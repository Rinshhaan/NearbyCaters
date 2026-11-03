const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getEventStartAt } = require('../src/utils/event-time');

test('event report times use India time independent of the server timezone', () => {
  const start = getEventStartAt(new Date('2026-11-04T00:00:00.000Z'), '08:00');
  assert.equal(start.toISOString(), '2026-11-04T02:30:00.000Z');
});

test('event report time parsing rejects malformed values', () => {
  assert.equal(getEventStartAt('2026-11-04', '25:00'), null);
  assert.equal(getEventStartAt('invalid date', '08:00'), null);
});
