import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, MapPin, ShieldCheck, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function PartnerProfile() {
  const { id } = useParams();
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/clients/${id}`)
      .then(res => setPartner(res.data.client || res.data))
      .catch(() => toast.error('Could not load partner profile'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="card">Loading partner profile…</div>;
  if (!partner) return <div className="card">Partner not found.</div>;
  let photos = [];
  try { photos = Array.isArray(partner.workImages) ? partner.workImages : JSON.parse(partner.workImages || '[]'); } catch {}
  const events = partner.events || [];
  const bookings = events.reduce((sum, event) => sum + (event._count?.bookings || 0), 0);

  return (
    <div className="admin-partner-profile" style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <Link to={`/clients/${id}/events`} className="btn btn-secondary" style={{ display: 'inline-flex', gap: 7, marginBottom: 18, textDecoration: 'none' }}><ArrowLeft size={15} /> Back to events</Link>
      <section className="admin-partner-banner" style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, minHeight: 180, background: partner.bannerUrl ? `url(${partner.bannerUrl}) center/cover` : 'linear-gradient(120deg,#0f172a,#1d4ed8 72%,#60a5fa)', boxShadow: '0 16px 36px rgba(15,23,42,.16)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(15,23,42,.82),rgba(15,23,42,.12))' }} />
        <div className="admin-partner-banner-content" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 18, padding: '36px 28px', color: '#fff' }}>
          {partner.logoUrl ? <img className="admin-partner-logo" src={partner.logoUrl} alt={`${partner.companyName || partner.name} logo`} style={{ width: 84, height: 84, borderRadius: 24, objectFit: 'cover', border: '2px solid rgba(255,255,255,.7)' }} /> : <div className="admin-partner-logo admin-partner-logo-fallback" style={{ width: 84, height: 84, borderRadius: 24, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.16)', fontSize: 32, fontWeight: 900 }}>{(partner.companyName || partner.name || 'P')[0]}</div>}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><h1 className="admin-partner-title" style={{ margin: 0, fontSize: 28 }}>{partner.companyName || partner.name}</h1><span style={{ borderRadius: 99, padding: '4px 9px', background: partner.isApproved && partner.isActive ? 'rgba(16,185,129,.2)' : 'rgba(245,158,11,.22)', color: '#fff', fontSize: 11, fontWeight: 800 }}>{partner.isApproved && partner.isActive ? 'Verified partner' : 'Review required'}</span></div>
            <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,.82)' }}>{partner.name} · {partner.place || 'Kerala'}</p>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: 12, margin: '16px 0' }}>
        {[
          ['Published events', events.filter(e => ['published', 'booking_closed', 'completed'].includes(e.status)).length],
          ['Confirmed bookings', bookings],
          ['Partner rating', <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Star size={17} fill="#f59e0b" color="#f59e0b" />{Number(partner.rating || 0).toFixed(1)}</span>],
        ].map(([label, value]) => <div className="card" key={label} style={{ padding: 18 }}><div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{label}</div><div style={{ marginTop: 8, fontSize: 22, color: '#0f172a', fontWeight: 850 }}>{value}</div></div>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
        <section className="card" style={{ padding: 20 }}>
          <h2 style={{ margin: '0 0 15px', fontSize: 17 }}>Profile details</h2>
          <p style={{ margin: '0 0 11px', color: '#334155', fontSize: 13 }}><strong>Contact:</strong> {partner.name}</p>
          <p style={{ margin: '0 0 11px', color: '#334155', fontSize: 13 }}><strong>Email:</strong> {partner.email}</p>
          <p style={{ margin: '0 0 11px', color: '#334155', fontSize: 13 }}><strong>Mobile:</strong> {partner.phone}</p>
          <p style={{ margin: '0 0 11px', color: '#334155', fontSize: 13 }}><MapPin size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />{partner.place || '—'}</p>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}><div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 800, color: '#0f172a' }}><ShieldCheck size={16} color="#059669" />Profile transparency</div><p style={{ color: '#64748b', lineHeight: 1.6, fontSize: 13 }}>{partner.bio || 'This partner has not added a team description yet.'}</p></div>
          <Link to={`/clients/${id}/events`} className="btn btn-primary" style={{ display: 'inline-flex', gap: 7, textDecoration: 'none', marginTop: 6 }}><CalendarDays size={15} /> View all events</Link>
        </section>
        <section className="card" style={{ padding: 20 }}>
          <h2 style={{ margin: '0 0 15px', fontSize: 17 }}>Work gallery</h2>
          {photos.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(125px,1fr))', gap: 10 }}>{photos.map((url, index) => /\.(mp4|webm|mov|avi)(\?|$)/i.test(url) ? <video key={`${url}-${index}`} src={url} controls style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 12, background: '#f1f5f9' }} /> : <img key={`${url}-${index}`} src={url} alt={`Partner work ${index + 1}`} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 12 }} />)}</div> : <p style={{ color: '#64748b', fontSize: 13 }}>No portfolio media has been added.</p>}
        </section>
      </div>
    </div>
  );
}
