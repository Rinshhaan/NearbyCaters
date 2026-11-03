const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { isSafeImageUrl } = require('../utils/event-validation');

const router = express.Router();

/**
 * GET /api/v1/users/me
 * Get current user's profile
 */
router.get('/me',
  authenticate, requireRole('user'),
  async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true, name: true, phone: true, email: true, place: true, avatarUrl: true,
          rating: true, ratingCount: true,
          isActive: true, createdAt: true,
          _count: { select: { bookings: { where: { status: 'confirmed' } } } },
        },
      });
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/users/me
 * Update profile (name, place, avatarUrl)
 */
router.patch('/me',
  authenticate, requireRole('user'),
  async (req, res, next) => {
    try {
      const { name, place, phone, email, avatarUrl } = req.body;
      const current = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { phone: true, email: true },
      });
      if (!current) return res.status(404).json({ error: 'User not found' });

      const data = {};
      if (name) data.name = name.trim();
      if (place) data.place = place.trim();
      let nextPhone = current.phone;
      let nextEmail = current.email;
      if (phone !== undefined) {
        const normalizedPhone = String(phone).replace(/\D/g, '');
        if (normalizedPhone && !/^[6-9]\d{9}$/.test(normalizedPhone)) return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number' });
        if (normalizedPhone) {
          const existingPhone = await prisma.user.findFirst({ where: { phone: normalizedPhone, NOT: { id: req.user.id } } });
          if (existingPhone) return res.status(409).json({ error: 'Phone number already in use' });
        }
        nextPhone = normalizedPhone || null;
        data.phone = nextPhone;
      }
      if (email !== undefined) {
        const normalizedEmail = String(email).trim().toLowerCase();
        if (normalizedEmail) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ error: 'Enter a valid email address' });
          const existing = await prisma.user.findFirst({ where: { email: normalizedEmail, NOT: { id: req.user.id } } });
          if (existing) return res.status(409).json({ error: 'Email address already in use' });
        }
        nextEmail = normalizedEmail || null;
        data.email = nextEmail;
      }
      if (!nextPhone && !nextEmail) return res.status(400).json({ error: 'Keep at least one email address or mobile number on your profile.' });
      if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
      if (avatarUrl !== undefined && avatarUrl !== null && !isSafeImageUrl(avatarUrl)) {
        return res.status(422).json({ error: 'Avatar must be a secure image address or an uploaded image' });
      }

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data,
        select: { id: true, name: true, phone: true, email: true, place: true, avatarUrl: true },
      });
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/users/me/avatar
 * Update avatar picture
 */
router.patch('/me/avatar',
  authenticate, requireRole('user'),
  async (req, res, next) => {
    try {
      const { avatarUrl } = req.body;
      if (!avatarUrl) return res.status(400).json({ error: 'avatarUrl is required' });
      if (!isSafeImageUrl(avatarUrl)) return res.status(422).json({ error: 'Avatar must be a secure image address or an uploaded image' });

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { avatarUrl },
        select: { id: true, name: true, phone: true, place: true, avatarUrl: true },
      });
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
