import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Clock, MapPin, Trash2, Lock, CalendarCheck2, Bell, Flame, Star, Trophy } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import MapThumbnail from '../components/MapThumbnail';
import { getMapRedirectUrl } from '../components/mapUtils';

// ── Live countdown ──
function useCountdown(dateStr, timeStr) {
  const [display, setDisplay] = useState('');
  const [urgency, setUrgency] = useState('normal');

  useEffect(() => {
    function calc() {
      try {
        const eventDate = new Date(dateStr);
        if (Number.isNaN(eventDate.getTime()) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) return;
        const target = new Date(`${eventDate.toISOString().slice(0, 10)}T${timeStr}:00+05:30`);
        const diff = target - Date.now();
        if (diff <= 0) { setDisplay('Event started'); setUrgency('normal'); return; }
        const d = Math.floor(diff / 86400000);
        const hr = Math.floor(diff / 3600000) % 24;
        const mn = Math.floor(diff / 60000) % 60;
        if (d > 0) { setDisplay(`${d}d ${hr}h left`); setUrgency('normal'); }
        else if (hr >= 2) { setDisplay(`${hr}h ${mn}m left`); setUrgency('soon'); }
        else { setDisplay(`${hr ? `${hr}h ` : ''}${mn}m left`); setUrgency('urgent'); }
      } catch { setDisplay(''); }
    }
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [dateStr, timeStr]);

  return { display, urgency };
}

function eventStart(booking) {
  const date = new Date(booking.event.date);
  const time = booking.event.reportTime || '00:00';
  if (Number.isNaN(date.getTime()) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return new Date(0);
  return new Date(`${date.toISOString().slice(0, 10)}T${time}:00+05:30`);
}

function format12HourTime(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return value || 'Time to be announced';
  let hours = Number(match[1]);
  if (match[3]) hours = (hours % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? 'PM' : 'AM'}`;
}

function BookingCard({ booking, onCancel, upcoming }) {
  const { display: countdown, urgency } = useCountdown(booking.event.date, booking.event.reportTime);

  const urgencyStyles = {
    normal: { bg: 'rgba(37, 99, 235, 0.08)', border: 'rgba(37, 99, 235, 0.25)', text: '#1D4ED8' },
    soon:   { bg: 'rgba(217, 119, 6, 0.08)', border: 'rgba(217, 119, 6, 0.25)', text: '#B45309' },
    urgent: { bg: 'rgba(225, 29, 72, 0.08)', border: 'rgba(225, 29, 72, 0.25)',  text: '#BE123C' },
  }[urgency];

  return (
    <div className="glass-card booking-card event-card">
      <MapThumbnail
        location={booking.event.location}
        locationMapUrl={booking.event.locationMapUrl}
        imageUrl={booking.event.imageUrl}
        topBadge={countdown ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: `1px solid ${urgencyStyles.border}`,
            color: urgencyStyles.text,
            padding: '4px 10px',
            borderRadius: 99,
            fontSize: '0.72rem',
            fontWeight: 800,
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.12)',
            letterSpacing: '-0.01em',
          }}>
            <Clock size={12} />
            {countdown}
          </span>
        ) : null}
      />

      <div className="event-card-body">
        <div className="event-card-header" style={{ marginBottom: 4 }}>
          <h3 className="event-title">
            {booking.event.name}
          </h3>
        </div>

        <p style={{
          fontSize: '0.78rem',
          color: '#2563EB',
          fontWeight: 700,
          background: 'rgba(37, 99, 235, 0.06)',
          border: '1px solid rgba(191, 219, 254, 0.6)',
          padding: '4px 9px',
          borderRadius: 8,
          width: 'fit-content',
          marginBottom: 12,
        }}>
          {new Date(booking.event.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </p>

        <div className="event-meta">
          <div className="event-meta-row">
            <div className="meta-icon-container blue">
              <MapPin size={14} />
            </div>
            <span style={{ color: '#1E293B', fontWeight: 600 }}>{booking.event.location}</span>
          </div>

          <div className="event-meta-row">
            <div className="meta-icon-container amber">
              <Clock size={14} />
            </div>
            <span>Report at <strong style={{ color: '#0F172A', fontWeight: 700 }}>{format12HourTime(booking.event.reportTime)}</strong></span>
          </div>
        </div>

        {booking.event.client && <Link to={`/client/${booking.event.client.id}`} style={{ fontSize: 12, color: '#2563EB', fontWeight: 750, textDecoration: 'none', marginTop: 10 }}>Partner · {booking.event.client.companyName || booking.event.client.name} →</Link>}

        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 14 }}>
          {booking.event.locationMapUrl && (
            <a
              href={getMapRedirectUrl(booking.event.locationMapUrl, booking.event.location)}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{ flex: 1, height: '40px', fontSize: '0.82rem', padding: '0 12px', justifyContent: 'center' }}
            >
              <MapPin size={14} color="#2563EB" />
              <span>Map Route</span>
            </a>
          )}
          {upcoming ? <button
            onClick={() => onCancel(booking.id, booking.event.name)}
            className="btn-danger-glass"
            style={{ flex: booking.event.locationMapUrl ? '0 0 auto' : 1, height: '40px', padding: '0 14px', justifyContent: 'center' }}
          >
            <Trash2 size={14} /><span>{booking.event.locationMapUrl ? 'Cancel' : 'Cancel Slot'}</span>
          </button> : <span style={{ flex: 1, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 11, background: booking.attended ? '#ecfdf5' : '#f1f5f9', color: booking.attended ? '#047857' : '#64748b', fontSize: 12, fontWeight: 800 }}>{booking.attended ? '✓ Attended' : 'Attendance not recorded'}</span>}
        </div>
      </div>
    </div>
  );
}

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [clockNow, setClockNow] = useState(Date.now());
  const [notificationPermission, setNotificationPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const { user, token }         = useAuthStore();

  useEffect(() => {
    if (token) fetchBookings();
    else setLoading(false);
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token || notificationPermission !== 'granted' || typeof Notification === 'undefined') return undefined;
    const timer = setInterval(() => {
      const now = Date.now();
      bookings.filter(booking => eventStart(booking).getTime() > now).forEach(booking => {
        const reminderAt = eventStart(booking).getTime() - 60 * 60 * 1000;
        const reminderKey = `nearby-reminder-${user?.id || 'staff'}-${booking.id}`;
        if (now >= reminderAt && !localStorage.getItem(reminderKey)) {
          new Notification('Your site starts in about an hour', {
            body: `${booking.event.name} · report at ${booking.event.reportTime}, ${booking.event.location}`,
            tag: reminderKey,
          });
          localStorage.setItem(reminderKey, 'sent');
        }
      });
    }, 15000);
    return () => clearInterval(timer);
  }, [bookings, notificationPermission, token, user?.id]);

  async function fetchBookings() {
    try {
      const res = await api.get('/bookings/mine');
      setBookings(res.data);
    } catch {}
    finally { setLoading(false); }
  }

  async function handleCancel(id, name) {
    if (!window.confirm(`Cancel your slot for "${name}"?`)) return;
    try {
      await api.delete(`/bookings/${id}`);
      toast.success('Slot cancelled successfully');
      setBookings(b => b.filter(x => x.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cancel failed');
    }
  }

  async function enableSiteReminders() {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return toast.error('This browser does not support notifications.');
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') toast.success('One-hour site reminders are on');
    else toast.error('Notification permission was not granted');
  }

  const upcomingBookings = bookings
    .filter(booking => eventStart(booking).getTime() > clockNow)
    .sort((a, b) => eventStart(a) - eventStart(b));
  const takenBookings = bookings
    .filter(booking => eventStart(booking).getTime() <= clockNow)
    .sort((a, b) => eventStart(b) - eventStart(a));
  const attendedCount = takenBookings.filter(booking => booking.attended).length;
  const participationStars = Math.min(5, Math.floor(attendedCount / 2));
  let currentStreak = 0;
  for (const booking of takenBookings) {
    if (!booking.attended) break;
    currentStreak += 1;
  }
  let bestStreak = 0;
  let runningStreak = 0;
  [...takenBookings].reverse().forEach(booking => {
    runningStreak = booking.attended ? runningStreak + 1 : 0;
    bestStreak = Math.max(bestStreak, runningStreak);
  });

  if (!token) {
    return (
      <div className="empty-state">
        <div className="empty-icon" style={{
          width: 54, height: 54, borderRadius: '50%',
          background: 'rgba(37, 99, 235, 0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#2563EB', margin: '0 auto 14px',
        }}>
          <Lock size={26} />
        </div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 6, color: '#0F172A' }}>Sign In to View Bookings</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', maxWidth: 280 }}>
          Book a slot from the Explore page and your confirmed catering events will appear here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', paddingBottom: 34 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <div className="section-heading-wrap" style={{ marginBottom: 0 }}>
          <h2 className="section-heading">My Booked Sites</h2>
          <p className="section-sub">Your upcoming shifts, attendance history, and participation streaks</p>
        </div>
        <button onClick={enableSiteReminders} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <Bell size={16} /> {notificationPermission === 'granted' ? '1-hour reminders on' : 'Enable 1-hour reminders'}
        </button>
      </div>

      <div className="participation-overview" role="group" aria-label="Your participation summary">
        <div className="participation-stat participation-stat-blue">
          <div className="participation-stat-heading"><span className="participation-stat-icon"><CalendarCheck2 size={15} /></span><span>Coming up</span></div>
          <strong className="participation-stat-value">{loading ? '—' : upcomingBookings.length}</strong>
          <span className="participation-stat-detail">confirmed sites</span>
        </div>
        <div className="participation-stat participation-stat-green">
          <div className="participation-stat-heading"><span className="participation-stat-icon"><Trophy size={15} /></span><span>Attended</span></div>
          <strong className="participation-stat-value">{loading ? '—' : attendedCount}</strong>
          <span className="participation-stat-detail">recorded sites</span>
        </div>
        <div className="participation-stat participation-stat-orange">
          <div className="participation-stat-heading"><span className="participation-stat-icon streak-flame"><Flame size={15} /></span><span>Current streak</span></div>
          <strong className="participation-stat-value">{loading ? '—' : currentStreak}</strong>
          <span className="participation-stat-detail">best streak: {bestStreak}</span>
        </div>
        <div className="participation-stat participation-stat-gold">
          <div className="participation-stat-heading"><span className="participation-stat-icon"><Star size={15} /></span><span>Participation stars</span></div>
          <div className="participation-stars" role="img" aria-label={`${participationStars} of 5 participation stars`}>
            {[0, 1, 2, 3, 4].map(i => <Star className={i < participationStars ? 'participation-star-earned' : ''} key={i} size={16} fill={i < participationStars ? 'currentColor' : 'none'} />)}
          </div>
          <span className="participation-stat-detail">1 star per 2 attended sites</span>
        </div>
      </div>

      <section style={{ marginBottom: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', background: '#eff6ff', color: '#2563eb' }}><CalendarCheck2 size={18} /></div>
          <div><h3 style={{ margin: 0, color: '#0f172a', fontSize: 18, fontWeight: 850 }}>Upcoming work</h3><p style={{ margin: '3px 0 0', color: '#64748b', fontSize: 12 }}>Arrival countdowns and site details</p></div>
        </div>
        <div className="events-grid">
          {loading ? [1,2].map(n => <div key={n} className="glass-card booking-card"><div className="map-skeleton" /><div style={{ padding: 18 }}><div style={{ background: '#E2E8F0', height: 18, borderRadius: 8, width: '65%', marginBottom: 10 }} /><div style={{ background: '#E2E8F0', height: 42, borderRadius: 12 }} /></div></div>) : upcomingBookings.length ? upcomingBookings.map(booking => <BookingCard key={booking.id} booking={booking} onCancel={handleCancel} upcoming />) : (
            <div className="empty-state" style={{ gridColumn: '1 / -1', padding: 24 }}><CalendarCheck2 size={24} color="#2563EB" /><h3 style={{ margin: '8px 0 4px', fontSize: 16 }}>No upcoming sites</h3><p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Explore open sites to book your next shift.</p></div>
          )}
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', background: '#ecfdf5', color: '#059669' }}><Trophy size={18} /></div>
          <div><h3 style={{ margin: 0, color: '#0f172a', fontSize: 18, fontWeight: 850 }}>Taken sites</h3><p style={{ margin: '3px 0 0', color: '#64748b', fontSize: 12 }}>Past dates, locations, partner details, and attendance</p></div>
        </div>
        <div className="events-grid">
          {!loading && takenBookings.length ? takenBookings.map(booking => <BookingCard key={booking.id} booking={booking} onCancel={handleCancel} upcoming={false} />) : !loading ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1', padding: 24 }}><Trophy size={24} color="#059669" /><h3 style={{ margin: '8px 0 4px', fontSize: 16 }}>Your history will build here</h3><p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>After your first site, its date and attendance record will appear here.</p></div>
          ) : null}
        </div>
      </section>
      <p style={{ textAlign: 'center', marginTop: 24, color: '#94a3b8', fontSize: 11 }}>Reminder emails are sent when your account has an email address. Browser alerts need permission and this page open.</p>
    </div>
  );
}
