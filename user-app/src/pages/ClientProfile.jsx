import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';

// ── Refined SVG Star Rating ────────────────────────────────────────────────
function StarRating({ rating = 0, count = 0 }) {
  const num = Number(rating) || 0;
  const fullStars = Math.floor(num);
  const hasHalf = num - fullStars >= 0.3 && num - fullStars < 0.8;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const isFilled = i < fullStars;
          const isHalf = i === fullStars && hasHalf;
          return (
            <svg
              key={i}
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill={isFilled ? '#F59E0B' : isHalf ? 'url(#halfStarGrad)' : 'none'}
              stroke="#F59E0B"
              strokeWidth="1.8"
            >
              {isHalf && (
                <defs>
                  <linearGradient id="halfStarGrad">
                    <stop offset="50%" stopColor="#F59E0B" />
                    <stop offset="50%" stopColor="transparent" stopOpacity="0" />
                  </linearGradient>
                </defs>
              )}
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          );
        })}
      </div>
      <span style={{ fontWeight: 800, color: '#D97706', fontSize: '0.92rem' }}>
        {num.toFixed(1)}
      </span>
      {count > 0 && (
        <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
          ({count} review{count !== 1 ? 's' : ''})
        </span>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ClientProfile() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedImg, setSelectedImg] = useState(null);

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await api.get(`/clients/${clientId}/profile`);
        setProfile(res.data.client || res.data);
      } catch (err) {
        if (err.response?.status === 404) setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [clientId]);

  // ── Loading ──
  if (loading) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '3px solid #DBEAFE',
          borderTopColor: '#2563EB',
          animation: 'spin 0.75s linear infinite',
        }} />
        <p style={{ color: '#2563EB', fontWeight: 700, fontSize: '0.88rem', letterSpacing: '-0.01em' }}>
          Loading partner profile…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── 404 Not Found ──
  if (notFound || !profile) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '40px 20px',
        textAlign: 'center',
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: 'rgba(239, 246, 255, 0.9)',
          border: '1px solid rgba(191, 219, 254, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#2563EB',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 style={{ fontWeight: 800, color: '#0F172A', fontSize: '1.35rem', letterSpacing: '-0.025em' }}>
          Partner Profile Not Found
        </h2>
        <p style={{ color: '#64748B', fontSize: '0.88rem', maxWidth: 320, lineHeight: 1.5 }}>
          This catering organizer profile doesn't exist or is currently inactive.
        </p>
        <button
          onClick={() => navigate('/')}
          className="btn btn-primary"
          style={{ marginTop: 8, padding: '12px 24px', fontSize: '0.88rem' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Return to Open Sites
        </button>
      </div>
    );
  }

  const displayName = profile.companyName || profile.name || 'Catering Partner';
  const workImages = (profile.workImages || []).slice(0, 10);

  return (
    <div className="partner-public-profile" style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px 80px' }}>

      {/* ── Top Navigation / Back Button ── */}
      <div style={{ paddingTop: 16, marginBottom: 14 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(191, 219, 254, 0.8)',
            borderRadius: 12,
            padding: '8px 16px',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#2563EB',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)',
            transition: 'all 0.15s ease',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back</span>
        </button>
      </div>

      {/* ── Banner ── */}
      <div className="partner-profile-banner" style={{
        position: 'relative',
        width: '100%',
        height: 'clamp(145px, 24vw, 230px)',
        borderRadius: 16,
        background: profile.bannerUrl
          ? `url(${profile.bannerUrl}) center/cover no-repeat`
          : 'linear-gradient(135deg, #1E40AF 0%, #2563EB 50%, #3B82F6 100%)',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(37, 99, 235, 0.12)',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, transparent 30%, rgba(15, 23, 42, 0.45) 100%)',
        }} />
      </div>

      {/* ── Identity Card ── */}
      <div className="glass-card partner-profile-identity" style={{
        padding: '0 clamp(14px, 3vw, 24px) 24px',
        marginTop: -40,
        position: 'relative',
        zIndex: 2,
        borderRadius: 16,
      }}>
        {/* Logo overlapping banner */}
        <div className="partner-profile-identity-header" style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ marginTop: -40 }}>
            {profile.logoUrl ? (
              <img
                src={profile.logoUrl}
                alt={displayName}
                style={{
                  width: 'clamp(68px, 12vw, 92px)',
                  height: 'clamp(68px, 12vw, 92px)',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid #ffffff',
                  boxShadow: '0 6px 20px rgba(37, 99, 235, 0.22)',
                  background: '#ffffff',
                }}
              />
            ) : (
              <div style={{
                width: 'clamp(68px, 12vw, 92px)',
                height: 'clamp(68px, 12vw, 92px)',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563EB, #60A5FA)',
                border: '3px solid #ffffff',
                boxShadow: '0 6px 20px rgba(37, 99, 235, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '1.85rem',
              }}>
                {displayName[0].toUpperCase()}
              </div>
            )}
          </div>

          <div style={{ paddingBottom: 6 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(5, 150, 105, 0.08)',
              color: '#059669',
              border: '1px solid rgba(5, 150, 105, 0.25)',
              borderRadius: 99,
              padding: '3px 10px',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Verified Partner
            </span>
          </div>
        </div>

        {/* Name */}
        <h1 className="partner-profile-title" style={{
          fontSize: 'clamp(1.25rem, 4vw, 1.55rem)',
          fontWeight: 800,
          color: '#0F172A',
          marginBottom: 4,
          lineHeight: 1.25,
          letterSpacing: '-0.025em',
        }}>
          {displayName}
        </h1>

        {/* Company organizer subline */}
        {profile.companyName && profile.name && profile.companyName !== profile.name && (
          <p style={{ fontSize: '0.84rem', color: '#64748B', fontWeight: 600, marginBottom: 8 }}>
            Organized by {profile.name}
          </p>
        )}

        {/* Location */}
        {profile.place && (
          <p style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.84rem',
            color: '#64748B',
            fontWeight: 500,
            marginBottom: 10,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{profile.place}</span>
          </p>
        )}

        {/* Rating Section */}
        <div style={{ marginBottom: 16 }}>
          {profile.rating > 0 ? (
            <StarRating rating={profile.rating} count={profile.ratingCount || 0} />
          ) : (
            <p style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500 }}>
              No ratings received yet
            </p>
          )}
        </div>

        {profile.bio && <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.7, maxWidth: 680, margin: '0 0 18px' }}>{profile.bio}</p>}

        {/* CTA */}
        <button
          onClick={() => navigate('/')}
          className="btn btn-primary"
          style={{
            padding: '12px 22px',
            fontSize: '0.86rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Explore Partner Events</span>
        </button>
      </div>

      {/* ── Work Images Gallery ── */}
      {workImages.length > 0 && (
        <div className="glass-card" style={{ marginTop: 16, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Work & Catering Portfolio
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 10,
          }}>
            {workImages.map((imgUrl, i) => {
              const isVideo = /\.(mp4|webm|mov|avi)$/i.test(imgUrl);
              return (
                <div
                  key={i}
                  onClick={() => setSelectedImg(imgUrl)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 12,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.06)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    background: '#0F172A',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.03)';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(37, 99, 235, 0.16)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.06)';
                  }}
                >
                  {isVideo ? (
                    <>
                      <video
                        src={imgUrl}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        muted
                        playsInline
                      />
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(4px)',
                        borderRadius: '50%',
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <img
                      src={imgUrl}
                      alt={`Work showcase ${i + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Lightbox Overlay ── */}
      {selectedImg && (
        <div
          onClick={() => setSelectedImg(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            cursor: 'zoom-out',
          }}
        >
          <button
            onClick={() => setSelectedImg(null)}
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '50%',
              width: 40,
              height: 40,
              color: '#ffffff',
              fontSize: '1.2rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onClickCapture={e => {
              e.stopPropagation();
              setSelectedImg(null);
            }}
          >
            ✕
          </button>
          {/\.(mp4|webm|mov|avi)$/i.test(selectedImg) ? (
            <video
              src={selectedImg}
              controls
              autoPlay
              style={{
                maxWidth: '92vw',
                maxHeight: '86vh',
                borderRadius: 14,
                boxShadow: '0 24px 80px rgba(0, 0, 0, 0.7)',
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <img
              src={selectedImg}
              alt="Full view"
              style={{
                maxWidth: '92vw',
                maxHeight: '86vh',
                objectFit: 'contain',
                borderRadius: 14,
                boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6)',
              }}
              onClick={e => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}
