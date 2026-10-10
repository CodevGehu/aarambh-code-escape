// Actual HTTP authorization checks against an ephemeral loopback database only.
// This script deliberately never reads dotenv, live credentials, or live data.
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

async function run() {
  for (const key of Object.keys(process.env)) if (/^(MONGODB_URI|JWT_|ADMIN_PASSWORD|AARAMBH_INTEGRATION_SECRET|SMTP_|GMAIL_|CLOUDINARY_)/.test(key)) delete process.env[key];
  const { MongoMemoryServer } = require(process.env.AARAMBH_TEST_MEMORY_SERVER || require.resolve('mongodb-memory-server'));
  const database = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' },
    binary: process.env.AARAMBH_TEST_MONGOD ? { systemBinary: process.env.AARAMBH_TEST_MONGOD } : undefined });
  const mongoose = require('mongoose');
  let server, assertions = 0;
  const equal = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
  try {
    const uri = database.getUri('organizer_security_test');
    assert.ok(uri.startsWith('mongodb://127.0.0.1:'));
    Object.assign(process.env, { NODE_ENV: 'test', MONGODB_URI: uri,
      JWT_TEAM_SECRET: 'loopback-participant-key-not-for-production',
      JWT_ADMIN_SECRET: 'loopback-organizer-key-not-for-production',
      EARLY_ROUND_SECRET: 'loopback-private-round-key-not-for-production',
      ADMIN_PASSWORD: 'LoopbackOnlyOrganizer!1234567890' });
    await mongoose.connect(uri);
    const app = require('../app');
    const AdminSession = require('../models/AdminSession');
    const AdminAccessAttempt = require('../models/AdminAccessAttempt');
    const PuzzleRehearsal = require('../models/PuzzleRehearsal');
    const { earlyQuestions, generatePrivate } = require('../services/earlyRoundPuzzles');
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    async function request(route, expected, { token, body, method = 'GET' } = {}) {
      const response = await fetch(base + route, { method, headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {})
      }, ...(body ? { body: JSON.stringify(body) } : {}) });
      equal(response.status, expected, route);
      equal(response.headers.get('cache-control').includes('no-store'), true, 'No confidential responses may be cached');
      return response.json();
    }
    const booklet = '/api/admin/answer-booklet?set_id=L1';
    await request(booklet, 401);
    const participant = jwt.sign({ isAdmin: true, role: 'admin', username: 'admin', sid: '11111111-1111-4111-8111-111111111111' },
      process.env.JWT_TEAM_SECRET, { algorithm: 'HS256', issuer: 'aarambh-code-escape', audience: 'aarambh-organizer' });
    await request(booklet, 401, { token: participant });
    const login = () => request('/api/admin/login', 200, { method: 'POST', body: { username: 'admin', password: process.env.ADMIN_PASSWORD } });
    const organizer = await login();
    const claims = jwt.decode(organizer.token);
    equal(claims.exp - claims.iat, 7200);
    await request('/api/admin/verify', 200, { token: organizer.token });
    const setBooklet = await request(booklet, 200, { token: organizer.token });
    equal(setBooklet.set_id, 'L1'); equal(setBooklet.rounds.map(row => row.level), [1, 2, 3, 4, 5]);
    // Private content must be authorized at the origin, even when an attacker
    // knows the exact corrected-image rehearsal identifier.
    const question = { ...earlyQuestions.find(row => row.set_id === 'L1' && row.level === 2), _id: 'preview-L1-2' };
    const instanceId = '11111111-2222-4333-8444-555555555555';
    const privateData = generatePrivate(question, { _id: claims.sid, event_run_id: 'rehearsal' }, instanceId);
    const rehearsal = await PuzzleRehearsal.create({ owner: claims.sid, question_id: question._id, instance_id: instanceId,
      kind: question.puzzle_type, private_data: privateData, expires_at: new Date(Date.now() + 60000) });
    const selectedBooklet = `/api/admin/answer-booklet?set_id=L1&level=2&rehearsal_id=${rehearsal._id}`;
    await request(selectedBooklet, 401); await request(selectedBooklet, 401, { token: participant });
    const privateBooklet = await request(selectedBooklet, 200, { token: organizer.token });
    equal(privateBooklet.rounds.length, 1); equal(privateBooklet.rounds[0].answer, privateData.passphrase);
    equal(privateBooklet.rounds[0].corrected_source, privateData.corrected);
    await request(`/api/admin/answer-booklet?set_id=L2&level=2&rehearsal_id=${rehearsal._id}`, 409, { token: organizer.token });
    await PuzzleRehearsal.updateOne({ _id: rehearsal._id }, { $set: { owner: 'another-organizer-session' } });
    await request(selectedBooklet, 404, { token: organizer.token });
    await PuzzleRehearsal.updateOne({ _id: rehearsal._id }, { $set: { owner: claims.sid, expires_at: new Date(0) } });
    await request(selectedBooklet, 404, { token: organizer.token });
    for (const token of [
      jwt.sign({ ...claims, iss: 'wrong-issuer' }, process.env.JWT_ADMIN_SECRET),
      jwt.sign({ ...claims, aud: 'participant' }, process.env.JWT_ADMIN_SECRET),
      jwt.sign({ ...claims, role: 'team' }, process.env.JWT_ADMIN_SECRET),
      jwt.sign(claims, process.env.JWT_ADMIN_SECRET, { algorithm: 'HS384' }),
      jwt.sign({ ...claims, exp: 1 }, process.env.JWT_ADMIN_SECRET)
    ]) await request(booklet, 401, { token });
    await request('/api/admin/answer-booklet?set_id=L9', 400, { token: organizer.token });
    await request('/api/admin/answer-booklet?set_id=L1&level[]=1', 400, { token: organizer.token });
    await request('/api/admin/logout', 200, { token: organizer.token, method: 'POST', body: {} });
    await request('/api/admin/verify', 401, { token: organizer.token });
    await request(booklet, 401, { token: organizer.token });
    equal(!!(await AdminSession.findOne({ session_id: claims.sid })).revoked_at, true);
    const second = await login();
    await AdminSession.updateOne({ session_id: jwt.decode(second.token).sid }, { $set: { expires_at: new Date(0) } });
    await request(booklet, 401, { token: second.token });
    // Two successful logins also reserve the shared counter; the ninth wrong
    // attempt is blocked by Mongo before the process-local failure cap is hit.
    for (let index = 0; index < 8; index += 1) await request('/api/admin/login', 401,
      { method: 'POST', body: { username: 'admin', password: 'wrong' } });
    await request('/api/admin/login', 429, { method: 'POST', body: { username: 'admin', password: 'wrong' } });
    const attempts = await AdminAccessAttempt.find({}).lean();
    equal(attempts.length, 1); equal(attempts[0].count, 11);
    equal(JSON.stringify(attempts).includes('127.0.0.1'), false);
    console.log(JSON.stringify({ target: 'ephemeral-loopback-database', assertions, result: 'passed', productionWrites: 0 }));
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); await database.stop();
  }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
