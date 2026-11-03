import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Calendar, CreditCard, LogOut, Menu, X, PlusCircle, BarChart2, User, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';

export default function ClientLayout() {
  const { user, token, setAuth, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync latest approval & active status from server on mount
  useEffect(() => {
    if (token) {
      api.get('/clients/profile')
        .then((res) => {
          if (res.data) {
            setAuth({ ...user, ...res.data }, token);
          }
        })
        .catch(() => {});
    }
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="portal-layout">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 35,
          }}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 0,
            overflow: 'visible',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'none',
            flexShrink: 0,
          }}>
            <img src="/nearby-caters-logo.jpg" alt="Nearby Caters" width="36" height="36" style={{ display: 'block', objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, letterSpacing: '-0.03em', fontSize: '1.05rem', color: '#0F172A' }}>
              Nearby<span style={{ color: 'var(--primary)' }}>Caters</span>
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Partner Portal
            </span>
          </div>
        </div>

        <nav className="sidebar-menu">
          <NavLink
            to="/"
            end
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Calendar size={18} />
            <span>My Events</span>
          </NavLink>

          <NavLink
            to="/create-event"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <PlusCircle size={18} />
            <span>Publish New Event</span>
          </NavLink>

          <NavLink
            to="/payments"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <CreditCard size={18} />
            <span>Payments & Invoices</span>
          </NavLink>

          <NavLink
            to="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <BarChart2 size={18} />
            <span>Analytics</span>
          </NavLink>

          <NavLink
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <User size={18} />
            <span>My Profile</span>
          </NavLink>
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid var(--glass-border)' }}>
          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', gap: 8, color: '#FCA5A5' }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              className="mobile-nav-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.3px' }}>
              {user?.companyName || user?.name || 'Catering Partner'}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={`badge ${user?.isApproved ? 'badge-success' : 'badge-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {user?.isApproved ? (
                <>
                  <ShieldCheck size={13} />
                  <span>Verified Partner</span>
                </>
              ) : (
                <>
                  <Clock size={13} />
                  <span>Review Pending</span>
                </>
              )}
            </span>
          </div>
        </header>

        <main className="page-container">
          {!user?.isApproved && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              marginBottom: '24px',
              color: '#B45309',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}>
              <AlertCircle size={22} color="#D97706" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#92400E' }}>Account Verification Pending:</strong> Your organizer profile is currently being reviewed by Nearby Caters Admin. You can prepare event drafts in the meantime.
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
