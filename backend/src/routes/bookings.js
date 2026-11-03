const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { scheduleEventNotifications } = require('../services/scheduler');
const { sendBookingConfirmationEmail } = require('../services/email');
const { bookingLimiter } = require('../middleware/rate-limit');
const { reserveEventSlots } = require('../utils/booking-capacity');
const { getEventStartAt } = require('../utils/event-time');

const router = express.Router();

// Strict Indian 10-digit mobile number validation (starts with 6, 7, 8, 9)
const isValidIndianPhone = (phone) => /^[6-9]\d{9}$/.test(String(phone).trim());

/**
 * POST /api/v1/bookings
 * User books an event slot for themselves, OR a group booking for themselves + friends
 * Body:
 *   - eventId: string
 *   - members?: Array<{ name: string, phone: string }>
 */
router.post('/',
  authenticate, requireRole('user'), bookingLimiter,
  async (req, res, next) => {
    try {
      const { eventId, members = [] } = req.body;
      if (typeof eventId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(eventId)) return res.status(400).json({ error: 'A valid eventId is required' });
      if (!Array.isArray(members) || members.length > 10) return res.status(400).json({ error: 'A group booking can include at most 10 additional people' });

      // Validate friends in group booking
      const validMembers = [];
      const seenPhones = new Set([req.user.phone]);

      if (members.length > 0) {
        for (let i = 0; i < members.length; i++) {
          const m = members[i];
          const name = String(m.name || '').trim();
          const phone = String(m.phone || '').trim();

          if (name.length < 2 || name.length > 100) {
            return res.status(400).json({ error: `Member #${i + 1} name must be 2 to 100 characters` });
          }
          if (!isValidIndianPhone(phone)) {
            return res.status(400).json({
              error: `Member #${i + 1} must have a valid 10-digit Indian mobile number`,
            });
          }
          if (seenPhones.has(phone)) {
            return res.status(400).json({
              error: 'Each member must have a unique mobile number',
            });
          }
          seenPhones.add(phone);
          validMembers.push({ name, phone });
        }
      }

      // Reserve capacity and write the whole group atomically. The event row
      // compare-and-set prevents concurrent requests from claiming the same slot.
      const bookingResult = await prisma.$transaction(async (tx) => {
        const now = new Date();
        const event = await tx.event.findUnique({ where: { id: eventId } });
        if (!event) return { error: 'Event not found', status: 404 };
        if (event.status !== 'published') return { error: 'This event is not open for bookings', status: 400 };
        if (event.timerEnd && now >= new Date(event.timerEnd)) return { error: 'Booking time for this event has expired', status: 400 };
        const siteStart = getEventStartAt(event.date, event.reportTime);
        if (!siteStart || now >= siteStart) return { error: 'This site has already started', status: 400 };

        const existingUserBooking = await tx.booking.findUnique({
          where: { eventId_userId: { eventId, userId: req.user.id } },
        });
        if (existingUserBooking?.status === 'confirmed') {
          return { error: 'You already have a confirmed booking for this event', status: 409 };
        }

        const friendStates = [];
        for (const member of validMembers) {
          const user = await tx.user.findUnique({ where: { phone: member.phone } });
          const existingBooking = user ? await tx.booking.findUnique({
            where: { eventId_userId: { eventId, userId: user.id } },
          }) : null;
          friendStates.push({ member, user, existingBooking });
        }

        const friendsToBook = friendStates.filter(({ existingBooking }) => existingBooking?.status !== 'confirmed');
        const slotsToReserve = 1 + friendsToBook.length;
        const remaining = event.slotsNeeded === null ? null : event.slotsNeeded - event.reservedSlots;
        if (remaining !== null && remaining < slotsToReserve) {
          return {
            error: remaining <= 0
              ? 'All slots for this event are full'
              : `Only ${remaining} slot${remaining === 1 ? '' : 's'} remaining, but you requested ${slotsToReserve}`,
            status: 400,
          };
        }
        if (!await reserveEventSlots(tx, event, slotsToReserve, now)) {
          return { error: 'Slots changed while you were booking. Please refresh and try again.', status: 409 };
        }

        const primaryBooking = existingUserBooking
          ? await tx.booking.update({
            where: { id: existingUserBooking.id },
            data: { status: 'confirmed' },
            include: { event: true, user: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
          })
          : await tx.booking.create({
            data: { eventId, userId: req.user.id, status: 'confirmed' },
            include: { event: true, user: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
          });
        const bookedUsers = [req.user.id];
        const friendBookings = [];

        for (const { member, user: existingUser, existingBooking } of friendsToBook) {
          const user = existingUser || await tx.user.create({
            data: { name: member.name, phone: member.phone, place: 'Kerala' },
          });
          const friendBooking = existingBooking
            ? await tx.booking.update({
              where: { id: existingBooking.id },
              data: { status: 'confirmed', bookedByUserId: req.user.id },
              include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
            })
            : await tx.booking.create({
              data: { eventId, userId: user.id, status: 'confirmed', bookedByUserId: req.user.id },
              include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
            });
          friendBookings.push(friendBooking);
          bookedUsers.push(user.id);
        }

        return { event, primaryBooking, friendBookings, bookedUsers };
      });

      if (bookingResult.error) return res.status(bookingResult.status).json({ error: bookingResult.error });
      const { event, primaryBooking, friendBookings, bookedUsers } = bookingResult;

      // Schedule FCM notifications for all booked members
      await scheduleEventNotifications(event, bookedUsers);
      if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
        const recipients = await prisma.user.findMany({
          where: { id: { in: bookedUsers }, email: { not: null } },
          select: { email: true },
        });
        for (const recipient of recipients) {
          try { await sendBookingConfirmationEmail(recipient.email, event); }
          catch { console.error('[Email] Booking confirmation could not be delivered.'); }
        }
      }

      res.status(201).json({
        message: validMembers.length > 0
          ? `Group booking confirmed! ${bookedUsers.length} new slots reserved for you and your friends.`
          : 'Booking confirmed!',
        booking: primaryBooking,
        groupBookings: friendBookings,
        totalBooked: bookedUsers.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/bookings/mine
 * Get all bookings for the logged-in user
 */
router.get('/mine',
  authenticate, requireRole('user'),
  async (req, res, next) => {
    try {
      const bookings = await prisma.booking.findMany({
        where: { userId: req.user.id, status: 'confirmed' },
        orderBy: { createdAt: 'desc' },
        include: {
          event: {
            select: {
              id: true, name: true, location: true, locationMapUrl: true,
              date: true, reportTime: true, imageUrl: true, status: true,
              client: { select: { id: true, name: true, companyName: true, logoUrl: true, rating: true, ratingCount: true } },
            },
          },
        },
      });
      res.json(bookings);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/bookings/:id
 * User cancels their own booking
 */
router.delete('/:id',
  authenticate, requireRole('user'),
  async (req, res, next) => {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: req.params.id },
          include: { event: { select: { status: true } } },
        });
        if (!booking) return { error: 'Booking not found', status: 404 };
        if (booking.userId !== req.user.id) return { error: 'Not your booking', status: 403 };
        if (booking.event.status === 'completed') return { error: 'Cannot cancel a completed event', status: 400 };
        if (booking.status !== 'confirmed') return { error: 'Booking is already cancelled', status: 409 };

        const updated = await tx.booking.updateMany({
          where: { id: req.params.id, userId: req.user.id, status: 'confirmed' },
          data: { status: 'cancelled' },
        });
        if (updated.count !== 1) return { error: 'Booking changed while cancelling. Refresh and try again.', status: 409 };

        const released = await tx.event.updateMany({
          where: { id: booking.eventId, reservedSlots: { gt: 0 } },
          data: { reservedSlots: { decrement: 1 } },
        });
        if (released.count !== 1) throw new Error('Confirmed booking slot counter is inconsistent');
        return { message: 'Booking cancelled' };
      });

      if (result.error) return res.status(result.status).json({ error: result.error });
      res.json({ message: result.message });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/bookings/:id/attendance
 * Client or admin updates attendance details (attended, arrival, leaving, notes, fines, staffPaid)
 */
router.patch('/:id/attendance',
  authenticate, requireRole('admin', 'client'),
  async (req, res, next) => {
    try {
      const { attended, arrivalTime, leavingTime, notes, fine, uniform, staffPaid } = req.body;
      if (attended !== undefined && typeof attended !== 'boolean') return res.status(422).json({ error: 'attended must be a boolean' });
      if (uniform !== undefined && typeof uniform !== 'boolean') return res.status(422).json({ error: 'uniform must be a boolean' });
      if (staffPaid !== undefined && typeof staffPaid !== 'boolean') return res.status(422).json({ error: 'staffPaid must be a boolean' });
      for (const [field, value, maxLength] of [['arrivalTime', arrivalTime, 40], ['leavingTime', leavingTime, 40], ['notes', notes, 1000], ['fine', fine, 200]]) {
        if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > maxLength)) return res.status(422).json({ error: `${field} must be text of at most ${maxLength} characters` });
      }
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: { event: { select: { clientId: true } } },
      });

      if (!booking) return res.status(404).json({ error: 'Booking not found' });

      if (req.user.role === 'client' && booking.event.clientId !== req.user.id) {
        return res.status(403).json({ error: 'Not your event' });
      }

      const data = {};
      if (attended !== undefined) {
        data.attended = attended;
        data.attendanceTime = attended ? (booking.attendanceTime || new Date()) : null;
      }
      if (arrivalTime !== undefined) data.arrivalTime = arrivalTime;
      if (leavingTime !== undefined) data.leavingTime = leavingTime;
      if (notes !== undefined) data.notes = notes;
      if (fine !== undefined) data.fine = fine;
      if (uniform !== undefined) data.uniform = Boolean(uniform);
      if (staffPaid !== undefined) data.staffPaid = Boolean(staffPaid);

      const updated = await prisma.booking.update({
        where: { id: req.params.id },
        data,
        include: {
          user: { select: { id: true, name: true, phone: true, place: true, avatarUrl: true } },
        },
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/bookings/:id/staff-paid
 * 1-click toggle for staff wage payment
 */
router.patch('/:id/staff-paid',
  authenticate, requireRole('admin', 'client'),
  async (req, res, next) => {
    try {
      const { staffPaid } = req.body;
      if (typeof staffPaid !== 'boolean') return res.status(422).json({ error: 'staffPaid must be a boolean' });
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: { event: { select: { clientId: true } } },
      });

      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      if (req.user.role === 'client' && booking.event.clientId !== req.user.id) {
        return res.status(403).json({ error: 'Not your event' });
      }

      const updated = await prisma.booking.update({
        where: { id: req.params.id },
        data: { staffPaid },
        include: {
          user: { select: { id: true, name: true, phone: true, place: true, avatarUrl: true } },
        },
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
