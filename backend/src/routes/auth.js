const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { sendPasswordResetEmail } = require('../services/email');
const { authLimiter } = require('../middleware/rate-limit');
const { isSafeImageUrl, isSafePortfolioUrl } = require('../utils/event-validation');

const router = express.Router();

// ─── Helper ────────────────────────────────────────────────────────────────────
const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
const passwordField = (field) => body(field).isString().isLength({ min: 8, max: 128 }).custom((value) => Buffer.byteLength(value, 'utf8') <= 72);
const credentialField = (field) => body(field).isString().isLength({ min: 1, max: 128 }).custom((value) => Buffer.byteLength(value, 'utf8') <= 72);

const validationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN LOGIN — POST /api/v1/auth/admin/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/admin/login',
  authLimiter,
  body('email').isEmail().normalizeEmail(),
  credentialField('password'),
  async (req, res, next) => {
    try {
      if (validationErrors(req, res)) return;

      const { email, password } = req.body;
      const admin = await prisma.admin.findUnique({ where: { email } });

      if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = signToken({ id: admin.id, role: 'admin', ver: admin.tokenVersion });
      res.json({
        token,
        user: { id: admin.id, name: admin.name, email: admin.email, role: 'admin' },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT REGISTER — POST /api/v1/auth/client/register
// ─────────────────────────────────────────────────────────────────────────────
router.post('/client/register',
  authLimiter,
  body('name').trim().isLength({ min: 2 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').matches(/^[6-9]\d{9}$/),
  body('place').trim().isLength({ min: 2 }),
  passwordField('password'),
  async (req, res, next) => {
    try {
      if (validationErrors(req, res)) return;

      const { name, companyName, email, phone, place, bio, password, logoUrl, bannerUrl, workImages = [] } = req.body;
      if ((logoUrl && !isSafeImageUrl(logoUrl)) || (bannerUrl && !isSafeImageUrl(bannerUrl))) {
        return res.status(422).json({ error: 'Profile image links must use HTTPS and a supported raster image type' });
      }
      if (!Array.isArray(workImages) || workImages.length > 10 || workImages.some((url) => !isSafePortfolioUrl(url))) {
        return res.status(422).json({ error: 'Add up to 10 secure image or video URLs to your portfolio' });
      }

      // Check duplicates
      const existing = await prisma.client.findFirst({
        where: { OR: [{ email }, { phone }] },
      });
      if (existing) {
        return res.status(409).json({
          error: existing.email === email
            ? 'Email already registered'
            : 'Phone number already registered',
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const client = await prisma.client.create({
        data: {
          name, companyName, email, phone, place, bio, passwordHash,
          logoUrl: logoUrl || null,
          bannerUrl: bannerUrl || null,
          workImages: JSON.stringify(workImages.filter(Boolean)),
        },
        select: { id: true, name: true, email: true, phone: true, isApproved: true },
      });

      res.status(201).json({
        message: 'Registration successful. Awaiting admin approval.',
        client,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT LOGIN — POST /api/v1/auth/client/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/client/login',
  authLimiter,
  body('email').isEmail().normalizeEmail(),
  credentialField('password'),
  async (req, res, next) => {
    try {
      if (validationErrors(req, res)) return;

      const { email, password } = req.body;
      const client = await prisma.client.findUnique({ where: { email } });

      if (!client || !(await bcrypt.compare(password, client.passwordHash))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (!client.isActive) {
        return res.status(403).json({ error: 'Account deactivated. Contact admin.' });
      }
      if (!client.isApproved) {
        return res.status(403).json({
          error: 'Your partner registration is waiting for admin approval. You can sign in once it is approved.',
          approvalPending: true,
        });
      }

      const token = signToken({ id: client.id, role: 'client', ver: client.tokenVersion });
      res.json({
        token,
        user: {
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          isApproved: client.isApproved,
          role: 'client',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// USER REGISTER — POST /api/v1/auth/user/register
// Staff can sign up with either email/password or mobile/password.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/user/register',
  authLimiter,
  body('name').trim().isLength({ min: 2 }),
  body('phone').optional({ checkFalsy: true }).matches(/^[6-9]\d{9}$/),
  body('place').trim().isLength({ min: 2 }),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  passwordField('password'),
  async (req, res, next) => {
    try {
      if (validationErrors(req, res)) return;

      const { name, place, password } = req.body;
      const phone = req.body.phone ? String(req.body.phone).replace(/\D/g, '') : null;
      const email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
      if (!phone && !email) return res.status(422).json({ error: 'Enter an email address or mobile number to create your account.' });

      const [existingPhone, existingEmail] = await Promise.all([
        phone ? prisma.user.findUnique({ where: { phone } }) : null,
        email ? prisma.user.findUnique({ where: { email } }) : null,
      ]);
      if (existingEmail) return res.status(409).json({ error: 'Email already registered' });
      if (existingPhone?.email || existingPhone?.passwordHash) {
        return res.status(409).json({ error: 'Phone number already has an account. Sign in instead.' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/png?seed=${encodeURIComponent(name || phone || email)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
      const userData = { name, phone, place, email, passwordHash, pinHash: null, avatarUrl: existingPhone?.avatarUrl || defaultAvatar };
      const user = existingPhone
        ? await prisma.user.update({
            where: { id: existingPhone.id },
            data: { ...userData, tokenVersion: { increment: 1 } },
            select: { id: true, name: true, phone: true, email: true, place: true, avatarUrl: true, tokenVersion: true },
          })
        : await prisma.user.create({
            data: userData,
            select: { id: true, name: true, phone: true, email: true, place: true, avatarUrl: true, tokenVersion: true },
          });

      const token = signToken({ id: user.id, role: 'user', ver: user.tokenVersion });
      const safeUser = { ...user };
      delete safeUser.tokenVersion;
      res.status(201).json({
        token,
        user: { ...safeUser, role: 'user' },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// USER LOGIN — POST /api/v1/auth/user/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/user/login', authLimiter, async (req, res, next) => {
    try {
      const { email, password, phone, pin } = req.body;
      if (email !== undefined && (typeof email !== 'string' || email.length > 254)) return res.status(422).json({ error: 'Enter a valid email address' });
      if (password !== undefined && (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72)) return res.status(422).json({ error: 'Password is invalid or too long' });
      if (phone !== undefined && typeof phone !== 'string') return res.status(422).json({ error: 'Enter a valid mobile number' });
      if (pin !== undefined && (typeof pin !== 'string' || !/^\d{4}$/.test(pin))) return res.status(422).json({ error: 'PIN must contain four digits' });
      let user = null;
      let validCredentials = false;
      if (email && password) {
        user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
        validCredentials = Boolean(user?.passwordHash && await bcrypt.compare(password, user.passwordHash));
      } else if (phone && password && /^[6-9]\d{9}$/.test(String(phone).replace(/\D/g, ''))) {
        const normalizedPhone = String(phone).replace(/\D/g, '');
        user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
        validCredentials = Boolean(user?.passwordHash && await bcrypt.compare(password, user.passwordHash));
      } else if (phone && pin && /^[6-9]\d{9}$/.test(String(phone)) && /^\d{4}$/.test(pin)) {
        user = await prisma.user.findUnique({ where: { phone: String(phone) } });
        validCredentials = Boolean(user?.pinHash && await bcrypt.compare(pin, user.pinHash));
      } else {
        return res.status(422).json({ error: 'Enter your email or mobile number and password' });
      }

      if (!user || !validCredentials) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (!user.isActive) {
        return res.status(403).json({ error: 'Account deactivated. Contact admin.' });
      }

      const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/png?seed=${encodeURIComponent(user.name || user.phone)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
      const token = signToken({ id: user.id, role: 'user', ver: user.tokenVersion });
      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          place: user.place,
          avatarUrl: user.avatarUrl || defaultAvatar,
          role: 'user',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE FCM TOKEN — POST /api/v1/auth/fcm-token
// Users update their device FCM token after login
// ─────────────────────────────────────────────────────────────────────────────
const { authenticate, requireRole } = require('../middleware/auth');
const recoveryAccounts = {
  admin: { model: 'admin', baseUrl: () => process.env.ADMIN_URL || 'http://localhost:5173' },
  client: { model: 'client', baseUrl: () => process.env.CLIENT_URL || 'http://localhost:5174' },
  user: { model: 'user', baseUrl: () => process.env.USER_URL || 'http://localhost:5175' },
};
const recoveryBaseUrl = (role) => {
  const configured = role === 'admin' ? process.env.ADMIN_URL : role === 'client' ? process.env.CLIENT_URL : process.env.USER_URL;
  const value = configured || (process.env.NODE_ENV === 'production' ? '' : recoveryAccounts[role].baseUrl());
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (process.env.NODE_ENV === 'production' ? url.protocol !== 'https:' : !['https:', 'http:'].includes(url.protocol)) return null;
    return url.origin;
  } catch { return null; }
};

router.post('/password/forgot',
  authLimiter,
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['admin', 'client', 'user']),
  async (req, res, next) => {
    try {
      if (validationErrors(req, res)) return;
      const { email, role } = req.body;
      if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) {
        return res.status(503).json({ error: 'Password recovery email is temporarily unavailable.' });
      }
      const baseUrl = recoveryBaseUrl(role);
      if (!baseUrl) return res.status(503).json({ error: 'Password recovery links are not configured securely.' });
      const account = await prisma[recoveryAccounts[role].model].findUnique({ where: { email } });
      if (account) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        await prisma.passwordReset.updateMany({
          where: { role, accountId: account.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        await prisma.passwordReset.create({
          data: {
            role,
            accountId: account.id,
            tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });
        const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
        try {
          await sendPasswordResetEmail(email, resetUrl);
        } catch {
          console.error('[Email] Password reset could not be sent.');
          await prisma.passwordReset.updateMany({
            where: { role, accountId: account.id, usedAt: null },
            data: { usedAt: new Date() },
          });
        }
      }
      res.json({ message: 'If an account matches that email, a reset link has been sent.' });
    } catch (err) { next(err); }
  }
);

router.post('/password/reset',
  authLimiter,
  body('role').isIn(['admin', 'client', 'user']),
  body('token').matches(/^[a-f0-9]{64}$/i),
  passwordField('password'),
  async (req, res, next) => {
    try {
      if (validationErrors(req, res)) return;
      const tokenHash = crypto.createHash('sha256').update(req.body.token).digest('hex');
      const reset = await prisma.passwordReset.findUnique({ where: { tokenHash } });
      if (!reset || reset.role !== req.body.role || reset.usedAt || reset.expiresAt <= new Date()) {
        return res.status(400).json({ error: 'This reset link is invalid or expired. Request a new one.' });
      }
      const passwordHash = await bcrypt.hash(req.body.password, 12);
      const consumedAt = new Date();
      const changed = await prisma.$transaction(async (tx) => {
        const consumed = await tx.passwordReset.updateMany({
          where: { id: reset.id, usedAt: null, expiresAt: { gt: consumedAt } },
          data: { usedAt: consumedAt },
        });
        if (consumed.count !== 1) return false;
        await tx[recoveryAccounts[reset.role].model].update({
          where: { id: reset.accountId },
          data: { passwordHash, tokenVersion: { increment: 1 }, ...(reset.role === 'user' ? { pinHash: null } : {}) },
        });
        return true;
      });
      if (!changed) return res.status(400).json({ error: 'This reset link is invalid or expired. Request a new one.' });
      res.json({ message: 'Password reset successfully. You can now sign in.' });
    } catch (err) { next(err); }
  }
);

router.post('/fcm-token',
  authenticate,
  requireRole('user'),
  body('fcmToken').isString().isLength({ min: 10, max: 4096 }),
  async (req, res, next) => {
    try {
      if (validationErrors(req, res)) return;
      await prisma.user.update({
        where: { id: req.user.id },
        data: { fcmToken: req.body.fcmToken },
      });
      res.json({ message: 'FCM token updated' });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT CHANGE PASSWORD — POST /api/v1/auth/client/change-password
// Requires old password; sets new password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/client/change-password',
  authenticate,
  requireRole('client'),
  credentialField('oldPassword'),
  passwordField('newPassword'),
  async (req, res, next) => {
    try {
      if (validationErrors(req, res)) return;
      const { oldPassword, newPassword } = req.body;
      const client = await prisma.client.findUnique({ where: { id: req.user.id } });
      if (!client || !(await bcrypt.compare(oldPassword, client.passwordHash))) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.client.update({ where: { id: req.user.id }, data: { passwordHash, tokenVersion: { increment: 1 } } });
      res.json({ message: 'Password changed successfully' });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// USER CHANGE PIN — POST /api/v1/auth/user/change-pin
// Requires old PIN; sets new PIN
// ─────────────────────────────────────────────────────────────────────────────
router.post('/user/change-pin',
  authenticate,
  requireRole('user'),
  body('oldPin').matches(/^\d{4}$/),
  body('newPin').matches(/^\d{4}$/),
  async (req, res, next) => {
    try {
      if (validationErrors(req, res)) return;
      const { oldPin, newPin } = req.body;
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user?.pinHash || !(await bcrypt.compare(oldPin, user.pinHash))) {
        return res.status(401).json({ error: 'Current PIN is incorrect' });
      }
      const pinHash = await bcrypt.hash(newPin, 12);
      await prisma.user.update({ where: { id: req.user.id }, data: { pinHash, tokenVersion: { increment: 1 } } });
      res.json({ message: 'PIN changed successfully' });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CHANGE PASSWORD — POST /api/v1/auth/admin/change-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/admin/change-password',
  authenticate,
  requireRole('admin'),
  credentialField('oldPassword'),
  passwordField('newPassword'),
  async (req, res, next) => {
    try {
      if (validationErrors(req, res)) return;
      const { oldPassword, newPassword } = req.body;
      const admin = await prisma.admin.findUnique({ where: { id: req.user.id } });
      if (!admin || !(await bcrypt.compare(oldPassword, admin.passwordHash))) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.admin.update({ where: { id: req.user.id }, data: { passwordHash, tokenVersion: { increment: 1 } } });
      res.json({ message: 'Admin password changed successfully' });
    } catch (err) { next(err); }
  }
);

router.post('/user/change-password',
  authenticate,
  requireRole('user'),
  credentialField('oldPassword'),
  passwordField('newPassword'),
  async (req, res, next) => {
    try {
      if (validationErrors(req, res)) return;
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      const validCurrentCredential = user?.passwordHash
        ? await bcrypt.compare(req.body.oldPassword, user.passwordHash)
        : Boolean(user?.pinHash && await bcrypt.compare(req.body.oldPassword, user.pinHash));
      if (!user || !validCurrentCredential) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
      await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash, pinHash: null, tokenVersion: { increment: 1 } } });
      res.json({ message: 'Password changed successfully' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
