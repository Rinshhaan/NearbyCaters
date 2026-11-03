import React from 'react';
import { getMapEmbedUrl, getMapRedirectUrl } from './mapUtils';

function safeImageAddress(value) {
  if (!value || typeof value !== 'string' || value.length > 2048) return false;
  const raw = value.trim();
  if (raw.startsWith('/uploads/')) return !raw.toLowerCase().split('?')[0].endsWith('.svg');
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.pathname.toLowerCase().endsWith('.svg')) return false;
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.startsWith('/uploads/'));
  } catch { return false; }
}

export default function MapThumbnail({ location, locationMapUrl, imageUrl, className, topBadge }) {
  const embedUrl = getMapEmbedUrl(locationMapUrl, location);
  const redirectUrl = getMapRedirectUrl(locationMapUrl, location);
  const hasImage = safeImageAddress(imageUrl);
  const handleOpenMaps = (event) => {
    event.stopPropagation();
    window.open(redirectUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`event-card-map-wrapper ${className || ''}`} style={{ position: 'relative', width: '100%', height: 180, overflow: 'hidden', background: '#E2E8F0', borderBottom: '1px solid rgba(226, 232, 240, 0.85)' }}>
      {hasImage ? (
        <img src={imageUrl} alt={`Event at ${location || 'the listed venue'}`} loading="lazy" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
      ) : (
        <iframe title={`Site map — ${location || 'Kerala'}`} src={embedUrl} width="100%" height="100%" style={{ border: 0, width: '100%', height: '100%', display: 'block' }} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
      )}
      {topBadge && <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 3, pointerEvents: 'none' }}>{topBadge}</div>}
      <button type="button" onClick={handleOpenMaps} title="Open site location in Google Maps" style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 3, background: 'rgba(255,255,255,.95)', border: '1px solid rgba(255,255,255,.9)', color: '#1D4ED8', fontSize: '.72rem', fontWeight: 700, padding: '6px 12px', borderRadius: 99, boxShadow: '0 2px 10px rgba(15,23,42,.16)', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
        <span>Open Maps ↗</span>
      </button>
    </div>
  );
}
