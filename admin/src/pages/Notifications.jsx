import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Send, Bell } from 'lucide-react';
import api from '../lib/api';

export default function Notifications() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetAll, setTargetAll] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title || !body) return toast.error('Fill in title and body');

    setLoading(true);
    try {
      const res = await api.post('/notifications/send', {
        title,
        body,
        targetAll: true,
      });
      toast.success(res.data.message || 'Push notifications sent!');
      setTitle('');
      setBody('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send broadcast');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Push Broadcast</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Send live FCM push notifications to boys with installed PWA
        </p>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSend}>
          <div className="form-group">
            <label className="form-label">Notification Title</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="🚨 Urgent: New Catering Event in Calicut!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notification Message</label>
            <textarea
              required
              rows={4}
              className="form-input"
              style={{ resize: 'vertical' }}
              placeholder="We need 15 boys for tomorrow evening at Emerald Hall. Book your slot now!"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={targetAll}
                onChange={(e) => setTargetAll(e.target.checked)}
              />
              <span>Broadcast to all active boys in Kerala</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
          >
            <Send size={16} />
            <span>{loading ? 'Sending Push Alerts...' : 'Send Live Push Broadcast'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
