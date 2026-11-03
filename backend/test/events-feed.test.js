const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

test('public event feed separates active and archived events and keeps newest updates first', async () => {
  process.env.JWT_SECRET = 'event-feed-regression-test-secret-with-32-bytes';
  const calls = [];
  let ownerEvent = { id: 'event-123', clientId: 'client-1', attendanceToken: null };
  const fakePrisma = {
    event: {
      findMany: async (query) => {
        calls.push(query);
        return query.where.date.lt
          ? [{ id: 'older-event' }]
          : [{ id: 'newest-event' }, { id: 'current-event' }];
      },
      count: async ({ where }) => where.date.lt ? 1 : 2,
      findUnique: async ({ where }) => where.id === ownerEvent.id ? { ...ownerEvent } : null,
      updateMany: async ({ where, data }) => {
        if (where.id === ownerEvent.id && ownerEvent.attendanceToken === null) {
          ownerEvent = { ...ownerEvent, ...data };
          return { count: 1 };
        }
        return { count: 0 };
      },
      findFirst: async ({ where }) => where.attendanceToken === ownerEvent.attendanceToken && ownerEvent.attendanceToken
        ? {
          id: ownerEvent.id,
          name: 'Sample site',
          location: 'Kozhikode',
          locationMapUrl: null,
          date: new Date('2030-01-01T00:00:00.000Z'),
          reportTime: '08:00',
          slotsNeeded: 5,
          status: 'published',
          client: { name: 'Partner', companyName: 'Partner Co', phone: '8078240018' },
          bookings: [],
        }
        : null,
    },
    admin: { findFirst: async () => ({ ratePerBoy: 17 }) },
    client: { findUnique: async () => ({ isApproved: true, isActive: true, tokenVersion: 0 }) },
  };

  const prismaPath = require.resolve('../src/lib/prisma');
  const eventsPath = require.resolve('../src/routes/events');
  const authPath = require.resolve('../src/middleware/auth');
  const schedulerPath = require.resolve('../src/services/scheduler');
  const savedModules = new Map([prismaPath, eventsPath, authPath, schedulerPath].map((path) => [path, require.cache[path]]));
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
  for (const path of [eventsPath, authPath, schedulerPath]) delete require.cache[path];

  let server;
  try {
    const app = express();
    app.use('/events', require(eventsPath));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    const base = `http://127.0.0.1:${server.address().port}/events`;
    const activeResponse = await fetch(`${base}?limit=50`);
    assert.equal(activeResponse.status, 200);
    const active = await activeResponse.json();
    assert.deepEqual(active.events.map((event) => event.id), ['newest-event', 'current-event']);
    assert.equal(active.total, 2);
    assert.equal(active.archivedTotal, 1);
    assert.equal(active.platformFeePerConfirmedSlot, 17);
    assert.deepEqual(calls[0].orderBy, [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }]);
    assert.equal(calls[0].where.status, 'published');
    assert.ok(calls[0].where.date.gte instanceof Date);

    const archiveResponse = await fetch(`${base}?archived=true&limit=50`);
    assert.equal(archiveResponse.status, 200);
    const archive = await archiveResponse.json();
    assert.deepEqual(archive.events.map((event) => event.id), ['older-event']);
    assert.equal(archive.total, 1);
    assert.deepEqual(calls[1].where.status.in, ['published', 'booking_closed', 'completed']);
    assert.ok(calls[1].where.date.lt instanceof Date);

    const ownerJwt = jwt.sign({ id: 'client-1', role: 'client', ver: 0 }, process.env.JWT_SECRET);
    const linkResponse = await fetch(`${base}/event-123/attendance-link`, {
      headers: { Authorization: `Bearer ${ownerJwt}` },
    });
    assert.equal(linkResponse.status, 200);
    const { attendanceToken } = await linkResponse.json();
    assert.match(attendanceToken, /^[a-f\d]{32}$/);

    const otherOwnerJwt = jwt.sign({ id: 'client-2', role: 'client', ver: 0 }, process.env.JWT_SECRET);
    const forbiddenResponse = await fetch(`${base}/event-123/attendance-link`, {
      headers: { Authorization: `Bearer ${otherOwnerJwt}` },
    });
    assert.equal(forbiddenResponse.status, 403);

    const attendanceResponse = await fetch(`${base}/supervisor/${attendanceToken}`);
    assert.equal(attendanceResponse.status, 200);
    assert.equal((await attendanceResponse.json()).id, 'event-123');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    for (const [path, cachedModule] of savedModules) {
      if (cachedModule) require.cache[path] = cachedModule;
      else delete require.cache[path];
    }
  }
});
