import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Pencil, Check, X, KeyRound, Award, Star, Trophy, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { getCartoonAvatar, CARTOON_AVATAR_PRESETS } from '../lib/avatar';

function ProfileBadge({ icon: Icon, label, tone }) {
  return <span className={`staff-earned-badge staff-earned-badge-${tone}`}><Icon size={13} aria-hidden="true" />{label}</span>;
}

export default function Profile() {
  const { user, token, setAuth, logout } = useAuthStore();
  const navigate = useNavigate();
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [profileBookings, setProfileBookings] = useState([]);
  const [badgesLoading, setBadgesLoading] = useState(true);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    api.get('/bookings/mine')
      .then((response) => { if (active) setProfileBookings(response.data || []); })
      .catch(() => { if (active) setProfileBookings([]); })
      .finally(() => { if (active) setBadgesLoading(false); });
    return () => { active = false; };
  }, [token]);

  // Profile edit state
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPlace, setEditPlace] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Password change state
  const [showPinChange, setShowPinChange] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  const defaultAvatar = user?.avatarUrl || getCartoonAvatar(user?.name || user?.phone || 'staff');
  const attendedCount = profileBookings.filter((booking) => booking.status === 'confirmed' && booking.attended).length;
  const earnedProfileBadges = [
    ...(attendedCount >= 1 ? [{ label: 'First site', icon: Trophy, tone: 'blue' }] : []),
    ...(attendedCount >= 5 ? [{ label: '5 sites attended', icon: Award, tone: 'green' }] : []),
    ...(attendedCount >= 10 ? [{ label: '10 site milestone', icon: Star, tone: 'gold' }] : []),
    ...(Number(user?.ratingCount) > 0 && Number(user?.rating) >= 4.5 ? [{ label: 'Top rated', icon: Star, tone: 'gold' }] : []),
  ];

  const handleUpdateAvatar = async (url) => {
    setAvatarLoading(true);
    try {
      const res = await api.patch('/users/me/avatar', { avatarUrl: url });
      setAuth({ ...user, avatarUrl: res.data.avatarUrl }, token);
      setShowPicker(false);
      toast.success('Cartoon profile picture updated!');
    } catch {
      toast.error('Failed to update profile picture');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleGenerateRandomCartoon = () => {
    const randomSeed = Math.random().toString(36).substring(2, 9);
    const randomStyle = ['adventurer', 'bottts', 'lorelei'][Math.floor(Math.random() * 3)];
    const newAvatar = getCartoonAvatar(randomSeed, randomStyle);
    handleUpdateAvatar(newAvatar);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      return toast.error('File size must be under 2MB');
    }

    const reader = new FileReader();
    reader.onload = async () => {
      await handleUpdateAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setEditSaving(true);
    try {
      const res = await api.patch('/users/me', { name: editName.trim(), place: editPlace.trim(), phone: editPhone.trim(), email: editEmail.trim() });
      setAuth({ ...user, ...res.data }, token);
      setEditMode(false);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setEditSaving(false);
    }
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    if (newPin !== newPin2) return toast.error('New passwords do not match');
    if (newPin.length < 8) return toast.error('Password must be at least 8 characters');
    setPinSaving(true);
    try {
      await api.post('/auth/user/change-password', { oldPassword: oldPin, newPassword: newPin });
      toast.success('Password changed successfully!');
      setOldPin(''); setNewPin(''); setNewPin2('');
      setShowPinChange(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change PIN');
    } finally {
      setPinSaving(false);
    }
  };

  const handleRequestPush = async () => {
    if (!('Notification' in window)) {
      return toast.error('This browser does not support push notifications.');
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success('Browser notifications enabled for event reminders');
      } else {
        toast.error('Notification permission was denied.');
      }
    } catch {
      toast.error('Could not request notification permissions.');
    }
  };

  // Unauthenticated user inline auth form state
  const [authMode, setAuthMode] = useState('login');
  const [authMethod, setAuthMethod] = useState('email');
  const [legacyLogin, setLegacyLogin] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authData, setAuthData] = useState({ name: '', phone: '', place: '', email: '', password: '', confirmPassword: '', pin: '' });

  const handleInlineAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthSubmitting(true);
    try {
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
      setProfileBookings([]);
      setBadgesLoading(true);
      setAuth(res.data.user, res.data.token);
      toast.success(`Welcome back, ${res.data.user.name}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div style={{ maxWidth: '440px', margin: '24px auto', padding: '0 16px' }}>
        <div className="card" style={{ padding: '28px 24px', boxShadow: '0 12px 36px rgba(15, 23, 42, 0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <div style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(2,132,199,0.06))',
              border: '1px solid rgba(191, 219, 254, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563EB',
              margin: '0 auto 14px',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 6 }}>
              {authMode === 'login' ? 'Staff Sign In' : 'Register New Staff Profile'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
              {authMode === 'login'
                ? 'Sign in to manage your cartoon avatar, bookings, and wages'
                : 'Join NearMe Catering network in under 30 seconds'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'rgba(241, 245, 249, 0.8)',
            padding: 4,
            borderRadius: 12,
            marginBottom: 20,
            border: '1px solid rgba(226, 232, 240, 0.8)',
          }}>
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setLegacyLogin(false); }}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: '0.84rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: authMode === 'login' ? '#FFFFFF' : 'transparent',
                color: authMode === 'login' ? '#2563EB' : 'var(--text-muted)',
                boxShadow: authMode === 'login' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setLegacyLogin(false); }}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: '0.84rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: authMode === 'register' ? '#FFFFFF' : 'transparent',
                color: authMode === 'register' ? '#2563EB' : 'var(--text-muted)',
                boxShadow: authMode === 'register' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleInlineAuthSubmit}>
            {authMode === 'register' && (
              <>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Full Name</label>
                  <input
                    className="form-input"
                    required
                    placeholder="e.g. Mohammed Shafi"
                    value={authData.name}
                    onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Location (District / City)</label>
                  <input
                    className="form-input"
                    required
                    placeholder="e.g. Manjeri, Malappuram"
                    value={authData.place}
                    onChange={(e) => setAuthData({ ...authData, place: e.target.value })}
                  />
                </div>
              </>
            )}

            {!legacyLogin && <div style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Continue with</label>
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

            {(legacyLogin || authMethod === 'phone') ? <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Mobile Number</label>
              <input className="form-input" type="tel" required maxLength={10} autoComplete="tel" placeholder="9876543210" value={authData.phone}
                onChange={e => setAuthData({ ...authData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
            </div> : <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Email Address</label>
              <input className="form-input" type="email" required autoComplete="email" placeholder="you@example.com" value={authData.email}
                onChange={e => setAuthData({ ...authData, email: e.target.value })} />
            </div>}

            {authMode === 'login' && legacyLogin ? <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Existing 4-Digit PIN</label>
              <input className="form-input" type="password" inputMode="numeric" required maxLength={4} placeholder="••••" value={authData.pin}
                onChange={e => setAuthData({ ...authData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
            </div> : <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Password</label>
              <input className="form-input" type="password" required minLength={8} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" value={authData.password}
                onChange={e => setAuthData({ ...authData, password: e.target.value })} />
            </div>}
            {authMode === 'register' && <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Confirm Password</label>
              <input className="form-input" type="password" required minLength={8} autoComplete="new-password" placeholder="Repeat your password" value={authData.confirmPassword}
                onChange={e => setAuthData({ ...authData, confirmPassword: e.target.value })} />
            </div>}

            <button
              type="submit"
              disabled={authSubmitting}
              className="btn btn-primary"
              style={{ width: '100%', height: 44, justifyContent: 'center', fontSize: '0.92rem', fontWeight: 700 }}
            >
              {authSubmitting ? 'Verifying…' : authMode === 'login' ? 'Sign In & Access Profile' : 'Register Profile'}
            </button>
            {authMode === 'login' && <div style={{ textAlign: 'center', marginTop: 12, display: 'grid', gap: 8 }}>
              {!legacyLogin && <button type="button" onClick={() => navigate('/forgot-password')} style={{ border: 0, background: 'transparent', color: '#2563EB', fontWeight: 700, cursor: 'pointer' }}>Forgot password?</button>}
              <button type="button" onClick={() => { setLegacyLogin(v => !v); setAuthMethod(legacyLogin ? 'email' : 'phone'); }} style={{ border: 0, background: 'transparent', color: '#64748B', fontWeight: 650, cursor: 'pointer', fontSize: 12 }}>{legacyLogin ? 'Use email or mobile + password' : 'Use an older phone + PIN account'}</button>
            </div>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="staff-profile-heading-wrap" style={{ maxWidth: '800px', margin: '0 auto', padding: '16px 16px 12px' }}>
        <h2 className="section-heading">Staff Profile</h2>
        <p className="section-sub">Manage your identification, contact and reminder settings</p>
      </div>

      <div className="staff-profile-content" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* User Identity Card with AI Cartoon Avatar */}
        <div className="glass-card staff-profile-card" style={{ padding: '22px 20px' }}>
          <div className="staff-profile-identity-row" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={defaultAvatar}
                className="staff-profile-avatar"
                alt={user?.name || 'Staff'}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = getCartoonAvatar(user?.name || 'staff');
                }}
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid #2563EB',
                  boxShadow: '0 4px 16px rgba(37, 99, 235, 0.22)',
                  background: '#EFF6FF',
                }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                fontSize: '1.18rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                marginBottom: 6,
                color: '#0F172A',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user?.name || 'Staff Member'}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'rgba(5, 150, 105, 0.08)',
                  border: '1px solid rgba(5, 150, 105, 0.25)',
                  padding: '3px 9px',
                  borderRadius: 99,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#047857',
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Verified Staff
                </span>

                <button
                  onClick={() => setShowPicker(!showPicker)}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.74rem', gap: 5 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>{showPicker ? 'Close' : 'Choose Cartoon Avatar'}</span>
                </button>
              </div>
            </div>
          </div>

          <section className="staff-achievement-panel" aria-label="Participation badges">
            <div className="staff-achievement-title"><Award size={15} /><span>Earned badges</span><span className="staff-achievement-count">{badgesLoading ? '—' : earnedProfileBadges.length}</span></div>
            <div className="staff-earned-badges">
              {badgesLoading ? <span className="staff-achievement-hint">Loading your milestones…</span> : earnedProfileBadges.length ? earnedProfileBadges.map((badge) => <ProfileBadge key={badge.label} {...badge} />) : <span className="staff-achievement-hint">Attend your first site to earn a badge.</span>}
            </div>
          </section>

          {/* AI Cartoon Avatar Picker Drawer */}
          {showPicker && (
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '18px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A' }}>
                  Choose AI Cartoon Character:
                </h4>
                <button
                  onClick={handleGenerateRandomCartoon}
                  disabled={avatarLoading}
                  className="btn btn-secondary"
                  style={{ padding: '4px 9px', fontSize: '0.72rem', gap: 4 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  <span>Random AI Character</span>
                </button>
              </div>

              {/* Preset AI Cartoon Avatars */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {CARTOON_AVATAR_PRESETS.map((preset, idx) => (
                  <img
                    key={idx}
                    src={preset}
                    alt={`Cartoon Character ${idx + 1}`}
                    onClick={() => handleUpdateAvatar(preset)}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      cursor: 'pointer',
                      border: user?.avatarUrl === preset ? '3px solid #2563EB' : '2px solid #E2E8F0',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      background: '#FFFFFF',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  />
                ))}
              </div>

              {/* Upload from Phone / Device */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>
                  Or upload custom photo from device gallery:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
            </div>
          )}

            <div className="staff-profile-details" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid rgba(226, 232, 240, 0.8)', paddingTop: 16 }}>
            {/* Mobile number – editable */}
            <div className="staff-profile-contact-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Mobile for event updates</span>
              {editMode ? <input className="form-input" type="tel" maxLength={10} autoComplete="tel" placeholder="Add mobile number" value={editPhone} onChange={e => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} style={{ flex: 1, marginLeft: 12, height: 34, fontSize: '0.85rem', padding: '4px 10px' }} /> : <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user?.phone || 'Add a mobile number'}</span>}
            </div>

            <div className="staff-profile-contact-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Email for reminders & messages</span>
              {editMode ? <input className="form-input" type="email" autoComplete="email" placeholder="Add email address" value={editEmail} onChange={e => setEditEmail(e.target.value)} style={{ flex: 1, height: 34, fontSize: '0.85rem', padding: '4px 10px' }} /> : <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user?.email || 'Add an email'}</span>}
            </div>
            {(!user?.phone || !user?.email) && <p style={{ margin: '-4px 0 0', color: '#64748B', fontSize: '0.73rem', lineHeight: 1.5 }}>
              Add a mobile number or email in Edit Profile Info so we can reach you about events and account updates.
            </p>}

            {/* Name – editable */}
            <div className="staff-profile-contact-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Full Name</span>
              {editMode ? (
                <input
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ flex: 1, height: 34, fontSize: '0.85rem', padding: '4px 10px' }}
                  placeholder="Full name"
                />
              ) : (
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user?.name || '—'}</span>
              )}
            </div>

            {/* Place – editable */}
            <div className="staff-profile-contact-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Home District / Place</span>
              {editMode ? (
                <input
                  className="form-input"
                  value={editPlace}
                  onChange={(e) => setEditPlace(e.target.value)}
                  style={{ flex: 1, height: 34, fontSize: '0.85rem', padding: '4px 10px' }}
                  placeholder="e.g. Malappuram"
                />
              ) : (
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user?.place || 'Kerala'}</span>
              )}
            </div>

            {/* Edit / Save / Cancel controls */}
            <div className="staff-profile-actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
              {editMode ? (
                <>
                  <button
                    onClick={handleSaveProfile}
                    disabled={editSaving}
                    className="btn btn-primary"
                    style={{ padding: '5px 14px', fontSize: '0.8rem', gap: 5 }}
                  >
                    <Check size={13} />
                    <span>{editSaving ? 'Saving…' : 'Save'}</span>
                  </button>
                  <button
                    onClick={() => setEditMode(false)}
                    className="btn btn-secondary"
                    style={{ padding: '5px 12px', fontSize: '0.8rem', gap: 5 }}
                  >
                    <X size={13} />
                    <span>Cancel</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setEditName(user?.name || ''); setEditPlace(user?.place || ''); setEditPhone(user?.phone || ''); setEditEmail(user?.email || ''); setEditMode(true); }}
                  className="btn btn-secondary"
                  style={{ padding: '5px 12px', fontSize: '0.8rem', gap: 5 }}
                >
                  <Pencil size={13} />
                  <span>Edit Profile Info</span>
                </button>
              )}
            </div>
          </div>
        </div>


        <div className="profile-cancellation-note" role="note">
          <AlertTriangle size={17} aria-hidden="true" />
          <p><strong>Protect your account:</strong> Please cancel only when plans change. Repeated avoidable cancellations may lead to account restrictions or blocking by an admin.</p>
        </div>

        {/* Notifications Card */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(239, 246, 255, 0.9)',
              border: '1px solid rgba(191, 219, 254, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563EB',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div>
              <h4 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                Arrival & Slot Alerts
              </h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Browser alerts need this permission. Event reminders can also be sent to your saved email.
              </p>
            </div>
          </div>

          <button
            onClick={handleRequestPush}
            className="btn btn-glass"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4, gap: 8, fontSize: '0.84rem' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.4">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>Enable Browser Notifications</span>
          </button>
        </div>

        {/* Change Password Card */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <KeyRound size={17} color="#DC2626" />
              </div>
              <div>
                <h4 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A' }}>Change Password</h4>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Update the password used to sign in</p>
                {!user?.email && <p style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 3 }}>If you signed in with an older PIN, enter it as your current credential to set a password.</p>}
              </div>
            </div>
            <button
              onClick={() => setShowPinChange(v => !v)}
              className="btn btn-secondary"
              style={{ padding: '5px 12px', fontSize: '0.78rem' }}
            >
              {showPinChange ? 'Cancel' : 'Change'}
            </button>
          </div>

          {showPinChange && (
            <form onSubmit={handleChangePin} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid rgba(226,232,240,0.8)', paddingTop: 16 }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Current Password</label>
                <input
                  className="form-input"
                  type="password"
                  required
                  placeholder="Current password"
                  value={oldPin}
                  onChange={e => setOldPin(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>New Password</label>
                <input
                  className="form-input"
                  type="password"
                  minLength={8}
                  required
                  placeholder="At least 8 characters"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Confirm New Password</label>
                <input
                  className="form-input"
                  type="password"
                  minLength={8}
                  required
                  placeholder="Repeat new password"
                  value={newPin2}
                  onChange={e => setNewPin2(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={pinSaving}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px', background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                  color: '#fff', border: 'none', borderRadius: 10, cursor: pinSaving ? 'wait' : 'pointer',
                  fontSize: '0.86rem', fontWeight: 700, boxShadow: '0 3px 12px rgba(220,38,38,0.22)',
                }}
              >
                <KeyRound size={14} />
                {pinSaving ? 'Changing…' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        {/* Logout Button */}
        <button
          onClick={() => { setProfileBookings([]); setBadgesLoading(true); logout(); }}
          className="btn-danger-glass"
          style={{ width: '100%', justifyContent: 'center', padding: '13px', borderRadius: 'var(--radius-md)', gap: 8, fontSize: '0.86rem' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );
}
