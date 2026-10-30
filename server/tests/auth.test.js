const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { generateAccessCode, hashAccessCode, verifyAccessCode } = require('../services/accessCodes');
const { prepareAccessCodes } = require('../seed/accessCodeExport');

function loadWithMocks(relative, mocks) {
  const filename = require.resolve(path.join(__dirname, '..', relative));
  const previous = require.cache[filename];
  const replacements = Object.entries(mocks).map(([name, exports]) => {
    const id = require.resolve(path.join(__dirname, '..', name));
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
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const secret = 'offline-test-only-team-signing-key-not-for-deployment';
function withSecret(t) {
  const previous = process.env.JWT_TEAM_SECRET;
  process.env.JWT_TEAM_SECRET = secret;
  t.after(() => {
    if (previous === undefined) delete process.env.JWT_TEAM_SECRET; else process.env.JWT_TEAM_SECRET = previous;
  });
}
async function fixture(options = {}) {
  const code = generateAccessCode();
  const team = {
    _id: '507f1f77bcf86cd799439011', email: 'leader@example.com', team_name: 'Test Team', leader_name: 'Leader', members: [],
    question_set_id: 'L2', current_level: 0, total_points: 250, level_points: { '1': 100 }, start_time: null, end_time: null,
    access_code_hash: await hashAccessCode(code), active_session_id: null, ...options.team
  };
  const state = options.state || { status: 'active', started_at: new Date('2026-10-01T04:30:00Z') };
  const match = filter => Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === 'object') {
      if ('$ne' in value) return team[key] !== value.$ne;
      if ('$type' in value) return typeof team[key] === value.$type;
      if ('$exists' in value) return (team[key] !== undefined) === value.$exists;
    }
    return team[key] === value;
  });
  const Team = {
    findOne(filter) {
      if (options.dbError) throw new Error('Database unavailable');
      const result = match(filter) ? { ...team } : null;
      // Mongoose queries support both select and awaiting without select.
      return { select() { return Promise.resolve(result); }, then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); } };
    },
    async updateOne(filter, update, options) {
      assert.equal(options?.timestamps, false, 'Auth must not change score tie-break timestamps');
      if (match(filter)) Object.assign(team, update.$set);
    },
    async findOneAndUpdate(filter, update, mutationOptions) {
      assert.equal(mutationOptions?.timestamps, false, 'New sessions must not change score tie-break timestamps');
      if (options.rotateDuringLogin) return null;
      if (!match(filter)) return null;
      Object.assign(team, update.$set);
      return { ...team };
    }
  };
  const mocks = { 'models/Team.js': Team, 'models/QuizState.js': { findOne: async () => state }, 'services/activityLog.js': { writeActivity: async () => true } };
  const controller = loadWithMocks('controllers/authController.js', mocks);
  const middleware = loadWithMocks('middleware/auth.js', { 'models/Team.js': Team }).authMiddleware;
  const authenticate = async token => {
    const req = { headers: { authorization: `Bearer ${token}` } }, res = response();
    let passed = false;
    await middleware(req, res, () => { passed = true; });
    return { req, res, passed };
  };
  const login = async (body = { email: ' LEADER@example.com ', accessCode: code }) => {
    const res = response(); await controller.login({ body }, res); return res;
  };
  return { team, code, state, controller, middleware, authenticate, login };
}

test('random access codes use salted scrypt and reject wrong or malformed codes', async () => {
  const code = generateAccessCode();
  assert.match(code, /^[\w-]{16}$/);
  assert.notEqual(code, generateAccessCode());
  const hash = await hashAccessCode(code);
  assert.notEqual(hash, await hashAccessCode(code));
  assert.equal(await verifyAccessCode(code, hash), true);
  assert.equal(await verifyAccessCode('wrong-code', hash), false);
  assert.equal(await verifyAccessCode(code, 'scrypt:bad:bad'), false);
  assert.equal(await verifyAccessCode({}, hash), false);
});

