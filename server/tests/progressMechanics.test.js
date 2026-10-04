const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function loadMocks(relativeFile, mocks) {
  const filename = require.resolve(path.join(__dirname, '..', relativeFile));
  const replacements = Object.entries(mocks).map(([file, exports]) => {
    const id = require.resolve(path.join(__dirname, '..', file));
    return { id, exports, prior: require.cache[id] };
  });
  const priorUnit = require.cache[filename];
  try {
    replacements.forEach(({ id, exports }) => { require.cache[id] = { id, filename: id, loaded: true, exports }; });
    delete require.cache[filename]; return require(filename);
  } finally {
    if (priorUnit) require.cache[filename] = priorUnit; else delete require.cache[filename];
    replacements.forEach(({ id, prior }) => { if (prior) require.cache[id] = prior; else delete require.cache[id]; });
  }
}
function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
function fixture({ overtime = false, closeBeforeWrite = false, final = false, failDerived = false } = {}) {
  const started = new Date(Date.now() - (overtime ? 11 : 1) * 60000);
  const state = { status: 'active', run_id: 'run', started_at: started, deadline: new Date(started.getTime() + 120 * 60000) };
  let stored = { _id: 'team', email: 'leader@example.com', question_set_id: 'L2', current_level: final ? 5 : 1,
    total_points: 0, level_points: {}, start_time: started, round_started_at: started, event_run_id: 'run', event_open: true,
    progress_version: 0, carry_ms: 0, outcomes: [], active_session_id: 'session', overtime_continued_at: overtime ? started : null };
  const filters = [], logs = [];
  const controller = loadMocks('controllers/progressController.js', {
    'models/QuizState.js': { findOne: async () => structuredClone(state) },
    'models/Team.js': {
      findOne: async () => structuredClone(stored),
      async findOneAndUpdate(filter, update) {
        filters.push(filter);
        assert.deepEqual(filter.$expr, { $lt: ['$$NOW', state.deadline] });
        if (closeBeforeWrite) stored.event_open = false;
        if (filter.current_level !== stored.current_level || filter.progress_version !== stored.progress_version ||
          filter.event_run_id !== stored.event_run_id || filter.event_open !== stored.event_open ||
          filter.active_session_id !== stored.active_session_id) return null;
        for (const [key, value] of Object.entries(update.$set || {})) {
          if (key.startsWith('level_points.')) stored.level_points[key.split('.')[1]] = value;
          else stored[key] = value;
        }
        for (const [key, value] of Object.entries(update.$inc || {})) stored[key] += value;
        if (update.$push?.outcomes) stored.outcomes.push(update.$push.outcomes);
        return structuredClone(stored);
      }
    },
    'models/Question.js': { findById: async () => ({ correct_answer: 'correct', set_id: 'L2', level: final ? 5 : 1 }) },
    'models/MappedQuestion.js': { findOne: async () => ({ selected_question_id: 'question' }) },
    'models/Result.js': { findOneAndUpdate: async () => { if (failDerived) throw new Error('offline'); } },
    'services/activityLog.js': { writeActivity: async entry => { logs.push(entry); return false; }, recordObservedTimeouts: async () => {} }
  });
  const req = () => ({ user: { email: stored.email, sessionId: 'session' }, body: { level: final ? 5 : 1, answer: ' correct ' } });
  return { ...controller, req, filters, logs, get team() { return stored; }, state };
}
test('overlapping correct submissions commit one score and one authoritative outcome', async () => {
  const f = fixture(); const replies = [response(), response()];
  await Promise.all(replies.map(res => f.submitProgress(f.req(), res)));
  assert.deepEqual(replies.map(res => res.statusCode).sort(), [200, 409]);
  assert.equal(f.team.total_points, 100); assert.equal(f.team.current_level, 2);
  assert.equal(f.team.outcomes.length, 1); assert.equal(f.team.progress_version, 1);
  assert.ok(f.filters.every(filter => filter.event_open === true && filter.event_run_id === 'run'));
});
test('answer versus skip race changes score once and preserves signed outcome', async () => {
  const f = fixture({ overtime: true }); const solved = response(), skipped = response();
  await Promise.all([f.submitProgress(f.req(), solved), f.skipRound(f.req(), skipped)]);
  assert.deepEqual([solved.statusCode, skipped.statusCode].sort(), [200, 409]);
  assert.equal(f.team.outcomes.length, 1); assert.equal(f.team.total_points, f.team.outcomes[0].points);
  assert.equal(f.team.current_level, 2); assert.equal(f.team.carry_ms, 0);
});
test('event closure on the Team document rejects an in-flight answer', async () => {
  const f = fixture({ closeBeforeWrite: true }); const res = response();
  await f.submitProgress(f.req(), res);
  assert.equal(res.statusCode, 409); assert.equal(f.team.total_points, 0); assert.equal(f.team.outcomes.length, 0);
});
test('incorrect answer writes no progress and never logs submitted answer text', async () => {
  const f = fixture(); const req = f.req(); req.body.answer = 'private submitted text'; const res = response();
  await f.submitProgress(req, res);
  assert.equal(res.statusCode, 400); assert.equal(res.body.code, 'INCORRECT_ANSWER');
  assert.equal(f.team.progress_version, 0); assert.equal(f.team.outcomes.length, 0);
  assert.ok(!JSON.stringify(f.logs).includes(req.body.answer));
});
test('secondary log and derived result failures cannot turn committed completion into failure', async () => {
  const f = fixture({ final: true, failDerived: true }); const res = response();
  await f.submitProgress(f.req(), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.points_awarded, 500);
  assert.equal(res.body.team.current_level, 6); assert.equal(f.team.outcomes.length, 1);
});
test('Continue is unavailable before cap and versioned when overtime starts', async () => {
  const early = fixture(); const earlyRes = response();
  await early.continueRound(early.req(), earlyRes);
  assert.equal(earlyRes.statusCode, 409); assert.equal(early.team.progress_version, 0);
  const late = fixture({ overtime: true }); late.team.overtime_continued_at = null;
  const res = response(); await late.continueRound(late.req(), res);
  assert.equal(res.statusCode, 200); assert.equal(late.team.progress_version, 1);
  assert.ok(late.team.overtime_continued_at); assert.equal(late.team.score_reached_at, undefined);
});

