const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { authenticate, requireRole, requireApprovedClient } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { eventImageUpload, uploadBufferToCloudinary } = require('../services/cloudinary');
const { scheduleEventNotifications } = require('../services/scheduler');
const { normalizeMapUrl, isSafeImageUrl } = require('../utils/event-validation');
const { eventUploadLimiter } = require('../middleware/rate-limit');

const router = express.Router();

const generateAttendanceToken = () => crypto.randomBytes(16).toString('hex');

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES — no auth required
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events
 * Public list of published events (for user-app home page)
 */
router.get('/', async (req, res, next) => {
  try {
    const { search, date, archived = 'false', page = 1, limit = 12 } = req.query;
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedPage) || parsedPage < 1 || parsedPage > 100000 || !Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return res.status(400).json({ error: 'page must be a positive integer and limit must be between 1 and 50' });
    }
    if (search && String(search).length > 100) return res.status(400).json({ error: 'Search text is too long' });
    if (!['true', 'false'].includes(String(archived))) return res.status(400).json({ error: 'archived must be true or false' });
    const skip = (parsedPage - 1) * parsedLimit;
    const archiveCutoff = new Date();
    archiveCutoff.setUTCHours(0, 0, 0, 0);
    archiveCutoff.setUTCDate(archiveCutoff.getUTCDate() - 7);

    const searchWhere = {
      status: archived === 'true' ? { in: ['published', 'booking_closed', 'completed'] } : 'published',
    };

    if (search) {
      searchWhere.OR = [
        { name: { contains: search } },
        { location: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const archivedWhere = {
      ...searchWhere,
      status: { in: ['published', 'booking_closed', 'completed'] },
      date: { lt: archiveCutoff },
    };
    const dateBucketWhere = archived === 'true'
      ? archivedWhere
      : { ...searchWhere, date: { gte: archiveCutoff } };
    let where = dateBucketWhere;
    if (date) {
      const start = new Date(date);
      if (Number.isNaN(start.getTime())) return res.status(400).json({ error: 'Invalid date filter' });
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      where = { AND: [dateBucketWhere, { date: { gte: start, lt: end } }] };
    }

    const [events, total, admin, archivedTotal] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: parsedLimit,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true, name: true, description: true, location: true,
          date: true, reportTime: true, slotsNeeded: true, timerEnd: true,
          imageUrl: true, status: true, createdAt: true, updatedAt: true,
          client: { select: { id: true, name: true, companyName: true, logoUrl: true, rating: true, ratingCount: true } },
          _count: { select: { bookings: { where: { status: 'confirmed' } } } },
        },
      }),
      prisma.event.count({ where }),
      prisma.admin.findFirst({ select: { ratePerBoy: true } }),
      prisma.event.count({ where: archivedWhere }),
    ]);

    res.json({ events, total, page: parsedPage, totalPages: Math.ceil(total / parsedLimit), archivedTotal, platformFeePerConfirmedSlot: admin?.ratePerBoy ?? 20 });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/events/supervisor/:token
 * Public on-site attendance roster for head boys / supervisors (accessible via shared link)
 */
