// Real HTTP and MongoDB transactions against an ephemeral loopback replica only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function run() {
  for (const key of Object.keys(process.env)) if (/^(MONGODB_URI|JWT_|ADMIN_PASSWORD|EARLY_ROUND_SECRET|AARAMBH_INTEGRATION_SECRET)/.test(key)) delete process.env[key];
  const { MongoMemoryReplSet } = require(process.env.AARAMBH_TEST_MEMORY_SERVER || 'mongodb-memory-server');
  const mongoose = require('mongoose');
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' }, binary: process.env.AARAMBH_TEST_MONGOD ? { systemBinary: process.env.AARAMBH_TEST_MONGOD } : undefined });
  let server; const serve = process.argv.includes('--serve'); let checks = 0;
  const equal = (a,b,label) => { checks++; assert.deepEqual(a,b,label); };
  try {
    const uri = replica.getUri('early_rounds_loopback'); assert.ok(uri.startsWith('mongodb://127.0.0.1:'));
    Object.assign(process.env, { NODE_ENV: 'test', MONGODB_URI: uri,
      JWT_TEAM_SECRET: 'loopback-early-team-secret-1234567890', JWT_ADMIN_SECRET: 'loopback-early-admin-secret-1234567890',
      EARLY_ROUND_SECRET: 'loopback-early-instance-secret-1234567890', ADMIN_PASSWORD: 'LocalPuzzleOrganizer!123', FRONTEND_URL: 'http://127.0.0.1:5313' });
    await mongoose.connect(uri);
    const app = require('../app');
    const Team = require('../models/Team'), Question = require('../models/Question'), QuizState = require('../models/QuizState'), State = require('../models/RoundPuzzleState');
    const { hashAccessCode } = require('../services/accessCodes');
    const { installEarlyQuestions } = require('../services/installEarlyQuestions');
    const e = require('../services/earlyRoundPuzzles');
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    const originals = await Question.insertMany(['L1','L2','L3'].flatMap(set_id => [1,2,3,4,5].map(level => ({ set_id, level, points: level * 100, question_text: 'Previous round question', correct_answer: 'retained-original' }))));
    await QuizState.create({ key: 'global', status: 'not_started' });
    equal((await installEarlyQuestions()).changed_questions, 9); equal(await Question.countDocuments(), 15);
    await assert.rejects(installEarlyQuestions({ apply: true, backup: async () => { throw new Error('Synthetic backup failure'); } }), /backup failure/); checks++;
    equal(await Question.countDocuments({ archived: true }), 0, 'Failed backup rolls back migration');
    let backups;
    equal((await installEarlyQuestions({ apply: true, backup: async rows => { backups = rows; } })).changed_questions, 9);
    equal(backups.length, 9); equal(await Question.countDocuments(), 24); equal(await Question.countDocuments({ archived: { $ne: true } }), 15);
    equal(await Question.countDocuments({ _id: { $in: originals.map(q => q._id) } }), 15, 'Historic question IDs retained');
    equal((await installEarlyQuestions({ apply: true })).changed_questions, 0, 'Installer idempotent');
    for (const set_id of ['L1','L2','L3']) await Team.create({ team_name: `Early ${set_id}`, leader_name: 'Leader', members: ['Builder'],
      email: `${set_id.toLowerCase()}@example.test`, question_set_id: set_id, access_code_hash: await hashAccessCode('LoopbackTeamCode!123') });
    await Team.create({ team_name: 'Durable Limit', leader_name: 'Leader', members: ['Builder'], email: 'limit@example.test',
      question_set_id: 'L1', access_code_hash: await hashAccessCode('LoopbackTeamCode!123') });
    server = await new Promise(resolve => { const s = app.listen(serve ? 5312 : 0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    async function request(route, expected, { method = 'GET', token, body, raw = false } = {}) {
      const response = await fetch(base + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      equal(response.status, expected, `${method} ${route}`);
      if (raw) return { response, bytes: Buffer.from(await response.arrayBuffer()) };
      return { response, data: await response.json() };
    }
    const admin = (await request('/api/admin/login', 200, { method: 'POST', body: { username: 'admin', password: process.env.ADMIN_PASSWORD } })).data;
    await request('/api/admin/answer-booklet?set_id=L1', 401);
    const rehearsalEvidence = [];
    for (const set_id of ['L1','L2','L3']) {
      const listed = (await request(`/api/admin/puzzles?set_id=${set_id}`, 200, { token: admin.token })).data;
      equal(listed.questions.length, 5); equal(listed.questions.every(q => q.set_id === set_id), true);
      const booklet = await request(`/api/admin/answer-booklet?set_id=${set_id}`, 200, { token: admin.token });
      equal(booklet.data.rounds.length, 5); equal(booklet.response.headers.get('cache-control').includes('no-store'), true);
      for (let level = 1; level <= 3; level++) {
        const created = (await request('/api/admin/rehearsals', 200, { method: 'POST', token: admin.token, body: { question_id: `preview-${set_id}-${level}` } })).data;
        const reference = (await request(`/api/admin/answer-booklet?set_id=${set_id}&level=${level}&rehearsal_id=${created.rehearsal_id}`, 200, { token: admin.token })).data.rounds[0];
        const root = `/api/admin/rehearsals/${created.rehearsal_id}`;
        if (level === 1) { const result = await request(root + '/signal', 200, { method: 'POST', token: admin.token, body: { instance_id: created.puzzle.instance_id } }); equal(result.response.headers.get('x-escape-signal'), String(reference.values.Y)); }
        if (level === 2) {
          await request(root + `/artifacts/photo-2?instance_id=${created.puzzle.instance_id}`, 409, { token: admin.token });
          await request(root + '/repair', 400, { method: 'POST', token: admin.token, body: { instance_id: created.puzzle.instance_id, source: created.puzzle.source, marker: reference.marker } });
          await request(root + '/repair', 200, { method: 'POST', token: admin.token, body: { instance_id: created.puzzle.instance_id, source: reference.corrected_source, marker: reference.marker } });
          const photo = await request(root + `/artifacts/photo-2?instance_id=${created.puzzle.instance_id}`, 200, { token: admin.token, raw: true }); equal(photo.bytes.includes(Buffer.from(reference.answer)), true);
        }
        await request(root + '/check', 200, { method: 'POST', token: admin.token, body: { puzzle_submission: reference.reference_submission } });
        rehearsalEvidence.push({ set_id, level, ...created, reference });
      }
    }
    equal(await Team.countDocuments({ current_level: { $ne: 0 } }), 0, 'Rehearsals do not advance teams');
    equal(await require('../models/EventLog').countDocuments(), 0, 'Rehearsals do not write competition logs');
    equal(await require('../models/MappedQuestion').countDocuments(), 0, 'Rehearsals do not allocate team questions');
    const anotherAdmin = (await request('/api/admin/login', 200, { method: 'POST', body: { username: 'admin', password: process.env.ADMIN_PASSWORD } })).data;
    await request(`/api/admin/answer-booklet?set_id=L1&level=1&rehearsal_id=${rehearsalEvidence[0].rehearsal_id}`, 404, { token: anotherAdmin.token });
    await request('/api/quiz/start', 200, { method: 'POST', token: admin.token, body: {} });
    await assert.rejects(installEarlyQuestions(), /stopped/); checks++;
    const tokens = {}, evidence = [];
    for (const set_id of ['L1','L2','L3']) {
      const login = (await request('/api/auth/login', 200, { method: 'POST', body: { email: `${set_id.toLowerCase()}@example.test`, accessCode: 'LoopbackTeamCode!123' } })).data; tokens[set_id] = login.token;
      await request(`/api/admin/answer-booklet?set_id=${set_id}`, 401, { token: login.token });
      for (let level = 1; level <= 3; level++) {
        const payload = (await request(`/api/questions/${level}`, 200, { token: login.token })).data;
        const question = await Question.findById(payload.question._id).lean(), puzzle = payload.question.puzzle;
        const state = await State.findOne({ instance_id: puzzle.instance_id }).select('+private_data');
        const root = `/api/round-puzzles/${question._id}`;
        equal((await request(`/api/questions/${level}`, 200, { token: login.token })).data.question.puzzle.instance_id, puzzle.instance_id, 'Refresh preserves instance');
        equal(JSON.stringify(payload).includes(state.private_data.answer || state.private_data.passphrase), false, 'No final answer in participant payload');
        await request(`/api/questions/${level + 1}`, 403, { token: login.token });
        if (level === 1) {
          const signal = await request(root + '/signal', 200, { method: 'POST', token: login.token, body: { instance_id: puzzle.instance_id } });
          equal(signal.data, { status: 'awake' }); equal(signal.response.headers.get('x-escape-signal'), String(state.private_data.y));
        }
        if (level === 2) {
          await request(root + `/artifacts/photo-2?instance_id=${puzzle.instance_id}`, 409, { token: login.token });
          await request('/api/progress/submit', 400, { method: 'POST', token: login.token, body: { level, question_id: String(question._id), puzzle_submission: { instance_id: puzzle.instance_id, code: state.private_data.passphrase } } });
          await request(root + '/repair', 400, { method: 'POST', token: login.token, body: { instance_id: puzzle.instance_id, source: '<svg onload="alert(1)"/>', marker: state.private_data.marker } });
          await request(root + '/repair', 200, { method: 'POST', token: login.token, body: { instance_id: puzzle.instance_id, source: state.private_data.corrected, marker: state.private_data.marker } });
          equal((await request(`/api/questions/${level}`, 200, { token: login.token })).data.question.puzzle.stage, 'unlocked');
          const photo = await request(root + `/artifacts/photo-2?instance_id=${puzzle.instance_id}`, 200, { token: login.token, raw: true }); equal(photo.bytes.includes(Buffer.from(state.private_data.passphrase)), true);
          await request(root + `/artifacts/corrected-svg?instance_id=${puzzle.instance_id}`, 409, { token: login.token });
        }
        if (level === 3) {
          for (const input of puzzle.blocked_letters) await request(root + '/probe', 400, { method: 'POST', token: login.token, body: { instance_id: puzzle.instance_id, input, idempotency_key: 'blocked-request' } });
          const concurrent = await Promise.all(Array.from({ length: 10 }, (_, i) => fetch(base + root + '/probe', { method: 'POST', headers: { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ instance_id: puzzle.instance_id, input: 'A', idempotency_key: `parallel-${i}` }) })));
          equal(concurrent.filter(r => r.status === 200).length, 6, 'Concurrent probes never exceed six');
          const updated = (await request(`/api/questions/${level}`, 200, { token: login.token })).data.question.puzzle;
          equal(updated.remaining_probes, 0); equal(updated.probe_history.length, 6);
          const first = updated.probe_history[0];
          const retry = (await request(root + '/probe', 200, { method: 'POST', token: login.token, body: { instance_id: puzzle.instance_id, input: first.input, idempotency_key: first.idempotency_key } })).data;
          equal(retry.puzzle.remaining_probes, 0);
          await request(root + '/probe', 400, { method: 'POST', token: login.token, body: { instance_id: puzzle.instance_id, input: 'B', idempotency_key: first.idempotency_key } });
        }
        const code = state.private_data.answer || state.private_data.passphrase;
        const saved = (await request('/api/progress/submit', 200, { method: 'POST', token: login.token, body: { level, question_id: String(question._id), puzzle_submission: { instance_id: puzzle.instance_id, code } } })).data;
        equal(saved.team.current_level, level + 1); equal(saved.points_awarded, level * 100);
        await request(root + '/signal', 409, { method: 'POST', token: login.token, body: { instance_id: puzzle.instance_id } });
        evidence.push({ set_id, level, question_id: String(question._id), instance_id: puzzle.instance_id });
      }
    }
    // Team ownership and ended-event checks remain enforced for saved instances/artifacts.
    const other = evidence.find(q => q.set_id === 'L1' && q.level === 2);
    await request(`/api/round-puzzles/${other.question_id}/artifacts/photo-2?instance_id=${other.instance_id}`, 409, { token: tokens.L2 });
    const limitToken = (await request('/api/auth/login', 200, { method: 'POST', body: { email: 'limit@example.test', accessCode: 'LoopbackTeamCode!123' } })).data.token;
    const limited = (await request('/api/questions/1', 200, { token: limitToken })).data.question;
    const limitState = await State.findOne({ instance_id: limited.puzzle.instance_id }).select('+private_data');
    const wrongCode = limitState.private_data.answer === '0000' ? '0001' : '0000';
    for (let i = 0; i < 13; i++) await request('/api/progress/submit', i === 12 ? 429 : 400, { method: 'POST', token: limitToken,
      body: { level: 1, question_id: limited._id, puzzle_submission: { instance_id: limited.puzzle.instance_id, code: wrongCode } } });
    equal((await State.findById(limitState._id)).answer_attempts, 12, 'Durable final-answer bucket is shared and bounded');
    await request('/api/auth/login', 200, { method: 'POST', body: { email: 'limit@example.test', accessCode: 'LoopbackTeamCode!123' } });
    await request(`/api/round-puzzles/${limited._id}/signal`, 401, { method: 'POST', token: limitToken, body: { instance_id: limited.puzzle.instance_id } });
    await request('/api/quiz/end', 200, { method: 'POST', token: admin.token, body: {} });
    await request(`/api/round-puzzles/${other.question_id}/artifacts/photo-2?instance_id=${other.instance_id}`, 403, { token: tokens.L1 });
    await request('/api/admin/logout', 200, { method: 'POST', token: anotherAdmin.token, body: {} });
    await request('/api/admin/answer-booklet?set_id=L1', 401, { token: anotherAdmin.token });
    console.log(`Early round HTTP workflow: ${checks} assertions passed; 9 questions, digital repair, persistent probes, private booklet.`);
    if (serve) {
      const now = new Date(); await QuizState.updateOne({ key: 'global' }, { $set: { status: 'active', ended_at: null, started_at: now, deadline: new Date(now.getTime() + 2 * 3600000) } });
      await Team.updateMany({}, { $set: { current_level: 1, total_points: 0, level_points: {}, outcomes: [], event_open: true, round_started_at: now, start_time: now, carry_ms: 0, overtime_continued_at: null } });
      const folder = path.join(__dirname, '..', '..', '.private'); fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, 'early-round-loopback.json'), JSON.stringify({ rehearsalEvidence, evidence }, null, 2));
      console.log('Loopback ready at http://127.0.0.1:5312; synthetic organizer and leader credentials only.');
      await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
    }
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await replica.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
