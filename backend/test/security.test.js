const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  normalizeMapUrl,
  isSafeImageUrl,
  verifyRazorpaySignature,
} = require('../src/utils/event-validation');
const { detectMedia, acceptedFile } = require('../src/services/cloudinary');
const { reserveEventSlots } = require('../src/utils/booking-capacity');

test('map input accepts Google Maps URLs and rejects arbitrary iframe targets', () => {
  assert.equal(normalizeMapUrl('https://www.google.com/maps/embed?pb=abc'), 'https://www.google.com/maps/embed?pb=abc');
  assert.equal(normalizeMapUrl('<iframe src="https://maps.google.com/maps?q=Kochi&output=embed"></iframe>'), 'https://maps.google.com/maps?q=Kochi&output=embed');
  assert.equal(normalizeMapUrl('https://attacker.example/maps/embed?url=1'), undefined);
  assert.equal(normalizeMapUrl('http://www.google.com/maps/embed?pb=abc'), undefined);
  assert.equal(normalizeMapUrl('<iframe src="javascript:alert(1)"></iframe>'), undefined);
});

test('image addresses allow HTTPS and local development uploads but reject executable schemes and SVG', () => {
  assert.equal(isSafeImageUrl('https://images.example/event.webp'), true);
  assert.equal(isSafeImageUrl('https://nearbycaters.onrender.com/uploads/abc.jpg'), true);
  assert.equal(isSafeImageUrl('http://images.example/event.jpg'), false);
  assert.equal(isSafeImageUrl('javascript:alert(1)'), false);
  assert.equal(isSafeImageUrl('https://images.example/active.svg'), false);
});

test('media validation recognizes supported image signatures and rejects HTML masquerading as an image', () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.deepEqual(detectMedia(png), { mime: 'image/png', ext: '.png', resourceType: 'image' });
  assert.deepEqual(detectMedia(jpg), { mime: 'image/jpeg', ext: '.jpg', resourceType: 'image' });
  assert.equal(detectMedia(Buffer.from('<html><script>alert(1)</script></html>')), null);
  assert.equal(detectMedia(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
});

test('upload filter accepts JPG aliases and gallery files with generic MIME while relying on signature validation', async () => {
  const filter = acceptedFile(new Set(['image/jpeg', 'image/jpg', 'image/png']));
  const check = (mimetype, originalname) => new Promise((resolve, reject) => {
    filter(null, { mimetype, originalname }, (error, accepted) => error ? reject(error) : resolve(accepted));
  });

  assert.equal(await check('image/jpg', 'staff.jpg'), true);
  assert.equal(await check('application/octet-stream', 'staff.jpeg'), true);
  assert.equal(await check('application/octet-stream', 'staff.png'), true);
  await assert.rejects(check('application/octet-stream', 'payload.html'));
});

test('Razorpay signature verification is constant-time checked and rejects invalid signatures', () => {
  const secret = 'local-test-only-secret';
  const orderId = 'order_test_123';
  const paymentId = 'pay_test_456';
  const signature = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  assert.equal(verifyRazorpaySignature(secret, orderId, paymentId, signature), true);
  assert.equal(verifyRazorpaySignature(secret, 'order_other', paymentId, signature), false);
  assert.equal(verifyRazorpaySignature(secret, orderId, paymentId, 'invalid'), false);
});

test('concurrent bookings cannot reserve the same remaining event slot', async () => {
  let reservedSlots = 0;
  const event = { id: 'event-1', status: 'published', reservedSlots, slotsNeeded: 1, timerEnd: null };
  const tx = {
    event: {
      async updateMany({ where, data }) {
        if (where.reservedSlots !== reservedSlots || where.id !== event.id || where.status !== 'published') {
          return { count: 0 };
        }
        reservedSlots += data.reservedSlots.increment;
        return { count: 1 };
      },
    },
  };

  const results = await Promise.all([
    reserveEventSlots(tx, event, 1),
    reserveEventSlots(tx, event, 1),
  ]);

  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(reservedSlots, 1);
});
