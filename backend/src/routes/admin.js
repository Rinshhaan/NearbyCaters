const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { scheduleEventNotifications } = require('../services/scheduler');
const { normalizeMapUrl, isSafeImageUrl } = require('../utils/event-validation');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireRole('admin'));

// ─── DASHBOARD STATS ───────────────────────────────────────────────────────────
// GET /api/v1/admin/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const [
      totalClients,
      pendingClients,
      totalUsers,
      totalEvents,
      activeEvents,
      totalBookings,
      totalRevenue,
      pendingPayments,
      recentEvents,
    ] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { isApproved: false } }),
      prisma.user.count(),
      prisma.event.count(),
      prisma.event.count({ where: { status: { in: ['published', 'booking_closed'] } } }),
      prisma.booking.count({ where: { status: 'confirmed' } }),
      prisma.payment.aggregate({
        where: { status: 'paid' },
        _sum: { totalAmount: true },
      }),
      prisma.payment.count({ where: { status: 'pending' } }),
      prisma.event.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { name: true, companyName: true } },
          _count: { select: { bookings: { where: { status: 'confirmed' } } } },
        },
      }),
    ]);

    res.json({
      stats: {
        totalClients,
        pendingClients,
        totalUsers,
        totalEvents,
        activeEvents,
        totalBookings,
        totalRevenue: (totalRevenue._sum.totalAmount || 0) / 100, // convert paise to ₹
        pendingPayments,
      },
      recentEvents,
    });
  } catch (err) {
    next(err);
  }
});

