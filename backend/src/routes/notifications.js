const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendPushToUser, sendPushToMultipleUsers } = require('../services/fcm');
const prisma = require('../lib/prisma');

const router = express.Router();

/**
 * POST /api/v1/notifications/send
 * Admin sends a manual push notification to all users of an event (or all users)
 */
router.post('/send',
  authenticate, requireRole('admin'),
  async (req, res, next) => {
    try {
      const { title, body, eventId, targetAll } = req.body;

      if (!title || !body) {
        return res.status(400).json({ error: 'title and body are required' });
      }

      let userIds = [];

      if (targetAll) {
        // Send to all active users who have FCM tokens
        const users = await prisma.user.findMany({
          where: { isActive: true, fcmToken: { not: null } },
          select: { id: true, fcmToken: true },
        });
        userIds = users.map(u => u.id);
        const tokens = users.map(u => u.fcmToken);
        await sendPushToMultipleUsers(tokens, title, body);
      } else if (eventId) {
        // Send to users booked for this event
        const bookings = await prisma.booking.findMany({
          where: { eventId, status: 'confirmed' },
          include: { user: { select: { id: true, fcmToken: true } } },
        });
        const tokens = bookings.map(b => b.user.fcmToken).filter(Boolean);
        userIds = bookings.map(b => b.user.id);
        if (tokens.length > 0) {
          await sendPushToMultipleUsers(tokens, title, body);
        }
      } else {
        return res.status(400).json({ error: 'Provide eventId or targetAll=true' });
      }

      res.json({
        message: `Notification sent to ${userIds.length} users`,
        count: userIds.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/notifications/scheduled
 * Admin views all scheduled notifications
 */
router.get('/scheduled',
  authenticate, requireRole('admin'),
  async (req, res, next) => {
    try {
      const notifications = await prisma.notification.findMany({
        orderBy: { scheduledAt: 'asc' },
        include: {
          event: { select: { name: true, date: true } },
          _count: { select: { userNotifications: true } },
        },
      });
      res.json(notifications);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
