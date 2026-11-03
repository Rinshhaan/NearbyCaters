require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const crypto = require('crypto');

if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 UTF-8 bytes.');
}

const app = express();

// ─── Security & Logging ───────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});
app.use(morgan(':method :status :response-time ms'));

// ─── Static Uploads (Local gallery & video storage) ───────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  dotfiles: 'deny',
  index: false,
  fallthrough: false,
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  },
}));

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.ADMIN_URL,
  process.env.CLIENT_URL,
  process.env.USER_URL,
].filter(Boolean);

if (process.env.NODE_ENV === 'production') {
  const requiredOrigins = [process.env.ADMIN_URL, process.env.CLIENT_URL, process.env.USER_URL];
  if (requiredOrigins.some((origin) => !origin) || allowedOrigins.some((origin) => {
    try { return new URL(origin).protocol !== 'https:'; } catch { return true; }
  })) {
    throw new Error('Production ADMIN_URL, CLIENT_URL, and USER_URL values must be configured with HTTPS origins.');
  }
}

const isLocalDevelopmentOrigin = (origin) => {
  if (process.env.NODE_ENV === 'production') return false;

  try {
    const { protocol, hostname } = new URL(origin);
    return ['http:', 'https:'].includes(protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., Postman, mobile apps)
    if (!origin || allowedOrigins.includes(origin) || isLocalDevelopmentOrigin(origin)) {
      callback(null, true);
    } else {
      const error = new Error('Origin is not allowed by CORS policy');
      error.status = 403;
      callback(error);
    }
  },
  credentials: true,
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb', parameterLimit: 100 }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',          require('./routes/auth'));
app.use('/api/v1/admin',         require('./routes/admin'));
app.use('/api/v1/clients',       require('./routes/clients'));
app.use('/api/v1/events',        require('./routes/events'));
app.use('/api/v1/bookings',      require('./routes/bookings'));
app.use('/api/v1/payments',      require('./routes/payments'));
app.use('/api/v1/notifications', require('./routes/notifications'));
app.use('/api/v1/users',         require('./routes/users'));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status :
    err.type === 'entity.too.large' ? 413 : err.name === 'MulterError' ? 400 : 500;
  console.error('[ERROR]', req.requestId, err.name || 'Error', err.code || '');
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);
  const message = status === 403 ? 'Request origin is not allowed' :
    status === 413 ? 'Request is too large' :
      err.name === 'MulterError' ? 'Upload could not be processed' :
        status === 404 ? 'Resource not found' :
      status === 503 ? err.message :
        status < 500 && process.env.NODE_ENV !== 'production' ? err.message : 'Internal server error';
  res.status(status).json({ error: message, requestId: req.requestId });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ NearMe Catering API running on http://localhost:${PORT}`);
    // Start notification scheduler only for the standalone API process.
    require('./services/scheduler').startNotificationScheduler();
  });
}

module.exports = app;