// ─── CLIENT MANAGEMENT ─────────────────────────────────────────────────────────
// GET /api/v1/admin/clients
router.get('/clients', async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedPage) || parsedPage < 1 || parsedPage > 100000 || !Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ error: 'page must be positive and limit must be between 1 and 100' });
    }
    if (search && String(search).length > 100) return res.status(400).json({ error: 'Search text is too long' });
    const skip = (parsedPage - 1) * parsedLimit;

    const where = {};
    if (status === 'pending') where.isApproved = false;
    if (status === 'approved') where.isApproved = true;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { companyName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: parsedLimit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, companyName: true, email: true, phone: true,
          isApproved: true, isActive: true, notes: true, createdAt: true,
          logoUrl: true, bannerUrl: true, rating: true, ratingCount: true,
          _count: { select: { events: true } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    res.json({ clients, total, page: parsedPage, totalPages: Math.ceil(total / parsedLimit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/clients/:id
router.get('/clients/:id', async (req, res, next) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, clientId: true, name: true, description: true, location: true,
            locationMapUrl: true, imageUrl: true, date: true, reportTime: true,
            slotsNeeded: true, timerEnd: true, status: true, createdAt: true, updatedAt: true,
            _count: { select: { bookings: { where: { status: 'confirmed' } } } },
            payment: { select: { id: true, eventId: true, boysCount: true, ratePerBoy: true, totalAmount: true, status: true, paidAt: true, createdAt: true } },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, eventId: true, boysCount: true, ratePerBoy: true, totalAmount: true, status: true, paidAt: true, createdAt: true },
        },
      },
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    const { passwordHash, tokenVersion, ...safeClient } = client;
    res.json(safeClient);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/clients/:id/approve
router.patch('/clients/:id/approve', async (req, res, next) => {
  try {
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { isApproved: true, isActive: true },
      select: { id: true, name: true, email: true, isApproved: true },
    });
    res.json({ message: 'Client approved successfully', client });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/clients/:id/reject
router.patch('/clients/:id/reject', async (req, res, next) => {
  try {
    const { notes } = req.body;
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { isApproved: false, isActive: false, notes },
      select: { id: true, name: true, email: true, isApproved: true },
    });
    res.json({ message: 'Client rejected', client });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/clients/:id/notes
router.patch('/clients/:id/notes', async (req, res, next) => {
  try {
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { notes: req.body.notes },
    });
    res.json({ message: 'Notes updated', client });
  } catch (err) {
    next(err);
  }
});

// ─── USER (BOY) MANAGEMENT ─────────────────────────────────────────────────────
// GET /api/v1/admin/users
router.get('/users', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedPage) || parsedPage < 1 || parsedPage > 100000 || !Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ error: 'page must be positive and limit must be between 1 and 100' });
    }
    if (search && String(search).length > 100) return res.status(400).json({ error: 'Search text is too long' });
    const skip = (parsedPage - 1) * parsedLimit;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { place: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parsedLimit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, phone: true, email: true, place: true,
          isActive: true, createdAt: true, avatarUrl: true,
          rating: true, ratingCount: true,
          _count: { select: { bookings: { where: { status: 'confirmed' } } } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page: parsedPage, totalPages: Math.ceil(total / parsedLimit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/users/:id
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' },
          include: { event: { select: { name: true, date: true, location: true } } },
        },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Remove sensitive field
    const { pinHash, passwordHash, tokenVersion, fcmToken, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/users/:id — edit staff contact/profile details
router.patch('/users/:id', async (req, res, next) => {
  try {
    const { name, place, phone, email } = req.body;
    const data = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
        return res.status(422).json({ error: 'Name must be between 2 and 100 characters' });
      }
      data.name = name.trim();
    }
    if (place !== undefined) {
      if (typeof place !== 'string' || place.trim().length < 2 || place.trim().length > 120) {
        return res.status(422).json({ error: 'Place must be between 2 and 120 characters' });
      }
      data.place = place.trim();
    }
    if (phone !== undefined) {
      const normalizedPhone = String(phone).replace(/\D/g, '');
      if (normalizedPhone && !/^[6-9]\d{9}$/.test(normalizedPhone)) {
        return res.status(422).json({ error: 'Enter a valid 10-digit Indian mobile number' });
      }
      data.phone = normalizedPhone || null;
    }
    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(422).json({ error: 'Enter a valid email address' });
      }
      data.email = normalizedEmail || null;
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Provide at least one profile field to update' });

    const current = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, phone: true, email: true } });
    if (!current) return res.status(404).json({ error: 'User not found' });
    const nextPhone = data.phone !== undefined ? data.phone : current.phone;
    const nextEmail = data.email !== undefined ? data.email : current.email;
    if (!nextPhone && !nextEmail) return res.status(422).json({ error: 'Keep at least one mobile number or email address on the account' });

    const uniqueValues = [];
    if (data.phone) uniqueValues.push({ phone: data.phone });
    if (data.email) uniqueValues.push({ email: data.email });
    if (uniqueValues.length) {
      const conflict = await prisma.user.findFirst({ where: { OR: uniqueValues, NOT: { id: req.params.id } }, select: { id: true } });
      if (conflict) return res.status(409).json({ error: 'That mobile number or email is already used by another staff account' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, phone: true, email: true, place: true, isActive: true, rating: true, ratingCount: true },
    });
    res.json({ message: 'Staff profile updated', user });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/users/:id/toggle-block — block/unblock and revoke active sessions
router.patch('/users/:id/toggle-block', async (req, res, next) => {
  try {
    const current = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, isActive: true } });
    if (!current) return res.status(404).json({ error: 'User not found' });
    const user = await prisma.user.update({
      where: { id: current.id },
      data: { isActive: !current.isActive, tokenVersion: { increment: 1 } },
      select: { id: true, name: true, isActive: true },
    });
    res.json({ message: user.isActive ? 'Staff account unblocked' : 'Staff account blocked', user });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/admin/users/:id — permanently remove a staff account and personal booking records
