import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { Check, Search, Copy, Clock, Phone, MapPin, Calendar, FileText } from 'lucide-react';
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1',
});

export default function SupervisorAttendance() {
  const { token } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchSupervisorEvent();
  }, [token]);

  const fetchSupervisorEvent = async () => {
    try {
      const res = await api.get(`/events/supervisor/${token}`);
      setEvent(res.data);
    } catch (err) {
      toast.error('Invalid or expired attendance link');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAttendance = async (bookingId, currentAttended) => {
    try {
      const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const payload = { attended: !currentAttended };
      if (!currentAttended) payload.arrivalTime = nowStr;

      const res = await api.patch(`/events/supervisor/${token}/bookings/${bookingId}`, payload);
      setEvent((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) => (b.id === bookingId ? res.data : b)),
      }));
      toast.success(!currentAttended ? `Marked Present (In: ${nowStr})` : 'Marked Absent');
    } catch (err) {
      toast.error('Failed to update attendance');
    }
  };

  const handleUpdateTime = async (bookingId, field, value) => {
    try {
      const res = await api.patch(`/events/supervisor/${token}/bookings/${bookingId}`, { [field]: value });
      setEvent((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) => (b.id === bookingId ? res.data : b)),
      }));
      toast.success('Time updated!');
    } catch (err) {
      toast.error('Failed to update time');
    }
  };

  const handleUpdateNotes = async (bookingId, notes, fine) => {
    try {
      const res = await api.patch(`/events/supervisor/${token}/bookings/${bookingId}`, { notes, fine });
      setEvent((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) => (b.id === bookingId ? res.data : b)),
      }));
      setEditingId(null);
      toast.success('Notes & fines saved!');
    } catch (err) {
      toast.error('Failed to save notes');
    }
  };

  const handleCopyReport = () => {
    if (!event || !event.bookings?.length) return toast.error('No staff records to copy');

    const confirmed = event.bookings;
    const attended = confirmed.filter((b) => b.attended).length;

    let report = `📋 *NEARBY CATERS — SITE ATTENDANCE REPORT*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `🏢 *Site:* ${event.name}\n`;
    report += `📅 *Date:* ${new Date(event.date).toLocaleDateString('en-IN')}\n`;
    report += `⏰ *Report Time:* ${event.reportTime}\n`;
    report += `📍 *Venue:* ${event.location}\n`;
    report += `👥 *Total Staff:* ${confirmed.length} | *Present:* ${attended}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    confirmed.forEach((b, idx) => {
      const statusIcon = b.attended ? '✅ Present' : '❌ Absent';
      const inTime = b.arrivalTime || '—';
      const outTime = b.leavingTime || '—';
      const notes = [b.fine ? `Fine: ${b.fine}` : '', b.notes || ''].filter(Boolean).join(' - ');

      report += `${idx + 1}. *${b.user.name}* (${b.user.phone})\n`;
      report += `   ${statusIcon} | In: ${inTime} | Out: ${outTime}${notes ? ` | ${notes}` : ''}\n\n`;
    });

    navigator.clipboard.writeText(report);
    toast.success('📋 Report copied to clipboard! Paste it into WhatsApp.');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F5FF' }}>
        <p style={{ fontWeight: 600, color: '#475569' }}>Loading Site Attendance...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F0F5FF', padding: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Link Invalid or Expired</h2>
        <p style={{ color: '#64748B', textAlign: 'center' }}>Please request a new attendance link from the event organizer.</p>
      </div>
    );
  }

  const confirmed = event.bookings || [];
  const attendedCount = confirmed.filter((b) => b.attended).length;

  const filtered = confirmed.filter((b) => {
    const q = search.toLowerCase();
    return b.user.name.toLowerCase().includes(q) || (b.user.phone || '').includes(q);
  });

  return (
    <div style={{ minHeight: '100vh', background: '#F0F5FF', color: '#0F172A', paddingBottom: '40px' }}>
      <Toaster position="top-center" />

      {/* Top Header */}
      <header
        style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(219, 234, 254, 0.9)',
          padding: '16px 20px',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/nearby-caters-logo.jpg" alt="Nearby Caters" width="36" height="36" style={{ display: 'block', objectFit: 'contain' }} />
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1 }}>Nearby Caters</h2>
              <span style={{ fontSize: '0.7rem', color: '#2563EB', fontWeight: 700, textTransform: 'uppercase' }}>
                On-Site Staff Supervisor
              </span>
            </div>
          </div>

          <button
            onClick={handleCopyReport}
            className="btn btn-primary"
            style={{ padding: '8px 14px', fontSize: '0.78rem' }}
          >
            <Copy size={14} /> Copy Report
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '720px', margin: '20px auto', padding: '0 16px' }}>
        {/* Site Details Card */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '6px' }}>{event.name}</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#475569' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={15} color="#2563EB" /> <span>{event.location}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} color="#D97706" /> <span>{new Date(event.date).toLocaleDateString()}</span>
              <span style={{ margin: '0 4px' }}>•</span>
              <Clock size={15} color="#D97706" /> <span>Report at {event.reportTime}</span>
            </div>
          </div>

          {/* Counts */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <div style={{ flex: 1, background: 'rgba(239, 246, 255, 0.8)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(191, 219, 254, 0.8)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase' }}>Total Staff</span>
              <p style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1E293B' }}>{confirmed.length}</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(209, 250, 229, 0.8)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(110, 231, 183, 0.8)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>Present</span>
              <p style={{ fontSize: '1.25rem', fontWeight: 900, color: '#065F46' }}>{attendedCount}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '40px', background: '#ffffff', borderRadius: '14px' }}
            placeholder="Search boy name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Staff Roster Cards */}
        {filtered.map((b, idx) => {
          const isEditing = editingId === b.id;

          return (
            <div
              key={b.id}
              className="card"
              style={{
                marginBottom: '12px',
                padding: '16px',
                borderLeft: b.attended ? '4px solid #10B981' : '4px solid #CBD5E1',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {b.user.avatarUrl ? (
                    <img
                      src={b.user.avatarUrl}
                      alt={b.user.name}
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(37, 99, 235, 0.25)' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #2563EB, #0284C7)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '1.1rem',
                        flexShrink: 0,
                      }}
                    >
                      {b.user.name?.[0]?.toUpperCase() || 'B'}
                    </div>
                  )}
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{b.user.name}</h3>
                    {b.user.phone ? <a
                      href={`https://wa.me/91${b.user.phone}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 700 }}
                    >📱 {b.user.phone}</a> : <span style={{ color: '#64748B', fontSize: '0.8rem' }}>No mobile number</span>}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAttendance(b.id, b.attended)}
                  className={`btn ${b.attended ? 'btn-success' : 'btn-secondary'}`}
                  style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                >
                  {b.attended ? <Check size={14} /> : null}
                  {b.attended ? 'Present' : 'Mark Present'}
                </button>
              </div>

              {/* Arrival & Leaving Times */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(226, 232, 240, 0.8)' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>In Time</span>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="08:30 AM"
                      style={{ padding: '6px 8px', fontSize: '0.78rem' }}
                      defaultValue={b.arrivalTime || ''}
                      onBlur={(e) => handleUpdateTime(b.id, 'arrivalTime', e.target.value)}
                    />
                    <button
                      onClick={() => {
                        const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        handleUpdateTime(b.id, 'arrivalTime', t);
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '4px 6px', fontSize: '0.7rem' }}
                    >
                      Now
                    </button>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Out Time</span>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="05:00 PM"
                      style={{ padding: '6px 8px', fontSize: '0.78rem' }}
                      defaultValue={b.leavingTime || ''}
                      onBlur={(e) => handleUpdateTime(b.id, 'leavingTime', e.target.value)}
                    />
                    <button
                      onClick={() => {
                        const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        handleUpdateTime(b.id, 'leavingTime', t);
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '4px 6px', fontSize: '0.7rem' }}
                    >
                      Now
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes & Fine */}
              <div style={{ marginTop: '10px' }}>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <input
                      type="text"
                      id={`sup-fine-${b.id}`}
                      placeholder="Fine e.g. ₹50 late"
                      className="form-input"
                      style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                      defaultValue={b.fine || ''}
                    />
                    <input
                      type="text"
                      id={`sup-notes-${b.id}`}
                      placeholder="Notes / Comments"
                      className="form-input"
                      style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                      defaultValue={b.notes || ''}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => {
                          const f = document.getElementById(`sup-fine-${b.id}`).value;
                          const n = document.getElementById(`sup-notes-${b.id}`).value;
                          handleUpdateNotes(b.id, n, f);
                        }}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setEditingId(b.id)}
                    style={{ cursor: 'pointer', background: 'rgba(241, 245, 249, 0.7)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem' }}
                  >
                    {b.fine && <span className="badge badge-danger" style={{ marginRight: '6px' }}>{b.fine}</span>}
                    <span style={{ color: b.notes ? '#0F172A' : '#94A3B8' }}>{b.notes || '+ Add note or fine for this boy'}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
