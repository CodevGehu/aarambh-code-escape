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
  json(body) { this.body = body; return this; }, set(key, value) { if (typeof key === 'object') Object.assign(this.headers, key); else this.headers[key] = value; return this; }, send(body) { this.body = body; return this; } });
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

test('organizer JWTs require fixed algorithm, role, issuer, audience and a live server session', async () => {
  const jwt = require('jsonwebtoken');
  const { ISSUER, AUDIENCE } = require('../services/adminSessions');
  const previous = process.env.JWT_ADMIN_SECRET;
  const secret = 'unit-test-organizer-secret-only-1234567890';
  process.env.JWT_ADMIN_SECRET = secret;
  const sid = '11111111-1111-4111-8111-111111111111';
  let active = true, sessionLookups = 0;
  const auth = loadWithMocks('middleware/adminAuth.js', {
    'models/AdminSession.js': { findOne(filter) {
      sessionLookups += 1; assert.equal(filter.session_id, sid); assert.equal(filter.revoked_at, null);
      assert.ok(filter.expires_at.$gt instanceof Date);
      return { lean: async () => active ? { session_id: sid } : null };
    } }
  });
  const claims = { isAdmin: true, role: 'admin', username: 'admin', sid };
  const options = { algorithm: 'HS256', issuer: ISSUER, audience: AUDIENCE, expiresIn: '2h' };
  async function check(token) {
    const res = response(); let passed = false;
    await auth({ header: () => `Bearer ${token}` }, res, () => { passed = true; });
    assert.match(res.headers['Cache-Control'], /no-store/); return { passed, res };
  }
  try {
    const valid = jwt.sign(claims, secret, options);
    assert.equal((await check(valid)).passed, true);
    const lookups = sessionLookups;
    for (const token of [
      jwt.sign({ isAdmin: true }, secret),
      jwt.sign({ ...claims, role: 'team' }, secret, options),
      jwt.sign(claims, secret, { ...options, issuer: 'wrong' }),
      jwt.sign(claims, secret, { ...options, audience: 'participant' }),
      jwt.sign(claims, secret, { ...options, algorithm: 'HS384' }),
      jwt.sign(claims, secret, { ...options, expiresIn: -1 }),
      jwt.sign(claims, 'participant-signing-key', options)
    ]) { const result = await check(token); assert.equal(result.passed, false); assert.equal(result.res.statusCode, 401); }
    assert.equal(sessionLookups, lookups, 'invalid credentials must fail before database access');
    active = false;
    assert.equal((await check(valid)).res.statusCode, 401, 'revoked or expired server session invalidates an otherwise valid JWT');
  } finally { if (previous === undefined) delete process.env.JWT_ADMIN_SECRET; else process.env.JWT_ADMIN_SECRET = previous; }
});

test('organizer login stores an expiring session and signs only the strict organizer audience', async () => {
  const jwt = require('jsonwebtoken');
  const previous = process.env.JWT_ADMIN_SECRET;
  process.env.JWT_ADMIN_SECRET = 'unit-test-organizer-secret-only-1234567890';
  let saved;
  const sessions = loadWithMocks('services/adminSessions.js', {
    'models/AdminSession.js': { create: async row => { saved = row; } }
  });
  try {
    const result = await sessions.createSession();
    const claims = jwt.verify(result.token, process.env.JWT_ADMIN_SECRET,
      { algorithms: ['HS256'], issuer: sessions.ISSUER, audience: sessions.AUDIENCE });
    assert.equal(claims.sid, saved.session_id); assert.equal(claims.role, 'admin');
    assert.equal(claims.exp - claims.iat, 7200);
    assert.equal(result.expires_at, saved.expires_at.toISOString());
    assert.equal(saved.username, 'admin'); assert.equal(saved.password, undefined);
  } finally { if (previous === undefined) delete process.env.JWT_ADMIN_SECRET; else process.env.JWT_ADMIN_SECRET = previous; }
});

test('organizer guesses share one durable counter without persisting credentials or IPs', async () => {
  let count = 0; const writes = [];
  const sessions = loadWithMocks('services/adminSessions.js', {
    'models/AdminAccessAttempt.js': { findOneAndUpdate: async (filter, update) => {
      writes.push({ filter, update }); return { count: ++count };
    } }
  });
  for (let index = 1; index <= 11; index += 1) {
    const result = await sessions.reserveAttempt('admin-login', '127.0.0.1', 10);
    assert.equal(result.allowed, index <= 10); assert.ok(result.retry_after > 0);
  }
  assert.equal(new Set(writes.map(row => row.filter.key)).size, 1);
  assert.equal(JSON.stringify(writes).includes('127.0.0.1'), false);
  assert.match(writes[0].filter.key, /^[a-f0-9]{64}$/);
});
