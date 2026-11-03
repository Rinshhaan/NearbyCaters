const express = require('express');
const Razorpay = require('razorpay');
const { authenticate, requireRole, requireApprovedClient } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { verifyRazorpaySignature } = require('../utils/event-validation');
const { paymentLimiter } = require('../middleware/rate-limit');

const router = express.Router();

const createRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const error = new Error('Payment processing is not configured');
    error.status = 503;
    throw error;
  }
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
};

/**
 * POST /api/v1/payments/create-order
 * Client initiates Razorpay payment for an event's boys
 */
router.post('/create-order',
  authenticate, requireApprovedClient, paymentLimiter,
  async (req, res, next) => {
    try {
      const { eventId } = req.body;

      const payment = await prisma.payment.findUnique({
        where: { eventId },
        include: { event: { select: { name: true, clientId: true } } },
      });

      if (!payment) return res.status(404).json({ error: 'Payment not found. Close bookings first.' });
      if (payment.clientId !== req.user.id) return res.status(403).json({ error: 'Not your payment' });
      if (payment.status === 'paid') return res.status(400).json({ error: 'Already paid' });

      // Create Razorpay order
      const order = await createRazorpay().orders.create({
        amount: payment.totalAmount, // already in paise
        currency: 'INR',
        receipt: `nearme_${payment.id}`,
        notes: {
          eventId,
          eventName: payment.event.name,
          boysCount: payment.boysCount,
          clientId: req.user.id,
        },
      });

      // Save order ID
      await prisma.payment.update({
        where: { id: payment.id },
        data: { razorpayOrderId: order.id },
      });

      res.json({
        orderId: order.id,
        amount: payment.totalAmount,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
        paymentId: payment.id,
        description: `NearMe Catering — ${payment.boysCount} boys × ₹${payment.ratePerBoy}`,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/payments/verify
 * Verify Razorpay signature after payment
 */
router.post('/verify',
  authenticate, requireApprovedClient, paymentLimiter,
  async (req, res, next) => {
    try {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentId } = req.body;

      if (typeof paymentId !== 'string' || typeof razorpayOrderId !== 'string' || typeof razorpayPaymentId !== 'string') {
        return res.status(400).json({ error: 'Payment details are incomplete' });
      }
      if (!process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ error: 'Payment verification is not configured' });
      if (!verifyRazorpaySignature(process.env.RAZORPAY_KEY_SECRET, razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
        return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
      }

      const existingPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (!existingPayment) return res.status(404).json({ error: 'Payment record not found' });
      if (existingPayment.clientId !== req.user.id) return res.status(403).json({ error: 'Not your payment' });
      if (!existingPayment.razorpayOrderId || existingPayment.razorpayOrderId !== razorpayOrderId) {
        return res.status(400).json({ error: 'Payment order does not match this event payment' });
      }
      if (existingPayment.status === 'paid') {
        if (existingPayment.razorpayPaymentId !== razorpayPaymentId) return res.status(409).json({ error: 'A different payment has already been recorded' });
        return res.json({ message: 'Payment already verified', payment: { id: existingPayment.id, eventId: existingPayment.eventId, status: existingPayment.status, paidAt: existingPayment.paidAt } });
      }

      const paidAt = new Date();
      const payment = await prisma.$transaction(async (tx) => {
        const claimed = await tx.payment.updateMany({
          where: { id: paymentId, clientId: req.user.id, status: 'pending', razorpayOrderId },
          data: { status: 'paid', razorpayPaymentId, paidAt },
        });
        if (claimed.count !== 1) {
          const latest = await tx.payment.findUnique({ where: { id: paymentId } });
          if (latest?.status === 'paid' && latest.razorpayPaymentId === razorpayPaymentId) return latest;
          const conflict = new Error('Payment state changed before verification completed');
          conflict.status = 409;
          throw conflict;
        }
        await tx.booking.updateMany({ where: { eventId: existingPayment.eventId, status: 'confirmed' }, data: { isPaid: true } });
        await tx.event.update({ where: { id: existingPayment.eventId }, data: { status: 'completed' } });
        return tx.payment.findUnique({ where: { id: paymentId } });
      });

      res.json({
        message: 'Payment successful! Event marked as completed.',
        payment: { id: payment.id, eventId: payment.eventId, status: payment.status, paidAt: payment.paidAt },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/payments/mine
 * Client gets their payment history
 */
router.get('/mine',
  authenticate, requireApprovedClient,
  async (req, res, next) => {
    try {
      const payments = await prisma.payment.findMany({
        where: { clientId: req.user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, eventId: true, boysCount: true, ratePerBoy: true,
          totalAmount: true, status: true, paidAt: true, createdAt: true,
          event: { select: { name: true, date: true, location: true } },
        },
      });
      res.json(payments);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/payments/:eventId
 * Get payment status for a specific event (client or admin)
 */
router.get('/:eventId',
  authenticate, requireRole('admin', 'client'),
  async (req, res, next) => {
    try {
      const payment = await prisma.payment.findUnique({
        where: { eventId: req.params.eventId },
        select: {
          id: true, eventId: true, clientId: true, boysCount: true, ratePerBoy: true,
          totalAmount: true, status: true, paidAt: true, createdAt: true,
          event: { select: { name: true, date: true, clientId: true } },
        },
      });

      if (!payment) return res.status(404).json({ error: 'No payment found for this event' });

      if (req.user.role === 'client' && payment.clientId !== req.user.id) {
        return res.status(403).json({ error: 'Not your payment' });
      }

      const publicPayment = { ...payment };
      delete publicPayment.clientId;
      res.json(publicPayment);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
