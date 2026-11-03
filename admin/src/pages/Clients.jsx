import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, X, ShieldAlert, ShieldOff, Search, Trash2, CalendarDays, Star, ExternalLink, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

/* ─── tiny helpers ─── */
function Avatar({ src, name, size = 36 }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #e0e7ff' }}
      />
    );
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'linear-gradient(135deg, #2563EB, #0284C7)',
        color: '#fff', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontWeight: 800,
        fontSize: size * 0.38 + 'px', flexShrink: 0,
      }}
    >
      {name?.[0]?.toUpperCase() || 'C'}
    </div>
  );
}

function StarDisplay({ value = 0, max = 5, size = 13 }) {
  return (
    <span style={{ display: 'inline-flex', gap: '1px', verticalAlign: 'middle' }}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={size}
          fill={i < Math.round(value) ? '#f59e0b' : 'none'}
          color={i < Math.round(value) ? '#f59e0b' : '#d1d5db'}
        />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(null);
  return (
    <span style={{ display: 'inline-flex', gap: '3px', cursor: 'pointer' }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = (hovered ?? value) > i;
        return (
          <Star
            key={i}
            size={22}
            fill={filled ? '#f59e0b' : 'none'}
            color={filled ? '#f59e0b' : '#9ca3af'}
            onMouseEnter={() => setHovered(i + 1)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onChange(i + 1)}
            style={{ cursor: 'pointer', transition: 'all 0.1s' }}
          />
        );
      })}
    </span>
  );
}

