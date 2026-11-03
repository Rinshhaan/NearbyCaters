import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, Plus, Save, User, Image as ImageIcon, Video, Loader2, CheckCircle, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

/* ─── Media Slot (image or video) ───────────────────────── */
function MediaSlot({ url, resourceType, onUpload, onRemove, index }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const isVideo = resourceType === 'video' || /\.(mp4|webm|mov|avi)$/i.test(url || '');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/clients/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpload(res.data.url, res.data.resourceType);
      toast.success('Uploaded!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      borderRadius: '14px',
      overflow: 'hidden',
      background: 'rgba(37,99,235,0.04)',
      border: '1.5px solid rgba(37,99,235,0.12)',
      position: 'relative',
      aspectRatio: '4/3',
      cursor: 'pointer',
    }}
      onClick={() => !url && fileRef.current?.click()}
    >
      {uploading ? (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#2563EB' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Uploading…</span>
        </div>
      ) : url ? (
        <div style={{ position: 'relative', height: '100%' }}>
          {isVideo ? (
            <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} muted playsInline />
          ) : (
            <img src={url} alt={`Work ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
          {isVideo && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(0,0,0,0.45)', borderRadius: '50%', padding: 8, display: 'flex' }}>
              <Video size={18} color="#fff" />
            </div>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
          >
            <X size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(37,99,235,0.85)', border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#fff', fontSize: '0.7rem', fontWeight: 600 }}
          >
            <Upload size={11} /> Change
          </button>
        </div>
      ) : (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#94A3B8' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={20} color="#2563EB" />
          </div>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.3, padding: '0 8px' }}>Tap to add photo or video</span>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </div>
  );
}

/* ─── Upload Button ────────────────────────────────────── */
function UploadButton({ currentUrl, onUpload, children, accept = 'image/*' }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/clients/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpload(res.data.url);
      toast.success('Uploaded successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
          background: 'rgba(37,99,235,0.08)', border: '1.5px dashed rgba(37,99,235,0.3)',
          borderRadius: 12, cursor: uploading ? 'wait' : 'pointer', fontSize: '0.83rem',
          fontWeight: 600, color: '#2563EB', transition: 'all 0.2s',
          width: '100%', justifyContent: 'center',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,99,235,0.13)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(37,99,235,0.08)'}
      >
        {uploading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={16} />}
        {uploading ? 'Uploading…' : children}
      </button>
      <input ref={fileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleFile} />
    </>
  );
}

/* ─── Main component ─────────────────────────────────── */
export default function ClientProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [workMedia, setWorkMedia] = useState([]); // [{url, resourceType}]

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [place, setPlace] = useState('');
  const [bio, setBio] = useState('');

  const [pwOld, setPwOld] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwNew2, setPwNew2] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    api.get('/clients/me/profile')
      .then((res) => {
        const p = res.data;
        setProfile(p);
        setLogoUrl(p.logoUrl || '');
        setBannerUrl(p.bannerUrl || '');
        setName(p.name || '');
        setCompanyName(p.companyName || '');
        setPhone(p.phone || '');
        setEmail(p.email || '');
        setPlace(p.place || '');
        setBio(p.bio || '');
        const imgs = Array.isArray(p.workImages) && p.workImages.length > 0
          ? p.workImages.map(url => ({ url, resourceType: /\.(mp4|webm|mov)$/i.test(url) ? 'video' : 'image' }))
          : [];
        setWorkMedia(imgs);
      })
      .catch((err) => console.error('Profile load error:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const workImages = workMedia.filter(m => m.url).map(m => m.url);
      await api.patch('/clients/me/profile', {
        name: name.trim() || undefined,
        companyName: companyName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        place: place.trim() || undefined,
        bio: bio.trim(),
        logoUrl: logoUrl || undefined,
        bannerUrl: bannerUrl || undefined,
        workImages,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success('Profile saved!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwNew !== pwNew2) return toast.error('New passwords do not match');
    if (pwNew.length < 8) return toast.error('Password must be at least 8 characters');
    setPwSaving(true);
    try {
      await api.post('/auth/client/change-password', { oldPassword: pwOld, newPassword: pwNew });
      toast.success('Password changed successfully!');
      setPwOld(''); setPwNew(''); setPwNew2('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  const addSlot = () => {
    if (workMedia.length >= 10) return;
    setWorkMedia(prev => [...prev, { url: '', resourceType: 'image' }]);
  };

  const updateSlot = (idx, url, resourceType) => {
    setWorkMedia(prev => {
      const next = [...prev];
      next[idx] = { url, resourceType: resourceType || 'image' };
      return next;
    });
  };

  const removeSlot = (idx) => {
    setWorkMedia(prev => prev.filter((_, i) => i !== idx));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: '#2563EB' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontWeight: 600 }}>Loading profile…</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px', color: '#0F172A' }}>Brand Profile</h1>
        <p style={{ color: '#64748B', fontSize: '0.875rem', marginTop: 4 }}>
          Keep your public partner profile, contact details, and work gallery up to date
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Contact Info ── */}
        <div style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)', borderRadius: 20, border: '1px solid rgba(219,234,254,0.8)', boxShadow: '0 4px 24px rgba(37,99,235,0.07)', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={16} color="#2563EB" />
            </div>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>Contact Info</h2>
          <p style={{ fontSize: '0.75rem', color: '#64748B' }}>These details appear on your partner profile and support account recovery</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Full Name', value: name, setter: setName, placeholder: 'Your name', type: 'text' },
              { label: 'Company / Team Name', value: companyName, setter: setCompanyName, placeholder: 'Royal Feast Caters', type: 'text' },
              { label: 'City / District', value: place, setter: setPlace, placeholder: 'Kozhikode, Kerala', type: 'text' },
              { label: 'Mobile Number', value: phone, setter: setPhone, placeholder: '9876543210', type: 'tel', maxLength: 10 },
              { label: 'Email Address', value: email, setter: setEmail, placeholder: 'you@example.com', type: 'email' },
            ].map(({ label, value, setter, placeholder, type, maxLength }) => (
              <div key={label}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
                <input type={type} value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} maxLength={maxLength}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid rgba(37,99,235,0.2)', background: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', color: '#0F172A', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(37,99,235,0.6)'} onBlur={e => e.target.style.borderColor = 'rgba(37,99,235,0.2)'} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>About your team</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Share what staff should know about your team and event work."
                style={{ width: '100%', minHeight: 90, padding: '10px 14px', borderRadius: 10, border: '1.5px solid rgba(37,99,235,0.2)', background: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', color: '#0F172A', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
          </div>
        </div>

        {/* ── Logo ── */}
        <div style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(20px)',
          borderRadius: 20,
          border: '1px solid rgba(219,234,254,0.8)',
          boxShadow: '0 4px 24px rgba(37,99,235,0.07)',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={16} color="#2563EB" />
            </div>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>Company Logo</h2>
              <p style={{ fontSize: '0.75rem', color: '#64748B' }}>Shown as avatar on your event cards</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Logo preview circle */}
            <div style={{
              width: 88, height: 88, borderRadius: '50%', flexShrink: 0,
              background: logoUrl ? 'transparent' : 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(99,102,241,0.12))',
              border: '2.5px solid rgba(37,99,235,0.2)',
              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563EB' }}>
                  {profile?.name?.[0]?.toUpperCase() || 'N'}
                </span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <UploadButton onUpload={setLogoUrl} accept="image/*">
                Choose Logo from Gallery
              </UploadButton>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  style={{ marginTop: 8, fontSize: '0.75rem', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <X size={13} /> Remove logo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Banner ── */}
        <div style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(20px)',
          borderRadius: 20,
          border: '1px solid rgba(219,234,254,0.8)',
          boxShadow: '0 4px 24px rgba(37,99,235,0.07)',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageIcon size={16} color="#6366F1" />
            </div>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>Profile Banner</h2>
              <p style={{ fontSize: '0.75rem', color: '#64748B' }}>Displayed at top of your public profile page</p>
            </div>
          </div>

          {bannerUrl && (
            <div style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 16, height: 160, position: 'relative', border: '1px solid rgba(219,234,254,0.8)' }}>
              <img src={bannerUrl} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.25), transparent)' }} />
              <button
                type="button"
                onClick={() => setBannerUrl('')}
                style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <UploadButton onUpload={setBannerUrl} accept="image/*">
            {bannerUrl ? 'Change Banner Photo' : 'Choose Banner from Gallery'}
          </UploadButton>
        </div>

        {/* ── Portfolio Media ── */}
        <div style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(20px)',
          borderRadius: 20,
          border: '1px solid rgba(219,234,254,0.8)',
          boxShadow: '0 4px 24px rgba(37,99,235,0.07)',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(5,150,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Video size={16} color="#059669" />
              </div>
              <div>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>Portfolio</h2>
                <p style={{ fontSize: '0.75rem', color: '#64748B' }}>Photos & videos of your work — up to 10</p>
              </div>
            </div>
            {workMedia.length < 10 && (
              <button
                type="button"
                onClick={addSlot}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 10, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#2563EB' }}
              >
                <Plus size={14} /> Add Slot
              </button>
            )}
          </div>

          {workMedia.length === 0 ? (
            <div
              onClick={addSlot}
              style={{ border: '2px dashed rgba(37,99,235,0.2)', borderRadius: 16, padding: 40, textAlign: 'center', cursor: 'pointer', color: '#94A3B8' }}
            >
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(37,99,235,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Plus size={24} color="#2563EB" />
              </div>
              <p style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>Add your first photo or video</p>
              <p style={{ fontSize: '0.8rem' }}>Showcase your best catering event work</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {workMedia.map((media, idx) => (
                <MediaSlot
                  key={idx}
                  index={idx}
                  url={media.url}
                  resourceType={media.resourceType}
                  onUpload={(url, rt) => updateSlot(idx, url, rt)}
                  onRemove={() => removeSlot(idx)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Change Password ── */}
        <div style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)', borderRadius: 20, border: '1px solid rgba(219,234,254,0.8)', boxShadow: '0 4px 24px rgba(37,99,235,0.07)', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KeyRound size={16} color="#DC2626" />
            </div>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>Change Password</h2>
              <p style={{ fontSize: '0.75rem', color: '#64748B' }}>Keep your account secure with a strong password</p>
            </div>
          </div>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Current Password', value: pwOld, setter: setPwOld, placeholder: '••••••••' },
              { label: 'New Password', value: pwNew, setter: setPwNew, placeholder: 'Min 8 characters' },
              { label: 'Confirm New Password', value: pwNew2, setter: setPwNew2, placeholder: '••••••••' },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
                <input type="password" value={value} onChange={e => setter(e.target.value)} required placeholder={placeholder}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid rgba(37,99,235,0.2)', background: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', color: '#0F172A', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(220,38,38,0.5)'} onBlur={e => e.target.style.borderColor = 'rgba(37,99,235,0.2)'} />
              </div>
            ))}
            <button type="submit" disabled={pwSaving} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 24px', background: 'linear-gradient(135deg, #DC2626, #B91C1C)', color: '#fff', border: 'none', borderRadius: 12, cursor: pwSaving ? 'wait' : 'pointer', fontSize: '0.875rem', fontWeight: 700, boxShadow: '0 3px 12px rgba(220,38,38,0.25)' }}>
              {pwSaving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <KeyRound size={16} />}
              {pwSaving ? 'Changing…' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* ── Save ── */}
        <button
          type="submit"
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '14px 28px',
            background: saved ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            color: '#fff', border: 'none', borderRadius: 14, cursor: saving ? 'wait' : 'pointer',
            fontSize: '0.95rem', fontWeight: 700, letterSpacing: '-0.2px',
            boxShadow: saved ? '0 4px 16px rgba(5,150,105,0.35)' : '0 4px 16px rgba(37,99,235,0.35)',
            transition: 'all 0.3s',
          }}
        >
          {saving ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : saved ? <CheckCircle size={18} /> : <Save size={18} />}
          {saving ? 'Saving…' : saved ? 'Profile Saved!' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
