import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { getMapEmbedUrl } from '../components/mapUtils';
import EventCoverField from '../components/EventCoverField';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'booking_closed', label: 'Booking Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function isAttendanceStarted(date, reportTime) {
  if (!date || !reportTime) return false;
  try {
    const match = reportTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return false;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const eventDate = new Date(date);
    const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const attendanceStart = new Date(`${eventDate.toISOString().slice(0, 10)}T${time}:00+05:30`);

    return new Date() >= attendanceStart;
  } catch (err) {
    return false;
  }
}

export default function EditEvent() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    locationMapUrl: '',
    date: '',
    reportTime: '',
    slotsNeeded: '',
    timerEnd: '',
    imageUrl: '',
    status: 'draft',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchEvent = async () => {
    try {
      const res = await api.get(`/events/${id}`);
      const evt = res.data;
      // Format date to YYYY-MM-DD for input[type=date]
      const dateStr = evt.date ? new Date(evt.date).toISOString().split('T')[0] : '';
      // Format timerEnd similarly
      const timerEndStr = evt.timerEnd ? new Date(evt.timerEnd).toISOString().slice(0, 16) : '';
      setFormData({
        name: evt.name || '',
        description: evt.description || '',
        location: evt.location || '',
        locationMapUrl: evt.locationMapUrl || '',
        date: dateStr,
        reportTime: evt.reportTime || '',
        slotsNeeded: evt.slotsNeeded ?? '',
        timerEnd: timerEndStr,
        imageUrl: evt.imageUrl || '',
        status: evt.status || 'draft',
      });

      if (isAttendanceStarted(evt.date, evt.reportTime)) {
        setIsLocked(true);
      }
    } catch (err) {
      toast.error('Failed to load event');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        slotsNeeded: formData.slotsNeeded !== '' ? Number(formData.slotsNeeded) : null,
        timerEnd: formData.timerEnd ? new Date(formData.timerEnd).toISOString() : null,
      };
      // Remove empty optional fields
      if (!payload.timerEnd) delete payload.timerEnd;

      await api.patch(`/events/${id}`, payload);
      toast.success('Event updated successfully!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 280, gap: 12, color: '#2563EB' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span style={{ fontWeight: 600 }}>Loading event details…</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '650px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link
          to="/"
          className="btn btn-secondary"
          style={{ padding: '8px 12px', gap: '6px' }}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </Link>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Edit Event</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Update event details — changes apply immediately
          </p>
        </div>
      </div>

      <div className="card">
        {isLocked && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              marginBottom: '20px',
              color: '#DC2626',
            }}
          >
            <Lock size={20} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.875rem', lineHeight: '1.4' }}>
              <strong>Event Locked:</strong> Attendance reporting has already started for this event. Details can no longer be modified.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <fieldset disabled={isLocked} style={{ border: 'none', padding: 0, margin: 0 }}>
          {/* Event Name */}
          <div className="form-group">
            <label className="form-label">Event / Site Name</label>
            <input
              type="text"
              required
              className="form-input"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Grand Wedding Reception - Calicut Convention Centre"
            />
          </div>

          {/* Date & Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Event Date</label>
              <input
                type="date"
                required
                className="form-input"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Boys Report Time</label>
              <input
                type="time"
                required
                className="form-input"
                value={formData.reportTime}
                onChange={(e) => handleChange('reportTime', e.target.value)}
              />
            </div>
          </div>

          {/* Location & Slots */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Venue Location / Address</label>
              <input
                type="text"
                required
                className="form-input"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="e.g. Kadavanthra, Kochi"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Boys Needed (Slots)</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={formData.slotsNeeded}
                onChange={(e) => handleChange('slotsNeeded', e.target.value)}
                placeholder="Leave blank for unlimited"
              />
            </div>
          </div>

          {/* Google Maps Iframe Embed Code / Link */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                Google Maps Iframe Embed Code / Link
              </label>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                Paste &lt;iframe&gt; or share link
              </span>
            </div>
            <textarea
              rows={2}
              className="form-input"
              value={formData.locationMapUrl}
              onChange={(e) => {
                const val = e.target.value;
                const srcMatch = val.match(/src=["']([^"']+)["']/i);
                handleChange('locationMapUrl', (srcMatch && srcMatch[1]) ? srcMatch[1] : val);
              }}
              placeholder='Paste Google Maps embed code (<iframe src="...">) or URL'
              style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
            />

            {/* Live Iframe Map Preview */}
            {(formData.locationMapUrl || formData.location) && (
              <div style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid #CBD5E1', background: '#F1F5F9' }}>
                <div style={{ padding: '6px 12px', background: '#E2E8F0', fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Live Map Iframe Preview</span>
                  <span>{formData.locationMapUrl ? 'Custom Embed' : 'Auto Generated'}</span>
                </div>
                <iframe
                  title="Map Preview"
                  src={getMapEmbedUrl(formData.locationMapUrl, formData.location)}
                  width="100%"
                  height="160"
                  style={{ border: 0, display: 'block' }}
                  loading="lazy"
                />
              </div>
            )}
          </div>

          {/* Timer End */}
          <div className="form-group">
            <label className="form-label">Booking Closes At (Timer End — Optional)</label>
            <input
              type="datetime-local"
              className="form-input"
              value={formData.timerEnd}
              onChange={(e) => handleChange('timerEnd', e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Special Instructions / Uniform Details</label>
            <textarea
              rows={3}
              className="form-input"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="e.g. Black pants & white shirt mandatory. Free food provided."
            />
          </div>

          {/* Status */}
          <div className="form-group">
            <label className="form-label">Event Status</label>
            <select
              className="form-input"
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <EventCoverField value={formData.imageUrl} onChange={(imageUrl) => handleChange('imageUrl', imageUrl)} />
          </fieldset>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <Link
              to="/"
              className="btn btn-secondary"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || isLocked}
              className="btn btn-primary"
              style={{
                flex: 2,
                justifyContent: 'center',
                padding: '12px',
                opacity: isLocked ? 0.6 : 1,
                cursor: isLocked ? 'not-allowed' : 'pointer',
              }}
            >
              {isLocked ? (
                <>
                  <Lock size={16} />
                  <span>Locked (Attendance Started)</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{saving ? 'Saving Changes…' : 'Save Event Changes'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
