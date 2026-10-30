const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePayload, shouldApply, authenticate } = require('../routes/aarambhIntegration');

const payload = (overrides = {}) => ({ registration_id: '507f1f77bcf86cd799439011', version: 1,
  status: 'approved', team_name: 'Test Team', leader_name: 'Test Leader',
  email: 'Leader@example.com', access_code: 'test-only-strong-access-code-123456', members: ['Member One'], ...overrides });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('approved registration validation normalizes roster without accepting arbitrary fields', () => {
  const validated = validatePayload(payload({ team_name: ' Team ', leader_name: ' Leader ', members: [' Member '], extra: 'ignored' }));
  assert.equal(validated.email, 'leader@example.com');
  assert.equal(validated.team_name, 'Team');
  assert.equal(validated.leader_name, 'Leader');
  assert.deepEqual(validated.members, ['Member']);
  assert.equal(validated.extra, undefined);
});

test('revocation only needs a registration identity and version', () => {
  assert.deepEqual(validatePayload({ registration_id: 'ABCDEF0123456789ABCDEF01', version: 7, status: 'revoked' }),
    { registration_id: 'abcdef0123456789abcdef01', version: 7, status: 'revoked' });
});

test('malformed synchronization requests fail as client errors', () => {
  const invalid = [null, {}, payload({ registration_id: ['507f1f77bcf86cd799439011'] }),
    payload({ registration_id: { $ne: null } }), payload({ registration_id: 'not-an-id' }),
    payload({ version: 0 }), payload({ version: 1.5 }), payload({ version: '1' }),
    payload({ version: Number.MAX_SAFE_INTEGER + 1 }), payload({ status: 'pending' }),
    payload({ team_name: ' ' }), payload({ leader_name: 'x'.repeat(151) }), payload({ email: 'bad@example' }),
    payload({ access_code: 'short' }), payload({ access_code: 'x'.repeat(129) }),
    payload({ members: [''] }), payload({ members: Array(11).fill('Member') }), payload({ members: [123] })];
  for (const body of invalid) assert.throws(() => validatePayload(body), error => error.status === 400);
});

test('version ordering rejects duplicate/stale approvals and revocation wins an equal version', () => {
  assert.equal(shouldApply(null, payload()), true);
  for (const version of [1, 2]) assert.equal(shouldApply({ version: 2, status: 'approved' }, payload({ version })), false);
  assert.equal(shouldApply({ version: 2, status: 'approved' }, payload({ version: 2, status: 'revoked' })), true);
  assert.equal(shouldApply({ version: 2, status: 'revoked' }, payload({ version: 2 })), false);
  assert.equal(shouldApply({ version: 2, status: 'revoked' }, payload({ version: 2, status: 'revoked' })), false);
  assert.equal(shouldApply({ version: 2, status: 'revoked' }, payload({ version: 3 })), true);
});

test('integration requires configured, exact shared-secret bearer authentication', t => {
  const previous = process.env.AARAMBH_INTEGRATION_SECRET;
  t.after(() => { if (previous === undefined) delete process.env.AARAMBH_INTEGRATION_SECRET; else process.env.AARAMBH_INTEGRATION_SECRET = previous; });
  const secret = 'offline-test-integration-secret-never-deploy';
  const check = authorization => {
    const res = response(); let called = false;
    authenticate({ headers: { authorization } }, res, () => { called = true; });
    return { res, called };
  };
  delete process.env.AARAMBH_INTEGRATION_SECRET;
  assert.equal(check(`Bearer ${secret}`).res.statusCode, 503);
  process.env.AARAMBH_INTEGRATION_SECRET = 'too-short';
  assert.equal(check('Bearer too-short').res.statusCode, 503);
  process.env.AARAMBH_INTEGRATION_SECRET = secret;
  for (const header of [undefined, '', 'Basic nope', 'Bearer wrong', `Bearer ${secret}x`, `Bearer ${'x'.repeat(257)}`]) {
    const { res, called } = check(header);
    assert.equal(res.statusCode, 401); assert.equal(called, false);
    assert.equal(JSON.stringify(res.body).includes(secret), false);
  }
  assert.equal(check(`Bearer ${secret}`).called, true);
});

