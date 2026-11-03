import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, User, Building2, Mail, Phone, Lock, Image, Upload, Plus, X, Loader2, CheckCircle, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

/* ─── Upload helper ─────────────────────────────────── */
function FileUploadBtn({ label, accept = 'image/*', onUploaded, currentUrl, onClear }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/clients/signup-upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onUploaded(res.data.url);
      toast.success('Uploaded!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      {currentUrl ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', marginBottom: 8 }}>
          <img src={currentUrl} alt={label} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
          <button type="button" onClick={onClear}
            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <X size={13} />
          </button>
          <button type="button" onClick={() => ref.current?.click()}
            style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(37,99,235,0.85)', border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>
            <Upload size={11} /> Change
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          style={{
            width: '100%', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'rgba(255,255,255,0.06)', border: '1.5px dashed rgba(255,255,255,0.18)',
            borderRadius: 12, cursor: uploading ? 'wait' : 'pointer', color: 'rgba(255,255,255,0.7)',
            fontSize: '0.83rem', fontWeight: 600, boxSizing: 'border-box',
          }}>
          {uploading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={15} />}
          {uploading ? 'Uploading…' : label}
        </button>
      )}
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}

/* ─── Work image slot ─────────────────────────────── */
function WorkSlot({ url, index, onUpload, onRemove }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/clients/signup-upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onUpload(res.data.url);
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', position: 'relative', aspectRatio: '4/3', cursor: 'pointer' }}
      onClick={() => !url && ref.current?.click()}>
      {uploading ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : url ? (
        <div style={{ height: '100%', position: 'relative' }}>
          <img src={url} alt={`Work ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }}
            style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <X size={11} />
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); ref.current?.click(); }}
            style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(37,99,235,0.85)', border: 'none', borderRadius: 7, padding: '3px 7px', cursor: 'pointer', color: '#fff', fontSize: '0.65rem', fontWeight: 700 }}>
            <Upload size={9} />
          </button>
        </div>
      ) : (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'rgba(255,255,255,0.3)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(37,99,235,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={16} color="rgba(99,102,241,0.8)" />
          </div>
          <span style={{ fontSize: '0.65rem', fontWeight: 600, textAlign: 'center' }}>Add photo</span>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}

/* ─── Field component ────────────────────────────── */
function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginBottom: 9, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {Icon && <Icon size={12} />} {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '13px 14px',
  background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.1)',
  borderRadius: 13, color: '#fff', fontSize: '0.9rem', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.2s',
};

/* ─── Steps ─────────────────────────────────────── */
const STEPS = ['Account', 'Business', 'Portfolio'];

export default function Register() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  /* Step 0 — Account */
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [place, setPlace] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  /* Step 1 — Business */
  const [companyName, setCompanyName] = useState('');
  const [bio, setBio] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  /* Step 2 — Portfolio */
  const [workImages, setWorkImages] = useState([]);

  const canNext0 = name.trim() && place.trim() && email.trim() && phone.trim().length === 10 && password.length >= 8 && password === password2;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const cleanWork = workImages.filter(u => u);
      await api.post('/auth/client/register', {
        name: name.trim(),
        companyName: companyName.trim() || undefined,
        place: place.trim(),
        bio: bio.trim() || undefined,
        email: email.trim(),
        phone: phone.trim(),
        password,
        logoUrl: logoUrl || undefined,
        bannerUrl: bannerUrl || undefined,
        workImages: cleanWork,
      });

      setSubmittedEmail(email.trim());
      toast.success('Registration submitted for admin approval.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const updateWork = (idx, url) => setWorkImages(prev => { const n = [...prev]; n[idx] = url; return n; });
  const removeWork = (idx) => setWorkImages(prev => prev.filter((_, i) => i !== idx));
  const addWork = () => { if (workImages.length < 10) setWorkImages(prev => [...prev, '']); };

  if (submittedEmail) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #1E293B 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 480, padding: '36px 30px', borderRadius: 24, textAlign: 'center', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 24px 80px rgba(0,0,0,0.3)', backdropFilter: 'blur(24px)' }}>
          <div style={{ width: 62, height: 62, margin: '0 auto 18px', borderRadius: 20, display: 'grid', placeItems: 'center', color: '#FBBF24', background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(251,191,36,0.24)' }}>
            <CheckCircle size={30} />
          </div>
          <p style={{ marginBottom: 8, color: '#FCD34D', fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>Application submitted</p>
          <h1 style={{ margin: '0 0 12px', color: '#fff', fontSize: '1.65rem', fontWeight: 900, letterSpacing: '-.04em' }}>Waiting for admin approval</h1>
          <p style={{ margin: '0 auto 20px', maxWidth: 370, color: 'rgba(255,255,255,.66)', fontSize: '.9rem', lineHeight: 1.65 }}>
            We’ll review your partner details and portfolio. Sign-in and event publishing will be available after your account is approved.
          </p>
          <div style={{ padding: '13px 15px', marginBottom: 22, borderRadius: 12, textAlign: 'left', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>
            <div style={{ color: 'rgba(255,255,255,.42)', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Registered email</div>
            <div style={{ marginTop: 5, color: '#fff', fontSize: 14, fontWeight: 700, wordBreak: 'break-word' }}>{submittedEmail}</div>
          </div>
          <Link to="/login" style={{ display: 'inline-flex', justifyContent: 'center', width: '100%', boxSizing: 'border-box', padding: '13px 18px', borderRadius: 12, color: '#fff', background: 'linear-gradient(135deg, #2563EB, #4F46E5)', fontSize: '.92rem', fontWeight: 800, textDecoration: 'none' }}>
            Go to partner sign in
          </Link>
          <p style={{ margin: '16px 0 0', color: 'rgba(255,255,255,.42)', fontSize: '.76rem' }}>You don’t need to submit another application while you wait.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #1E293B 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', position: 'relative', overflow: 'hidden',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* Blobs */}
      <div style={{ position: 'absolute', top: -100, right: -100, width: 340, height: 340, borderRadius: '50%', background: 'rgba(37,99,235,0.15)', filter: 'blur(70px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -80, width: 260, height: 260, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', filter: 'blur(55px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 62, height: 62, borderRadius: 20,
            background: 'linear-gradient(135deg, #2563EB, #4F46E5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', boxShadow: '0 8px 28px rgba(37,99,235,0.4)',
          }}>
            <ChefHat size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', marginBottom: 6 }}>
            Create Partner Account
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>
            Join Kerala's catering workforce platform
          </p>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center', justifyContent: 'center' }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i < step ? 'rgba(5,150,105,0.7)' : i === step ? 'linear-gradient(135deg, #2563EB, #4F46E5)' : 'rgba(255,255,255,0.1)',
                  border: i === step ? 'none' : '1px solid rgba(255,255,255,0.15)',
                  fontSize: '0.7rem', fontWeight: 800, color: '#fff',
                }}>
                  {i < step ? <CheckCircle size={13} /> : i + 1}
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: i === step ? '#fff' : 'rgba(255,255,255,0.35)', display: 'none' /* hide on small */ }}>
                  {s}
                </span>
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? 'rgba(5,150,105,0.5)' : 'rgba(255,255,255,0.1)' }} />}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 26,
          padding: '30px 28px', boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        }}>
          <div style={{ fontWeight: 800, color: '#fff', fontSize: '1rem', marginBottom: 20 }}>
            {step === 0 ? 'Account Details' : step === 1 ? 'Business Info (Optional)' : 'Portfolio (Optional)'}
          </div>

          {/* ── Step 0: Account ── */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field icon={User} label="Full Name / Contact Person">
                <input required style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Rinshan VP"
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </Field>
              <Field icon={Building2} label="City / District">
                <input required style={inputStyle} value={place} onChange={e => setPlace(e.target.value)} placeholder="Kozhikode, Kerala"
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </Field>
              <Field icon={Mail} label="Email Address">
                <input type="email" required style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@royalfeast.com"
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </Field>
              <Field icon={Phone} label="Mobile Number">
                <input type="tel" required maxLength={10} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210"
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </Field>
              <Field icon={Lock} label="Password (min 8 characters)">
                <input type="password" required minLength={8} style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </Field>
              <Field icon={Lock} label="Confirm Password">
                <input type="password" required style={{ ...inputStyle, borderColor: password2 && password !== password2 ? 'rgba(220,38,38,0.6)' : 'rgba(255,255,255,0.1)' }}
                  value={password2} onChange={e => setPassword2(e.target.value)} placeholder="••••••••"
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'} onBlur={e => e.target.style.borderColor = password2 && password !== password2 ? 'rgba(220,38,38,0.6)' : 'rgba(255,255,255,0.1)'} />
                {password2 && password !== password2 && (
                  <p style={{ fontSize: '0.75rem', color: '#FCA5A5', marginTop: 5 }}>Passwords do not match</p>
                )}
              </Field>
              <button type="button" disabled={!canNext0} onClick={() => setStep(1)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '13px', background: canNext0 ? 'linear-gradient(135deg, #2563EB, #4F46E5)' : 'rgba(255,255,255,0.1)',
                  color: canNext0 ? '#fff' : 'rgba(255,255,255,0.3)', border: 'none', borderRadius: 13, cursor: canNext0 ? 'pointer' : 'not-allowed',
                  fontSize: '0.95rem', fontWeight: 800, marginTop: 4, boxShadow: canNext0 ? '0 4px 20px rgba(37,99,235,0.4)' : 'none', transition: 'all 0.2s',
                }}>
                Continue <ChevronRight size={17} />
              </button>
            </div>
          )}

          {/* ── Step 1: Business ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                These fields are optional and can be updated from your profile later.
              </p>
              <Field icon={Building2} label="Company / Team Name">
                <input style={inputStyle} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Royal Feast Caters"
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </Field>
              <Field icon={Building2} label="About your catering team">
                <textarea style={{ ...inputStyle, minHeight: 86, resize: 'vertical' }} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell staff what makes your events and team distinctive."
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </Field>
              <Field icon={Image} label="Company Logo">
                <FileUploadBtn label="Upload Logo" onUploaded={setLogoUrl} currentUrl={logoUrl} onClear={() => setLogoUrl('')} />
              </Field>
              {logoUrl && (
                <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <img src={logoUrl} alt="Logo" style={{ width: 72, height: 72, objectFit: 'cover', display: 'block', borderRadius: '50%', border: '2px solid rgba(37,99,235,0.5)', margin: '0 auto 0 0' }} />
                </div>
              )}
              <Field icon={Image} label="Profile Banner">
                <FileUploadBtn label="Upload Banner Image" onUploaded={setBannerUrl} currentUrl={bannerUrl} onClear={() => setBannerUrl('')} accept="image/*" />
              </Field>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setStep(0)}
                  style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                  Back
                </button>
                <button type="button" onClick={() => setStep(2)}
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', background: 'linear-gradient(135deg, #2563EB, #4F46E5)', color: '#fff', border: 'none', borderRadius: 13, fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 18px rgba(37,99,235,0.35)' }}>
                  Continue <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Portfolio ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                Upload up to 10 photos/videos of your catering work. Can also be done later from your Profile page.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {workImages.map((url, idx) => (
                  <WorkSlot key={idx} url={url} index={idx} onUpload={u => updateWork(idx, u)} onRemove={() => removeWork(idx)} />
                ))}
                {workImages.length < 10 && (
                  <div style={{ borderRadius: 12, border: '1.5px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', aspectRatio: '4/3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}
                    onClick={addWork}>
                    <Plus size={18} color="rgba(99,102,241,0.7)" />
                    <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Add</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setStep(1)}
                  style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                  Back
                </button>
                <button type="button" disabled={loading} onClick={handleSubmit}
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', background: loading ? 'rgba(37,99,235,0.45)' : 'linear-gradient(135deg, #059669, #047857)', color: '#fff', border: 'none', borderRadius: 13, fontWeight: 800, cursor: loading ? 'wait' : 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 18px rgba(5,150,105,0.35)' }}>
                  {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={16} />}
                  {loading ? 'Creating account…' : 'Complete Registration'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.83rem' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'rgba(147,197,253,0.9)', fontWeight: 700, textDecoration: 'none' }}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
