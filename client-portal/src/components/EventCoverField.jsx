import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

function canPreview(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const ext = parsed.pathname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
    if (ext === '.svg') return false;
    if (parsed.protocol === 'https:') return true;
    return parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.pathname.startsWith('/uploads/');
  } catch { return false; }
}

export default function EventCoverField({ value = '', onChange }) {
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Choose an image smaller than 10 MB');
      return;
    }
    const extension = file.name.toLowerCase().split('.').pop();
    const supportedType = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif'].includes(file.type);
    const supportedExtension = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(extension);
    if (!supportedType && !(['', 'application/octet-stream'].includes(file.type) && supportedExtension)) {
      toast.error('Choose a JPG, JPEG, PNG, GIF, WebP, or AVIF image');
      return;
    }
    setUploading(true);
    try {
      const payload = new FormData();
      payload.append('file', file);
      const result = await api.post('/events/upload-image', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(result.data.url);
      toast.success('Event image uploaded');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="form-group">
      <label className="form-label" htmlFor="event-cover-url">Event card image</label>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 8px' }}>
        Upload a photo or paste its HTTPS image address. Leave blank to show the venue map.
      </p>
      <input
        id="event-cover-url"
        type="url"
        className="form-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://example.com/event-photo.jpg"
        maxLength={2048}
        style={{ marginBottom: 10 }}
      />
      <input ref={fileInput} type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif" onChange={handleFile} hidden />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <ImagePlus size={16} />}
          {uploading ? 'Uploading…' : 'Upload image'}
        </button>
        {value && <button type="button" className="btn btn-secondary" onClick={() => onChange('')}><X size={15} /> Remove image</button>}
      </div>
      {canPreview(value) && (
        <div style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--glass-border)', maxHeight: 220 }}>
          <img src={value} alt="Event card preview" style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
        </div>
      )}
    </div>
  );
}
