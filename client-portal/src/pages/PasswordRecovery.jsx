import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function PasswordRecovery() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (token) {
        if (password !== confirmPassword) {
          toast.error('Passwords do not match');
          return;
        }
        await api.post('/auth/password/reset', { role: 'client', token, password });
        toast.success('Password updated. Sign in with your new password.');
        navigate('/login', { replace: true });
      } else {
        await api.post('/auth/password/forgot', { role: 'client', email });
        setSent(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(145deg,#f8fafc,#eef4ff)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <section style={{ width: '100%', maxWidth: 460, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 30, boxShadow: '0 24px 70px rgba(15,23,42,.1)' }}>
        <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#64748b', fontSize: 13, fontWeight: 700, textDecoration: 'none', marginBottom: 24 }}><ArrowLeft size={15} /> Back to sign in</Link>
        <div style={{ width: 48, height: 48, borderRadius: 15, display: 'grid', placeItems: 'center', color: '#2563eb', background: '#eff6ff', marginBottom: 18 }}><KeyRound size={22} /></div>
        <h1 style={{ margin: 0, color: '#0f172a', fontSize: 25, letterSpacing: '-.04em' }}>{token ? 'Choose a new password' : 'Reset your password'}</h1>
        <p style={{ color: '#64748b', lineHeight: 1.6, fontSize: 14, margin: '9px 0 22px' }}>{token ? 'Use at least 8 characters. This new password will work across your account.' : 'We’ll email a secure, single-use reset link if that address belongs to an account.'}</p>
        {sent ? (
          <div style={{ borderRadius: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 16, color: '#166534', lineHeight: 1.55, fontSize: 14 }}>
            <ShieldCheck size={18} style={{ verticalAlign: 'middle', marginRight: 7 }} />If an account matches that email, a reset link is on its way. Check your inbox.
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
            {!token ? (
              <label style={{ display: 'grid', gap: 7, color: '#334155', fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Account email
                <span style={{ position: 'relative' }}><Mail size={16} style={{ position: 'absolute', top: 14, left: 13, color: '#94a3b8' }} /><input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} /></span>
              </label>
            ) : (
              <>
                <label style={labelStyle}>New password<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, paddingLeft: 13 }} /></label>
                <label style={labelStyle}>Confirm new password<input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ ...inputStyle, paddingLeft: 13 }} /></label>
              </>
            )}
            <button disabled={busy} type="submit" style={{ border: 0, borderRadius: 12, background: '#2563eb', color: '#fff', padding: 13, fontWeight: 800, fontSize: 14, cursor: busy ? 'wait' : 'pointer', marginTop: 3 }}>{busy ? 'Please wait…' : token ? 'Save new password' : 'Email reset link'}</button>
          </form>
        )}
        <p style={{ margin: '22px 0 0', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Nearby Caters · secure account recovery</p>
      </section>
    </main>
  );
}

const inputStyle = { width: '100%', boxSizing: 'border-box', marginTop: 7, border: '1px solid #cbd5e1', borderRadius: 11, padding: '12px 13px 12px 40px', outline: 'none', fontSize: 14, color: '#0f172a', background: '#fff' };
const labelStyle = { display: 'grid', gap: 1, color: '#334155', fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' };
