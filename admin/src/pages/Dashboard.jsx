import React, { useEffect, useState } from 'react';
import { Users, UserCheck, Calendar, IndianRupee, Clock, CheckCircle } from 'lucide-react';
import api from '../lib/api';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/admin/dashboard');
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading dashboard stats...</div>;

  const stats = data?.stats || {};
  const recentEvents = data?.recentEvents || [];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: '#fee2e2', color: 'var(--primary)', borderRadius: '12px' }}>
            <IndianRupee size={28} />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Revenue (₹20/boy)</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹{stats.totalRevenue || 0}</h3>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: '#fef3c7', color: 'var(--warning)', borderRadius: '12px' }}>
            <UserCheck size={28} />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Pending Clients</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.pendingClients || 0}</h3>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: '#d1fae5', color: 'var(--success)', borderRadius: '12px' }}>
            <Users size={28} />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Registered Boys</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.totalUsers || 0}</h3>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '12px' }}>
            <Calendar size={28} />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Active Events</p>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.activeEvents || 0}</h3>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '16px' }}>Recent Events & Bookings</h3>
        {recentEvents.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No recent events posted.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Client</th>
                  <th>Date & Time</th>
                  <th>Booked Boys</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((evt) => (
                  <tr key={evt.id}>
                    <td style={{ fontWeight: 600 }}>{evt.name}</td>
                    <td>{evt.client?.companyName || evt.client?.name}</td>
                    <td>{new Date(evt.date).toLocaleDateString()} at {evt.reportTime}</td>
                    <td>
                      <span className="badge badge-success">
                        {evt._count?.bookings || 0} {evt.slotsNeeded ? `/ ${evt.slotsNeeded}` : 'boys'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${evt.status === 'published' ? 'badge-success' : 'badge-warning'}`}>
                        {evt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
