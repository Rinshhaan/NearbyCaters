import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, MapPin, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

const dateLabel = value => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function EventRoster() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/events/${eventId}/roster`)
      .then(res => setEvent(res.data))
      .catch(() => toast.error('Could not load the event roster'))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <div className="card">Loading event roster…</div>;
  if (!event) return <div className="card">Event not found.</div>;
  const attended = event.bookings.filter(booking => booking.attended).length;

  return (
    <div>
      <Link to={event.client?.id ? `/clients/${event.client.id}/events` : '/'} className="btn btn-secondary" style={{ display: 'inline-flex', gap: 7, marginBottom: 18, textDecoration: 'none' }}><ArrowLeft size={15} /> Back</Link>
      <div className="card" style={{ marginBottom: 18, padding: 22, background: 'linear-gradient(120deg,#eff6ff,#fff)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase' }}>Event attendance</div>
            <h1 style={{ margin: '7px 0', fontSize: 24, color: '#0f172a' }}>{event.name}</h1>
            <p style={{ margin: 0, color: '#64748b' }}>{event.client?.companyName || event.client?.name}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, color: '#475569', fontSize: 13 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CalendarDays size={15} />{dateLabel(event.date)} · {event.reportTime}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><MapPin size={15} />{event.location}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Users size={15} />{event.bookings.length} booked · {attended} attended</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Staff roster</h2>
          <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 13 }}>Contact details, attendance, arrival and departure records for confirmed staff.</p>
        </div>
        {event.bookings.length === 0 ? <p style={{ padding: 24, color: '#64748b' }}>There are no confirmed staff bookings for this event.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
              <thead><tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {['Staff member', 'Contact', 'Place', 'Attendance', 'Arrival / Departure', 'Uniform / Wages', 'Notes / Fine'].map(label => <th key={label} style={{ padding: '12px 14px' }}>{label}</th>)}
              </tr></thead>
              <tbody>{event.bookings.map(booking => <tr key={booking.id} style={{ borderTop: '1px solid #edf2f7', verticalAlign: 'top' }}>
                <td style={{ padding: '14px', fontWeight: 750, color: '#0f172a' }}>{booking.user.name}<div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>ID {booking.user.id.slice(-7)}</div></td>
                <td style={{ padding: '14px', fontSize: 12, color: '#475569' }}>{booking.user.phone || 'No mobile number'}<div style={{ marginTop: 5 }}>{booking.user.email || 'No email added'}</div></td>
                <td style={{ padding: '14px', color: '#475569', fontSize: 13 }}>{booking.user.place}</td>
                <td style={{ padding: '14px' }}><span style={{ display: 'inline-block', borderRadius: 99, padding: '4px 9px', background: booking.attended ? '#dcfce7' : '#fff7ed', color: booking.attended ? '#166534' : '#9a3412', fontSize: 11, fontWeight: 800 }}>{booking.attended ? 'Attended' : 'Not marked'}</span>{booking.attendanceTime && <div style={{ marginTop: 6, color: '#64748b', fontSize: 11 }}>{new Date(booking.attendanceTime).toLocaleString('en-IN')}</div>}</td>
                <td style={{ padding: '14px', color: '#475569', fontSize: 12 }}>In: {booking.arrivalTime || '—'}<div style={{ marginTop: 5 }}>Out: {booking.leavingTime || '—'}</div></td>
                <td style={{ padding: '14px', color: '#475569', fontSize: 12 }}>{booking.uniform ? 'Uniform provided' : 'No uniform record'}<div style={{ marginTop: 5, fontWeight: 700, color: booking.staffPaid ? '#047857' : '#b45309' }}>{booking.staffPaid ? 'Wage marked paid' : 'Wage pending'}</div></td>
                <td style={{ padding: '14px', color: '#475569', fontSize: 12 }}>{booking.notes || '—'}{booking.fine && <div style={{ marginTop: 5, color: '#b91c1c' }}>Fine: {booking.fine}</div>}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
