const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../services/eventRules');
const start = new Date('2026-10-01T08:00:00Z');
const at = minutes => new Date(start.getTime() + minutes * 60000);
const state = () => ({ status: 'active', started_at: start, config: rules.defaultConfig(), run_id: 'run' });
const team = (extra = {}) => ({ _id: 'team', current_level: 1, total_points: 0,
  round_started_at: start, carry_ms: 0, outcomes: [], ...extra });

test('shared event cutoff expires at exactly 120 minutes without background timers', () => {
  assert.equal(rules.getEventState(state(), at(119.999)).status, 'active');
  assert.equal(rules.getEventState(state(), at(120)).status, 'ended');
  assert.throws(() => rules.outcomeUpdate(team(), state(), 'solved', at(120)), { code: 'EVENT_ENDED' });
  assert.throws(() => rules.outcomeUpdate(team(), state(), 'skipped', at(121)), { code: 'EVENT_ENDED' });
});
test('six-minute solve gives four saved minutes and nineteen minutes in round two', () => {
  const changes = rules.outcomeUpdate(team(), state(), 'solved', at(6));
  assert.equal(changes.outcome.points, 100);
  assert.equal(changes.update.$set.carry_ms, 4 * 60000);
  const next = team({ ...changes.update.$set, total_points: 100 });
  const round = rules.getRoundState(next, state(), at(6));
  assert.equal(round.remaining_ms, 19 * 60000);
  const second = rules.outcomeUpdate(next, state(), 'solved', at(12));
  assert.equal(second.update.$set.carry_ms, 13 * 60000);
});
test('carry includes previously saved time and next deadline clips at global deadline', () => {
  const t = team({ current_level: 5, round_started_at: at(110), carry_ms: 20 * 60000 });
  assert.equal(rules.getRoundState(t, state(), at(110)).deadline.getTime(), at(120).getTime());
});
test('exact round boundary requires a decision; Continue earns decaying reward with zero carry', () => {
  assert.equal(rules.getRoundState(team(), state(), at(10)).requires_decision, true);
  assert.throws(() => rules.outcomeUpdate(team(), state(), 'solved', at(10)), { code: 'OVERTIME_DECISION_REQUIRED' });
  const continued = team({ current_level: 2, overtime_continued_at: at(15) });
  const changes = rules.outcomeUpdate(continued, state(), 'solved', at(18));
  assert.equal(changes.outcome.points, 170);
  assert.equal(changes.update.$set.carry_ms, 0);
});
test('decay is proportional per millisecond and stops at ceil of percentage floor', () => {
  const s = state();
  s.config.round_points[0] = 101;
  const t = team({ overtime_continued_at: at(10) });
  assert.equal(rules.getRoundState(t, s, at(10.5)).available_points, 98);
  assert.equal(rules.getRoundState(t, s, at(40)).available_points, 26);
});
test('skips are available after cap only, allow negative total, and award no carry', () => {
  assert.throws(() => rules.outcomeUpdate(team(), state(), 'skipped', at(9.99)), { code: 'SKIP_NOT_AVAILABLE' });
  const changes = rules.outcomeUpdate(team(), state(), 'skipped', at(10));
  assert.equal(changes.outcome.after, -20);
  assert.equal(changes.update.$inc.total_points, -20);
  assert.equal(changes.update.$set.carry_ms, 0);
  assert.equal(changes.update.$set.current_level, 2);
  assert.equal(changes.update.$push.outcomes, changes.outcome);
});
test('last round completes and saves score timestamp in the atomic outcome update', () => {
  const changes = rules.outcomeUpdate(team({ current_level: 5 }), state(), 'solved', at(2));
  assert.equal(changes.update.$set.current_level, 6);
  assert.deepEqual(changes.update.$set.end_time, at(2));
  assert.deepEqual(changes.update.$set.score_reached_at, at(2));
  assert.equal(changes.update.$inc.progress_version, 1);
});
test('frozen settings override mutable settings and public teams exclude credentials', () => {
  const s = state(); s.frozen_config = rules.defaultConfig(); s.config.round_points[0] = 999;
  assert.equal(rules.getRoundState(team(), s, at(1)).available_points, 100);
  const publicData = rules.publicTeam(team({ access_code_hash: 'private', active_session_id: 'private' }), s, at(1));
  assert.equal('access_code_hash' in publicData, false);
  assert.equal('active_session_id' in publicData, false);
});
test('config rejects invalid lengths, numbers, excessive budgets and unknown fields', () => {
  for (const config of [{ round_minutes: [1] }, { round_points: [1, 2, 3, 4, 1.2] },
    { round_minutes: [30, 30, 30, 30, 30] }, { minimum_reward_percent: -1 },
    { duration_minutes: 60 }, { secret: 'value' }, { toString: 'invalid inherited key' },
    { round_points: [Number.MAX_SAFE_INTEGER, 2, 3, 4, 5] }]) assert.throws(() => rules.validateConfig(config));
  assert.throws(() => rules.outcomeUpdate(team(), state(), 'invented', at(1)), { code: 'INVALID_ACTION' });
});

test('an organizer ending after global cutoff cannot extend closed-round reward decay', () => {
  const s = state(); s.status = 'ended'; s.ended_at = at(130);
  assert.equal(rules.getEventState(s, at(150)).ended_at.getTime(), at(120).getTime());
  const t = team({ current_level: 5, round_started_at: at(110) });
  const frozen = rules.getRoundState(t, s, at(150));
  assert.equal(frozen.remaining_ms, 0);
  assert.equal(frozen.overtime_ms, 0);
});
