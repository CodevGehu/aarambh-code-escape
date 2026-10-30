import test from 'node:test';
import assert from 'node:assert/strict';
import { roundAnnouncements } from '../src/lib/leaderboardAnnouncements.js';

const a = { team_id: 'a', team_name: 'Team A', event_run_id: 'run', current_level: 1 };
test('initial snapshots, refreshes and changed ranks do not replay announcements', () => {
  assert.deepEqual(roundAnnouncements(null, [{ ...a, current_level: 4 }]), []);
  assert.deepEqual(roundAnnouncements([a], [{ ...a, rank: 1 }]), []);
  assert.deepEqual(roundAnnouncements([a], [{ ...a, current_level: 2, event_run_id: 'new-run' }]), []);
  assert.deepEqual(roundAnnouncements([{ ...a, current_level: 4 }], [a]), []);
});
test('simultaneous teams and multiple rounds between polls are all announced once', () => {
  const b = { ...a, team_id: 'b', team_name: 'Team B' };
  const next = [{ ...a, current_level: 3, round_outcomes: [{ level: 1, status: 'solved' }, { level: 2, status: 'skipped' }] },
    { ...b, current_level: 2, last_outcome_status: 'solved' }];
  const messages = roundAnnouncements([a, b], next);
  assert.equal(messages.length, 3);
  assert.match(messages[0].text, /cleared Round 1/);
  assert.equal(messages[1].text, 'reached Round 3!');
  assert.equal(messages[2].team, 'Team B');
  assert.equal(new Set(messages.map(message => message.id)).size, 3);
  assert.deepEqual(roundAnnouncements(next, next), []);
});
test('finishing with a skip never announces five solved rounds', () => {
  const messages = roundAnnouncements([{ ...a, current_level: 5 }], [{ ...a, current_level: 6, last_outcome_status: 'skipped' }]);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].text, 'finished the five-round path!');
});
