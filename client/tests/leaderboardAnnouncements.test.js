import test from 'node:test';
import assert from 'node:assert/strict';
import { roundAnnouncements, milestoneAnnouncements } from '../src/lib/leaderboardAnnouncements.js';

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
test('milestones voice firsts, clears, finishes and lead changes but never skips', () => {
  const b = { ...a, team_id: 'b', team_name: 'Team B' };
  const start = [{ ...a, rank: 1, total_points: 0 }, { ...b, rank: 2, total_points: 0 }];
  const aClears = [{ ...a, rank: 1, total_points: 100, current_level: 2, round_outcomes: [{ level: 1, status: 'solved' }] }, { ...b, rank: 2, total_points: 0 }];
  const first = milestoneAnnouncements(start, aClears);
  assert.equal(first.length, 1);
  assert.equal(first[0].kind, 'first');
  assert.equal(first[0].speech, 'Team A is the first team to clear round 1!');
  const bClears = [{ ...b, rank: 1, total_points: 150, current_level: 2, round_outcomes: [{ level: 1, status: 'solved' }] }, aClears[0]];
  const second = milestoneAnnouncements(aClears, bClears);
  assert.deepEqual(second.map(item => item.kind), ['cleared', 'lead']);
  assert.equal(second[0].speech, 'Team B cleared round 1.');
  assert.equal(second[1].speech, 'Team B takes the lead!');
  const skip = milestoneAnnouncements(bClears, [bClears[0], { ...aClears[0], current_level: 3, round_outcomes: [{ level: 1, status: 'solved' }, { level: 2, status: 'skipped' }] }]);
  assert.equal(skip.length, 1);
  assert.equal(skip[0].speech, null);
  const finish = milestoneAnnouncements([{ ...a, rank: 1, current_level: 5 }], [{ ...a, rank: 1, current_level: 6, round_outcomes: [{ level: 5, status: 'solved' }] }]);
  assert.equal(finish[0].speech, 'Team A escaped all five rooms!');
  assert.deepEqual(milestoneAnnouncements(null, aClears), []);
});
test('two teams clearing the same round in one update share no "first"', () => {
  const b = { ...a, team_id: 'b', team_name: 'Team B' };
  const next = [{ ...a, rank: 1, total_points: 100, current_level: 2, round_outcomes: [{ level: 1, status: 'solved' }] },
    { ...b, rank: 2, total_points: 90, current_level: 2, round_outcomes: [{ level: 1, status: 'solved' }] }];
  const items = milestoneAnnouncements([{ ...a, rank: 1, total_points: 0 }, { ...b, rank: 2, total_points: 0 }], next);
  assert.deepEqual(items.map(item => item.kind), ['first', 'cleared']);
});
