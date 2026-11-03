import React, { useState, useEffect } from 'react';
import { IndianRupee, Users, CheckSquare, CalendarDays, TrendingUp, Loader2, X } from 'lucide-react';
import api from '../lib/api';

/* ─── helpers ─── */
const fmtCurrency = (n) => '₹' + Number(n).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function StatCard({ icon: Icon, label, value, color = '#2563EB' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: 20, border: '1px solid rgba(219,234,254,0.8)', boxShadow: '0 4px 24px rgba(37,99,235,0.07)', padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color = '#2563EB' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ height: 8, background: '#EFF6FF', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
    </div>
  );
}

/* ─── Financial detail modal ─── */
function FinancialModal({ event, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('attendance');

  useEffect(() => {
    api.get(`/admin/events/${event.id}/financial`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [event.id]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }} onClick={onClose}>
      <div style={{ background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(24px)', borderRadius: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(37,99,235,0.18)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{event.name}</h2>
              <p style={{ fontSize: '0.78rem', color: '#64748B' }}>{event.client?.companyName || event.client?.name} • {fmtDate(event.date)}</p>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(100,116,139,0.1)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} color="#475569" />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={28} color="#2563EB" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : data ? (
          <div style={{ padding: '0 24px 24px' }}>
            {/* Filter toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#F1F5F9', borderRadius: 12, padding: 4 }}>
              {['attendance', 'booked'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  flex: 1, padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', transition: 'all 0.2s',
                  background: filter === f ? '#2563EB' : 'transparent',
                  color: filter === f ? '#fff' : '#64748B',
                }}>
                  {f === 'attendance' ? 'By Attendance' : 'By Booked'}
                </button>
              ))}
            </div>

            {/* Counts grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Boys Booked', value: data.bookedCount, color: '#2563EB', bg: '#EFF6FF' },
                { label: 'Attended', value: data.attendedCount, color: '#059669', bg: '#F0FDF4' },
                { label: 'Wages Paid', value: data.paidCount, color: '#D97706', bg: '#FFF7ED' },
                { label: 'Unpaid', value: data.unpaidCount, color: '#DC2626', bg: '#FEF2F2' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: '16px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0F172A' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Wage highlight */}
            <div style={{ background: filter === 'attendance' ? 'linear-gradient(135deg, #2563EB, #1D4ED8)' : 'linear-gradient(135deg, #7C3AED, #6D28D9)', borderRadius: 16, padding: '20px', marginBottom: 20, color: '#fff' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.85, marginBottom: 8 }}>
                Total Wages — {filter === 'attendance' ? 'Based on Attendance' : 'Based on Booked Count'}
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-1px' }}>
                {fmtCurrency(filter === 'attendance' ? data.wagesByAttendance : data.wagesByBooked)}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 4 }}>
                {filter === 'attendance' ? data.attendedCount : data.bookedCount} boys × {fmtCurrency(data.ratePerBoy)}/boy
              </div>
            </div>

            {/* Progress bars */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                <span>Attendance Rate</span>
                <span>{data.bookedCount > 0 ? Math.round(data.attendedCount / data.bookedCount * 100) : 0}%</span>
              </div>
              <ProgressBar value={data.attendedCount} max={data.bookedCount} color="#059669" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                <span>Wages Disbursed</span>
                <span>{data.attendedCount > 0 ? Math.round(data.paidCount / data.attendedCount * 100) : 0}%</span>
              </div>
              <ProgressBar value={data.paidCount} max={Math.max(data.attendedCount, 1)} color="#D97706" />
            </div>
          </div>
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>No financial data</div>
        )}
      </div>
    </div>
  );
}

export default function Revenue() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [globalFilter, setGlobalFilter] = useState('attendance');

  useEffect(() => {
    api.get('/admin/events')
      .then(r => setEvents(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = events.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.client?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.client?.companyName || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalBooked = filtered.reduce((s, e) => s + (e.bookedCount || 0), 0);
  const totalAttended = filtered.reduce((s, e) => s + (e.attendedCount || 0), 0);
  const totalWages = filtered.reduce((s, e) => s + (globalFilter === 'attendance' ? e.attendedCount : e.bookedCount) * (e.ratePerBoy || 20), 0);

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.5px', marginBottom: 6 }}>Revenue & Wages</h1>
        <p style={{ color: '#64748B', fontSize: '0.875rem' }}>Track wages across all events — filter by attendance or booked slots</p>
      </div>

      {/* Global stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard icon={CalendarDays} label="Total Events" value={filtered.length} color="#2563EB" />
        <StatCard icon={Users} label="Boys Booked" value={totalBooked} color="#7C3AED" />
        <StatCard icon={CheckSquare} label="Boys Attended" value={totalAttended} color="#059669" />
        <StatCard icon={IndianRupee} label={`Wages (${globalFilter === 'attendance' ? 'Attended' : 'Booked'})`} value={fmtCurrency(totalWages)} color="#D97706" />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search events or clients..."
          className="form-input"
          style={{ flex: 1, minWidth: 200 }}
        />
        <div style={{ display: 'flex', gap: 0, background: '#F1F5F9', borderRadius: 12, padding: 4 }}>
          {['attendance', 'booked'].map(f => (
            <button key={f} onClick={() => setGlobalFilter(f)} style={{
              padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', transition: 'all 0.2s',
              background: globalFilter === f ? '#2563EB' : 'transparent',
              color: globalFilter === f ? '#fff' : '#64748B',
            }}>
              {f === 'attendance' ? 'By Attendance' : 'By Booked'}
            </button>
          ))}
        </div>
      </div>

      {/* Events list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={32} color="#2563EB" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: '#94A3B8', fontWeight: 600 }}>No events found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(ev => {
            const wages = (globalFilter === 'attendance' ? (ev.attendedCount || 0) : (ev.bookedCount || 0)) * (ev.ratePerBoy || 20);
            const attendancePct = ev.bookedCount > 0 ? Math.round((ev.attendedCount || 0) / ev.bookedCount * 100) : 0;
            return (
              <div key={ev.id} className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.95rem', marginBottom: 3 }}>{ev.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{ev.client?.companyName || ev.client?.name} • {fmtDate(ev.date)}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>{ev.location}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#2563EB' }}>{fmtCurrency(wages)}</div>
                      <div style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>{globalFilter === 'attendance' ? `${ev.attendedCount || 0} attended` : `${ev.bookedCount || 0} booked`}</div>
                    </div>
                    <button onClick={() => setSelectedEvent(ev)} style={{
                      padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: 'rgba(37,99,235,0.1)', color: '#2563EB', fontWeight: 700, fontSize: '0.75rem',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <TrendingUp size={13} /> Details
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: '#475569', marginBottom: 10, flexWrap: 'wrap' }}>
                  <span>Booked: <strong>{ev.bookedCount || 0}</strong></span>
                  <span>Attended: <strong style={{ color: '#059669' }}>{ev.attendedCount || 0}</strong></span>
                  <span>Rate: <strong>₹{ev.ratePerBoy || 20}/boy</strong></span>
                  <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{attendancePct}% showed up</span>
                </div>
                <ProgressBar value={ev.attendedCount || 0} max={ev.bookedCount || 0} color={attendancePct >= 80 ? '#059669' : attendancePct >= 50 ? '#D97706' : '#DC2626'} />
              </div>
            );
          })}
        </div>
      )}

      {selectedEvent && (
        <FinancialModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