// Optional local transaction suite: provide a mongodb-memory-server package path.
// It never reads app .env files or uses a cloud database connection.
test('local replica-set registration synchronization', { skip: !process.env.AARAMBH_TEST_MEMORY_SERVER, timeout: 120000 }, async t => {
  const { MongoMemoryReplSet } = require(process.env.AARAMBH_TEST_MEMORY_SERVER);
  const mongoose = require('mongoose');
  const Team = require('../models/Team');
  const Enrollment = require('../models/AarambhEnrollment');
  const QuizState = require('../models/QuizState');
  const EventLog = require('../models/EventLog');
  const { router, synchronize } = require('../routes/aarambhIntegration');
  const { verifyAccessCode } = require('../services/accessCodes');
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 },
    binary: process.env.AARAMBH_TEST_MONGOD ? { systemBinary: process.env.AARAMBH_TEST_MONGOD } : undefined });
  t.after(async () => { await mongoose.disconnect(); await replSet.stop(); });
  await mongoose.connect(replSet.getUri(), { dbName: 'escape_integration_tests' });
  await Promise.all([Team.init(), Enrollment.init(), QuizState.init(), EventLog.init()]);
  async function reset() { await Promise.all([Team.deleteMany({}), Enrollment.deleteMany({}), QuizState.deleteMany({}), EventLog.deleteMany({})]); }

  await t.test('repeat sync preserves progress and an unchanged-code active session', async () => {
    await reset();
    const first = await synchronize(validatePayload(payload()));
    const progress = { current_level: 3, total_points: 350, question_set_id: 'L2', carry_ms: 42000,
      outcomes: [{ level: 1, points: 100, status: 'solved' }], event_run_id: 'event-1', active_session_id: 'session-1' };
    await Team.updateOne({ _id: first.team_id }, { $set: progress });
    const before = await Team.findById(first.team_id).select('+active_session_id').lean();
    assert.equal((await synchronize(validatePayload(payload()))).applied, false);
    await synchronize(validatePayload(payload({ version: 2, team_name: 'Renamed Team' })));
    const after = await Team.findById(first.team_id).select('+active_session_id +access_code_hash').lean();
    for (const key of Object.keys(progress)) assert.deepEqual(after[key], before[key]);
    assert.deepEqual(after.updatedAt, before.updatedAt);
    assert.equal(after.team_name, 'Renamed Team');
    assert.equal(await verifyAccessCode(payload().access_code, after.access_code_hash), true);
    assert.equal(JSON.stringify(await EventLog.find().lean()).includes(payload().access_code), false);
  });

  await t.test('revocation tombstone rejects delayed approval, including equal versions', async () => {
    await reset();
    const revoked = await synchronize(validatePayload(payload({ status: 'revoked', version: 2 })));
    assert.equal(revoked.team_id, null);
    for (const version of [1, 2]) {
      const replay = await synchronize(validatePayload(payload({ version })));
      assert.equal(replay.applied, false); assert.equal(replay.status, 'revoked');
    }
    assert.equal(await Team.countDocuments(), 0);
    await synchronize(validatePayload(payload({ version: 3 })));
    await Team.updateOne({}, { $set: { active_session_id: 'session', total_points: 100,
      registered_members: [{ name: 'Member', email: 'member@example.test', active_session_id: 'google-member-session', google_subject: 'verified-google-subject' }] } });
    await synchronize(validatePayload(payload({ status: 'revoked', version: 3 })));
    const team = await Team.findOne().select('+active_session_id +registered_members.active_session_id +registered_members.google_subject').lean();
    assert.equal(team.access_enabled, false); assert.equal(team.active_session_id, null);
    assert.equal(team.total_points, 100); assert.equal(team.progress_version, 1);
    assert.equal(team.registered_members[0].active_session_id, null, 'Refund revokes member sessions as well as the leader');
    assert.equal(team.registered_members[0].google_subject, 'verified-google-subject', 'Refund does not transfer a member identity');
  });

  await t.test('simultaneous duplicate first deliveries create exactly one team and receipt', async () => {
    await reset();
    const handler = router.stack.find(layer => layer.route?.path === '/teams').route.stack.at(-1).handle;
    const results = await Promise.all(Array.from({ length: 4 }, async () => {
      const res = response(); await handler({ body: payload() }, res); return res;
    }));
    assert.ok(results.every(res => res.statusCode === 200), JSON.stringify(results.map(res => res.statusCode)));
    assert.equal(results.filter(res => res.body.applied).length, 1);
    assert.equal(await Team.countDocuments(), 1); assert.equal(await Enrollment.countDocuments(), 1);
  });

  await t.test('late payment takes the shared start and setup conflict commits no partial receipt', async () => {
    await reset();
    const started_at = new Date();
    await QuizState.create({ key: 'global', status: 'starting', run_id: 'run-1', started_at,
      deadline: new Date(started_at.getTime() + 7200000) });
    await assert.rejects(synchronize(validatePayload(payload())), error => error.status === 503);
    assert.equal(await Team.countDocuments(), 0); assert.equal(await Enrollment.countDocuments(), 0);
    await QuizState.updateOne({ key: 'global' }, { $set: { status: 'active' } });
    const sync = await synchronize(validatePayload(payload()));
    const team = await Team.findById(sync.team_id).lean();
    assert.equal(team.event_run_id, 'run-1'); assert.equal(team.event_open, true);
    assert.deepEqual(team.round_started_at, started_at); assert.deepEqual(team.start_time, started_at);
  });

  await t.test('paid roster controls allocations, shared start, public ranks and exports while retaining refund audit', async () => {
    await reset();
    const previous = process.env.AARAMBH_REGISTRATION_REQUIRED;
    process.env.AARAMBH_REGISTRATION_REQUIRED = 'true';
    try {
      const Question = require('../models/Question');
      await Question.deleteMany({});
      await Question.insertMany(['L1', 'L2', 'L3'].flatMap(set_id => Array.from({ length: 5 }, (_, index) => ({
        set_id, level: index + 1, question_text: 'Local test question', correct_answer: 'test', points: (index + 1) * 100
      }))));
      const documents = [
        { team_name: 'Legacy Seed', email: 'legacy@example.com', question_set_id: 'removed-set', total_points: 9999 },
        { team_name: 'Refunded Team', email: 'refund@example.com', aarambh_registration_id: 'reg-refunded', access_enabled: false, total_points: 9000 },
        ...['A', 'B', 'C'].map(letter => ({ team_name: `Paid ${letter}`, email: `${letter.toLowerCase()}@example.com`, aarambh_registration_id: `reg-${letter}` }))
      ];
      await Team.insertMany(documents.map(team => ({ leader_name: 'Leader', ...team })));
      const start = response();
      await require('../controllers/quizController').startQuiz({}, start);
      assert.equal(start.statusCode, 200, JSON.stringify(start.body));
      const roster = await Team.find().lean();
      const paid = roster.filter(team => team.team_name.startsWith('Paid'));
      const event = await QuizState.findOne({ key: 'global' });
      assert.equal(new Set(paid.map(team => team.question_set_id)).size, 3);
      assert.ok(paid.every(team => team.event_run_id === event.run_id && team.start_time.getTime() === new Date(start.body.started_at).getTime()));
      for (const excluded of roster.filter(team => !team.team_name.startsWith('Paid'))) {
        assert.equal(excluded.event_run_id, null); assert.equal(excluded.start_time, null);
      }
      // Even historical scores with a start timestamp cannot enter current rankings.
      await Team.updateMany({ team_name: { $in: ['Legacy Seed', 'Refunded Team'] } }, { $set: { start_time: new Date() } });
      const board = response(); await require('../controllers/leaderboardController').getLeaderboard({}, board);
      assert.equal(board.statusCode, 200); assert.equal(board.body.leaderboard.length, 3);
      assert.ok(board.body.leaderboard.every(team => team.team_name.startsWith('Paid')));
      assert.ok(board.body.leaderboard.every(team => team.team_id && team.event_run_id === event.run_id && Array.isArray(team.round_outcomes)));
      const admin = response(); await require('../controllers/adminEventController').getTeams({}, admin);
      assert.equal(admin.statusCode, 200); assert.equal(admin.body.teams.length, 4);
      const refunded = admin.body.teams.find(team => team.team_name === 'Refunded Team');
      assert.equal(refunded.rank, null); assert.equal(refunded.access_enabled, false);
      assert.deepEqual(admin.body.teams.filter(team => team.access_enabled).map(team => team.rank).sort(), [1, 2, 3]);
      const { PassThrough } = require('node:stream');
      const stream = new PassThrough(), chunks = [];
      stream.setHeader = () => {};
      stream.status = code => { throw new Error(`Unexpected export error ${code}`); };
      stream.on('data', chunk => chunks.push(chunk));
      await require('../controllers/exportController').exportExcel({}, stream);
      const ExcelJS = require('exceljs'), workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.concat(chunks));
      const sheet = workbook.getWorksheet('Leaderboard Results');
      assert.equal(sheet.rowCount, 4);
      for (let row = 2; row <= sheet.rowCount; row++) assert.match(sheet.getRow(row).getCell(2).value, /^Paid /);
    } finally {
      if (previous === undefined) delete process.env.AARAMBH_REGISTRATION_REQUIRED;
      else process.env.AARAMBH_REGISTRATION_REQUIRED = previous;
    }
  });
});
