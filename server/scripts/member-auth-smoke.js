// Real HTTP/session/scoring checks use synthetic Google identities and loopback Mongo only.
const assert = require('node:assert/strict');
async function run() {
  for (const key of Object.keys(process.env)) if (/^(MONGODB_URI|JWT_|ADMIN_PASSWORD|GOOGLE_CLIENT_ID|EARLY_ROUND_SECRET|AARAMBH_INTEGRATION_SECRET)/.test(key)) delete process.env[key];
  const { MongoMemoryReplSet } = require('mongodb-memory-server');
  const mongoose = require('mongoose');
  const { OAuth2Client } = require('google-auth-library');
  const originalVerify = OAuth2Client.prototype.verifyIdToken;
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' },
    binary: process.env.AARAMBH_TEST_MONGOD ? { systemBinary: process.env.AARAMBH_TEST_MONGOD } : undefined });
  let server, checks = 0;
  const equal = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
  try {
    const uri = replica.getUri('member_google_loopback'); assert.ok(uri.startsWith('mongodb://127.0.0.1:'));
    Object.assign(process.env, { NODE_ENV: 'test', MONGODB_URI: uri, AARAMBH_REGISTRATION_REQUIRED: 'true',
      GOOGLE_CLIENT_ID: 'loopback-google-client.apps.googleusercontent.com',
      JWT_TEAM_SECRET: 'loopback-member-team-secret-1234567890', JWT_ADMIN_SECRET: 'loopback-member-admin-secret-1234567890',
      ADMIN_PASSWORD: 'LoopbackOnlyOrganizer!123', EARLY_ROUND_SECRET: 'loopback-member-early-secret-1234567890' });
    const identities = { leader: 'leader@example.test', one: 'one@example.test', two: 'two@example.test', unknown: 'unknown@example.test' };
    OAuth2Client.prototype.verifyIdToken = async ({ idToken, audience }) => {
      assert.equal(audience, process.env.GOOGLE_CLIENT_ID);
      const email = identities[idToken] || (idToken === 'one-other-subject' ? identities.one : null);
      if (!email) throw new Error('Invalid synthetic signature');
      return { getPayload: () => ({ sub: 'google-' + idToken, email, email_verified: true,
        aud: audience, iss: 'https://accounts.google.com', exp: Math.floor(Date.now() / 1000) + 3600 }) };
    };
    await mongoose.connect(uri);
    const app = require('../app'), Team = require('../models/Team'), Question = require('../models/Question');
    const QuizState = require('../models/QuizState'), PuzzleState = require('../models/RoundPuzzleState');
    const { hashAccessCode } = require('../services/accessCodes');
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    await QuizState.create({ key: 'global', status: 'not_started' });
    const team = await Team.create({ team_name: 'Shared Google Team', leader_name: 'Leader', email: identities.leader,
      members: ['One', 'Two'], question_set_id: 'L1', aarambh_registration_id: 'synthetic-members',
      access_code_hash: await hashAccessCode('LoopbackTeamCode!123'),
      registered_members: Object.entries(identities).filter(([key]) => key !== 'unknown').map(([key, email]) => ({
        email, name: key, is_leader: key === 'leader' })) });
    await Question.create({ set_id: 'L1', level: 1, question_text: 'Loopback sum', correct_answer: '42', points: 100 });
    await Question.create(require('../services/earlyRoundPuzzles').earlyQuestions.find(q => q.set_id === 'L1' && q.level === 2));
    await Question.insertMany(['L1', 'L2', 'L3'].flatMap(set_id => [1, 2, 3, 4, 5]
      .filter(level => set_id !== 'L1' || level > 2)
      .map(level => ({ set_id, level, question_text: 'Synthetic remaining round', correct_answer: '42', points: level * 100 }))));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    async function request(route, status, { token, body } = {}) {
      const r = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await r.json(); if (status != null) equal(r.status, status, route + ': ' + (data.error || '')); return { status: r.status, data };
    }
    const login = async key => (await request('/api/auth/google', 200, { body: { credential: key } })).data.token;
    equal((await request('/api/auth/config', 200)).data.google_client_id, process.env.GOOGLE_CLIENT_ID);
    await request('/api/auth/google', 401, { body: { credential: 'tampered' } });
    await request('/api/auth/google', 401, { body: { credential: 'unknown' } });
    await request('/api/auth/google', 400, { body: { credential: { $ne: null } } });
    let leader = await login('leader'), one = await login('one'), two = await login('two');
    await request('/api/auth/google', 401, { body: { credential: 'one-other-subject' } });
    for (const [token, email] of [[leader, identities.leader], [one, identities.one], [two, identities.two]]) {
      const me = (await request('/api/auth/me', 200, { token })).data;
      equal(me.team._id, String(team._id)); equal(me.team.question_set_id, 'L1'); equal(me.participant.email, email);
      equal(JSON.stringify(me).includes('active_session_id'), false); equal(JSON.stringify(me).includes('google_subject'), false);
      await request('/api/admin/teams', 401, { token }); await request('/api/admin/answer-booklet?set_id=L1', 401, { token });
    }
    const replaced = one; one = await login('one');
    await request('/api/auth/me', 401, { token: replaced });
    await request('/api/auth/me', 200, { token: leader }); await request('/api/auth/me', 200, { token: two });
    await request('/api/auth/logout', 200, { token: one, body: {} });
    await request('/api/auth/me', 401, { token: one });
    await request('/api/auth/me', 200, { token: leader }); await request('/api/auth/me', 200, { token: two });
    one = await login('one');
    const oldLeader = leader;
    leader = (await request('/api/auth/login', 200, { body: { email: identities.leader, accessCode: 'LoopbackTeamCode!123' } })).data.token;
    await request('/api/auth/me', 401, { token: oldLeader });
    await request('/api/auth/me', 200, { token: one }); await request('/api/auth/me', 200, { token: two });
    const admin = (await request('/api/admin/login', 200, { body: { username: 'admin', password: process.env.ADMIN_PASSWORD } })).data.token;
    await request('/api/quiz/start', 200, { token: admin, body: {} });
    const question = (await request('/api/questions/1', 200, { token: one })).data.question;
    equal(question.question_text, 'Loopback sum');
    const finishes = await Promise.all([one, two].map(token => request('/api/progress/submit', null, { token, body: { level: 1, answer: '42' } })));
    equal(finishes.map(r => r.status).sort(), [200, 409], 'Only one simultaneous member submission awards points');
    const after = await Team.findById(team._id).lean();
    equal(after.current_level, 2); equal(after.total_points, 100); equal(after.outcomes.length, 1);
    for (const token of [leader, one, two]) equal((await request('/api/progress/state', 200, { token })).data.team.total_points, 100);
    const early = (await request('/api/questions/2', 200, { token: two })).data.question;
    const document = await PuzzleState.findOne({ instance_id: early.puzzle.instance_id }).select('+private_data');
    const reference = require('../services/earlyRoundPuzzles').reference(await Question.findById(early._id), document);
    await request(`/api/round-puzzles/${early._id}/repair`, 200, { token: one, body: {
      instance_id: early.puzzle.instance_id, source: reference.corrected_source, marker: reference.marker } });
    equal((await request('/api/questions/2', 200, { token: two })).data.question.puzzle.stage, 'unlocked', 'Members share the same round experiment');
    await request('/api/progress/submit', 200, { token: two, body: {
      level: 2, question_id: String(early._id), puzzle_submission: reference.reference_submission } });
    equal((await request('/api/progress/state', 200, { token: leader })).data.team.total_points, 300);
    const duplicate = await Team.create({ team_name: 'Conflicting roster', leader_name: 'Other', email: 'other@example.test',
      aarambh_registration_id: 'synthetic-conflict', registered_members: [{ name: 'Duplicate', email: identities.one }] });
    await request('/api/auth/google', 401, { body: { credential: 'one' } });
    await Team.deleteOne({ _id: duplicate._id });
    await Team.updateOne({ _id: team._id }, { $set: { access_enabled: false } });
    for (const token of [leader, one, two]) await request('/api/auth/me', 401, { token });
    console.log(JSON.stringify({ passed: true, checks, independent_member_sessions: 3, shared_progress: true,
      concurrent_score_awarded_once: true, member_repair_and_cross_member_submit: true, organizer_routes_denied: true }));
  } finally {
    OAuth2Client.prototype.verifyIdToken = originalVerify;
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await mongoose.disconnect(); await replica.stop();
  }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
