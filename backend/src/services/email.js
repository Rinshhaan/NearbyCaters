const API_URL = 'https://api.resend.com/emails';
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

async function sendEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) {
    throw new Error('Email delivery is not configured (RESEND_API_KEY and MAIL_FROM are required)');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, html, text }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Email provider returned ${response.status}: ${details.slice(0, 300)}`);
  }
}

async function sendPasswordResetEmail(email, link) {
  await sendEmail({
    to: email,
    subject: 'Reset your Nearby Caters password',
    text: `Use this link to reset your password. It expires in 30 minutes: ${link}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h2>Reset your password</h2><p>We received a request to reset your Nearby Caters password.</p><p><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Choose a new password</a></p><p>This link expires in 30 minutes. If you did not request a reset, you can ignore this email.</p></div>`,
  });
}

async function sendEventReminderEmail(email, event, title, body) {
  await sendEmail({
    to: email,
    subject: title.replace(/^[^\w]+\s*/, ''),
    text: body,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p><p><strong>${escapeHtml(event.name)}</strong><br>${escapeHtml(event.location)} · ${escapeHtml(event.reportTime)}</p><p>Nearby Caters</p></div>`,
  });
}

async function sendBookingConfirmationEmail(email, event) {
  const date = new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const body = `Your booking for "${event.name}" is confirmed. Report at ${event.reportTime} on ${date} at ${event.location}.`;
  await sendEmail({
    to: email,
    subject: `Booking confirmed: ${event.name}`,
    text: body,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h2>Site booking confirmed</h2><p>${escapeHtml(body)}</p><p><strong>${escapeHtml(event.name)}</strong><br>${escapeHtml(date)} · ${escapeHtml(event.reportTime)}<br>${escapeHtml(event.location)}</p><p>We’ll send a reminder one hour before the site starts.</p><p>Nearby Caters</p></div>`,
  });
}

module.exports = { sendPasswordResetEmail, sendEventReminderEmail, sendBookingConfirmationEmail };
