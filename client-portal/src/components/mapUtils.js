function extractSource(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i);
  return match?.[2]?.trim() || raw;
}

function parseGoogleMap(value) {
  if (!value) return null;
  try {
    const url = new URL(extractSource(value));
    const host = url.hostname.toLowerCase();
    const allowed = host === 'google.com' || host.endsWith('.google.com') || host === 'google.co.in' || host.endsWith('.google.co.in') || ['maps.app.goo.gl', 'goo.gl', 'share.google'].includes(host);
    if (!allowed || url.protocol !== 'https:' || url.username || url.password) return null;
    if (host === 'goo.gl' && !url.pathname.startsWith('/maps')) return null;
    return url;
  } catch { return null; }
}

function locationQuery(value) {
  const url = parseGoogleMap(value);
  if (!url || ['maps.app.goo.gl', 'goo.gl', 'share.google'].includes(url.hostname)) return '';
  const query = url.searchParams.get('q') || url.searchParams.get('query');
  if (query) return query;
  const coords = url.href.match(/@(-?[\d.]+),(-?[\d.]+)/) || url.href.match(/!2d(-?[\d.]+)!3d(-?[\d.]+)/);
  if (coords) return `${coords[1]},${coords[2]}`;
  const place = url.pathname.match(/\/place\/([^/]+)/i);
  if (place) {
    try { return decodeURIComponent(place[1].replace(/\+/g, ' ')); } catch { return ''; }
  }
  return '';
}

export function getMapEmbedUrl(locationMapUrl, location) {
  const url = parseGoogleMap(locationMapUrl);
  if (url && (url.pathname.includes('/maps/embed') || url.searchParams.get('output') === 'embed')) return url.toString();
  const query = locationQuery(locationMapUrl) || String(location || '').trim() || 'Kerala';
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=14&output=embed`;
}

export function getMapRedirectUrl(locationMapUrl, location) {
  const url = parseGoogleMap(locationMapUrl);
  if (url && ['maps.app.goo.gl', 'goo.gl', 'share.google'].includes(url.hostname)) return url.toString();
  const query = locationQuery(locationMapUrl) || String(location || '').trim() || 'Kerala';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
