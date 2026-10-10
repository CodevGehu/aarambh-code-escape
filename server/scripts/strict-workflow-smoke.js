// Actual HTTP release check. It only uses a new loopback test replica and fake keys.
// No dotenv, cloud database, mail provider or production credentials are loaded.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function run() {
  for (const key of Object.keys(process.env)) {
    if (/^(MONGODB_URI|JWT_|ADMIN_PASSWORD|EARLY_ROUND_SECRET|AARAMBH_INTEGRATION_SECRET|SMTP_|GMAIL_|CLOUDINARY_)/.test(key)) delete process.env[key];
  }
  const memoryModule = process.env.AARAMBH_TEST_MEMORY_SERVER || require.resolve('mongodb-memory-server');
  const { MongoMemoryReplSet } = require(memoryModule);
  const mongoose = require('mongoose');
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' },
    binary: process.env.AARAMBH_TEST_MONGOD ? { systemBinary: process.env.AARAMBH_TEST_MONGOD } : undefined });
  let server;
  let checks = 0;
  const check = (value, message) => { checks++; assert.ok(value, message); };
  const equal = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message); };
  try {
    const uri = replica.getUri('game_strict_workflow');
    check(uri.startsWith('mongodb://127.0.0.1:'), 'Database must be loopback');
    Object.assign(process.env, { NODE_ENV: 'test', MONGODB_URI: uri,
      JWT_TEAM_SECRET: 'local-only-participant-secret-1234567890',
      JWT_ADMIN_SECRET: 'local-only-organizer-secret-1234567890',
      ADMIN_PASSWORD: 'LocalOnlyOrganizer!1234567890',
      AARAMBH_INTEGRATION_SECRET: 'local-only-bridge-secret-1234567890' });
    await mongoose.connect(uri);
    const app = require('../app');
    const Team = require('../models/Team');
    const Question = require('../models/Question');
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    await Question.insertMany(Array.from({ length: 5 }, (_, index) => ({
      level: index + 1, set_id: 'synthetic-set', question_text: `Synthetic question ${index + 1}`,
      correct_answer: `synthetic answer ${index + 1}`, points: 300 })));
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (route, expected, { method = 'GET', token, body, binary = false } = {}) => {
      const response = await fetch(base + route, { method, headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }, ...(body ? { body: JSON.stringify(body) } : {}) });
      equal(response.status, expected, `${method} ${route}`);
      return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
    };
    equal((await request('/api/health', 200)).status, 'ready');
    for (const route of ['/api/auth/me', '/api/questions/1', '/api/progress/state', '/api/admin/teams', '/api/admin/logs', '/api/export/excel', '/api/quiz/config']) await request(route, 401);
    await request('/api/quiz/start', 401, { method: 'POST', body: {} });
    const payload = { registration_id: '507f1f77bcf86cd799439011', version: 1, status: 'approved',
      team_name: 'Synthetic Smoke Team', leader_name: 'Synthetic Leader', email: 'leader@example.test',
      access_code: 'SyntheticLeaderAccessCode!123456', members: ['Synthetic Leader', 'Synthetic Second', 'Synthetic Third'] };
    const bridge = process.env.AARAMBH_INTEGRATION_SECRET;
    const deliver = (body, expected = 200, token = bridge) => request('/api/integrations/aarambh/teams', expected, { method: 'POST', token, body });
    await deliver(payload, 401, 'forged-bridge-token');
    await deliver({ ...payload, registration_id: { $ne: null } }, 400);
    await deliver(payload);
    await deliver(payload);
    equal(await Team.countDocuments({}), 1, 'Duplicate synchronization must be idempotent');
    await request('/api/auth/login', 400, { method: 'POST', body: { email: { $ne: null }, accessCode: payload.access_code } });
    await request('/api/auth/login', 401, { method: 'POST', body: { email: payload.email, accessCode: 'wrong-code' } });
    const login = () => request('/api/auth/login', 200, { method: 'POST', body: { email: payload.email, accessCode: payload.access_code } });
    let signedIn = await login();
    check(!JSON.stringify(signedIn.team).includes('access_code_hash'), 'No hash in login');
    check(!JSON.stringify(signedIn.team).includes('active_session_id'), 'No session ID in login');
    await request('/api/questions/1', 403, { token: signedIn.token });
    await request('/api/admin/login', 401, { method: 'POST', body: { username: 'admin', password: 'wrong-password' } });
    const organizer = await request('/api/admin/login', 200, { method: 'POST', body: { username: 'admin', password: process.env.ADMIN_PASSWORD } });
    await request('/api/quiz/start', 401, { method: 'POST', token: signedIn.token, body: {} });
    equal((await request('/api/quiz/start', 200, { method: 'POST', token: organizer.token, body: {} })).status, 'active');
    await request('/api/quiz/start', 409, { method: 'POST', token: organizer.token, body: {} });
    await request('/api/questions/2', 403, { token: signedIn.token });
    const previousToken = signedIn.token;
    signedIn = await login();
    await request('/api/auth/me', 401, { token: previousToken });
    for (let level = 1; level <= 5; level++) {
      const question = await request(`/api/questions/${level}`, 200, { token: signedIn.token });
      const restored = await request(`/api/questions/${level}`, 200, { token: signedIn.token });
      equal(question.question, restored.question, 'Refreshing preserves the assigned question');
      check(!JSON.stringify(question).includes('correct_answer'), 'Answer must remain hidden');
      await request('/api/progress/submit', 400, { method: 'POST', token: signedIn.token, body: { level, answer: 'incorrect' } });
      const saved = await request('/api/progress/submit', 200, { method: 'POST', token: signedIn.token, body: { level, answer: `synthetic answer ${level}` } });
      equal(saved.team.current_level, level + 1);
      await request('/api/progress/submit', 409, { method: 'POST', token: signedIn.token, body: { level, answer: `synthetic answer ${level}` } });
    }
    const completed = await Team.findOne({ email: payload.email });
    equal(completed.current_level, 6);
    equal(completed.outcomes.length, 5);
    equal(completed.total_points, 1500);
    const leaderboard = await request('/api/leaderboard', 200);
    check(JSON.stringify(leaderboard).includes(payload.team_name), 'Completed paid team appears in leaderboard');
    // Exercise the real controller and ExcelJS zip writer with the patched uuid override.
    const spreadsheet = await request('/api/export/excel', 200, { token: organizer.token, binary: true });
    equal(spreadsheet.subarray(0, 2).toString(), 'PK', 'Export is an XLSX zip');
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(spreadsheet);
    equal(workbook.worksheets[0].rowCount, 2);
    equal(workbook.worksheets[0].getCell('B2').value, payload.team_name);
    equal(workbook.worksheets[0].getCell('E2').value, 1500);
    await deliver({ registration_id: payload.registration_id, version: 2, status: 'revoked' });
    await request('/api/auth/me', 401, { token: signedIn.token });
    await request('/api/auth/login', 401, { method: 'POST', body: { email: payload.email, accessCode: payload.access_code } });
    await deliver(payload);
    check(!JSON.stringify(await request('/api/leaderboard', 200)).includes(payload.team_name), 'Revoked team disappears from rankings');
    equal((await Team.findById(completed._id)).total_points, 1500, 'Score remains for audit after revocation');
    const report = { checkedAt: new Date().toISOString(), target: 'ephemeral-loopback-replica', assertions: checks,
      result: 'passed', productionWrites: 0, emailsSent: 0, excelExportRows: 1 };
    if (process.env.GAME_SMOKE_REPORT) {
      fs.mkdirSync(path.dirname(process.env.GAME_SMOKE_REPORT), { recursive: true });
      fs.writeFileSync(process.env.GAME_SMOKE_REPORT, JSON.stringify(report, null, 2) + '\n');
    }
    console.log(JSON.stringify(report));
  } finally {
    try {
      if (server) await new Promise(resolve => server.close(resolve));
    } finally {
      try { await mongoose.disconnect(); }
      finally { await replica.stop(); }
    }
  }
}
run().catch(error => { console.error('Strict isolated workflow failed:', error.message); process.exitCode = 1; });
