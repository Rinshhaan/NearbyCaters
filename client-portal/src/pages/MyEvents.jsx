import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, Eye, Plus, CheckCircle2, Clock, Search, Edit3, Lock } from 'lucide-react';
import api from '../lib/api';
import MapThumbnail from '../components/MapThumbnail';

export function canEditEvent(evt) {
  if (!evt || !evt.date || !evt.reportTime) return true;
  try {
    const match = evt.reportTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return true;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const eventDate = new Date(evt.date);
    const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const attendanceStart = new Date(`${eventDate.toISOString().slice(0, 10)}T${time}:00+05:30`);

    return new Date() < attendanceStart;
  } catch (err) {
    return true;
  }
}

export default function MyEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await api.get('/events/client/mine');
      setEvents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter((evt) => {
    const q = search.toLowerCase();
    return (
      evt.name.toLowerCase().includes(q) ||
      evt.location.toLowerCase().includes(q) ||
      (evt.status && evt.status.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>My Catering Events</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Manage published sites, view booked boys, track wages, and take attendance
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search bar on sites */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', paddingY: '8px', fontSize: '0.85rem' }}
              placeholder="Search site, venue, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Link to="/create-event" className="btn btn-primary">
            <Plus size={16} />
            <span>Publish New Event</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <p>Loading your events...</p>
      ) : events.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Calendar size={28} color="var(--primary)" />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>No Events Published Yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px', marginBottom: '16px' }}>
            Publish your first catering event to start recruiting boys across your district.
          </p>
          <Link to="/create-event" className="btn btn-primary">
            <Plus size={16} />
            <span>Create Event Now</span>
          </Link>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ color: 'var(--text-muted)' }}>No sites found matching "{search}".</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredEvents.map((evt) => {
            const isGreenPaid = evt.allStaffPaid;
            const editable = canEditEvent(evt);

            return (
              <div
                key={evt.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 0,
                  overflow: 'hidden',
                  borderColor: isGreenPaid ? '#10B981' : 'var(--glass-border)',
                  background: isGreenPaid
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.05))'
                    : 'var(--glass-1)',
                  boxShadow: isGreenPaid ? '0 10px 30px rgba(16, 185, 129, 0.15)' : 'var(--glass-shadow)',
                  transition: 'all 0.3s ease',
                }}
              >
                {/* Google Maps Thumbnail with 1-click redirect */}
                <MapThumbnail
                  location={evt.location}
                  locationMapUrl={evt.locationMapUrl}
                  imageUrl={evt.imageUrl}
                />

                <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span className={`badge ${evt.status === 'published' ? 'badge-success' : evt.status === 'completed' ? 'badge-warning' : 'badge-danger'}`}>
                        {evt.status.replace('_', ' ').toUpperCase()}
                      </span>
                      {isGreenPaid && (
                        <span
                          style={{
                            background: '#10B981',
                            color: '#ffffff',
                            padding: '3px 8px',
                            borderRadius: '99px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          All Paid
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(evt.date).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '6px' }}>{evt.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px', flex: 1 }}>
                    {evt.location} <br />
                    Report Time: {evt.reportTime}
                  </p>

                  <div style={{
                    background: isGreenPaid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 246, 255, 0.8)',
                    padding: '12px',
                    borderRadius: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    border: isGreenPaid ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(191, 219, 254, 0.7)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={18} color={isGreenPaid ? '#047857' : 'var(--primary)'} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Booked Staff:</span>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '1.125rem', color: isGreenPaid ? '#047857' : 'var(--primary)' }}>
                      {evt._count?.bookings || 0} {evt.slotsNeeded ? `/ ${evt.slotsNeeded}` : 'boys'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                    {editable ? (
                      <Link
                        to={`/events/${evt.id}/edit`}
                        className="btn btn-secondary"
                        style={{ flex: '0 0 auto', padding: '9px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        title="Edit event before attendance starting time"
                      >
                        <Edit3 size={15} />
                        <span>Edit</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="btn"
                        style={{
                          flex: '0 0 auto',
                          padding: '9px 12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(148, 163, 184, 0.15)',
                          color: 'var(--text-muted)',
                          border: '1px solid rgba(148, 163, 184, 0.3)',
                          cursor: 'not-allowed',
                        }}
                        title="Locked: Attendance time has started. Edits are no longer allowed."
                      >
                        <Lock size={14} />
                        <span>Locked</span>
                      </button>
                    )}

                    <Link
                      to={`/events/${evt.id}/boys`}
                      className={`btn ${isGreenPaid ? 'btn-success' : 'btn-primary'}`}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <Eye size={16} />
                      <span>{isGreenPaid ? 'Staff & Wages' : 'Attendance & Boys'}</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
