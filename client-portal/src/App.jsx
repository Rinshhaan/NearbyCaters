import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import ClientLayout from './components/ClientLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import MyEvents from './pages/MyEvents';
import CreateEvent from './pages/CreateEvent';
import EditEvent from './pages/EditEvent';
import EventBoys from './pages/EventBoys';
import Payments from './pages/Payments';
import SupervisorAttendance from './pages/SupervisorAttendance';
import ClientDashboard from './pages/ClientDashboard';
import ClientProfile from './pages/ClientProfile';
import PasswordRecovery from './pages/PasswordRecovery';

function ProtectedRoute({ children }) {
  const { token, user, logout } = useAuthStore();
  const approvalPending = user?.isApproved === false;
  useEffect(() => {
    if (approvalPending) logout();
  }, [approvalPending, logout]);
  if (!token || approvalPending) return <Navigate to="/login" state={{ approvalPending }} replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<PasswordRecovery />} />
        <Route path="/reset-password" element={<PasswordRecovery />} />
        {/* Public Attendance Link for Site Supervisor / Head Boy */}
        <Route path="/attendance/:token" element={<SupervisorAttendance />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ClientLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<MyEvents />} />
          <Route path="create-event" element={<CreateEvent />} />
          <Route path="events/:id/edit" element={<EditEvent />} />
          <Route path="events/:id/boys" element={<EventBoys />} />
          <Route path="payments" element={<Payments />} />
          <Route path="dashboard" element={<ClientDashboard />} />
          <Route path="profile" element={<ClientProfile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
