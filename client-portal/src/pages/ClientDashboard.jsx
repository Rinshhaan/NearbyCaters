import React, { useEffect, useState } from 'react';
import { Users, Calendar, Zap, MapPin, BarChart2 } from 'lucide-react';
import api from '../lib/api';

/* ─── Skeleton helpers ──────────────────────────────────── */
function Skeleton({ width = '100%', height = '18px', radius = '8px', style = {} }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.06) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
        ...style,
      }}
    />
  );
}

/* ─── Stat card ─────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, color, loading }) {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '20px 24px',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: `${color}22`,
          border: `1px solid ${color}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={22} color={color} />
      </div>
      <div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
          {label}
        </p>
        {loading ? (
          <Skeleton width="60px" height="28px" radius="6px" />
        ) : (
          <p style={{ fontSize: '1.75rem', fontWeight: 800, color }}>{value ?? '—'}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Horizontal progress bar ───────────────────────────── */
function PlaceBar({ place, count, max }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{place}</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{count} boys</span>
      </div>
      <div style={{ height: '8px', borderRadius: '99px', background: 'rgba(37,99,235,0.1)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: '99px',
            background: 'linear-gradient(90deg, #2563EB, #60A5FA)',
            transition: 'width 0.8s ease',
          }}
        />
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export default function ClientDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/clients/me/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to load dashboard');
      })
      .finally(() => setLoading(false));
  }, []);

  /* Derived data */
  const boysByPlace = data?.boysByPlace ?? [];
  const boysBySite = data?.boysBySite ?? [];
  const maxPlace = boysByPlace.length > 0 ? Math.max(...boysByPlace.map((p) => p.count)) : 1;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Overview of your recruitment activity
        </p>
      </div>

      {error && (
        <div
          className="card"
          style={{ padding: '20px', color: '#EF4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '24px' }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ── Stat cards ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <StatCard icon={Users} label="Total Boys" value={data?.totalBoys} color="#2563EB" loading={loading} />
        <StatCard icon={Calendar} label="Total Events" value={data?.totalEvents} color="#7C3AED" loading={loading} />
        <StatCard icon={Zap} label="Active Events" value={data?.activeEvents} color="#059669" loading={loading} />
      </div>

      {/* ── Two-column grid ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>

        {/* Boys by Place */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <MapPin size={18} color="#2563EB" />
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Boys by Place</h2>
          </div>
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} style={{ marginBottom: '18px' }}>
                <Skeleton width="140px" height="14px" style={{ marginBottom: '6px' }} />
                <Skeleton height="8px" radius="99px" />
              </div>
            ))
          ) : boysByPlace.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data yet.</p>
          ) : (
            boysByPlace.map((p) => (
              <PlaceBar key={p.place} place={p.place} count={p.count} max={maxPlace} />
            ))
          )}
        </div>

        {/* Boys by Site / Event */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <BarChart2 size={18} color="#7C3AED" />
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Boys by Site</h2>
          </div>
          {loading ? (
            [1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--glass-border)',
                }}
              >
                <div>
                  <Skeleton width="160px" height="14px" style={{ marginBottom: '6px' }} />
                  <Skeleton width="100px" height="12px" />
                </div>
                <Skeleton width="36px" height="36px" radius="10px" />
              </div>
            ))
          ) : boysBySite.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data yet.</p>
          ) : (
            boysBySite.map((site, idx) => (
              <div
                key={site.eventId || idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: idx < boysBySite.length - 1 ? '1px solid var(--glass-border)' : 'none',
                }}
              >
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>{site.siteName}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>📍 {site.location}</p>
                </div>
                <div
                  style={{
                    minWidth: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'rgba(37,99,235,0.12)',
                    border: '1px solid rgba(37,99,235,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: '#2563EB',
                  }}
                >
                  {site.count}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* shimmer animation keyframes (injected once) */}
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}
