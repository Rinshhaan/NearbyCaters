import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Pencil, Trash2, X, Check, CalendarDays, MapPin, Users, Clock } from 'lucide-react';
import api from '../lib/api';

/* ─── Status badge colour map ─── */
const STATUS_BADGE = {
  published: { background: '#d1fae5', color: '#059669' },
  draft:     { background: '#f1f5f9', color: '#64748b' },
  closed:    { background: '#fee2e2', color: '#dc2626' },
  completed: { background: '#e0e7ff', color: '#4f46e5' },
};

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || { background: '#fef3c7', color: '#d97706' };
  return (
    <span style={{ ...s, padding: '2px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
}

/* ─── Edit Event Modal ─── */
function EditEventModal({ event, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:           event.name || '',
    description:    event.description || '',
    location:       event.location || '',
    locationMapUrl: event.locationMapUrl || '',
    date:           event.date ? event.date.slice(0, 10) : '',
    reportTime:     event.reportTime || '',
    slotsNeeded:    event.slotsNeeded ?? '',
    timerEnd:       event.timerEnd ? event.timerEnd.slice(0, 16) : '',
    status:         event.status || 'draft',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.location.trim() || !form.date) {
      toast.error('Name, location and date are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        slotsNeeded: form.slotsNeeded !== '' ? Number(form.slotsNeeded) : undefined,
        timerEnd: form.timerEnd || undefined,
      };
      await api.patch(`/admin/events/${event.id}`, payload);
      toast.success('Event updated!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e0e7ff',
    fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', marginBottom: 12,
    background: '#f8faff',
  };
  const labelStyle = { fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', padding: '28px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Edit Event</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="#64748b" />
          </button>
        </div>

        <label style={labelStyle}>Event Name *</label>
        <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} />

        <label style={labelStyle}>Description</label>
        <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} />

        <label style={labelStyle}>Location *</label>
        <input style={inputStyle} value={form.location} onChange={e => set('location', e.target.value)} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>Google Maps Iframe Embed Code / Link</label>
          <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Paste &lt;iframe&gt; or link</span>
        </div>
        <textarea
          style={{ ...inputStyle, minHeight: 48, fontFamily: 'monospace', fontSize: '0.8rem' }}
          value={form.locationMapUrl}
          onChange={e => {
            const val = e.target.value;
            const srcMatch = val.match(/src=["']([^"']+)["']/i);
            set('locationMapUrl', (srcMatch && srcMatch[1]) ? srcMatch[1] : val);
          }}
          placeholder='Paste <iframe src="..."> or Google Maps URL'
        />
        {(form.locationMapUrl || form.location) && (
          <div style={{ marginTop: 6, borderRadius: 10, overflow: 'hidden', border: '1px solid #CBD5E1' }}>
            <iframe
              title="Preview"
              src={
                form.locationMapUrl?.includes('/maps/embed') || form.locationMapUrl?.includes('output=embed')
                  ? form.locationMapUrl
                  : `https://maps.google.com/maps?q=${encodeURIComponent((form.location || 'Kerala') + ', Kerala')}&t=&z=14&ie=UTF8&iwloc=&output=embed`
              }
              width="100%"
              height="130"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
            />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Event Date *</label>
            <input style={inputStyle} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Report Time</label>
            <input style={inputStyle} type="time" value={form.reportTime} onChange={e => set('reportTime', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Slots Needed</label>
            <input style={inputStyle} type="number" min="1" value={form.slotsNeeded} onChange={e => set('slotsNeeded', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Timer End (datetime)</label>
            <input style={inputStyle} type="datetime-local" value={form.timerEnd} onChange={e => set('timerEnd', e.target.value)} />
          </div>
        </div>

        <label style={labelStyle}>Status</label>
        <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="closed">Closed</option>
          <option value="completed">Completed</option>
        </select>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : <><Check size={14} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function ClientEvents() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState(null);

  useEffect(() => {
    fetchAll();
  }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cRes, eRes] = await Promise.all([
        api.get(`/admin/clients/${id}`),
        api.get(`/admin/clients/${id}/events`),
      ]);
      setClient(cRes.data.client || cRes.data);
      setEvents(eRes.data.events || eRes.data || []);
    } catch (err) {
      toast.error('Failed to load client events');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (evt) => {
    if (!window.confirm(`Permanently delete event "${evt.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/events/${evt.id}`);
      toast.success('Event deleted');
      setEvents(prev => prev.filter(e => e.id !== evt.id));
    } catch (err) {
      toast.error('Failed to delete event');
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button
          onClick={() => navigate('/clients')}
          className="btn btn-secondary"
          style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={16} /> Back to Clients
        </button>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>
            {loading ? 'Loading…' : `${client?.name || 'Client'}'s Events`}
          </h1>
          {client && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {client.companyName || 'Individual Caterer'} · {client.phone}
            </p>
          )}
        </div>
      </div>

      {/* Client summary card */}
      {client && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '16px 20px' }}>
          {client.logoUrl && (
            <img src={client.logoUrl} alt={client.name} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e0e7ff' }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{client.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{client.email}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className={`badge ${client.isApproved ? 'badge-success' : 'badge-warning'}`}>
              {client.isApproved ? '✓ Approved' : 'Pending'}
            </span>
            {client.isBlocked && <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>🚫 Blocked</span>}
          </div>
          <Link to={`/clients/${id}/profile`} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}><Users size={14} /> Partner profile</Link>
          <div style={{ background: '#f0f5ff', borderRadius: 10, padding: '8px 16px', textAlign: 'center', minWidth: 80 }}>
            <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#2563EB' }}>{events.length}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Events</div>
          </div>
        </div>
      )}

      {/* Events list */}
      <div className="card">
        <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: '1rem' }}>All Events</h3>

        {loading ? (
          <p>Loading events...</p>
        ) : events.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
            No events posted by this client yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {events.map(evt => (
              <div
                key={evt.id}
                style={{
                  border: '1.5px solid #e0e7ff',
                  borderRadius: 14,
                  padding: '16px 18px',
                  background: 'rgba(240, 245, 255, 0.5)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  {/* Event info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#0F172A', marginBottom: 6 }}>
                      {evt.name}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={13} /> {evt.location}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CalendarDays size={13} />
                        {evt.date ? new Date(evt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                      {evt.reportTime && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={13} /> {evt.reportTime}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={13} />
                        {evt._count?.bookings ?? 0} confirmed / {evt.slotsNeeded ?? '?'} slots
                      </span>
                    </div>
                  </div>

                  {/* Status + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <StatusBadge status={evt.status} />
                    <Link to={`/events/${evt.id}/roster`} className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}><Users size={13} /> Staff roster</Link>
                    <button
                      onClick={() => setEditingEvent(evt)}
                      className="btn btn-secondary"
                      style={{ padding: '5px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(evt)}
                      className="btn btn-danger"
                      style={{ padding: '5px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 5, background: '#fff1f2', color: '#dc2626', border: '1px solid #fecaca' }}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}
