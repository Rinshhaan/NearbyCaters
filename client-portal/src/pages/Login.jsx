import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, Lock, LogIn, Clock3 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const [approvalPending, setApprovalPending] = useState(Boolean(location.state?.approvalPending));
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setApprovalPending(false);
    try {
      const res = await api.post('/auth/client/login', { email, password });
      setAuth(res.data.user, res.data.token);
      toast.success(`Welcome back, ${res.data.user.name}!`);
      navigate('/');
    } catch (err) {
      if (err.response?.data?.approvalPending) {
        setApprovalPending(true);
      } else {
        toast.error(err.response?.data?.error || 'Failed to login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #1E293B 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative blobs */}
      <div style={{ position: 'absolute', top: -100, right: -100, width: 340, height: 340, borderRadius: '50%', background: 'rgba(37,99,235,0.15)', filter: 'blur(70px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -80, width: 260, height: 260, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', filter: 'blur(55px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '40%', left: '10%', width: 120, height: 120, borderRadius: '50%', background: 'rgba(37,99,235,0.07)', filter: 'blur(30px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src="/nearby-caters-logo.jpg" alt="Nearby Caters" width="72" height="72" style={{ display: 'block', objectFit: 'contain', margin: '0 auto 18px' }} />
          <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', marginBottom: 8 }}>
            Partner Portal
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', fontWeight: 500 }}>
            Publish catering events · Hire boys instantly
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 26,
          padding: '34px 30px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        }}>
          {approvalPending && (
            <div role="status" style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: 13, marginBottom: 18, borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(251,191,36,0.26)', color: '#FDE68A' }}>
              <Clock3 size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: '.83rem', fontWeight: 800, marginBottom: 4 }}>Your application is under review</div>
                <div style={{ fontSize: '.76rem', lineHeight: 1.5, color: 'rgba(255,255,255,.7)' }}>You can sign in after an admin approves your partner account. Please wait for the review to finish.</div>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 9, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="rgba(255,255,255,0.35)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="organizer@caterer.com"
                  style={{
                    width: '100%', padding: '13px 14px 13px 44px',
                    background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.1)',
                    borderRadius: 13, color: '#fff', fontSize: '0.92rem', outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 9, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="rgba(255,255,255,0.35)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '13px 14px 13px 44px',
                    background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.1)',
                    borderRadius: 13, color: '#fff', fontSize: '0.92rem', outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 9 }}>
                <Link to="/forgot-password" style={{ color: '#A5B4FC', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none' }}>Forgot password?</Link>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '14px',
                background: loading ? 'rgba(37,99,235,0.45)' : 'linear-gradient(135deg, #2563EB, #4F46E5)',
                color: '#fff', border: 'none', borderRadius: 14, cursor: loading ? 'wait' : 'pointer',
                fontSize: '0.97rem', fontWeight: 800, letterSpacing: '-0.2px',
                boxShadow: '0 4px 22px rgba(37,99,235,0.45)',
                transition: 'all 0.2s', marginTop: 4,
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(37,99,235,0.55)'; }}}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 22px rgba(37,99,235,0.45)'; }}
            >
              <LogIn size={18} />
              {loading ? 'Signing in…' : 'Sign In as Partner'}
            </button>
          </form>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 26, paddingTop: 22, textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: 14 }}>
              Don't have a partner account?
            </p>
            <Link to="/register" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 28px', borderRadius: 13,
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)',
              color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.13)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
            >
              Create Partner Account
            </Link>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.74rem', marginTop: 28 }}>
          Need help? <a href="mailto:nearbycaters@gmail.com" style={{ color: 'rgba(191,219,254,0.7)' }}>Email partner support</a>
        </p>
      </div>
    </div>
  );
}