router.delete('/users/:id', async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!user) return { error: 'User not found', status: 404 };

      const confirmedCounts = await tx.booking.groupBy({
        by: ['eventId'],
        where: { userId: user.id, status: 'confirmed' },
        _count: { _all: true },
      });
      for (const item of confirmedCounts) {
        const event = await tx.event.findUnique({ where: { id: item.eventId }, select: { id: true, reservedSlots: true } });
        if (!event || event.reservedSlots < item._count._all) {
          return { error: 'Could not safely release this staff member’s event slots. Refresh and retry.', status: 409 };
        }
      }

      for (const item of confirmedCounts) {
        await tx.event.update({
          where: { id: item.eventId },
          data: { reservedSlots: { decrement: item._count._all } },
        });
      }
      await tx.userNotification.deleteMany({ where: { userId: user.id } });
      await tx.passwordReset.deleteMany({ where: { role: 'user', accountId: user.id } });
      await tx.booking.updateMany({ where: { bookedByUserId: user.id }, data: { bookedByUserId: null } });
      await tx.booking.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
      return { message: 'Staff account and its booking history deleted' };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ message: result.message });
  } catch (err) {
    next(err);
  }
});

// ─── REVENUE / PAYMENTS ────────────────────────────────────────────────────────
// GET /api/v1/admin/revenue
router.get('/revenue', async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, eventId: true, clientId: true, boysCount: true, ratePerBoy: true,
        totalAmount: true, status: true, paidAt: true, createdAt: true,
        client: { select: { name: true, companyName: true } },
        event: { select: { name: true, date: true } },
      },
    });

    const totalRevenue = payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.totalAmount, 0) / 100;

    const pendingRevenue = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.totalAmount, 0) / 100;

    res.json({ payments, totalRevenue, pendingRevenue });
  } catch (err) {
    next(err);
  }
});

// ─── ADMIN SETTINGS ────────────────────────────────────────────────────────────
// GET /api/v1/admin/settings
router.get('/settings', async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, ratePerBoy: true },
    });
    res.json(admin);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/settings
router.patch('/settings', async (req, res, next) => {
  try {
    const { ratePerBoy, name } = req.body;
    const data = {};
    if (ratePerBoy !== undefined) data.ratePerBoy = Number(ratePerBoy);
    if (name) data.name = name;

    const admin = await prisma.admin.update({
      where: { id: req.user.id },
      data,
      select: { id: true, name: true, email: true, ratePerBoy: true },
    });
    res.json({ message: 'Settings updated', admin });
  } catch (err) {
    next(err);
  }
});

// ─── ADMIN: TOGGLE CLIENT BLOCK ────────────────────────────────────────────────
// PATCH /api/v1/admin/clients/:id/toggle-block
router.patch('/clients/:id/toggle-block', async (req, res, next) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    const updated = await prisma.client.update({
      where: { id: req.params.id },
      data: { isActive: !client.isActive },
      select: { id: true, name: true, isActive: true },
    });
    res.json({ message: updated.isActive ? 'Client unblocked' : 'Client blocked', client: updated });
  } catch (err) { next(err); }
});

// DELETE /api/v1/admin/clients/:id — hard delete client + cascade events/bookings
router.delete('/clients/:id', async (req, res, next) => {
  try {
    const events = await prisma.event.findMany({ where: { clientId: req.params.id }, select: { id: true } });
    const eventIds = events.map(e => e.id);
    await prisma.$transaction([
      prisma.booking.deleteMany({ where: { eventId: { in: eventIds } } }),
      prisma.payment.deleteMany({ where: { eventId: { in: eventIds } } }),
      prisma.event.deleteMany({ where: { clientId: req.params.id } }),
      prisma.client.delete({ where: { id: req.params.id } }),
    ]);
    res.json({ message: 'Client and all their data removed' });
  } catch (err) { next(err); }
});

// PATCH /api/v1/admin/clients/:id/rating — set client star rating
router.patch('/clients/:id/rating', async (req, res, next) => {
  try {
    const { rating } = req.body;
    const r = Math.min(5, Math.max(0, Number(rating)));
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { rating: r },
      select: { id: true, name: true, rating: true },
    });
    res.json({ message: 'Rating updated', client });
  } catch (err) { next(err); }
});

