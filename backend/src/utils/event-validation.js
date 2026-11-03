const SAFE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']);
const SAFE_MEDIA_EXTENSIONS = new Set([...SAFE_IMAGE_EXTENSIONS, '.mp4', '.webm', '.mov']);

function extractIframeSource(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i);
  return match?.[2]?.trim() || raw;
}

function isGoogleMapsHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'google.com' || host.endsWith('.google.com') ||
    host === 'google.co.in' || host.endsWith('.google.co.in') ||
    host === 'maps.app.goo.gl' || host === 'goo.gl' || host === 'share.google';
}

function normalizeMapUrl(value) {
  if (value == null || String(value).trim() === '') return null;
  if (String(value).length > 2048) return undefined;
  const source = extractIframeSource(value);
  let url;
  try { url = new URL(source); } catch { return undefined; }
  if (url.protocol !== 'https:' || url.username || url.password || !isGoogleMapsHost(url.hostname)) return undefined;
  if (url.hostname === 'goo.gl' && !url.pathname.startsWith('/maps')) return undefined;
  if (url.hostname === 'share.google' && !url.pathname) return undefined;
  return url.toString();
}

function isSafeMediaUrl(value, extensions = SAFE_IMAGE_EXTENSIONS) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  const raw = value.trim();
  if (!raw) return true;
  let url;
  try { url = new URL(raw); } catch { return false; }
  if (url.username || url.password) return false;
  const extension = url.pathname.slice(url.pathname.lastIndexOf('/')).toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  if (extension === '.svg' || (extension && !extensions.has(extension))) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.startsWith('/uploads/');
}

const isSafeImageUrl = (value) => isSafeMediaUrl(value, SAFE_IMAGE_EXTENSIONS);
const isSafePortfolioUrl = (value) => isSafeMediaUrl(value, SAFE_MEDIA_EXTENSIONS);

function verifyRazorpaySignature(secret, orderId, paymentId, signature) {
  if (![secret, orderId, paymentId, signature].every((value) => typeof value === 'string' && value.length > 0)) return false;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = require('crypto').createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
  const actual = Buffer.from(signature, 'hex');
  return expected.length === actual.length && require('crypto').timingSafeEqual(expected, actual);
}

module.exports = { extractIframeSource, isGoogleMapsHost, normalizeMapUrl, isSafeImageUrl, isSafePortfolioUrl, verifyRazorpaySignature };
