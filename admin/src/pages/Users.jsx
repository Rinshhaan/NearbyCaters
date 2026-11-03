import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, Phone, Calendar, MapPin, UserCheck, CheckCircle2, Mail, Pencil, Ban, Trash2, X } from 'lucide-react';
import api from '../lib/api';

function StaffEditModal({ staff, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: staff.name || '',
    place: staff.place || '',
    phone: staff.phone || '',
    email: staff.email || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.phone.trim() && !form.email.trim()) return toast.error('Keep at least one contact method on this account.');
    setSaving(true);
    try {
      const response = await api.patch(`/admin/users/${staff.id}`, form);
      toast.success('Staff profile updated');
      onSaved(response.data.user);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not update staff profile');
    } finally {
      setSaving(false);
    }
  };

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.48)' }}>
      <section role="dialog" aria-modal="true" aria-labelledby="edit-staff-title" className="card staff-edit-dialog">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div>
            <h2 id="edit-staff-title" style={{ margin: 0, fontSize: '1.15rem' }}>Edit staff profile</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '.82rem' }}>{staff.name}</p>
          </div>
          <button type="button" className="btn btn-secondary" aria-label="Close edit dialog" onClick={onClose} style={{ padding: 7 }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 13 }}>
          <label className="staff-edit-field">Full name<input className="form-input" required minLength={2} maxLength={100} value={form.name} onChange={update('name')} /></label>
          <label className="staff-edit-field">Place / district<input className="form-input" required minLength={2} maxLength={120} value={form.place} onChange={update('place')} /></label>
          <label className="staff-edit-field">Mobile number<input className="form-input" type="tel" inputMode="numeric" maxLength={10} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))} /></label>
          <label className="staff-edit-field">Email address<input className="form-input" type="email" maxLength={254} value={form.email} onChange={update('email')} /></label>
          <p style={{ margin: '-3px 0 0', color: '#64748b', fontSize: '.74rem' }}>Keep at least one mobile number or email address.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [editTarget, setEditTarget] = useState(null);
  const [actioningId, setActioningId] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/users?page=${page}&limit=50&search=${encodeURIComponent(search.trim())}`);
      setUsers(res.data.users || []);
      setTotal(res.data.total || 0);
      setTotalPages(Math.max(1, res.data.totalPages || 1));
    } catch {
      toast.error('Failed to load staff list');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchUsers, search]);

  const handleToggleBlock = async (staff) => {
    const isBlocked = staff.isActive === false;
    const action = isBlocked ? 'Unblock' : 'Block';
    if (!window.confirm(`${action} ${staff.name}'s account? ${isBlocked ? 'They will be able to sign in again.' : 'Their current sessions will be revoked.'}`)) return;
    setActioningId(staff.id);
    try {
      await api.patch(`/admin/users/${staff.id}/toggle-block`);
      toast.success(`Account ${isBlocked ? 'unblocked' : 'blocked'}`);
      await fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || `Could not ${action.toLowerCase()} this account`);
    } finally {
      setActioningId(null);
    }
  };

  const handleDelete = async (staff) => {
    const confirmed = window.confirm(`Permanently delete ${staff.name}'s account and its booking and attendance history? This cannot be undone.`);
    if (!confirmed) return;
    setActioningId(staff.id);
    try {
      await api.delete(`/admin/users/${staff.id}`);
      toast.success('Staff account and history deleted');
      if (users.length === 1 && page > 1) setPage((current) => current - 1);
      else await fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not delete this staff account');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.4px', color: '#0F172A' }}>Registered Staff & Boys</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>
            Direct directory of catering personnel across Kerala districts
          </p>
        </div>
        <div style={{ position: 'relative', width: 'min(320px, 100%)', flex: '1 1 240px', maxWidth: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '40px', fontSize: '0.85rem' }}
            placeholder="Search by name, place, phone..."
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#2563EB', fontWeight: 600 }}>
            Loading staff directory…
          </div>
        ) : users.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '36px 0', textAlign: 'center' }}>
            {search ? `No staff found matching "${search}".` : 'No staff registered yet.'}
          </p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Staff Profile</th>
                  <th>WhatsApp Contact</th>
                  <th>Location</th>
                  <th>Total Events Joined</th>
                  <th>Joined Date</th>
                  <th>Account</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    {/* Profile */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={u.avatarUrl || `https://api.dicebear.com/7.x/adventurer/png?seed=${encodeURIComponent(u.name || u.phone || 'staff')}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                          alt={u.name}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = `https://api.dicebear.com/7.x/adventurer/png?seed=${encodeURIComponent(u.name || 'staff')}`;
                          }}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid rgba(37,99,235,0.25)',
                            background: '#EFF6FF',
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.92rem' }}>{u.name}</div>
                          <div style={{ fontSize: '0.74rem', color: u.isActive === false ? '#b91c1c' : 'var(--text-muted)' }}>{u.isActive === false ? 'Account blocked' : 'Verified Staff'}</div>
                        </div>
                      </div>
                    </td>

                    {/* WhatsApp */}
                    <td>
                      {u.phone ? <a
                        href={`https://wa.me/91${u.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: '#059669',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          background: 'rgba(5, 150, 105, 0.08)',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          textDecoration: 'none',
                        }}
                      >
                        <Phone size={13} />
                        {u.phone}
                      </a> : <span style={{ color: '#64748B', fontSize: 12 }}>No mobile number added</span>}
                      {u.email && <a href={`mailto:${u.email}`} style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, color: '#2563EB', fontSize: 12, fontWeight: 650, textDecoration: 'none' }}><Mail size={12} />{u.email}</a>}
                    </td>

                    {/* Place */}
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#475569', fontSize: '0.85rem' }}>
                        <MapPin size={14} color="#2563EB" />
                        {u.place || 'Kerala'}
                      </span>
                    </td>

                    {/* Bookings */}
                    <td>
                      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} />
                        {u._count?.bookings || 0} events
                      </span>
                    </td>

                    {/* Joined */}
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Calendar size={13} />
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.isActive === false ? 'badge-danger' : 'badge-success'}`}>
                        {u.isActive === false ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setEditTarget(u)} disabled={actioningId === u.id} title={`Edit ${u.name}`} aria-label={`Edit ${u.name}`} style={{ minHeight: 30, padding: '4px 7px', fontSize: '.72rem' }}>
                          <Pencil size={13} /> Edit
                        </button>
                        <button type="button" className={`btn ${u.isActive === false ? 'btn-success' : 'btn-secondary'}`} onClick={() => handleToggleBlock(u)} disabled={actioningId === u.id} title={`${u.isActive === false ? 'Unblock' : 'Block'} ${u.name}`} style={{ minHeight: 30, padding: '4px 7px', fontSize: '.72rem' }}>
                          {u.isActive === false ? <><UserCheck size={13} /> Unblock</> : <><Ban size={13} /> Block</>}
                        </button>
                        <button type="button" className="btn btn-danger" onClick={() => handleDelete(u)} disabled={actioningId === u.id} title={`Delete ${u.name}`} aria-label={`Delete ${u.name}`} style={{ minHeight: 30, padding: '4px 7px', fontSize: '.72rem' }}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>Showing {users.length} of {total} staff profiles</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
            <span aria-live="polite" style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>Page {page} of {totalPages}</span>
            <button type="button" className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
          </div>
        </div>
      )}
      {editTarget && <StaffEditModal staff={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); fetchUsers(); }} />}
    </div>
  );
}
