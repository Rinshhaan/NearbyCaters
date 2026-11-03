import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientEvents from './pages/ClientEvents';
import Users from './pages/Users';
import Revenue from './pages/Revenue';
import Notifications from './pages/Notifications';
import PasswordRecovery from './pages/PasswordRecovery';
import PartnerProfile from './pages/PartnerProfile';
import EventRoster from './pages/EventRoster';

function ProtectedRoute({ children }) {
  const token = useAuthStore((state) => state.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<PasswordRecovery />} />
        <Route path="/reset-password" element={<PasswordRecovery />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id/events" element={<ClientEvents />} />
          <Route path="clients/:id/profile" element={<PartnerProfile />} />
          <Route path="events/:eventId/roster" element={<EventRoster />} />
          <Route path="users" element={<Users />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
