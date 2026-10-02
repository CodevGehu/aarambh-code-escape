import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventNotice, noticeWasSeen, rememberNotice } from '../src/lib/eventNotice.js';

const team = { _id: 'team-a' };
const started = { started_at: '2026-10-01T10:00:00.000Z', status: 'active' };

test('lobby and organizer initialization do not announce an early start', () => {
  assert.equal(getEventNotice(team, { status: 'not_started' }, false), null);
  assert.equal(getEventNotice(team, { ...started, status: 'starting' }, false), null);
  assert.equal(getEventNotice(null, started, false), null);
});

test('late arrivals see current state; deadline and manual endings supersede the start', () => {
  assert.equal(getEventNotice(team, started, false).phase, 'started');
  assert.equal(getEventNotice(team, started, true).phase, 'ended');
  assert.equal(getEventNotice(team, { ...started, status: 'ended' }, true).phase, 'ended');
});

test('acknowledgement survives refresh without hiding another team, ending, or new event', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const notice = getEventNotice(team, started, false);
  rememberNotice(notice.key, storage);
  assert.equal(noticeWasSeen(getEventNotice(team, { ...started, server_now: 'later' }, false).key, storage), true);
  assert.equal(noticeWasSeen(getEventNotice(team, started, true).key, storage), false);
  assert.equal(noticeWasSeen(getEventNotice({ _id: 'team-b' }, started, false).key, storage), false);
  assert.equal(noticeWasSeen(getEventNotice(team, { ...started, started_at: '2026-10-02T10:00:00.000Z' }, false).key, storage), false);
});

test('blocked storage does not crash event messages', () => {
  const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(noticeWasSeen('key', storage), false);
  assert.doesNotThrow(() => rememberNotice('key', storage));
});