test('seed credentials preserve roster/assignment and keep plaintext out of DB documents', async () => {
  const original = { email: 'leader@example.com', team_name: 'A', question_set_id: 'L3' };
  const issued = await prepareAccessCodes([original]);
  assert.equal(issued.documents[0].question_set_id, 'L3');
  assert.equal(issued.documents[0].email, original.email);
  assert.equal(issued.documents[0].active_session_id, null);
  assert.equal(issued.documents[0].access_code, undefined);
  assert.equal(issued.credentials[0].access_code_hash, undefined);
  assert.equal(await verifyAccessCode(issued.credentials[0].access_code, issued.documents[0].access_code_hash), true);
  assert.deepEqual(original, { email: 'leader@example.com', team_name: 'A', question_set_id: 'L3' });
});

test('leader login issues scoped token and initializes the official shared start without exposing credentials', async t => {
  withSecret(t);
  const f = await fixture();
  const res = await f.login();
  assert.equal(res.statusCode, 200);
  const claims = jwt.verify(res.body.token, secret, { algorithms: ['HS256'], audience: 'participant', issuer: 'aarambh-code-escape' });
  assert.equal(claims.exp - claims.iat, 10800);
  assert.equal(claims.role, 'team');
  assert.equal(claims.sub, f.team._id);
  assert.equal(claims.sid, f.team.active_session_id);
  assert.equal(f.team.current_level, 1);
  assert.equal(f.team.start_time, f.state.started_at);
  assert.equal(f.team.total_points, 250);
  assert.equal(res.body.team.question_set_id, 'L2');
  assert.equal(res.body.team.access_code_hash, undefined);
  assert.equal(res.body.team.active_session_id, undefined);
  const authenticated = await f.authenticate(res.body.token);
  assert.equal(authenticated.passed, true);
  assert.equal(authenticated.req.user.email, f.team.email);
});

test('login before start leaves clock unset and reconnect preserves later progress', async t => {
  withSecret(t);
  const f = await fixture({ state: { status: 'not_started' } });
  await f.login();
  assert.equal(f.team.start_time, null);
  f.team.current_level = 4;
  f.team.start_time = new Date('2026-10-01T04:30:00Z');
  const start = f.team.start_time;
  await f.login();
  assert.equal(f.team.current_level, 4);
  assert.equal(f.team.start_time, start);
  assert.equal(f.team.total_points, 250);
});

test('new device login invalidates old session; old logout cannot end the newer session', async t => {
  withSecret(t);
  const f = await fixture();
  const old = await f.login();
  const oldSession = f.team.active_session_id;
  const current = await f.login();
  assert.notEqual(f.team.active_session_id, oldSession);
  assert.equal((await f.authenticate(old.body.token)).res.statusCode, 401);
  assert.equal((await f.authenticate(current.body.token)).passed, true);
  const res = response();
  await f.controller.logout({ user: { id: f.team._id, sessionId: oldSession } }, res);
  assert.equal((await f.authenticate(current.body.token)).passed, true);
  await f.controller.logout({ user: { id: f.team._id, sessionId: f.team.active_session_id } }, response());
  assert.equal((await f.authenticate(current.body.token)).res.statusCode, 401);
});

test('unknown email and incorrect access code return the same error without mutating team', async t => {
  withSecret(t);
  const f = await fixture();
  const missing = await f.login({ email: 'unknown@example.com', accessCode: f.code });
  const incorrect = await f.login({ email: f.team.email, accessCode: 'wrong' });
  assert.equal(missing.statusCode, 401);
  assert.equal(incorrect.statusCode, 401);
  assert.deepEqual(missing.body, incorrect.body);
  assert.equal(f.team.current_level, 0);
  assert.equal(f.team.active_session_id, null);
  assert.equal((await f.login({ email: { $ne: null }, accessCode: f.code })).statusCode, 400);
});

test('rotation during login refuses to create a session under the old code', async t => {
  withSecret(t);
  const f = await fixture({ rotateDuringLogin: true });
  const res = await f.login();
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.token, undefined);
});

test('revoked registrations cannot sign in with their former valid access code', async t => {
  withSecret(t);
  const f = await fixture({ team: { access_enabled: false } });
  const res = await f.login();
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.token, undefined);
  assert.equal(f.team.active_session_id, null);
  assert.equal(f.team.current_level, 0);
});

