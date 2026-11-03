const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { sendPushToUser } = require('./fcm');
const { sendEventReminderEmail } = require('./email');
const { getEventStartAt } = require('../utils/event-time');

// ─── Notification Templates ───────────────────────────────────────────────────
const REMINDER_INTERVALS = [
  { offsetHours: 24, label: '24h',  title: '📅 Event Tomorrow!', bodyFn: (e) => `You have "${e.name}" at ${e.location} tomorrow. Report at ${e.reportTime}.` },
  { offsetHours: 12, label: '12h',  title: '⏰ 12 Hours to Go!',  bodyFn: (e) => `"${e.name}" is in 12 hours. Get ready! Report at ${e.reportTime} at ${e.location}.` },
  { offsetHours: 2,  label: '2h',   title: '🔔 2 Hours Left!',    bodyFn: (e) => `"${e.name}" starts soon! Head to ${e.location} by ${e.reportTime}.` },
  { offsetHours: 1,  label: '1h',   title: '⏳ 1 Hour Until Your Site', bodyFn: (e) => `Your site "${e.name}" starts in 1 hour. Report at ${e.reportTime} at ${e.location}.` },
  { offsetHours: 0.5,label: '30m',  title: '🚨 Report in 30 Min!', bodyFn: (e) => `Time to go! Report to ${e.location} in 30 minutes for "${e.name}".` },
];

/**
 * Schedule FCM notifications for a given event.
 * Call this when an event is published OR when a new booking is made.
 *
 * @param {Object} event - The event object (must have id, name, date, reportTime, location)
 * @param {string[]} [userIds] - If provided, only schedule for these users. Otherwise, all confirmed bookings.
 */
async function scheduleEventNotifications(event, userIds = null) {
  try {
    // Event dates and report times are entered in India local time.
    const reportDateTime = getEventStartAt(event.date, event.reportTime);
    if (!reportDateTime) return;

    // Determine which users to schedule for
    let targetUserIds = userIds;
    if (!targetUserIds) {
      const bookings = await prisma.booking.findMany({
        where: { eventId: event.id, status: 'confirmed' },
        select: { userId: true },
      });
      targetUserIds = bookings.map(b => b.userId);
    }

    if (targetUserIds.length === 0) return;

    // Create notification records for each reminder interval
    for (const interval of REMINDER_INTERVALS) {
      const scheduledAt = new Date(reportDateTime.getTime() - interval.offsetHours * 60 * 60 * 1000);
      let notification = await prisma.notification.findFirst({
        where: { eventId: event.id, title: interval.title },
      });

      if (scheduledAt <= new Date()) {
        if (notification) {
          await prisma.notification.update({ where: { id: notification.id }, data: { isSent: true, sentAt: new Date() } });
          await prisma.userNotification.updateMany({ where: { notificationId: notification.id, isSent: false }, data: { isSent: true, sentAt: new Date() } });
        }
        continue;
      }

      if (!notification) {
        notification = await prisma.notification.create({
          data: {
            eventId: event.id,
            title: interval.title,
            body: interval.bodyFn(event),
            scheduledAt,
          },
        });
      } else {
        notification = await prisma.notification.update({
          where: { id: notification.id },
          data: { body: interval.bodyFn(event), scheduledAt, isSent: false, sentAt: null },
        });
      }

      // Create UserNotification records for each target user
      for (const userId of targetUserIds) {
        await prisma.userNotification.upsert({
          where: { userId_notificationId: { userId, notificationId: notification.id } },
          create: { userId, notificationId: notification.id },
          update: { isSent: false, sentAt: null },
        });
      }
    }

    console.log(`[Scheduler] Scheduled reminders for event ${event.id} (${targetUserIds.length} recipients).`);
  } catch (err) {
    console.error('[Scheduler] Could not schedule event reminders:', err.name || 'Error');
  }
}

// ─── Cron Job — runs every minute ──────────────────────────────────────────────
// Checks for any notifications due in the next minute and sends them
function startNotificationScheduler() {
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000);

    // Find unsent notifications due now
    const pendingUserNotifications = await prisma.userNotification.findMany({
      where: {
        isSent: false,
        notification: {
          isSent: false,
          scheduledAt: { gte: now, lte: oneMinuteFromNow },
        },
      },
      include: {
        notification: {
          select: {
            title: true, body: true, eventId: true,
            event: { select: { name: true, location: true, reportTime: true } },
          },
        },
        user: { select: { fcmToken: true, name: true, email: true } },
      },
    });

    if (pendingUserNotifications.length === 0) return;

    console.log(`[Scheduler] Sending ${pendingUserNotifications.length} notifications...`);

    for (const un of pendingUserNotifications) {
      if (un.user.fcmToken) {
        try {
          await sendPushToUser(
            un.user.fcmToken,
            un.notification.title,
            un.notification.body,
            { eventId: un.notification.eventId }
          );
        } catch {
          console.error('[Scheduler] Push reminder could not be delivered.');
        }
      }
      if (un.user.email && process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
        try {
          await sendEventReminderEmail(un.user.email, un.notification.event, un.notification.title, un.notification.body);
        } catch {
          console.error('[Scheduler] Email reminder could not be delivered.');
        }
      }

      await prisma.userNotification.update({
        where: { id: un.id },
        data: { isSent: true, sentAt: new Date() },
      });
    }

    // Mark parent notifications as sent if all user notifications are sent
    const notifIds = [...new Set(pendingUserNotifications.map(un => un.notificationId))];
    for (const notifId of notifIds) {
      const unsent = await prisma.userNotification.count({
        where: { notificationId: notifId, isSent: false },
      });
      if (unsent === 0) {
        await prisma.notification.update({
          where: { id: notifId },
          data: { isSent: true, sentAt: new Date() },
        });
      }
    }
  } catch (err) {
    console.error('[Scheduler] Reminder job failed:', err.name || 'Error');
  }
});

console.log('✅ Notification scheduler started (runs every minute)');
}

module.exports = { scheduleEventNotifications, startNotificationScheduler };
