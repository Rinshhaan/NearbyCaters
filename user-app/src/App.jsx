import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import ClientProfile from './pages/ClientProfile';
import PasswordRecovery from './pages/PasswordRecovery';

// ── Inline SVG nav icons ──
const HomeIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? '#2563EB' : 'none'}
    stroke={active ? '#2563EB' : 'currentColor'} strokeWidth={active ? 0 : 2.2} strokeLinecap="round" strokeLinejoin="round">
    {active
      ? <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      : <path d="M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/>
    }
  </svg>
);

const BookIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? '#2563EB' : 'none'}
    stroke={active ? '#2563EB' : 'currentColor'} strokeWidth={active ? 0 : 2.2} strokeLinecap="round" strokeLinejoin="round">
    {active
      ? <path d="M19 3H5a2 2 0 00-2 2v16l4-4h12a2 2 0 002-2V5a2 2 0 00-2-2zm-9 10l-2-2-1 1 3 3 5-5-1-1-4 4z"/>
      : <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 11l2 2 4-4"/></>
    }
  </svg>
);

const ProfileIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? '#2563EB' : 'none'}
    stroke={active ? '#2563EB' : 'currentColor'} strokeWidth={active ? 0 : 2.2} strokeLinecap="round" strokeLinejoin="round">
    {active
      ? <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm-7 9a7 7 0 0114 0H5z"/>
      : <><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0116 0"/></>
    }
  </svg>
);

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(219, 234, 254, 0.9)',
            color: '#0F172A',
            borderRadius: '16px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: '0.88rem',
            boxShadow: '0 12px 32px rgba(37, 99, 235, 0.15)',
          },
          success: { iconTheme: { primary: '#2563EB', secondary: '#ffffff' } },
          error:   { iconTheme: { primary: '#DC2626', secondary: '#ffffff' } },
        }}
      />

      <div className="app-shell">
        {/* ── Responsive Header ── */}
        <header className="app-header">
          <div className="header-inner">
            <div className="logo-area">
              <div className="logo-icon">
                <img src="/nearby-caters-logo.jpg" alt="Nearby Caters" width="34" height="34" />
              </div>
              <div className="logo-text">
                Nearby<span>Caters</span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="desktop-nav">
              <NavLink to="/" end className={({ isActive }) => `desktop-nav-link ${isActive ? 'active' : ''}`}>
                <HomeIcon active={false} />
                <span>Explore Sites</span>
              </NavLink>
              <NavLink to="/bookings" className={({ isActive }) => `desktop-nav-link ${isActive ? 'active' : ''}`}>
                <BookIcon active={false} />
                <span>My Bookings</span>
              </NavLink>
              <NavLink to="/profile" className={({ isActive }) => `desktop-nav-link ${isActive ? 'active' : ''}`}>
                <ProfileIcon active={false} />
                <span>Profile</span>
              </NavLink>
            </nav>

            <div className="location-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span>Kerala</span>
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="page-scroll">
          <Routes>
            <Route path="/"                  element={<Home />} />
            <Route path="/bookings"          element={<MyBookings />} />
            <Route path="/profile"           element={<Profile />} />
            <Route path="/client/:clientId"  element={<ClientProfile />} />
            <Route path="/forgot-password" element={<PasswordRecovery />} />
            <Route path="/reset-password" element={<PasswordRecovery />} />
          </Routes>
        </main>

        {/* ── Curved Frosted Bottom Nav (Mobile Only) ── */}
        <nav className="bottom-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className="nav-icon"><HomeIcon active={isActive} /></span>
                <span>Explore</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/bookings"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className="nav-icon"><BookIcon active={isActive} /></span>
                <span>My Sites</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className="nav-icon"><ProfileIcon active={isActive} /></span>
                <span>Profile</span>
              </>
            )}
          </NavLink>
        </nav>
      </div>
    </BrowserRouter>
  );
}