/* ─── Rating Modal ─── */
function RatingModal({ client, onClose, onSaved }) {
  const [rating, setRating] = useState(client.rating ?? 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/admin/clients/${client.id}/rating`, { rating });
      toast.success('Rating updated!');
      onSaved(rating);
      onClose();
    } catch {
      toast.error('Failed to save rating');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="card" style={{ width: 340, padding: '28px 24px' }}>
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Set Client Rating</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
          {client.name} — {client.companyName || 'Individual Caterer'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <StarPicker value={rating} onChange={setRating} />
        </div>
        <p style={{ textAlign: 'center', color: '#f59e0b', fontWeight: 700, fontSize: '1.1rem', marginBottom: 20 }}>
          {rating} / 5
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Rating'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [ratingTarget, setRatingTarget] = useState(null); // client for rating modal

  useEffect(() => {
    const t = setTimeout(fetchClients, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [filter, search, page]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      let url = `/admin/clients?page=${page}&limit=50`;
      if (filter !== 'all') url += `&status=${filter}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const res = await api.get(url);
      setClients(res.data.clients || []);
      setTotal(res.data.total || 0);
      setTotalPages(Math.max(1, res.data.totalPages || 1));
    } catch (err) {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.patch(`/admin/clients/${id}/approve`);
      toast.success('Client approved to publish events!');
      fetchClients();
    } catch (err) {
      toast.error('Failed to approve client');
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject/disable this client?')) return;
    try {
      await api.patch(`/admin/clients/${id}/reject`, { notes: 'Rejected by admin' });
      toast.success('Client rejected');
      fetchClients();
    } catch (err) {
      toast.error('Failed to reject client');
    }
  };

  const handleToggleBlock = async (client) => {
    const isBlocked = client.isActive === false;
    const action = isBlocked ? 'Unblock' : 'Block';
    if (!window.confirm(`${action} client "${client.name}"? ${isBlocked ? 'This will allow them to publish and edit events.' : 'This will permanently block them from creating or editing events until unblocked.'}`)) return;
    try {
      await api.patch(`/admin/clients/${client.id}/toggle-block`);
      toast.success(`Client ${action.toLowerCase()}ed successfully`);
      fetchClients();
    } catch (err) {
      toast.error(`Failed to ${action.toLowerCase()} client`);
    }
  };

  const handleDelete = async (client) => {
    if (!window.confirm(`Permanently delete client "${client.name}" and all their events? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/clients/${client.id}`);
      toast.success('Client deleted');
      fetchClients();
    } catch (err) {
      toast.error('Failed to delete client');
    }
  };

  const handleRatingSaved = (clientId, newRating) => {
    setClients(prev =>
      prev.map(c => c.id === clientId ? { ...c, rating: newRating } : c)
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Client Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Review catering organizers and manage permissions
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', paddingY: '8px', fontSize: '0.85rem' }}
              placeholder="Search client, company, phone..."
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setPage(1); setFilter('all'); }}>All</button>
            <button className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setPage(1); setFilter('pending'); }}>Pending</button>
            <button className={`btn ${filter === 'approved' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setPage(1); setFilter('approved'); }}>Approved</button>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading clients...</p>
        ) : clients.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
            {search ? `No clients found matching "${search}".` : 'No clients found in this filter.'}
          </p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Client / Company</th>
                  <th>Contact Info</th>
                  <th>Events</th>
                  <th>Rating</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const isBlocked = c.isActive === false;
                  const profileUrl = `/clients/${c.id}/profile`;
                  const phoneDigits = String(c.phone || '').replace(/\D/g, '');
                  const whatsappNumber = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
                  const canContactOnWhatsApp = /^(?:91)?[6-9]\d{9}$/.test(phoneDigits);

                  return (
                    <tr key={c.id}>
                      {/* Client name + avatar (clickable -> opens public profile) */}
                      <td>
                        <a
                          href={profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="View public catering profile page"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            textDecoration: 'none',
                            color: 'inherit',
                            cursor: 'pointer',
                          }}
                        >
                          <Avatar src={c.logoUrl} name={c.name} size={38} />
                          <div>
                            <div style={{ fontWeight: 700, color: '#2563EB', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>{c.name}</span>
                              <ExternalLink size={12} color="#2563EB" />
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{c.companyName || 'Individual Caterer'}</div>
                          </div>
                        </a>
                      </td>

                      {/* Contact Info */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
                          <span>{c.phone}</span>
                          {canContactOnWhatsApp && (
                            <a
                              href={`https://wa.me/${whatsappNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Message ${c.companyName || c.name} on WhatsApp`}
                              title="Message organizer on WhatsApp"
                              style={{ width: 27, height: 27, display: 'inline-grid', placeItems: 'center', borderRadius: 8, color: '#128C7E', background: '#ECFDF5', border: '1px solid #A7F3D0', textDecoration: 'none' }}
                            >
                              <MessageCircle size={15} aria-hidden="true" />
                            </a>
                          )}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 2 }}>{c.email}</div>
                      </td>

                      {/* Events count */}
                      <td>
                        <button
                          onClick={() => navigate(`/clients/${c.id}/events`)}
                          className="btn btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600 }}
                          title="Manage client events"
                        >
                          {c._count?.events || 0} events
                        </button>
                      </td>

                      {/* Rating display */}
                      <td>
                        <button
                          onClick={() => setRatingTarget(c)}
                          title="Click to set client rating"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <StarDisplay value={c.rating ?? 0} />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {(c.rating ?? 0).toFixed(1)}
                          </span>
                        </button>
                      </td>

                      {/* Status badges */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {c.isApproved ? (
                            <span className="badge badge-success">✓ Approved</span>
                          ) : (
                            <span className="badge badge-warning">Pending Approval</span>
                          )}
                          {isBlocked && (
                            <span className="badge badge-danger" style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 800 }}>
                              🚫 Blocked
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {/* Approve / Disable */}
                          {!c.isApproved && (
                            <button
                              onClick={() => handleApprove(c.id)}
                              className="btn btn-success"
                              style={{ padding: '5px 10px', fontSize: '0.72rem' }}
                              title="Approve Client"
                            >
                              <Check size={13} /> Approve
                            </button>
                          )}
                          {c.isApproved && (
                            <button
                              onClick={() => handleReject(c.id)}
                              className="btn btn-danger"
                              style={{ padding: '5px 10px', fontSize: '0.72rem' }}
                              title="Reject/Disable"
                            >
                              <X size={13} /> Disable
                            </button>
                          )}

                          {/* Block / Unblock */}
                          <button
                            onClick={() => handleToggleBlock(c)}
                            className={`btn ${isBlocked ? 'btn-secondary' : 'btn-danger'}`}
                            style={{ padding: '5px 10px', fontSize: '0.72rem' }}
                            title={isBlocked ? 'Unblock Client' : 'Permanently Block Client'}
                          >
                            {isBlocked ? (
                              <><ShieldAlert size={13} /> Unblock</>
                            ) : (
                              <><ShieldOff size={13} /> Block</>
                            )}
                          </button>

                          {/* View Events */}
                          <button
                            onClick={() => navigate(`/clients/${c.id}/events`)}
                            className="btn btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '0.72rem' }}
                            title="View Events"
                          >
                            <CalendarDays size={13} /> Events
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(c)}
                            className="btn btn-danger"
                            style={{ padding: '5px 10px', fontSize: '0.72rem', background: '#fff1f2', color: '#dc2626', border: '1px solid #fecaca' }}
                            title="Delete Client"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>Showing {clients.length} of {total} partners</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
            <span aria-live="polite" style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>Page {page} of {totalPages}</span>
            <button type="button" className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
          </div>
        </div>
      )}

      {/* Rating modal */}
      {ratingTarget && (
        <RatingModal
          client={ratingTarget}
          onClose={() => setRatingTarget(null)}
          onSaved={(newRating) => {
            handleRatingSaved(ratingTarget.id, newRating);
            setRatingTarget(null);
          }}
        />
      )}
    </div>
  );
}
