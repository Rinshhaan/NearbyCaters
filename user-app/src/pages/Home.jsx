import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import MapThumbnail from '../components/MapThumbnail';

function getDateLabel(dateStr) {
  const target = new Date(dateStr);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / 86400000);
  const relative = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff < 0 ? 'Past site' : target.toLocaleDateString('en-IN', { weekday: 'short' });
  return {
    day: target.toLocaleDateString('en-IN', { day: '2-digit' }),
    month: target.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
    relative,
    expired: diff < 0,
  };
}

function format12HourTime(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return value || 'Time to be announced';
  let hours = Number(match[1]);
  const minutes = match[2];
  if (match[3]) hours = (hours % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${minutes} ${suffix}`;
}

function getEventStart(event) {
  const date = new Date(event.date);
  const time = String(event.reportTime || '00:00');
  if (Number.isNaN(date.getTime()) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return new Date(0);
  return new Date(`${date.toISOString().slice(0, 10)}T${time}:00+05:30`);
}

function groupEventsByDate(events, { archived = false } = {}) {
  const now = Date.now();
  const sorted = [...events].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  if (archived) {
    const months = new Map();
    sorted.forEach(event => {
      const date = new Date(event.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!months.has(key)) months.set(key, { key, title: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), events: [] });
      months.get(key).events.push(event);
    });
    return [...months.values()].sort((a, b) => b.key.localeCompare(a.key));
  }

  const freshlyUpdated = sorted.filter(event => {
    const updated = new Date(event.updatedAt || event.createdAt || 0).getTime();
    return Number.isFinite(updated) && now - updated <= 48 * 60 * 60 * 1000;
  });
  const freshIds = new Set(freshlyUpdated.map(event => event.id));
  const groups = freshlyUpdated.length ? [{ key: 'fresh', title: 'New & recently updated', events: freshlyUpdated }] : [];
  const buckets = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  sorted.filter(event => !freshIds.has(event.id)).forEach(event => {
    const day = new Date(event.date);
    day.setHours(0, 0, 0, 0);
    const diff = Math.round((day - today) / 86400000);
    const key = diff < 0 ? 'past' : diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : diff <= 7 ? 'week' : 'upcoming';
    const title = { today: 'Today', tomorrow: 'Tomorrow', week: 'This week', upcoming: 'Upcoming', past: 'Past week' }[key];
    if (!buckets.has(key)) buckets.set(key, { key, title, events: [] });
    buckets.get(key).events.push(event);
  });
  const order = ['today', 'tomorrow', 'week', 'upcoming', 'past'];
  groups.push(...order.map(key => buckets.get(key)).filter(Boolean));
  return groups;
}

const isValidIndianPhone = (phone) => /^[6-9]\d{9}$/.test(String(phone).trim());

export default function Home() {
  const [events, setEvents]               = useState([]);
  const [archiveEvents, setArchiveEvents] = useState([]);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [archivePage, setArchivePage] = useState(1);
  const [archiveHasMore, setArchiveHasMore] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [recentPage, setRecentPage] = useState(1);
  const [recentHasMore, setRecentHasMore] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [search, setSearch]               = useState('');
  const [loading, setLoading]             = useState(true);
  const [bookingId, setBookingId]         = useState(null);
  const [showContactNumber, setShowContactNumber] = useState(false);

  // Group booking modal state
  const [selectedEventForBooking, setSelectedEventForBooking] = useState(null);
  const [bookingType, setBookingType]     = useState('solo'); // 'solo' | 'group'
  const [groupMembers, setGroupMembers]   = useState([{ name: '', phone: '' }]);
  const eventsRequestId = useRef(0);

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingEvent, setPendingEvent]   = useState(null);
  const [authMode, setAuthMode]           = useState('login');
  const [authMethod, setAuthMethod]       = useState('email');
  const [legacyLogin, setLegacyLogin]     = useState(false);
  const [authData, setAuthData]           = useState({ name: '', phone: '', place: '', email: '', password: '', confirmPassword: '', pin: '' });

  const { user, token, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const clientPortalUrl = import.meta.env.VITE_CLIENT_PORTAL_URL || 'http://localhost:5174';

  const fetchEvents = useCallback(async () => {
    const requestId = ++eventsRequestId.current;
    setLoading(true);
    try {
      const res = await api.get(`/events?search=${encodeURIComponent(search)}&limit=50`);
      if (requestId !== eventsRequestId.current) return;
      setEvents(res.data.events || []);
      setRecentPage(1);
      setRecentHasMore(Number(res.data.totalPages || 1) > 1);
      setArchiveEvents([]);
      setShowArchive(false);
      setArchiveTotal(Number(res.data.archivedTotal || 0));
      setArchivePage(1);
      setArchiveHasMore(false);
    } catch {
      if (requestId === eventsRequestId.current) toast.error('Could not load sites. Please try again.');
    } finally {
      if (requestId === eventsRequestId.current) setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchEvents, search ? 350 : 0);
    return () => {
      clearTimeout(t);
      eventsRequestId.current += 1;
    };
  }, [fetchEvents, search]);

  async function loadMoreRecent() {
    if (recentLoading || !recentHasMore) return;
    setRecentLoading(true);
    const nextPage = recentPage + 1;
    try {
      const res = await api.get(`/events?search=${encodeURIComponent(search)}&limit=50&page=${nextPage}`);
      setEvents(current => [...current, ...(res.data.events || []).filter(event => !current.some(item => item.id === event.id))]);
      setRecentPage(nextPage);
      setRecentHasMore(nextPage < Number(res.data.totalPages || 1));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not load more sites');
    } finally {
      setRecentLoading(false);
    }
  }

  async function toggleArchive() {
    if (showArchive) {
      setShowArchive(false);
      return;
    }
    setShowArchive(true);
    if (archiveEvents.length) return;
    setArchiveLoading(true);
    try {
      const res = await api.get(`/events?search=${encodeURIComponent(search)}&archived=true&limit=50&page=1`);
      setArchiveEvents(res.data.events || []);
      setArchiveTotal(Number(res.data.total || 0));
      setArchivePage(1);
      setArchiveHasMore(Number(res.data.totalPages || 1) > 1);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not load older sites');
      setShowArchive(false);
    } finally {
      setArchiveLoading(false);
    }
  }

  async function loadMoreArchive() {
    if (archiveLoading || !archiveHasMore) return;
    setArchiveLoading(true);
    const nextPage = archivePage + 1;
    try {
      const res = await api.get(`/events?search=${encodeURIComponent(search)}&archived=true&limit=50&page=${nextPage}`);
      setArchiveEvents(current => [...current, ...(res.data.events || []).filter(event => !current.some(item => item.id === event.id))]);
      setArchivePage(nextPage);
      setArchiveHasMore(nextPage < Number(res.data.totalPages || 1));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not load older sites');
    } finally {
      setArchiveLoading(false);
    }
  }

  // Opens booking choices (Solo vs Group)
  function handleOpenBookingModal(evt) {
    if (!token) {
      setPendingEvent(evt);
      setShowAuthModal(true);
      return;
    }
    setSelectedEventForBooking(evt);
    setBookingType('solo');
    setGroupMembers([{ name: '', phone: '' }]);
  }

  // Dynamic Group Member Handlers
  function addGroupMember() {
    if (!selectedEventForBooking) return;
    const bookedCount = selectedEventForBooking._count?.bookings || 0;
    const slotsNeeded = selectedEventForBooking.slotsNeeded;
    const currentRequested = 1 + groupMembers.length;

    if (slotsNeeded !== null && currentRequested >= (slotsNeeded - bookedCount)) {
      return toast.error(`Cannot add more friends. Only ${slotsNeeded - bookedCount} slots remaining.`);
    }
    if (groupMembers.length >= 10) {
      return toast.error('Maximum 10 friends per group booking.');
    }
    setGroupMembers([...groupMembers, { name: '', phone: '' }]);
  }

  function removeGroupMember(index) {
    if (groupMembers.length <= 1) return;
    setGroupMembers(groupMembers.filter((_, i) => i !== index));
  }

  function updateGroupMember(index, field, value) {
    const updated = [...groupMembers];
    updated[index][field] = value;
    setGroupMembers(updated);
  }

  // Submit Booking (Solo or Group)
  async function submitConfirmedBooking() {
    if (!selectedEventForBooking) return;
    setBookingId(selectedEventForBooking.id);

    try {
      const payload = { eventId: selectedEventForBooking.id };

      if (bookingType === 'group') {
        const cleanedMembers = [];
        const seenPhones = new Set([user?.phone]);

        for (let i = 0; i < groupMembers.length; i++) {
          const m = groupMembers[i];
          const name = m.name.trim();
          const phone = m.phone.trim();

          if (!name) {
            toast.error(`Please enter friend #${i + 1}'s full name`);
            setBookingId(null);
            return;
          }
          if (!isValidIndianPhone(phone)) {
            toast.error(`Friend #${i + 1} (${name}): Enter a real 10-digit Indian mobile number`);
            setBookingId(null);
            return;
          }
          if (seenPhones.has(phone)) {
            toast.error(`Duplicate number: ${phone}. Each member must have a distinct number.`);
            setBookingId(null);
            return;
          }
          seenPhones.add(phone);
          cleanedMembers.push({ name, phone });
        }
        payload.members = cleanedMembers;
      }

      const res = await api.post('/bookings', payload);
      toast.success(res.data.message || 'Slots confirmed successfully');
      setSelectedEventForBooking(null);
      fetchEvents();
      navigate('/bookings');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not complete booking');
    } finally {
      setBookingId(null);
    }
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    try {
      if (authMode === 'register' && authData.password !== authData.confirmPassword) {
        return toast.error('Passwords do not match');
      }
      let res;
      if (authMode === 'login') {
        res = legacyLogin
          ? await api.post('/auth/user/login', { phone: authData.phone, pin: authData.pin })
          : await api.post('/auth/user/login', authMethod === 'phone'
              ? { phone: authData.phone, password: authData.password }
              : { email: authData.email, password: authData.password });
      } else {
        if (authData.password !== authData.confirmPassword) return toast.error('Passwords do not match');
        const registration = {
          name: authData.name,
          place: authData.place,
          password: authData.password,
          [authMethod]: authData[authMethod],
        };
        res = await api.post('/auth/user/register', registration);
      }
      setAuth(res.data.user, res.data.token);
      toast.success(`Welcome back, ${res.data.user.name}`);
      setShowAuthModal(false);

      if (pendingEvent) {
        setSelectedEventForBooking(pendingEvent);
        setPendingEvent(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Auth failed');
    }
  }

  const recentGroups = groupEventsByDate(events);
  const archiveGroups = groupEventsByDate(archiveEvents, { archived: true });

  return (
    <>
      {/* ── Search & Header Section ── */}
      <div className="search-container">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="search-bar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.4">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className="search-input"
              placeholder="Search catering site, venue, city (e.g. Kozhikode, Kochi, Malappuram)…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', lineHeight: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Section Title ── */}
      <div className="section-heading-wrap">
        <h2 className="section-heading">Open Catering Sites</h2>
        <p className="section-sub">Book slots individually or with your friends across Kerala</p>
      </div>

      {/* ── Responsive Event Grid (Mobile Single Column, Desktop 3-4 Columns) ── */}
      <div className="events-grid">
        {loading ? (
          [1,2,3,4,5,6].map(n => (
            <div key={n} className="glass-card event-card">
              <div className="map-skeleton" />
              <div style={{ padding: '18px 20px 20px' }}>
                <div style={{ background: '#E2E8F0', height: 18, borderRadius: 8, marginBottom: 10, width: '70%' }}/>
                <div style={{ background: '#E2E8F0', height: 12, borderRadius: 8, marginBottom: 8, width: '45%' }}/>
                <div style={{ background: '#E2E8F0', height: 12, borderRadius: 8, marginBottom: 16, width: '35%' }}/>
                <div style={{ background: '#E2E8F0', height: 44, borderRadius: 14 }}/>
              </div>
            </div>
          ))
        ) : events.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-icon">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.6" opacity="0.5">
                <path d="M3 11h18M12 11V3M5 11c0 5.523 3.134 8 7 8s7-2.477 7-8M8 3h8"/>
              </svg>
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 6, color: '#0F172A' }}>No Sites Available</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: 280 }}>
              {search ? `No sites found matching "${search}". Try searching for another city or venue.` : 'Check back soon for new catering sites.'}
            </p>
          </div>
        ) : (
          recentGroups.map(group => (
            <React.Fragment key={group.key}>
              <div className="event-date-group-heading">
                <h3>{group.title}</h3>
                <span>{group.events.length} {group.events.length === 1 ? 'site' : 'sites'}</span>
              </div>
              {group.events.map(evt => {
            const bookedCount = evt._count?.bookings || 0;
            const slotsLeft   = evt.slotsNeeded != null ? evt.slotsNeeded - bookedCount : null;
            const isFull      = slotsLeft !== null && slotsLeft <= 0;
            const dateLabel   = getDateLabel(evt.date);
            const isExpired   = getEventStart(evt).getTime() <= Date.now();
            const updatedAt   = new Date(evt.updatedAt || evt.createdAt || 0).getTime();
            const isFresh     = Number.isFinite(updatedAt) && Date.now() - updatedAt <= 48 * 60 * 60 * 1000;
            const isLoading   = bookingId === evt.id;

            return (
              <div key={evt.id} className={`glass-card event-card ${isExpired ? 'event-card-expired' : ''}`}>
                <MapThumbnail
                  location={evt.location}
                  locationMapUrl={evt.locationMapUrl}
                  imageUrl={evt.imageUrl}
                  topBadge={
                    <span className={`event-date-badge ${isExpired ? 'event-date-badge-expired' : ''}`}>
                      <CalendarDays size={17} strokeWidth={2.3} />
                      <span className="event-date-badge-day">{dateLabel.day}<small>{dateLabel.month}</small></span>
                      <span className="event-date-badge-label">{dateLabel.relative || 'Site date'}</span>
                    </span>
                  }
                />

                <div className="event-card-body">
                  <div className="event-card-header">
                    <h3 className="event-title">{evt.name}</h3>
                    {isFresh && !isExpired && <span className="event-updated-badge"><Sparkles size={12} /> New</span>}
                  </div>

                  {/* ── Client / Partner Chip (Clickable → /client/:id) ── */}
                  {evt.client && (
                    <div
                      onClick={e => { e.stopPropagation(); navigate(`/client/${evt.client.id}`); }}
                      className="event-partner-chip"
                      title={`View ${evt.client.companyName || evt.client.name}'s verified profile`}
                    >
                      <div className="partner-chip-left">
                        {evt.client.logoUrl ? (
                          <img
                            src={evt.client.logoUrl}
                            alt=""
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              flexShrink: 0,
                              border: '1.5px solid rgba(37, 99, 235, 0.25)',
                            }}
                          />
                        ) : (
                          <div style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #2563EB, #60A5FA)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: '0.74rem',
                            flexShrink: 0,
                          }}>
                            {(evt.client.companyName || evt.client.name || 'C')[0].toUpperCase()}
                          </div>
                        )}
                        <span className="partner-chip-name">
                          {evt.client.companyName || evt.client.name}
                        </span>
                      </div>

                      {evt.client.rating > 0 ? (
                        <span className="partner-rating-badge">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          {Number(evt.client.rating).toFixed(1)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>Partner ›</span>
                      )}
                    </div>
                  )}

                  <div className="event-meta">
                    <div className="event-meta-row">
                      <div className="meta-icon-container blue">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </div>
                      <span style={{ color: '#1E293B', fontWeight: 600 }}>{evt.location}</span>
                    </div>

                    <div className="event-meta-row">
                      <div className="meta-icon-container amber">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <span>Report at <strong style={{ color: '#0F172A', fontWeight: 700 }}>{format12HourTime(evt.reportTime)}</strong></span>
                    </div>

                    <div className="event-meta-row">
                      <div className="meta-icon-container emerald">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </div>
                      {isFull
                        ? <span className="slot-pill slot-pill-full">All slots filled</span>
                        : slotsLeft != null
                          ? <span className="slot-pill slot-pill-open">{slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} remaining</span>
                          : <span className="slot-pill slot-pill-open">{bookedCount} joined • Unlimited slots</span>
                      }
                    </div>
                  </div>

                  {evt.description && (
                    <div className="event-description">{evt.description}</div>
                  )}

                  {isExpired && <span className="event-ended-note">This site has ended</span>}

                  <button
                    disabled={isFull || isLoading || isExpired}
                    onClick={() => handleOpenBookingModal(evt)}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      height: '44px',
                      marginTop: 'auto',
                      opacity: (isFull || isLoading) ? 0.5 : 1,
                      cursor: (isFull || isLoading) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isExpired ? (
                      <>Site Ended</>
                    ) : isLoading ? (
                      <span style={{ opacity: 0.85 }}>Reserving Slot…</span>
                    ) : isFull ? (
                      'Slots Full'
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <line x1="19" y1="8" x2="19" y2="14" />
                          <line x1="22" y1="11" x2="16" y2="11" />
                        </svg>
                        Book Slot (Solo / Friends)
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
            </React.Fragment>
          ))
        )}
      </div>

      {recentHasMore && !loading && (
        <div className="event-list-actions">
          <button type="button" className="event-archive-button" onClick={loadMoreRecent} disabled={recentLoading}>
            {recentLoading ? 'Loading more sites…' : 'Load more current sites'}
          </button>
        </div>
      )}

      {archiveTotal > 0 && !loading && (
        <div className="event-list-actions event-archive-actions">
          <button type="button" className="event-archive-button" onClick={toggleArchive} disabled={archiveLoading}>
            {archiveLoading ? 'Loading older sites…' : showArchive ? 'Hide older sites' : `Show more · Past sites (${archiveTotal})`}
          </button>
        </div>
      )}

      {showArchive && (
        <section className="event-archive-section" aria-label="Sites from more than one week ago">
          <div className="event-archive-title">
            <div>
              <span>Past sites</span>
              <h2>More than a week ago</h2>
            </div>
            <span className="event-archive-count">{archiveTotal} {archiveTotal === 1 ? 'site' : 'sites'}</span>
          </div>
          {archiveLoading && archiveEvents.length === 0 ? <div className="event-archive-empty">Loading older sites…</div> : archiveEvents.length === 0 ? <div className="event-archive-empty">No older sites found.</div> : (
            <div className="events-grid event-archive-grid">
              {archiveGroups.map(group => (
                <React.Fragment key={group.key}>
                  <div className="event-date-group-heading event-archive-month-heading"><h3>{group.title}</h3><span>{group.events.length} {group.events.length === 1 ? 'site' : 'sites'}</span></div>
                  {group.events.map(evt => {
                    const dateLabel = getDateLabel(evt.date);
                    return (
                      <div key={evt.id} className="glass-card event-card event-card-expired">
                        <MapThumbnail location={evt.location} locationMapUrl={evt.locationMapUrl} imageUrl={evt.imageUrl}
                          topBadge={<span className="event-date-badge event-date-badge-expired"><CalendarDays size={17} strokeWidth={2.3} /><span className="event-date-badge-day">{dateLabel.day}<small>{dateLabel.month}</small></span><span className="event-date-badge-label">Past site</span></span>} />
                        <div className="event-card-body">
                          <div className="event-card-header"><h3 className="event-title">{evt.name}</h3></div>
                          <div className="event-meta">
                            <div className="event-meta-row"><div className="meta-icon-container blue"><MapPin size={14} /></div><span>{evt.location}</span></div>
                            <div className="event-meta-row"><div className="meta-icon-container amber"><Clock size={14} /></div><span>Report at <strong>{format12HourTime(evt.reportTime)}</strong></span></div>
                          </div>
                          {evt.description && <div className="event-description">{evt.description}</div>}
                          <span className="event-ended-note">This site has ended</span>
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          )}
          {archiveHasMore && <div className="event-list-actions"><button type="button" className="event-archive-button" onClick={loadMoreArchive} disabled={archiveLoading}>{archiveLoading ? 'Loading…' : 'Load more past sites'}</button></div>}
        </section>
      )}

      {/* ── Partner signup ── */}
      <section className="partner-section">
        <div className="partner-card">
          <div className="partner-copy">
            <span className="partner-eyebrow">For catering partners</span>
            <h2>Build your event team</h2>
            <p>Post catering shifts and connect with staff across Kerala.</p>
            <div className="partner-transparency">
              <span>No event listing fee</span>
              <span>A small charge per confirmed boys booking</span>
              <span>Profiles reviewed before going live</span>
            </div>
          </div>
          <div className="partner-actions">
            <a className="btn btn-primary" href={`${clientPortalUrl}/register`} target="_blank" rel="noreferrer">Create partner account</a>
            <a className="partner-login-link" href={`${clientPortalUrl}/login`} target="_blank" rel="noreferrer">Already a partner? Sign in</a>
          </div>
        </div>
      </section>

      {/* ── Light Grey Footer with Contact ── */}
      <footer className="app-footer">
        <div className="footer-inner">
          <div className="footer-col">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <img src="/nearby-caters-logo.jpg" alt="Nearby Caters" width="36" height="36" style={{ display: 'block', objectFit: 'contain' }} />
              <span style={{ fontWeight: 900, fontSize: '1.15rem', color: '#0F172A' }}>Nearby Caters</span>
            </div>
            <p>
              Kerala's dedicated catering workforce platform connecting event organizers with punctual, verified staff across all 14 districts.
            </p>
          </div>

          <div className="footer-col">
            <h4>Support & Help</h4>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Coverage: Kozhikode, Malappuram, Ernakulam, Kannur, Thrissur &amp; all Kerala
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 .81h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
                {showContactNumber ? (
                  <><a href="https://wa.me/918078240018?text=Hello%20Nearby%20Caters" target="_blank" rel="noopener noreferrer">8078240018</a><button type="button" className="contact-reveal-button" onClick={() => setShowContactNumber(false)}>Hide</button></>
                ) : (
                  <button type="button" className="contact-reveal-button" onClick={() => setShowContactNumber(true)}>Show contact number</button>
                )}
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <a href="mailto:nearbycaters@gmail.com">nearbycaters@gmail.com</a>
            </p>

          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Nearby Caters Platform. Built for Kerala Catering Services.</span>
          <span>Terms of Service • Privacy Policy</span>
        </div>
      </footer>

      {/* ── Group & Solo Booking Modal ── */}
      {selectedEventForBooking && (
        <div className="modal-overlay" onClick={() => setSelectedEventForBooking(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A' }}>Book Catering Slot</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{selectedEventForBooking.name}</p>
              </div>
              <button
                onClick={() => setSelectedEventForBooking(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            {/* Booking Type Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '18px' }}>
              <button
                type="button"
                onClick={() => setBookingType('solo')}
                className={`btn ${bookingType === 'solo' ? 'btn-primary' : 'btn-glass'}`}
                style={{ padding: '10px 14px', fontSize: '0.84rem', gap: 6 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Individual (1 Slot)
              </button>
              <button
                type="button"
                onClick={() => setBookingType('group')}
                className={`btn ${bookingType === 'group' ? 'btn-primary' : 'btn-glass'}`}
                style={{ padding: '10px 14px', fontSize: '0.84rem', gap: 6 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Group Booking
              </button>
            </div>

            {bookingType === 'solo' ? (
              <div style={{ background: 'rgba(239, 246, 255, 0.7)', padding: '16px', borderRadius: '14px', marginBottom: '20px', border: '1px solid rgba(191, 219, 254, 0.8)' }}>
                <p style={{ fontSize: '0.88rem', color: '#1E293B', fontWeight: 600 }}>
                  Booking as <strong>{user?.name}</strong> • {user?.phone || user?.email}
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Your spot will be confirmed immediately. You will receive report countdown reminders.
                </p>
              </div>
            ) : (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ background: 'rgba(239, 246, 255, 0.7)', padding: '12px 16px', borderRadius: '12px', marginBottom: '14px', border: '1px solid rgba(191, 219, 254, 0.8)' }}>
                  <p style={{ fontSize: '0.84rem', color: '#1E293B', fontWeight: 600 }}>
                    Organizer: <strong>{user?.name}</strong> • {user?.phone || user?.email}
                  </p>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Add your friends below so all of you get slots together. Each friend needs a mobile no.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {groupMembers.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #CBD5E1',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase' }}>
                          Friend #{idx + 1}
                        </span>
                        {groupMembers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeGroupMember(idx)}
                            style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <input
                            type="text"
                            required
                            placeholder="Full Name"
                            className="form-input"
                            style={{ padding: '8px 10px', fontSize: '0.82rem' }}
                            value={m.name}
                            onChange={(e) => updateGroupMember(idx, 'name', e.target.value)}
                          />
                        </div>
                        <div>
                          <input
                            type="tel"
                            required
                            maxLength={10}
                            aria-label={`Friend ${idx + 1} mobile no.`}
                            placeholder="Mobile no."
                            className="form-input"
                            style={{ padding: '8px 10px', fontSize: '0.82rem' }}
                            value={m.phone}
                            onChange={(e) => updateGroupMember(idx, 'phone', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addGroupMember}
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: '12px', padding: '10px', fontSize: '0.82rem', gap: 6 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Another Friend ({1 + groupMembers.length} Slots Total)
                </button>
              </div>
            )}

            <button
              disabled={bookingId !== null}
              onClick={submitConfirmedBooking}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '0.95rem' }}
            >
              {bookingId !== null ? 'Confirming Slots...' : `Confirm & Reserve ${bookingType === 'solo' ? '1 Slot' : `${1 + groupMembers.length} Slots`}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Auth Bottom Sheet Modal ── */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: 4, color: '#0F172A' }}>
              {authMode === 'login' ? 'Welcome Back' : 'Join Nearby Caters'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
              {authMode === 'login'
                ? `Sign in with your ${authMethod === 'phone' ? 'mobile number' : 'email'} and password to book`
                : 'Choose email or mobile to create your account'}
            </p>

            <form onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" required placeholder="e.g. Mohammed Shafi" value={authData.name}
                      onChange={e => setAuthData({ ...authData, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Your Location (District / City)</label>
                    <input className="form-input" required placeholder="e.g. Manjeri, Malappuram" value={authData.place}
                      onChange={e => setAuthData({ ...authData, place: e.target.value })} />
                  </div>
                </>
              )}

              {!legacyLogin && <div style={{ marginBottom: 14 }}>
                <label className="form-label">{authMode === 'login' ? 'Continue with' : 'Create account with'}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 4, borderRadius: 10, background: '#F1F5F9' }}>
                  {[
                    { value: 'email', label: 'Email + password' },
                    { value: 'phone', label: 'Mobile + password' },
                  ].map(option => (
                    <button key={option.value} type="button" onClick={() => setAuthMethod(option.value)} style={{
                      padding: '9px 6px', border: 0, borderRadius: 7, cursor: 'pointer',
                      background: authMethod === option.value ? '#fff' : 'transparent',
                      color: authMethod === option.value ? '#2563EB' : '#64748B',
                      boxShadow: authMethod === option.value ? '0 1px 4px rgba(15,23,42,.1)' : 'none',
                      fontSize: '0.76rem', fontWeight: 750,
                    }}>{option.label}</button>
                  ))}
                </div>
              </div>}

              {(legacyLogin || authMethod === 'phone') ? <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input className="form-input" type="tel" required maxLength={10} autoComplete="tel" placeholder="9876543210"
                  value={authData.phone} onChange={e => setAuthData({ ...authData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
              </div> : <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" type="email" required autoComplete="email" placeholder="you@example.com"
                  value={authData.email} onChange={e => setAuthData({ ...authData, email: e.target.value })} />
              </div>}

              {authMode === 'login' && legacyLogin ? <div className="form-group">
                <label className="form-label">Existing 4-Digit PIN</label>
                <input className="form-input" type="password" inputMode="numeric" required maxLength={4} placeholder="••••" value={authData.pin}
                  onChange={e => setAuthData({ ...authData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
              </div> : <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" required minLength={8} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters"
                  value={authData.password} onChange={e => setAuthData({ ...authData, password: e.target.value })} />
              </div>}
              {authMode === 'register' && <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input className="form-input" type="password" required minLength={8} autoComplete="new-password" placeholder="Repeat your password"
                  value={authData.confirmPassword} onChange={e => setAuthData({ ...authData, confirmPassword: e.target.value })} />
              </div>}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
                {authMode === 'login' ? 'Sign In & Continue' : 'Create Profile & Continue'}
              </button>

              <div style={{ textAlign: 'center', marginTop: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {authMode === 'login' ? (
                  <>{!legacyLogin && <span onClick={() => { setShowAuthModal(false); navigate('/forgot-password'); }} style={{ display: 'inline-block', marginBottom: 12, color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}>Forgot password?</span>}<br /><span onClick={() => { setLegacyLogin(v => !v); setAuthMethod(legacyLogin ? 'email' : 'phone'); }} style={{ color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}>{legacyLogin ? 'Use email or mobile + password' : 'Use an older phone + PIN account'}</span><br />New staff? <span onClick={() => { setLegacyLogin(false); setAuthMode('register'); }}
                    style={{ color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}>Register</span></>
                ) : (
                  <>Already registered? <span onClick={() => setAuthMode('login')}
                    style={{ color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}>Sign In</span></>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
