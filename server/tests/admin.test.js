const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { compareTeams } = require('../services/rankings');

function loadWithMocks(relative, mocks = {}) {
  const filename = require.resolve(path.join(__dirname, '..', relative));
  const previous = require.cache[filename];
  const replacements = Object.entries(mocks).map(([relative, exports]) => {
    const id = require.resolve(path.join(__dirname, '..', relative));
    return { id, exports, previous: require.cache[id] };
  });
  try {
    for (const item of replacements) require.cache[item.id] = { id: item.id, filename: item.id, loaded: true, exports: item.exports };
    delete require.cache[filename];
    return require(filename);
  } finally {
    if (previous) require.cache[filename] = previous; else delete require.cache[filename];
    for (const item of replacements) {
      if (item.previous) require.cache[item.id] = item.previous; else delete require.cache[item.id];
    }
  }
}
const query = rows => ({ select() { return this; }, sort() { return this; }, skip(value) { this.offset = value; return this; },
  limit(value) { this.size = value; return this; }, lean: async () => rows });
const response = () => ({ statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }, set(key, value) { this.headers[key] = value; return this; }, send(body) { this.body = body; return this; } });
const id = '507f1f77bcf86cd799439011';

test('admin snapshots expose clocks and outcomes without active session IDs or credential hashes', async () => {
  const team = { _id: id, team_name: 'Team A', leader_name: 'Leader', current_level: 1, total_points: -20,
    active_session_id: 'private-session', access_code_hash: 'private-hash', outcomes: [], question_set_id: 'L2' };
  const controller = loadWithMocks('controllers/adminEventController.js', {
    'models/Team.js': { find: () => query([team]) },
    'models/QuizState.js': { findOne: async () => ({ status: 'not_started' }) },
    'models/EventLog.js': { aggregate: async () => [{ _id: id, timestamp: new Date(), action: 'team_login' }] },
    'services/activityLog.js': { recordObservedTimeouts: async () => {} }
  });
  const res = response(); await controller.getTeams({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.teams[0].total_points, -20);
  assert.equal(res.body.teams[0].session_active, true);
  assert.equal(res.body.teams[0].question_set_id, 'L2');
  assert.equal(res.body.teams[0].active_session_id, undefined);
  assert.equal(res.body.teams[0].access_code_hash, undefined);
  assert.equal(res.body.event.status, 'not_started');
  assert.equal(res.body.teams[0].last_activity.action, 'team_login');
});

test('equal-score ranking prefers solved rounds, then score time, with deterministic final ties', () => {
  const teams = [
    { _id: 'b', total_points: 100, outcomes: [{ status: 'solved' }], score_reached_at: '2026-10-01T06:01:00Z' },
    { _id: 'a', total_points: 100, outcomes: [{ status: 'solved' }], score_reached_at: '2026-10-01T06:01:00Z' },
    { _id: 'e', total_points: -40, outcomes: [], score_reached_at: '2026-10-01T06:00:00Z' },
    { _id: 'c', total_points: 100, outcomes: [{ status: 'solved' }, { status: 'solved' }], score_reached_at: '2026-10-01T06:03:00Z' },
    { _id: 'd', total_points: 100, outcomes: [{ status: 'solved' }], score_reached_at: '2026-10-01T06:00:00Z' }
  ];
  assert.deepEqual(teams.sort(compareTeams).map(team => team._id), ['c', 'd', 'a', 'b', 'e']);
  teams[2].updatedAt = new Date('2099-01-01'); // Authentication activity cannot change order.
  assert.deepEqual(teams.sort(compareTeams).map(team => team._id), ['c', 'd', 'a', 'b', 'e']);
});

test('log filters reject query operators, malformed team IDs, and out-of-range rounds', () => {
  const { logFilter } = require('../controllers/adminEventController');
  for (const params of [{ team_id: { $ne: null } }, { team_id: 'invalid' }, { action: { $ne: null } }, { level: 6 }, { level: '1abc' }]) {
    assert.throws(() => logFilter(params), error => error.status === 400);
  }
  const filter = logFilter({ team_id: id, action: 'round_solved', level: '3' });
  assert.equal(String(filter.team_id), id);
  assert.equal(filter.level, 3);
  assert.equal(filter.action, 'round_solved');
});

test('activity CSV neutralizes formula team names and escapes embedded commas and quotes', async () => {
  const controller = loadWithMocks('controllers/adminEventController.js', {
    'models/Team.js': { find: () => query([{ _id: id, team_name: '=HYPERLINK("bad","Team")' }]) },
    'models/EventLog.js': { find: () => query([{ team_id: id, timestamp: new Date('2026-10-01T06:00:00Z'), action: 'round_skipped', level: 1, delta: -20 }]) }
  });
  const res = response(); await controller.exportLogs({ query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.ok(res.body.includes(`"'=HYPERLINK(""bad"",""Team"")"`));
  assert.ok(res.body.includes('"-20"'));
  for (const input of ['=SUM(A1)', '+cmd', '-cmd', '@cmd', '  =SUM(A1)', '\tcmd', '\ncmd']) {
    assert.ok(controller.csvCell(input).startsWith('"\''));
  }
});

test('admin activity pagination is bounded and metadata containing answers is omitted', async () => {
  let selected, skipped, limited;
  const logQuery = query([{ _id: 'log', team_id: id, action: 'round_solved', level: 2, delta: 100 }]);
  logQuery.select = fields => { selected = fields; return logQuery; };
  logQuery.skip = offset => { skipped = offset; return logQuery; };
  logQuery.limit = limit => { limited = limit; return logQuery; };
  const controller = loadWithMocks('controllers/adminEventController.js', {
    'models/Team.js': { find: () => query([{ _id: id, team_name: 'A' }]) },
    'models/EventLog.js': { find: () => logQuery, countDocuments: async () => 150, distinct: async () => ['round_solved'] }
  });
  const res = response(); await controller.getLogs({ query: { page: '2', page_size: '99999' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(limited, 100); assert.equal(skipped, 100);
  assert.equal(selected.includes('metadata'), false);
  assert.equal(res.body.pages, 2); assert.equal(res.body.logs[0].team_name, 'A');
});

test('admin team and activity endpoints require an organizer token', () => {
  const router = require('../routes/admin');
  for (const path of ['/teams', '/logs', '/logs/export']) {
    const route = router.stack.find(layer => layer.route?.path === path).route;
    const res = response(); let passed = false;
    route.stack[0].handle({ header: () => undefined }, res, () => { passed = true; });
    assert.equal(res.statusCode, 401); assert.equal(passed, false);
  }
});