test('observed timeout logs deduplicate by run, team, and round and use boundary timestamps', async () => {
  const writes = new Map();
  const { recordObservedTimeouts } = loadMocks('services/activityLog.js', {
    'models/EventLog.js': { updateOne: async (filter, update) => {
      if (!writes.has(filter.event_id)) writes.set(filter.event_id, update.$setOnInsert);
    } }
  });
  const started = new Date('2026-10-01T08:00:00Z');
  const state = { run_id: 'run', status: 'active', started_at: started };
  const team = { _id: 'team', current_level: 1, round_started_at: started };
  const now = new Date(started.getTime() + 121 * 60000);
  await recordObservedTimeouts([team], state, now);
  await recordObservedTimeouts([team], state, now);
  assert.equal(writes.size, 2);
  assert.equal(writes.get('run:event_deadline').timestamp.getTime(), started.getTime() + 120 * 60000);
  assert.equal(writes.get('run:team:round:1:deadline').timestamp.getTime(), started.getTime() + 10 * 60000);
});
test('manual end before cap freezes round reward/time and produces no later timeout', async () => {
  const writes = [];
  const { recordObservedTimeouts } = loadMocks('services/activityLog.js', {
    'models/EventLog.js': { updateOne: async (...args) => writes.push(args) }
  });
  const started = new Date('2026-10-01T08:00:00Z');
  const state = { run_id: 'run', status: 'ended', started_at: started, ended_at: new Date(started.getTime() + 5 * 60000) };
  const team = { _id: 'team', current_level: 1, round_started_at: started };
  const later = new Date(started.getTime() + 130 * 60000);
  await recordObservedTimeouts([team], state, later);
  assert.equal(writes.length, 0);
  const round = require('../services/eventRules').getRoundState(team, state, later);
  assert.equal(round.remaining_ms, 5 * 60000); assert.equal(round.available_points, 100);
});
