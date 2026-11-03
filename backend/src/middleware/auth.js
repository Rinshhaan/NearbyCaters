const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

/**
 * Verifies JWT and attaches req.user = { id, role }
 */
const authenticate = async (req, res, next) => {
  let decoded;
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !/^Bearer\s+[^\s]+$/i.test(authHeader)) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (!decoded.id || !['admin', 'client', 'user'].includes(decoded.role)) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (decoded.role === 'client') {
    try {
      const client = await prisma.client.findUnique({
        where: { id: decoded.id },
        select: { isApproved: true, isActive: true, tokenVersion: true },
      });
      if (!client) return res.status(401).json({ error: 'Account not found. Please sign in again.' });
      if (Number(decoded.ver ?? 0) !== client.tokenVersion) return res.status(401).json({ error: 'Session expired. Please sign in again.', code: 'SESSION_REVOKED' });
      if (!client.isActive) {
        return res.status(403).json({ error: 'Account deactivated. Contact admin.', code: 'ACCOUNT_BLOCKED' });
      }
      if (!client.isApproved) {
        return res.status(403).json({
          error: 'Your partner registration is waiting for admin approval. You can sign in once it is approved.',
          code: 'PENDING_APPROVAL',
        });
      }
    } catch (err) {
      return next(err);
    }
  } else if (decoded.role === 'user') {
    try {
      const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { isActive: true, tokenVersion: true } });
      if (!user) return res.status(401).json({ error: 'Account not found. Please sign in again.' });
      if (Number(decoded.ver ?? 0) !== user.tokenVersion) return res.status(401).json({ error: 'Session expired. Please sign in again.', code: 'SESSION_REVOKED' });
      if (!user.isActive) return res.status(403).json({ error: 'Account deactivated. Contact admin.', code: 'ACCOUNT_BLOCKED' });
    } catch (err) {
      return next(err);
    }
  } else {
    try {
      const admin = await prisma.admin.findUnique({ where: { id: decoded.id }, select: { tokenVersion: true } });
      if (!admin) return res.status(401).json({ error: 'Account not found. Please sign in again.' });
      if (Number(decoded.ver ?? 0) !== admin.tokenVersion) return res.status(401).json({ error: 'Session expired. Please sign in again.', code: 'SESSION_REVOKED' });
    } catch (err) {
      return next(err);
    }
  }

  // decoded = { id, role, iat, exp }
  req.user = decoded;
  next();
};

/**
 * Factory: allows only specific roles
 * Usage: requireRole('admin') or requireRole('admin', 'client')
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Access denied. Required role: ${roles.join(' or ')}`,
    });
  }
  next();
};

/**
 * Checks that an approved client account exists (not just any client token)
 */
const requireApprovedClient = async (req, res, next) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Client access only' });
    }
    const client = await prisma.client.findUnique({
      where: { id: req.user.id },
      select: { isApproved: true, isActive: true },
    });
    if (!client) {
      return res.status(403).json({ error: 'Client account not found' });
    }
    if (!client.isActive) {
      return res.status(403).json({
        error: 'Your account has been blocked by the admin. You cannot create or edit events until an admin unblocks your account.',
        code: 'ACCOUNT_BLOCKED',
      });
    }
    if (!client.isApproved) {
      return res.status(403).json({
        error: 'Your account is pending admin approval. Please wait for approval.',
        code: 'PENDING_APPROVAL',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, requireRole, requireApprovedClient };
