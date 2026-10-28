// Runnable self-check for the notification read-watermark decision table. Pure logic, no DB,
// no network. Runs under `npm test` in apps/api (tsx --test tests/**/*.test.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { isNotificationRead } from '../../../packages/shared/dist/index.js';

const readAt = new Date('2026-10-28T06:00:00.000Z');

test('nothing is read before the first acknowledgement', () => {
  // No watermark means the badge is honest: every item is unread.
  assert.equal(isNotificationRead('2026-10-28T05:00:00.000Z', null), false);
  assert.equal(isNotificationRead('2026-10-28T05:00:00.000Z', undefined), false);
  assert.equal(isNotificationRead('2026-10-28T05:00:00.000Z', ''), false);
});

test('an acknowledged watermark clears everything at or before it', () => {
  assert.equal(isNotificationRead('2026-10-28T05:00:00.000Z', readAt), true, 'older is read');
  assert.equal(isNotificationRead('2026-10-28T06:00:00.000Z', readAt), true, 'exactly at is read');
});

test('notifications newer than the watermark stay unread', () => {
  // This is the regression: a poll after "mark all read" must not clear a genuinely new alert.
  assert.equal(isNotificationRead('2026-10-28T06:00:01.000Z', readAt), false);
  assert.equal(isNotificationRead('2026-10-28T09:30:00.000Z', readAt), false);
});

test('a month-old security probe stays cleared, so old WAF noise cannot pin the badge', () => {
  const old = '2026-09-01T00:00:00.000Z';
  assert.equal(isNotificationRead(old, readAt), true);
  // And it is still unread when no acknowledgement has ever happened.
  assert.equal(isNotificationRead(old, null), false);
});

test('garbage timestamps fail closed (unread), never read', () => {
  assert.equal(isNotificationRead('not-a-date', readAt), false);
  assert.equal(isNotificationRead('2026-10-28T05:00:00.000Z', 'not-a-date'), false);
});

test('Date objects and ISO strings agree', () => {
  assert.equal(isNotificationRead(new Date('2026-10-28T05:00:00.000Z'), readAt), true);
  assert.equal(isNotificationRead(new Date('2026-10-28T07:00:00.000Z'), readAt), false);
});

test('the WhatsApp alert ages out once acknowledged instead of looking new every poll', () => {
  // Regression guard: the alert previously used `new Date()` per request, so it could never read.
  const sessionUpdatedAt = '2026-10-28T05:30:00.000Z';
  assert.equal(isNotificationRead(sessionUpdatedAt, null), false, 'unacknowledged: unread');
  assert.equal(isNotificationRead(sessionUpdatedAt, readAt), true, 'acknowledged: clears');
});
