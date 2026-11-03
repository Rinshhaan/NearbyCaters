const rateLimit = require('express-rate-limit');

const createLimiter = (max, windowMs = 15 * 60 * 1000, message = 'Too many requests. Please try again later.') => rateLimit({
  windowMs,
  limit: max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: message },
});

const authLimiter = createLimiter(12, 15 * 60 * 1000, 'Too many account requests. Wait a few minutes and try again.');
const publicUploadLimiter = createLimiter(10, 15 * 60 * 1000, 'Too many uploads. Please try again later.');
const eventUploadLimiter = createLimiter(20, 15 * 60 * 1000, 'Too many event image uploads. Please try again later.');
const paymentLimiter = createLimiter(10, 60 * 1000, 'Too many payment requests. Please try again shortly.');
const bookingLimiter = createLimiter(30, 60 * 60 * 1000, 'Too many booking requests. Please try again later.');

module.exports = { authLimiter, publicUploadLimiter, eventUploadLimiter, paymentLimiter, bookingLimiter };