// PATCH /api/v1/admin/users/:id/rating — set boy (user) rating
router.patch('/users/:id/rating', async (req, res, next) => {
  try {
    const { rating } = req.body;
    const r = Math.min(5, Math.max(0, Number(rating)));
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { rating: r },
      select: { id: true, name: true, rating: true },
    });
    res.json({ message: 'Rating updated', user });
  } catch (err) { next(err); }
});

// GET /api/v1/admin/clients/:id/events — list all events for a client
router.get('/clients/:id/events', async (req, res, next) => {
  try {
    const events = await prisma.event.findMany({
      where: { clientId: req.params.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, clientId: true, name: true, description: true, location: true,
        locationMapUrl: true, imageUrl: true, date: true, reportTime: true,
        slotsNeeded: true, timerEnd: true, status: true, createdAt: true, updatedAt: true,
        _count: { select: { bookings: { where: { status: 'confirmed' } } } },
        payment: { select: { id: true, eventId: true, boysCount: true, ratePerBoy: true, totalAmount: true, status: true, paidAt: true, createdAt: true } },
      },
    });
    res.json(events);
  } catch (err) { next(err); }
});

// PATCH /api/v1/admin/events/:eventId — admin edit any event
router.patch('/events/:eventId', async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const { name, description, location, locationMapUrl, date, reportTime, slotsNeeded, timerEnd, imageUrl, status } = req.body;
    const mapUrl = locationMapUrl === undefined ? undefined : normalizeMapUrl(locationMapUrl);
    if (mapUrl === undefined && locationMapUrl !== undefined) return res.status(422).json({ error: 'Use a secure Google Maps link or leave the map field empty' });
    if (imageUrl !== undefined && !isSafeImageUrl(imageUrl)) return res.status(422).json({ error: 'Use a secure direct image address or upload an image' });
    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 120)) return res.status(422).json({ error: 'Event name must be 3 to 120 characters' });
    if (location !== undefined && (typeof location !== 'string' || location.trim().length < 3 || location.trim().length > 240)) return res.status(422).json({ error: 'Location must be 3 to 240 characters' });
    if (description !== undefined && description != null && (typeof description !== 'string' || description.length > 3000)) return res.status(422).json({ error: 'Description must be at most 3000 characters' });
    if (date !== undefined && (typeof date !== 'string' || Number.isNaN(new Date(date).getTime()))) return res.status(422).json({ error: 'Invalid event date' });
    if (reportTime !== undefined && (typeof reportTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reportTime))) return res.status(422).json({ error: 'Report time must use 24-hour HH:MM format' });
    if (slotsNeeded !== undefined && slotsNeeded !== null && slotsNeeded !== '' && (!Number.isInteger(Number(slotsNeeded)) || Number(slotsNeeded) < 1 || Number(slotsNeeded) > 10000)) return res.status(422).json({ error: 'Slots needed must be a whole number between 1 and 10000' });
    if (timerEnd !== undefined && timerEnd !== null && timerEnd !== '' && (typeof timerEnd !== 'string' || Number.isNaN(new Date(timerEnd).getTime()))) return res.status(422).json({ error: 'Invalid booking deadline' });
    if (status !== undefined && !['draft', 'published', 'booking_closed', 'cancelled', 'completed'].includes(status)) return res.status(422).json({ error: 'Invalid event status' });
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (location !== undefined) data.location = location.trim();
    if (locationMapUrl !== undefined) data.locationMapUrl = mapUrl;
    if (date !== undefined) data.date = new Date(date);
    if (reportTime !== undefined) data.reportTime = reportTime;
    if (slotsNeeded !== undefined) data.slotsNeeded = slotsNeeded ? Number(slotsNeeded) : null;
    if (timerEnd !== undefined) data.timerEnd = timerEnd ? new Date(timerEnd) : null;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (status !== undefined) data.status = status;
    const updated = await prisma.event.update({ where: { id: req.params.eventId }, data });
    if (updated.status === 'published') await scheduleEventNotifications(updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/v1/admin/events/:eventId — admin force delete any event
router.delete('/events/:eventId', async (req, res, next) => {
  try {
    await prisma.$transaction([
      prisma.booking.deleteMany({ where: { eventId: req.params.eventId } }),
      prisma.payment.deleteMany({ where: { eventId: req.params.eventId } }),
      prisma.event.delete({ where: { id: req.params.eventId } }),
    ]);
    res.json({ message: 'Event force deleted' });
  } catch (err) { next(err); }
});

// ─── ADMIN: PER-EVENT FINANCIAL SUMMARY ────────────────────────────────────────
// GET /api/v1/admin/events/:eventId/roster
router.get('/events/:eventId/roster', async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      select: {
        id: true, name: true, location: true, date: true, reportTime: true,
        client: { select: { id: true, name: true, companyName: true } },
        bookings: {
          where: { status: 'confirmed' },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, attended: true, attendanceTime: true, arrivalTime: true,
            leavingTime: true, notes: true, fine: true, uniform: true, staffPaid: true,
            user: { select: { id: true, name: true, phone: true, email: true, place: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) { next(err); }
});

// GET /api/v1/admin/events/:eventId/financial
router.get('/events/:eventId/financial', async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      include: {
        client: { select: { id: true, name: true, companyName: true } },
        payment: { select: { id: true, eventId: true, boysCount: true, ratePerBoy: true, totalAmount: true, status: true, paidAt: true, createdAt: true } },
        _count: { select: { bookings: { where: { status: 'confirmed' } } } },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const bookings = await prisma.booking.findMany({
      where: { eventId: req.params.eventId, status: 'confirmed' },
      include: { user: { select: { id: true, name: true, phone: true, place: true } } },
    });

    const ratePerBoy = event.payment?.ratePerBoy ?? 20; // default ₹20/boy
    const bookedCount = bookings.length;
    const attendedCount = bookings.filter(b => b.attended).length;
    const paidCount = bookings.filter(b => b.staffPaid).length;
    const unpaidCount = attendedCount - paidCount;

    const wagesByAttendance = attendedCount * ratePerBoy;
    const wagesByBooked = bookedCount * ratePerBoy;

    res.json({
      eventId: event.id,
      eventName: event.name,
      location: event.location,
      date: event.date,
      client: event.client,
      ratePerBoy,
      bookedCount,
      attendedCount,
      paidCount,
      unpaidCount,
      wagesByAttendance,
      wagesByBooked,
      payment: event.payment,
      bookings: bookings.map(b => ({
        id: b.id,
        user: b.user,
        attended: b.attended,
        staffPaid: b.staffPaid,
        arrivalTime: b.arrivalTime,
        leavingTime: b.leavingTime,
        notes: b.notes,
        fine: b.fine,
        uniform: b.uniform,
      })),
    });
  } catch (err) { next(err); }
});

// ─── ADMIN: LIST ALL EVENTS WITH FINANCIAL SUMMARY ─────────────────────────────
// GET /api/v1/admin/events
router.get('/events', async (req, res, next) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { date: 'desc' },
      include: {
        client: { select: { id: true, name: true, companyName: true } },
        payment: { select: { id: true, eventId: true, boysCount: true, ratePerBoy: true, totalAmount: true, status: true, paidAt: true, createdAt: true } },
        _count: { select: { bookings: { where: { status: 'confirmed' } } } },
      },
    });

    // For each event, count attended
    const eventIds = events.map(e => e.id);
    const attendedCounts = await prisma.booking.groupBy({
      by: ['eventId'],
      where: { eventId: { in: eventIds }, status: 'confirmed', attended: true },
      _count: { id: true },
    });
    const attendedMap = {};
    attendedCounts.forEach(a => { attendedMap[a.eventId] = a._count.id; });

    const result = events.map(e => ({
      id: e.id,
      name: e.name,
      location: e.location,
      date: e.date,
      status: e.status,
      client: e.client,
      bookedCount: e._count.bookings,
      attendedCount: attendedMap[e.id] ?? 0,
      ratePerBoy: e.payment?.ratePerBoy ?? 20,
      payment: e.payment,
    }));

    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
