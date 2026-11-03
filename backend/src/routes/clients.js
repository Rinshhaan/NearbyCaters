const express = require('express');
const { authenticate, requireRole, requireApprovedClient } = require('../middleware/auth');
const { upload, signupUpload, uploadBufferToCloudinary } = require('../services/cloudinary');
const prisma = require('../lib/prisma');
const { publicUploadLimiter } = require('../middleware/rate-limit');
const { isSafeImageUrl, isSafePortfolioUrl } = require('../utils/event-validation');

const router = express.Router();

// Pre-registration portfolio uploads are limited to 8MB and image/video MIME types.
router.post('/signup-upload-image', publicUploadLimiter, signupUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const result = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname, 'nearme-catering/signup', req.file.mimetype);
    res.json({ url: result.secure_url, publicId: result.public_id, resourceType: result.resource_type });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATED CLIENT ROUTES (must come BEFORE /:id wildcard routes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/clients/upload-image
 * Upload image or video to Cloudinary (resource_type: auto)
 * Returns the Cloudinary URL to store on the event or client profile
 */
router.post('/upload-image',
  authenticate,
  requireApprovedClient,
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file provided' });
      const result = await uploadBufferToCloudinary(
        req.file.buffer,
        req.file.originalname,
        'nearme-catering',
        req.file.mimetype
      );
      res.json({ url: result.secure_url, publicId: result.public_id, resourceType: result.resource_type });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/clients/profile
 * Get current client's basic profile (existing endpoint — kept for compatibility)
 */
router.get('/profile',
  authenticate,
  requireRole('client'),
  async (req, res, next) => {
    try {
      const client = await prisma.client.findUnique({
        where: { id: req.user.id },
        select: {
          id: true, name: true, companyName: true, email: true, phone: true, place: true, bio: true,
          isApproved: true, isActive: true, createdAt: true,
          _count: { select: { events: true } },
        },
      });
      if (!client) return res.status(404).json({ error: 'Client not found' });
      res.json(client);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/clients/me/profile
 * Get logged-in client's own full profile (for editing — includes media & rating)
 */
router.get('/me/profile', authenticate, requireRole('client'), async (req, res, next) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, companyName: true, email: true, phone: true, place: true, bio: true,
        logoUrl: true, bannerUrl: true, workImages: true,
        rating: true, ratingCount: true,
      },
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    let workImages = [];
    try { workImages = client.workImages ? JSON.parse(client.workImages) : []; } catch {}
    res.json({ ...client, workImages });
  } catch (err) { next(err); }
});

/**
 * PATCH /api/v1/clients/me/profile
 * Update logo, banner, workImages for logged-in client
 */
router.patch('/me/profile', authenticate, requireRole('client'), async (req, res, next) => {
  try {
    const { name, companyName, phone, email, place, bio, logoUrl, bannerUrl, workImages } = req.body;
    if ((logoUrl != null && !isSafeImageUrl(logoUrl)) || (bannerUrl != null && !isSafeImageUrl(bannerUrl))) {
      return res.status(422).json({ error: 'Profile image links must use HTTPS and a supported raster image type' });
    }
    if (workImages !== undefined && (!Array.isArray(workImages) || workImages.length > 10 || workImages.some((url) => !isSafePortfolioUrl(url)))) {
      return res.status(422).json({ error: 'Add up to 10 secure image or video URLs to your portfolio' });
    }
    const data = {};
    if (name !== undefined && name.trim()) data.name = name.trim();
    if (companyName !== undefined) data.companyName = companyName.trim() || null;
    if (place !== undefined) data.place = place.trim() || 'Kerala';
    if (bio !== undefined) data.bio = bio.trim() || null;
    if (email !== undefined && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ error: 'Enter a valid email address' });
      const existing = await prisma.client.findFirst({ where: { email: normalizedEmail, NOT: { id: req.user.id } } });
      if (existing) return res.status(409).json({ error: 'Email address already in use' });
      data.email = normalizedEmail;
    }
    if (phone !== undefined && phone.trim()) {
      if (!/^[6-9]\d{9}$/.test(phone.trim())) return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number' });
      // Check phone not taken by another client
      const existing = await prisma.client.findFirst({ where: { phone: phone.trim(), NOT: { id: req.user.id } } });
      if (existing) return res.status(409).json({ error: 'Phone number already in use' });
      data.phone = phone.trim();
    }
    if (logoUrl !== undefined) data.logoUrl = logoUrl;
    if (bannerUrl !== undefined) data.bannerUrl = bannerUrl;
    if (workImages !== undefined) {
      const imgs = Array.isArray(workImages) ? workImages.slice(0, 10) : [];
      data.workImages = JSON.stringify(imgs);
    }
    const client = await prisma.client.update({
      where: { id: req.user.id },
      data,
      select: { id: true, name: true, companyName: true, email: true, phone: true, place: true, bio: true, logoUrl: true, bannerUrl: true, workImages: true },
    });
    let parsedWorkImages = [];
    try { parsedWorkImages = client.workImages ? JSON.parse(client.workImages) : []; } catch {}
    res.json({ ...client, workImages: parsedWorkImages });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/clients/me/dashboard
 * Client analytics dashboard — boys by place, boys by event, totals
 */
router.get('/me/dashboard', authenticate, requireRole('client'), async (req, res, next) => {
  try {
    const clientId = req.user.id;

    const bookings = await prisma.booking.findMany({
      where: {
        status: 'confirmed',
        event: { clientId },
      },
      include: {
        user: { select: { place: true } },
        event: { select: { id: true, name: true, location: true } },
      },
    });

    const totalBoys = bookings.length;

    const byPlace = {};
    bookings.forEach(b => {
      const place = b.user?.place || 'Unknown';
      byPlace[place] = (byPlace[place] || 0) + 1;
    });
    const boysByPlace = Object.entries(byPlace)
      .map(([place, count]) => ({ place, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const byEvent = {};
    bookings.forEach(b => {
      const key = b.event.name;
      if (!byEvent[key]) byEvent[key] = { name: b.event.name, location: b.event.location, count: 0, eventId: b.event.id };
      byEvent[key].count++;
    });
    const boysByEvent = Object.values(byEvent)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totalEvents = await prisma.event.count({ where: { clientId } });
    const activeEvents = await prisma.event.count({
      where: { clientId, status: { in: ['published', 'booking_closed'] } },
    });

    res.json({ totalBoys, totalEvents, activeEvents, boysByPlace, boysByEvent });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES — wildcard :id must come LAST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/clients/:id/profile
 * Public client profile page — public identity, logo, banner, work images, and rating
 */
router.get('/:id/profile', async (req, res, next) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, companyName: true, place: true, bio: true,
        logoUrl: true, bannerUrl: true, workImages: true,
        rating: true, ratingCount: true, isApproved: true, isActive: true,
      },
    });
    if (!client || !client.isApproved || !client.isActive) return res.status(404).json({ error: 'Partner profile not found' });

    let workImages = [];
    try { workImages = client.workImages ? JSON.parse(client.workImages) : []; } catch {}

    res.json({ ...client, workImages });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/clients/me/events/:eventId/financial
 * Client can see financial summary for their own event
 */
router.get('/me/events/:eventId/financial', authenticate, requireRole('client'), async (req, res, next) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: req.params.eventId, clientId: req.user.id },
      include: { payment: true },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const bookings = await prisma.booking.findMany({
      where: { eventId: req.params.eventId, status: 'confirmed' },
      include: { user: { select: { id: true, name: true, phone: true, place: true } } },
    });

    const ratePerBoy = event.payment?.ratePerBoy ?? 20;
    const bookedCount = bookings.length;
    const attendedCount = bookings.filter(b => b.attended).length;
    const paidCount = bookings.filter(b => b.staffPaid).length;
    const wagesByAttendance = attendedCount * ratePerBoy;
    const wagesByBooked = bookedCount * ratePerBoy;

    res.json({
      ratePerBoy,
      bookedCount,
      attendedCount,
      paidCount,
      unpaidCount: attendedCount - paidCount,
      wagesByAttendance,
      wagesByBooked,
    });
  } catch (err) { next(err); }
});

module.exports = router;