test('revocation denies an existing session even before the stored session is cleared', async t => {
  withSecret(t);
  const f = await fixture();
  const login = await f.login();
  assert.equal(login.statusCode, 200);
  f.team.access_enabled = false;
  const authenticated = await f.authenticate(login.body.token);
  assert.equal(authenticated.passed, false);
  assert.equal(authenticated.res.statusCode, 401);
});

test('login initializes a newly paid team using the shared event run and preserves an initialized round', async t => {
  withSecret(t);
  const f = await fixture({
    team: { event_run_id: null, round_started_at: null },
    state: { status: 'active', run_id: 'shared-run', started_at: new Date('2026-10-01T04:30:00Z') }
  });
  assert.equal((await f.login()).statusCode, 200);
  assert.equal(f.team.event_run_id, 'shared-run');
  assert.equal(f.team.event_open, true);
  assert.equal(f.team.round_started_at, f.state.started_at);
  f.team.current_level = 3;
  f.team.round_started_at = new Date('2026-10-01T05:00:00Z');
  const roundStart = f.team.round_started_at;
  assert.equal((await f.login()).statusCode, 200);
  assert.equal(f.team.current_level, 3);
  assert.equal(f.team.round_started_at, roundStart);
});

test('paid-registration enforcement rejects legacy seed credentials and sessions', async t => {
  withSecret(t);
  const previous = process.env.AARAMBH_REGISTRATION_REQUIRED;
  t.after(() => { if (previous === undefined) delete process.env.AARAMBH_REGISTRATION_REQUIRED; else process.env.AARAMBH_REGISTRATION_REQUIRED = previous; });
  delete process.env.AARAMBH_REGISTRATION_REQUIRED;
  const legacy = await fixture();
  const oldLogin = await legacy.login();
  assert.equal(oldLogin.statusCode, 200);
  process.env.AARAMBH_REGISTRATION_REQUIRED = 'true';
  assert.equal((await legacy.login()).statusCode, 401);
  assert.equal((await legacy.authenticate(oldLogin.body.token)).res.statusCode, 401);
  const paid = await fixture({ team: { aarambh_registration_id: '507f1f77bcf86cd799439012' } });
  const paidLogin = await paid.login();
  assert.equal(paidLogin.statusCode, 200);
  assert.equal((await paid.authenticate(paidLogin.body.token)).passed, true);
});

test('team middleware rejects admin tokens, wrong audience, expired tokens, and absent configuration', async t => {
  withSecret(t);
  const f = await fixture();
  const tokens = [
    jwt.sign({ isAdmin: true }, secret),
    jwt.sign({ role: 'team', sid: '' }, secret, { subject: f.team._id, issuer: 'aarambh-code-escape', audience: 'participant' }),
    jwt.sign({ role: 'team', sid: 'x', member_email: '' }, secret, { subject: f.team._id, issuer: 'aarambh-code-escape', audience: 'participant' }),
    jwt.sign({ role: 'team', sid: 'x' }, secret, { subject: f.team._id, issuer: 'aarambh-code-escape', audience: 'admin' }),
    jwt.sign({ role: 'team', sid: 'x' }, secret, { subject: f.team._id, issuer: 'aarambh-code-escape', audience: 'participant', expiresIn: -1 })
  ];
  for (const token of tokens) assert.equal((await f.authenticate(token)).res.statusCode, 401);
  delete process.env.JWT_TEAM_SECRET;
  assert.equal((await f.login()).statusCode, 503);
  assert.equal((await f.authenticate(tokens[0])).res.statusCode, 503);
});

test('database outage produces a retryable response without logging credentials', async t => {
  withSecret(t);
  const f = await fixture({ dbError: true });
  assert.equal((await f.login()).statusCode, 503);
  const token = jwt.sign({ role: 'team', sid: 'x' }, secret, { subject: f.team._id, issuer: 'aarambh-code-escape', audience: 'participant' });
  assert.equal((await f.authenticate(token)).res.statusCode, 503);
});