router.get('/supervisor/:token', async (req, res, next) => {
  try {
    const event = await prisma.event.findFirst({
      where: { attendanceToken: req.params.token },
      select: {
        id: true,
        name: true,
        location: true,
        locationMapUrl: true,
        date: true,
        reportTime: true,
        slotsNeeded: true,
        status: true,
        client: { select: { name: true, companyName: true, phone: true } },
        bookings: {
          where: { status: 'confirmed' },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            status: true,
            attended: true,
            attendanceTime: true,
            arrivalTime: true,
            leavingTime: true,
            notes: true,
            fine: true,
            staffPaid: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                place: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!event) return res.status(404).json({ error: 'Invalid or expired supervisor attendance link' });

    res.json(event);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/events/supervisor/:token/bookings/:bookingId
 * On-site supervisor marks attendance, arrival/leaving times, notes, fines
 */
router.patch('/supervisor/:token/bookings/:bookingId', async (req, res, next) => {
  try {
    const event = await prisma.event.findFirst({
      where: { attendanceToken: req.params.token },
      select: { id: true },
    });
    if (!event) return res.status(404).json({ error: 'Invalid supervisor link' });

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
    });
    if (!booking || booking.eventId !== event.id || booking.status !== 'confirmed') {
      return res.status(404).json({ error: 'Booking not found for this event' });
    }

    const { attended, arrivalTime, leavingTime, notes, fine } = req.body;
    if (attended !== undefined && typeof attended !== 'boolean') return res.status(422).json({ error: 'attended must be a boolean' });
    for (const [field, value, maxLength] of [['arrivalTime', arrivalTime, 40], ['leavingTime', leavingTime, 40], ['notes', notes, 1000], ['fine', fine, 200]]) {
      if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > maxLength)) return res.status(422).json({ error: `${field} must be text of at most ${maxLength} characters` });
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

    const updated = await prisma.booking.update({
      where: { id: req.params.bookingId },
      data,
      include: {
        user: { select: { id: true, name: true, phone: true, place: true, avatarUrl: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/events/:id
 * Get a single event (public)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, description: true, location: true, locationMapUrl: true,
        imageUrl: true, date: true, reportTime: true, slotsNeeded: true, timerEnd: true,
        status: true, createdAt: true, updatedAt: true,
        client: { select: { id: true, name: true, companyName: true, logoUrl: true, rating: true, ratingCount: true } },
        _count: { select: { bookings: { where: { status: 'confirmed' } } } },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.status === 'draft' || event.status === 'cancelled') {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/events/:id/attendance-link
 * Return a shareable attendance token only to the event owner or an admin.
 */
router.get('/:id/attendance-link', authenticate, requireRole('admin', 'client'), async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: { id: true, clientId: true, attendanceToken: true },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (req.user.role === 'client' && event.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Not your event' });
    }

    let attendanceToken = event.attendanceToken;
    if (!attendanceToken) {
      await prisma.event.updateMany({
        where: { id: event.id, attendanceToken: null },
        data: { attendanceToken: generateAttendanceToken() },
      });
      const refreshedEvent = await prisma.event.findUnique({
        where: { id: event.id },
        select: { attendanceToken: true },
      });
      attendanceToken = refreshedEvent?.attendanceToken;
    }
    if (!attendanceToken) return res.status(503).json({ error: 'Could not create an attendance link. Please try again.' });

    res.json({ attendanceToken });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/events/upload-image
 * Approved partners upload a validated event cover image.
 */
router.post('/upload-image', authenticate, requireApprovedClient, eventUploadLimiter, eventImageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose an image to upload' });
    const result = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname, 'nearme-catering/events', req.file.mimetype);
    res.status(201).json({ url: result.secure_url, resourceType: result.resource_type });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT ROUTES — require approved client
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/events/client/mine
 * Get all events for the logged-in client
 */
router.get('/client/mine',
  authenticate, requireApprovedClient,
  async (req, res, next) => {
    try {
      const events = await prisma.event.findMany({
        where: { clientId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { bookings: { where: { status: 'confirmed' } } } },
          bookings: {
            where: { status: 'confirmed' },
            select: { id: true, staffPaid: true },
          },
          payment: true,
        },
      });

      // Calculate allStaffPaid flag for each event
      const enrichedEvents = events.map(e => {
        const totalBooked = e._count?.bookings || 0;
        const allStaffPaid = totalBooked > 0 && e.bookings.every(b => b.staffPaid);
        return {
          ...e,
          allStaffPaid,
        };
      });

      res.json(enrichedEvents);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/events
 * Create new event (client only)
 */
router.post('/',
  authenticate, requireApprovedClient,
  body('name').trim().isLength({ min: 3, max: 120 }),
  body('location').trim().isLength({ min: 3, max: 240 }),
  body('description').optional({ nullable: true }).isString().isLength({ max: 3000 }),
  body('date').isISO8601(),
  body('reportTime').matches(/^\d{2}:\d{2}$/),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

      const {
        name, description, location, locationMapUrl,
        date, reportTime, slotsNeeded, timerEnd, imageUrl,
      } = req.body;

      const mapUrl = normalizeMapUrl(locationMapUrl);
      if (mapUrl === undefined) return res.status(422).json({ error: 'Use a secure Google Maps link or leave the map field empty' });
      if (!isSafeImageUrl(imageUrl)) return res.status(422).json({ error: 'Use a secure direct image address or upload an image' });
      const eventDate = new Date(date);
      if (Number.isNaN(eventDate.getTime())) return res.status(422).json({ error: 'Invalid event date' });
      if (timerEnd && Number.isNaN(new Date(timerEnd).getTime())) return res.status(422).json({ error: 'Invalid booking deadline' });
      const parsedSlots = slotsNeeded === '' || slotsNeeded == null ? null : Number(slotsNeeded);
      if (parsedSlots !== null && (!Number.isInteger(parsedSlots) || parsedSlots < 1 || parsedSlots > 10000)) {
        return res.status(422).json({ error: 'Slots needed must be a whole number between 1 and 10000' });
      }

      const event = await prisma.event.create({
        data: {
          clientId: req.user.id,
          name,
          description,
          location,
          locationMapUrl: mapUrl,
          date: eventDate,
          reportTime,
          slotsNeeded: parsedSlots,
          timerEnd: timerEnd ? new Date(timerEnd) : null,
          imageUrl: imageUrl || null,
          status: 'draft',
          attendanceToken: generateAttendanceToken(),
        },
      });

      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/events/:id
 * Update event
 */
router.patch('/:id',
  authenticate,
  requireRole('admin', 'client'),
  async (req, res, next) => {
    try {
      const event = await prisma.event.findUnique({ where: { id: req.params.id } });
      if (!event) return res.status(404).json({ error: 'Event not found' });

      if (req.user.role === 'client') {
        const client = await prisma.client.findUnique({
          where: { id: req.user.id },
          select: { isActive: true, isApproved: true },
        });
        if (!client || !client.isActive) {
          return res.status(403).json({
            error: 'Your account has been blocked by the admin. You cannot modify events until an admin unblocks your account.',
            code: 'ACCOUNT_BLOCKED',
          });
        }
        if (!client.isApproved) {
          return res.status(403).json({
            error: 'Your account is pending admin approval.',
            code: 'PENDING_APPROVAL',
          });
        }
        if (event.clientId !== req.user.id) {
          return res.status(403).json({ error: 'Not your event' });
        }

        // Attendance start time check: clients can only edit before attendance starts
        if (event.date && event.reportTime) {
          try {
            const match = event.reportTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (match) {
              let hours = parseInt(match[1], 10);
              const minutes = parseInt(match[2], 10);
              const meridiem = match[3]?.toUpperCase();
              if (meridiem === 'PM' && hours < 12) hours += 12;
              if (meridiem === 'AM' && hours === 12) hours = 0;

              const attendanceStart = new Date(event.date);
              attendanceStart.setHours(hours, minutes, 0, 0);

              if (new Date() >= attendanceStart) {
                return res.status(400).json({
                  error: 'Changes cannot be made after the starting time of attendance.',
                });
              }
            }
          } catch (e) {
            console.error('Error parsing attendance time:', e);
          }
        }
      }
      if (req.user.role === 'user') {
        return res.status(403).json({ error: 'Not allowed' });
      }

      const {
        name, description, location, locationMapUrl,
        date, reportTime, slotsNeeded, timerEnd, imageUrl, status,
      } = req.body;

      if (locationMapUrl !== undefined && normalizeMapUrl(locationMapUrl) === undefined) {
        return res.status(422).json({ error: 'Use a secure Google Maps link or leave the map field empty' });
      }
      if (imageUrl !== undefined && !isSafeImageUrl(imageUrl)) {
        return res.status(422).json({ error: 'Use a secure direct image address or upload an image' });
      }
      if (name !== undefined && (typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 120)) return res.status(422).json({ error: 'Event name must be 3 to 120 characters' });
      if (location !== undefined && (typeof location !== 'string' || location.trim().length < 3 || location.trim().length > 240)) return res.status(422).json({ error: 'Location must be 3 to 240 characters' });
      if (description !== undefined && description != null && (typeof description !== 'string' || description.length > 3000)) return res.status(422).json({ error: 'Description must be at most 3000 characters' });
      if (slotsNeeded !== undefined && slotsNeeded !== null && slotsNeeded !== '' && (!Number.isInteger(Number(slotsNeeded)) || Number(slotsNeeded) < 1 || Number(slotsNeeded) > 10000)) return res.status(422).json({ error: 'Slots needed must be a whole number between 1 and 10000' });
      if (date !== undefined && (typeof date !== 'string' || Number.isNaN(new Date(date).getTime()))) return res.status(422).json({ error: 'Invalid event date' });
      if (reportTime !== undefined && (typeof reportTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reportTime))) return res.status(422).json({ error: 'Report time must use 24-hour HH:MM format' });
      if (timerEnd !== undefined && timerEnd !== null && timerEnd !== '' && (typeof timerEnd !== 'string' || Number.isNaN(new Date(timerEnd).getTime()))) return res.status(422).json({ error: 'Invalid booking deadline' });
      if (status !== undefined && !['draft', 'published', 'booking_closed', 'cancelled', 'completed'].includes(status)) return res.status(422).json({ error: 'Invalid event status' });
      if (req.user.role === 'client' && status === 'completed') return res.status(403).json({ error: 'Only an admin can complete an event' });

      const data = {};
      if (name !== undefined) data.name = name.trim();
      if (description !== undefined) data.description = description?.trim() || null;
      if (location !== undefined) data.location = location.trim();
      if (locationMapUrl !== undefined) data.locationMapUrl = normalizeMapUrl(locationMapUrl);
      if (date !== undefined) data.date = new Date(date);
      if (reportTime !== undefined) data.reportTime = reportTime;
      if (slotsNeeded !== undefined) data.slotsNeeded = slotsNeeded ? Number(slotsNeeded) : null;
      if (timerEnd !== undefined) data.timerEnd = timerEnd ? new Date(timerEnd) : null;
      if (imageUrl !== undefined) data.imageUrl = imageUrl;
      if (status !== undefined) data.status = status;

      // Ensure event has attendanceToken
      if (!event.attendanceToken) {
        data.attendanceToken = generateAttendanceToken();
      }

      const updated = await prisma.event.update({
        where: { id: req.params.id },
        data,
      });

      if (updated.status === 'published') {
        await scheduleEventNotifications(updated);
      }

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/events/:id
 * Cancel event
 */
router.delete('/:id',
  authenticate,
  requireRole('admin', 'client'),
  async (req, res, next) => {
    try {
      const event = await prisma.event.findUnique({ where: { id: req.params.id } });
      if (!event) return res.status(404).json({ error: 'Event not found' });

      if (req.user.role === 'client' && event.clientId !== req.user.id) {
        return res.status(403).json({ error: 'Not your event' });
      }

      await prisma.event.update({
        where: { id: req.params.id },
        data: { status: 'cancelled' },
      });

      res.json({ message: 'Event cancelled' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/events/:id/bookings
 * Get all bookings for an event with user details and avatar photos
 */
router.get('/:id/bookings',
  authenticate, requireRole('admin', 'client'),
  async (req, res, next) => {
    try {
      const event = await prisma.event.findUnique({ where: { id: req.params.id } });
      if (!event) return res.status(404).json({ error: 'Event not found' });

      if (req.user.role === 'client' && event.clientId !== req.user.id) {
        return res.status(403).json({ error: 'Not your event' });
      }

      const bookings = await prisma.booking.findMany({
        where: { eventId: req.params.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              place: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json(bookings);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/events/:id/close-bookings
 * Client closes bookings
 */
router.post('/:id/close-bookings',
  authenticate, requireApprovedClient,
  async (req, res, next) => {
    try {
      const event = await prisma.event.findUnique({
        where: { id: req.params.id },
        include: {
          _count: { select: { bookings: { where: { status: 'confirmed' } } } },
          payment: true,
        },
      });

      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (event.clientId !== req.user.id) return res.status(403).json({ error: 'Not your event' });
      if (event.payment) return res.status(400).json({ error: 'Booking already closed and payment exists' });

      const boysCount = event._count.bookings;
      if (boysCount === 0) return res.status(400).json({ error: 'No confirmed bookings to close' });

      const admin = await prisma.admin.findFirst({ select: { ratePerBoy: true } });
      const rate = admin?.ratePerBoy || 20;
      const totalAmountPaise = boysCount * rate * 100;

      await prisma.$transaction([
        prisma.event.update({
          where: { id: req.params.id },
          data: { status: 'booking_closed' },
        }),
        prisma.payment.create({
          data: {
            clientId: req.user.id,
            eventId: req.params.id,
            boysCount,
            ratePerBoy: rate,
            totalAmount: totalAmountPaise,
            status: 'pending',
          },
        }),
      ]);

      res.json({
        message: 'Bookings closed. Payment created.',
        boysCount,
        ratePerBoy: rate,
        totalAmount: boysCount * rate,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
