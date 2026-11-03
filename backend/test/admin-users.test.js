const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

test('admin user editing is protected and blocking revokes existing sessions', async () => {
  const secret = 'admin-user-route-test-secret-with-32-bytes';
  process.env.JWT_SECRET = secret;
  const userState = {
    id: 'staff-1', name: 'Old Name', place: 'Kochi', phone: '8078240018', email: null,
    isActive: true, tokenVersion: 0,
  };
  const fakePrisma = {
    admin: { findUnique: async () => ({ tokenVersion: 0 }) },
    user: {
      findUnique: async ({ select }) => {
        const result = {};
        for (const field of Object.keys(select || {})) {
          if (field in userState) result[field] = userState[field];
        }
        return result;
      },
      findFirst: async () => null,
      update: async ({ data, select }) => {
        for (const [field, value] of Object.entries(data)) {
          userState[field] = value?.increment ? userState[field] + value.increment : value;
        }
        const result = {};
        for (const field of Object.keys(select || {})) {
          if (field in userState) result[field] = userState[field];
        }
        return result;
      },
    },
  };

  const prismaPath = require.resolve('../src/lib/prisma');
  const authPath = require.resolve('../src/middleware/auth');
  const adminPath = require.resolve('../src/routes/admin');
  const schedulerPath = require.resolve('../src/services/scheduler');
  const savedModules = new Map([prismaPath, authPath, adminPath, schedulerPath].map((path) => [path, require.cache[path]]));
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
  require.cache[schedulerPath] = {
    id: schedulerPath, filename: schedulerPath, loaded: true,
    exports: { scheduleEventNotifications: async () => {} },
  };
  delete require.cache[authPath];
  delete require.cache[adminPath];

  let server;
  try {
    const app = express();
    app.use(express.json());
    app.use('/admin', require(adminPath));
    app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    const base = `http://127.0.0.1:${server.address().port}/admin/users/staff-1`;
    const adminToken = jwt.sign({ id: 'admin-1', role: 'admin', ver: 0 }, secret);
    const userToken = jwt.sign({ id: 'staff-1', role: 'user', ver: 0 }, secret);

    const denied = await fetch(base, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Changed by user' }),
    });
    assert.equal(denied.status, 403);
    assert.equal(userState.name, 'Old Name');

    const edited = await fetch(base, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name', email: 'staff@example.com' }),
    });
    assert.equal(edited.status, 200);
    const editedBody = await edited.json();
    assert.equal(editedBody.user.name, 'Updated Name');
    assert.equal(editedBody.user.email, 'staff@example.com');
    assert.equal('passwordHash' in editedBody.user, false);

    const blocked = await fetch(`${base}/toggle-block`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(blocked.status, 200);
    assert.equal(userState.isActive, false);
    assert.equal(userState.tokenVersion, 1);

    const expiredSession = await fetch(`${base}/toggle-block`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(expiredSession.status, 401);
    assert.equal((await expiredSession.json()).code, 'SESSION_REVOKED');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    for (const [path, cachedModule] of savedModules) {
      if (cachedModule) require.cache[path] = cachedModule;
      else delete require.cache[path];
    }
  }
});
