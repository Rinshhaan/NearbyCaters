import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { getMapEmbedUrl } from '../components/mapUtils';
import EventCoverField from '../components/EventCoverField';

export default function CreateEvent() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    locationMapUrl: '',
    imageUrl: '',
    date: '',
    reportTime: '',
    slotsNeeded: '',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleMapFieldChange = (val) => {
    // If client pastes an <iframe> snippet, automatically extract the src URL
    const srcMatch = val.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      setFormData({ ...formData, locationMapUrl: srcMatch[1] });
    } else {
      setFormData({ ...formData, locationMapUrl: val });
    }
  };

  const previewEmbedUrl = getMapEmbedUrl(formData.locationMapUrl, formData.location);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanEmbedUrl = formData.locationMapUrl
        ? getMapEmbedUrl(formData.locationMapUrl, formData.location)
        : '';

      const payload = {
        ...formData,
        locationMapUrl: cleanEmbedUrl,
        slotsNeeded: formData.slotsNeeded ? Number(formData.slotsNeeded) : null,
      };
      const res = await api.post('/events', payload);
      // Auto publish the event right away
      await api.patch(`/events/${res.data.id}`, { status: 'published' });
      toast.success('Event published successfully!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to publish event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '650px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Publish New Catering Event</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Broadcast requirements to catering staff seeking jobs
        </p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Event / Site Name</label>
            <input
              type="text"
              required
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Grand Wedding Reception - Calicut Convention Centre"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Event Date</label>
              <input
                type="date"
                required
                className="form-input"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Boys Report Time</label>
              <input
                type="time"
                required
                className="form-input"
                value={formData.reportTime}
                onChange={(e) => setFormData({ ...formData, reportTime: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Venue Location / Address</label>
              <input
                type="text"
                required
                className="form-input"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, slotsNeeded: e.target.value })}
                placeholder="e.g. 15 (Leave blank for unlimited)"
              />
            </div>
          </div>

          {/* ── Google Maps Iframe / Embed Code Field ── */}
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
              onChange={(e) => handleMapFieldChange(e.target.value)}
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
                  src={previewEmbedUrl}
                  width="100%"
                  height="160"
                  style={{ border: 0, display: 'block' }}
                  loading="lazy"
                />
              </div>
            )}
          </div>

          <EventCoverField value={formData.imageUrl} onChange={(imageUrl) => setFormData((current) => ({ ...current, imageUrl }))} />

          <div className="form-group">
            <label className="form-label">Special Instructions / Uniform Details</label>
            <textarea
              rows={3}
              className="form-input"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g. Black pants & white shirt mandatory. Free food provided."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '12px' }}
          >
            {loading ? 'Publishing Event...' : 'Publish Event to Market'}
          </button>
        </form>
      </div>
    </div>
  );
}
