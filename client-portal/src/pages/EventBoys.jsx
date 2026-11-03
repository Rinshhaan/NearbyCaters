import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Users, Check, X, ArrowLeft, IndianRupee, Lock, Search,
  Share2, Copy, CheckCircle2, Clock, FileText, AlertCircle
} from 'lucide-react';
import api from '../lib/api';

export default function EventBoys() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [search, setSearch] = useState('');
  const [editingRow, setEditingRow] = useState(null); // tracking row being updated
  const [finFilter, setFinFilter] = useState('attendance');

  useEffect(() => {
    fetchEventAndBookings();
  }, [id]);

  const fetchEventAndBookings = async () => {
    try {
      const [evtRes, bookRes, attendanceRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/events/${id}/bookings`),
        api.get(`/events/${id}/attendance-link`),
      ]);
      setEvent({ ...evtRes.data, attendanceToken: attendanceRes.data.attendanceToken });
      setBookings(bookRes.data);
    } catch (err) {
      toast.error('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAttendance = async (bookingId, currentAttended) => {
    try {
      const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const payload = {
        attended: !currentAttended,
      };
      if (!currentAttended) {
        payload.arrivalTime = nowStr;
      }
      const res = await api.patch(`/bookings/${bookingId}/attendance`, payload);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? res.data : b)));
      toast.success(!currentAttended ? 'Marked Present (In: ' + nowStr + ')' : 'Marked Absent');
    } catch (err) {
      toast.error('Failed to update attendance');
    }
  };

  const handleUpdateTimes = async (bookingId, field, value) => {
    try {
      const res = await api.patch(`/bookings/${bookingId}/attendance`, { [field]: value });
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? res.data : b)));
      toast.success('Time updated!');
    } catch (err) {
      toast.error('Failed to update time');
    }
  };

  const handleUpdateNotes = async (bookingId, notes, fine) => {
    try {
      const res = await api.patch(`/bookings/${bookingId}/attendance`, { notes, fine });
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? res.data : b)));
      setEditingRow(null);
      toast.success('Notes and fines saved!');
    } catch (err) {
      toast.error('Failed to save notes');
    }
  };

  const handleToggleStaffPaid = async (bookingId, currentStatus) => {
    try {
      const res = await api.patch(`/bookings/${bookingId}/staff-paid`, { staffPaid: !currentStatus });
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? res.data : b)));
      toast.success(!currentStatus ? 'Staff wage marked as PAID ✓' : 'Staff wage marked UNPAID');
    } catch (err) {
      toast.error('Failed to update wage status');
    }
  };

  const handleCloseBookings = async () => {
    if (!window.confirm('Close bookings for this event? This will generate your ₹20/boy settlement invoice.')) return;
    setClosing(true);
    try {
      const res = await api.post(`/events/${id}/close-bookings`);
      toast.success(res.data.message || 'Bookings closed!');
      fetchEventAndBookings();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to close bookings');
    } finally {
      setClosing(false);
    }
  };

  // Copy shareable supervisor link to WhatsApp / clipboard
  const handleCopySupervisorLink = async () => {
    if (!event?.attendanceToken) return toast.error('Attendance link is not ready. Refresh the event and try again.');
    const supervisorUrl = new URL(`/attendance/${encodeURIComponent(event.attendanceToken)}`, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: `${event.name} attendance`, url: supervisorUrl });
        return;
      }
      await navigator.clipboard.writeText(supervisorUrl);
      toast.success('Attendance link copied. Send it to your site supervisor.');
    } catch (error) {
      if (error.name === 'AbortError') return;
      window.prompt('Copy this attendance link for your site supervisor:', supervisorUrl);
    }
  };

  // 1-Click Backup & WhatsApp Report generator
  const handleCopySiteReport = () => {
    if (!event || bookings.length === 0) return toast.error('No staff records to copy');

    const confirmed = bookings.filter((b) => b.status === 'confirmed');
    const attended = confirmed.filter((b) => b.attended).length;
    const allPaid = confirmed.length > 0 && confirmed.every((b) => b.staffPaid);

    let report = `📋 *NEARBY CATERS — SITE ATTENDANCE REPORT*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `🏢 *Site:* ${event.name}\n`;
    report += `📅 *Date:* ${new Date(event.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}\n`;
    report += `⏰ *Report Time:* ${event.reportTime}\n`;
    report += `📍 *Venue:* ${event.location}\n`;
    report += `👥 *Staff Headcount:* ${confirmed.length} confirmed | ${attended} attended on site\n`;
    report += `💰 *Wages Status:* ${allPaid ? 'ALL STAFF PAID ✓' : 'Partial / Pending'}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    report += `*STAFF ROSTER & ATTENDANCE:*\n`;

    confirmed.forEach((b, idx) => {
      const statusIcon = b.attended ? '✅ Present' : '❌ Absent';
      const inTime = b.arrivalTime ? b.arrivalTime : '—';
      const outTime = b.leavingTime ? b.leavingTime : '—';
      const wageIcon = b.staffPaid ? 'PAID [✓]' : 'UNPAID [ ]';
      const notesStr = b.notes || b.fine ? ` | Note: ${[b.fine ? `Fine: ${b.fine}` : '', b.notes || ''].filter(Boolean).join(' - ')}` : '';

      report += `${idx + 1}. *${b.user.name}* (📱 ${b.user.phone})\n`;
      report += `   ${statusIcon} | In: ${inTime} | Out: ${outTime} | Wage: ${wageIcon}${notesStr}\n\n`;
    });

    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `Generated via Nearby Caters Partner Portal (${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()})`;

    navigator.clipboard.writeText(report);
    toast.success('📋 Complete Site Report copied to clipboard! You can paste it into WhatsApp or Excel.');
  };

  if (loading) return <div style={{ padding: '24px', textAlign: 'center' }}>Loading event staff list...</div>;
  if (!event) return <div style={{ padding: '24px', textAlign: 'center' }}>Event not found.</div>;

  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');
  const confirmedCount = confirmedBookings.length;
  const attendedCount = confirmedBookings.filter((b) => b.attended).length;
  const paidCount = confirmedBookings.filter((b) => b.staffPaid).length;
  const allStaffPaid = confirmedCount > 0 && confirmedBookings.every((b) => b.staffPaid);
  const ratePerBoy = 20; // default platform rate ₹20/boy

  // Filtered roster by search
  const filteredBookings = confirmedBookings.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.user.name.toLowerCase().includes(q) ||
      (b.user.phone || '').includes(q) ||
      (b.user.place && b.user.place.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-muted)',
          marginBottom: '16px',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}
      >
        <ArrowLeft size={16} /> Back to My Events
      </Link>

      {/* ── Event Header Card (Turns emerald green when all staff are paid!) ── */}
      <div
        className="card"
        style={{
          marginBottom: '24px',
          background: allStaffPaid
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.08))'
            : 'var(--glass-1)',
          borderColor: allStaffPaid ? '#10B981' : 'var(--glass-border)',
          transition: 'all 0.3s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{event.name}</h1>
              {allStaffPaid && (
                <span
                  style={{
                    background: '#10B981',
                    color: '#ffffff',
                    padding: '4px 12px',
                    borderRadius: 99,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    letterSpacing: '0.5px',
                    boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  ✓ ALL STAFF PAID
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              📍 {event.location} • 📅 {new Date(event.date).toLocaleDateString()} at {event.reportTime}
            </p>
          </div>

          {/* Action buttons top-right */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleCopySupervisorLink}
              className="btn btn-secondary"
              title="Share attendance link with site supervisor / head boy"
            >
              <Share2 size={16} color="var(--primary)" />
              <span>Send Attendance Link</span>
            </button>

            <button
              onClick={handleCopySiteReport}
              className="btn btn-secondary"
              title="Copy formatted text table report for WhatsApp or Excel backup"
            >
              <Copy size={16} color="var(--primary)" />
              <span>Copy Report (WhatsApp Backup)</span>
            </button>

            {event.status === 'published' && (
              <button
                onClick={handleCloseBookings}
                disabled={closing || confirmedCount === 0}
                className="btn btn-primary"
              >
                <Lock size={16} />
                <span>{closing ? 'Closing...' : 'Close Bookings & Settle'}</span>
              </button>
            )}

            {event.status === 'booking_closed' && (
              <Link to="/payments" className="btn btn-success">
                <IndianRupee size={16} />
                <span>Pay Fee (₹{confirmedCount * 20})</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>Confirmed Staff</p>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px' }}>
            {confirmedCount} {event.slotsNeeded ? `/ ${event.slotsNeeded}` : 'boys'}
          </h3>
        </div>
        <div className="card">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>Marked Present</p>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>{attendedCount}</h3>
        </div>
        <div className="card">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>Staff Wages Status</p>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: allStaffPaid ? 'var(--success)' : 'var(--warning)', marginTop: '4px' }}>
            {confirmedBookings.filter((b) => b.staffPaid).length} / {confirmedCount} Paid
          </h3>
        </div>
        <div className="card">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>Platform Fee (₹20/boy)</p>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>₹{confirmedCount * 20}</h3>
        </div>
      </div>

      {/* ── Wage Summary ── */}
      <div style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(16px)', borderRadius: 18, border: '1px solid rgba(219,234,254,0.8)', boxShadow: '0 4px 20px rgba(37,99,235,0.07)', padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IndianRupee size={18} color="#2563EB" />
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>Wage Summary</span>
          </div>
          <div style={{ display: 'flex', gap: 0, background: '#F1F5F9', borderRadius: 10, padding: 3 }}>
            {['attendance', 'booked'].map(f => (
              <button key={f} onClick={() => setFinFilter(f)} style={{
                padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.72rem', transition: 'all 0.2s',
                background: finFilter === f ? '#2563EB' : 'transparent',
                color: finFilter === f ? '#fff' : '#64748B',
              }}>
                {f === 'attendance' ? 'By Attended' : 'By Booked'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {[
            { label: 'Booked', value: confirmedCount, color: '#2563EB', bg: '#EFF6FF' },
            { label: 'Attended', value: attendedCount, color: '#059669', bg: '#F0FDF4' },
            { label: 'Wages Paid', value: paidCount, color: '#D97706', bg: '#FFF7ED' },
            {
              label: finFilter === 'attendance' ? 'Total Wages' : 'Wages (Booked)',
              value: '₹' + ((finFilter === 'attendance' ? attendedCount : confirmedCount) * ratePerBoy).toLocaleString('en-IN'),
              color: '#7C3AED', bg: '#F5F3FF',
            },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: '0.67rem', fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0F172A' }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
            <span>Attendance rate</span>
            <span>{confirmedCount > 0 ? Math.round(attendedCount / confirmedCount * 100) : 0}%</span>
          </div>
          <div style={{ height: 7, background: '#EFF6FF', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: (confirmedCount > 0 ? Math.round(attendedCount / confirmedCount * 100) : 0) + '%', background: '#059669', borderRadius: 99, transition: 'width 0.5s' }} />
          </div>
        </div>
      </div>

      {/* ── Roster & Attendance Table ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Staff Roster, Attendance & Wages</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Verify staff photos, mark arrival/departure, log fines, and tick off wage payments
            </p>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', paddingY: '8px', fontSize: '0.85rem' }}
              placeholder="Search staff name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filteredBookings.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
            {search ? 'No staff found matching your search.' : 'No boys have booked this event yet.'}
          </p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Staff Profile</th>
                  <th>WhatsApp</th>
                  <th>Attendance</th>
                  <th>Arrival Time</th>
                  <th>Leaving Time</th>
                  <th>Notes & Fines</th>
                  <th>Wage Paid</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => {
                  const isEditing = editingRow === b.id;

                  return (
                    <tr key={b.id} style={{ background: b.staffPaid ? 'rgba(16, 185, 129, 0.03)' : 'transparent' }}>
                      {/* Avatar & Name */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {b.user.avatarUrl ? (
                            <img
                              src={b.user.avatarUrl}
                              alt={b.user.name}
                              style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(37, 99, 235, 0.3)' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #2563EB, #0284C7)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '1rem',
                                flexShrink: 0,
                              }}
                            >
                              {b.user.name?.[0]?.toUpperCase() || 'B'}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.925rem', color: '#0F172A' }}>{b.user.name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{b.user.place || 'Kerala'}</div>
                          </div>
                        </div>
                      </td>

                      {/* WhatsApp Phone */}
                      <td>
                        {b.user.phone ? <a
                          href={`https://wa.me/91${b.user.phone}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#059669', fontWeight: 700, fontSize: '0.85rem' }}
                        >📱 {b.user.phone}</a> : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No mobile number</span>}
                      </td>

                      {/* Attendance Status (Marked on-site by supervisor) */}
                      <td>
                        <span className={`badge ${b.attended ? 'badge-success' : 'badge-warning'}`}>
                          {b.attended ? '✓ Present' : 'Pending'}
                        </span>
                      </td>

                      {/* Arrival Time */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="text"
                            placeholder="e.g. 08:30 AM"
                            className="form-input"
                            style={{ width: '105px', padding: '6px 10px', fontSize: '0.8rem' }}
                            defaultValue={b.arrivalTime || ''}
                            onBlur={(e) => handleUpdateTimes(b.id, 'arrivalTime', e.target.value)}
                          />
                          <button
                            onClick={() => {
                              const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                              handleUpdateTimes(b.id, 'arrivalTime', t);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '6px 8px', fontSize: '0.7rem' }}
                            title="Set current time as Arrival"
                          >
                            Now
                          </button>
                        </div>
                      </td>

                      {/* Leaving Time */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="text"
                            placeholder="e.g. 05:00 PM"
                            className="form-input"
                            style={{ width: '105px', padding: '6px 10px', fontSize: '0.8rem' }}
                            defaultValue={b.leavingTime || ''}
                            onBlur={(e) => handleUpdateTimes(b.id, 'leavingTime', e.target.value)}
                          />
                          <button
                            onClick={() => {
                              const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                              handleUpdateTimes(b.id, 'leavingTime', t);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '6px 8px', fontSize: '0.7rem' }}
                            title="Set current time as Leaving"
                          >
                            Now
                          </button>
                        </div>
                      </td>

                      {/* Notes & Fine */}
                      <td style={{ minWidth: '180px' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <input
                              type="text"
                              id={`fine-${b.id}`}
                              placeholder="Fine e.g. ₹50 late"
                              className="form-input"
                              style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                              defaultValue={b.fine || ''}
                            />
                            <input
                              type="text"
                              id={`notes-${b.id}`}
                              placeholder="Notes / Dress code"
                              className="form-input"
                              style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                              defaultValue={b.notes || ''}
                            />
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => {
                                  const fineVal = document.getElementById(`fine-${b.id}`).value;
                                  const notesVal = document.getElementById(`notes-${b.id}`).value;
                                  handleUpdateNotes(b.id, notesVal, fineVal);
                                }}
                                className="btn btn-primary"
                                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingRow(null)}
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => setEditingRow(b.id)}
                            style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.02)' }}
                            title="Click to edit notes and fine"
                          >
                            {b.fine && <span className="badge badge-danger" style={{ marginRight: '6px' }}>{b.fine}</span>}
                            <span style={{ fontSize: '0.8rem', color: b.notes ? 'var(--text-main)' : 'var(--text-muted)' }}>
                              {b.notes || '+ Add note/fine'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Wage Paid Tick Mark */}
                      <td>
                        <button
                          onClick={() => handleToggleStaffPaid(b.id, b.staffPaid)}
                          className={`btn ${b.staffPaid ? 'btn-success' : 'btn-secondary'}`}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            borderRadius: '8px',
                          }}
                        >
                          {b.staffPaid ? <CheckCircle2 size={15} /> : null}
                          {b.staffPaid ? 'Wage Paid ✓' : 'Mark Paid'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
