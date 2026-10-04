// Actual HTTP and transactional question installation against an ephemeral
// loopback replica. This script never reads dotenv or production credentials.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
async function run() {
  for (const key of Object.keys(process.env)) {
    if (/^(MONGODB_URI|JWT_|ADMIN_PASSWORD|AARAMBH_INTEGRATION_SECRET|SMTP_|GMAIL_|CLOUDINARY_)/.test(key)) delete process.env[key];
  }
  const { MongoMemoryReplSet } = require(process.env.AARAMBH_TEST_MEMORY_SERVER || 'mongodb-memory-server');
  const mongoose = require('mongoose');
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' },
    binary: process.env.AARAMBH_TEST_MONGOD ? { systemBinary: process.env.AARAMBH_TEST_MONGOD } : undefined });
  let server;
  const serve = process.argv.includes('--serve');
  let assertions = 0;
  const equal = (actual, expected, message) => { assertions++; assert.deepEqual(actual, expected, message); };
  try {
    const uri = replica.getUri('interactive_rounds_loopback');
    assert.ok(uri.startsWith('mongodb://127.0.0.1:'));
    Object.assign(process.env, { NODE_ENV: 'test', MONGODB_URI: uri,
      JWT_TEAM_SECRET: 'loopback-puzzle-participant-secret-1234567890', JWT_ADMIN_SECRET: 'loopback-puzzle-organizer-secret-1234567890',
      ADMIN_PASSWORD: 'LocalPuzzleOrganizer!123', FRONTEND_URL: 'http://127.0.0.1:5303' });
    await mongoose.connect(uri);
    const app = require('../app');
    const Team = require('../models/Team'), Question = require('../models/Question'), QuizState = require('../models/QuizState');
    const { puzzleQuestions, organizerWitness, organizerDiscoveryWitness } = require('../services/interactivePuzzles');
    const { installInteractiveQuestions } = require('../services/installInteractiveQuestions');
    const { hashAccessCode } = require('../services/accessCodes');
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    const initial = ['L1', 'L2', 'L3'].flatMap(set_id => Array.from({ length: 5 }, (_, i) => ({
      set_id, level: i + 1, points: (i + 1) * 100, question_text: `Loopback round ${i + 1}`, correct_answer: `proof-${i + 1}` })));
    await Question.insertMany(initial);
    await QuizState.create({ key: 'global', status: 'not_started' });
    const originalIds = (await Question.find({}).lean()).map(q => String(q._id)).sort();
    equal((await installInteractiveQuestions()).changed_questions, 6);
    equal(await Question.countDocuments({ puzzle_type: { $exists: true } }), 0, 'Preview makes no question changes');
    await assert.rejects(installInteractiveQuestions({ apply: true, backup: async () => { throw new Error('Simulated backup failure'); } }), /Simulated backup failure/); assertions++;
    equal(await Question.countDocuments({ archived: true }), 0, 'Backup failure rolls back question changes');
    equal((await QuizState.findOne({ key: 'global' }).lean()).config_version, 0, 'Backup failure rolls back the state claim');
    const backups = [];
    equal((await installInteractiveQuestions({ apply: true, backup: async rows => backups.push(rows) })).changed_questions, 6);
    equal(backups[0].length, 6, 'Original questions backed up before replacement');
    equal(await Question.countDocuments(), 21);
    equal(await Question.countDocuments({ archived: { $ne: true } }), 15);
    const afterIds = new Set((await Question.find({}).lean()).map(q => String(q._id)));
    equal(originalIds.every(id => afterIds.has(id)), true, 'Every previous question ID retained');
    equal(await Question.countDocuments({ archived: true }), 6);
    equal((await installInteractiveQuestions({ apply: true, backup: async () => assert.fail('Already installed') })).changed_questions, 0);
    for (const set_id of ['L1', 'L2', 'L3']) {
      await Team.create({ team_name: `Puzzle Set ${set_id.slice(1)}`, leader_name: 'Loopback Leader', email: `${set_id.toLowerCase()}@example.test`,
        members: ['Observer', 'Builder'], question_set_id: set_id, access_code_hash: await hashAccessCode('LoopbackTeamCode!123') });
    }
    server = await new Promise(resolve => { const instance = app.listen(serve ? 5302 : 0, '127.0.0.1', () => resolve(instance)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    async function request(route, expected, { method = 'GET', token, body } = {}) {
      const response = await fetch(base + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      equal(response.status, expected, `${method} ${route}`);
      return response.json();
    }
    await request('/api/admin/puzzles', 401);
    const organizer = await request('/api/admin/login', 200, { method: 'POST', body: { username: 'admin', password: process.env.ADMIN_PASSWORD } });
    const preview = await request('/api/admin/puzzles', 200, { token: organizer.token });
    equal(preview.questions.length, 6);
    for (const publicQuestion of preview.questions) {
      equal('correct_answer' in publicQuestion, false);
      const question = { ...puzzleQuestions.find(q => `preview-${q.set_id}-${q.level}` === publicQuestion._id), _id: publicQuestion._id };
      const witness = organizerWitness(question, { _id: 'organizer-preview', event_run_id: 'organizer-preview-v1' });
      const discovery = organizerDiscoveryWitness(question, { _id: 'organizer-preview', event_run_id: 'organizer-preview-v1' });
      if (discovery) {
        equal(publicQuestion.puzzle.locked, true);
        equal('instructions' in publicQuestion.puzzle, false);
        equal('nodes' in publicQuestion.puzzle || 'pieces' in publicQuestion.puzzle, false);
        await request(`/api/admin/puzzles/${question._id}/check`, 409, { method: 'POST', token: organizer.token, body: { puzzle_submission: witness } });
        await request(`/api/admin/puzzles/${question._id}/discover`, 400, { method: 'POST', token: organizer.token, body: { discovery_submission: { ...discovery, url: 'https://example.test/wrong' } } });
        const unlocked = await request(`/api/admin/puzzles/${question._id}/discover`, 200, { method: 'POST', token: organizer.token, body: { discovery_submission: discovery } });
        equal(Boolean(unlocked.puzzle.locked), false);
        witness.discovery_submission = discovery;
      }
      equal((await request(`/api/admin/puzzles/${question._id}/check`, 200, { method: 'POST', token: organizer.token, body: { puzzle_submission: witness } })).valid, true);
    }
    equal(await Team.countDocuments({ current_level: { $ne: 0 } }), 0, 'Preview leaves all team progress untouched');
    equal(await require('../models/EventLog').countDocuments(), 0, 'Preview leaves event ledger untouched');
    await request('/api/quiz/start', 200, { method: 'POST', token: organizer.token, body: {} });
    const answers = {};
    for (const set_id of ['L1', 'L2', 'L3']) {
      const leader = await request('/api/auth/login', 200, { method: 'POST', body: { email: `${set_id.toLowerCase()}@example.test`, accessCode: 'LoopbackTeamCode!123' } });
      await request('/api/admin/puzzles', 401, { token: leader.token });
      for (let level = 1; level <= 5; level++) {
        const payload = await request(`/api/questions/${level}`, 200, { token: leader.token });
        equal('correct_answer' in payload.question, false);
        let body = { level, answer: `proof-${level}` };
        if (level >= 4) {
          const question = await Question.findById(payload.question._id).lean();
          const team = await Team.findOne({ email: `${set_id.toLowerCase()}@example.test` }).lean();
          const witness = organizerWitness(question, team);
          const discovery = organizerDiscoveryWitness(question, team);
          equal(witness.instance_id, payload.question.puzzle.instance_id);
          await request('/api/progress/submit', 400, { method: 'POST', token: leader.token, body: { level, question_id: String(question._id), answer: '[interactive]' } });
          if (discovery) {
            equal(payload.question.puzzle.locked, true);
            await request('/api/progress/submit', 409, { method: 'POST', token: leader.token, body: { level, question_id: String(question._id), puzzle_submission: witness } });
            await request(`/api/questions/${question._id}/discover`, 400, { method: 'POST', token: leader.token, body: { discovery_submission: { ...discovery, url: 'https://example.test/wrong' } } });
            await request(`/api/questions/${question._id}/discover`, 400, { method: 'POST', token: leader.token, body: { discovery_submission: { ...discovery, instance_id: 'different-run' } } });
            const unlocked = await request(`/api/questions/${question._id}/discover`, 200, { method: 'POST', token: leader.token, body: { discovery_submission: discovery } });
            equal(Boolean(unlocked.puzzle.locked), false);
            const refreshed = await request(`/api/questions/${level}`, 200, { token: leader.token });
            equal(Boolean(refreshed.question.puzzle.locked), false, 'Discovery persists across reload');
          }
          await request('/api/progress/submit', 400, { method: 'POST', token: leader.token, body: { level, question_id: String(question._id), puzzle_submission: { ...witness, instance_id: 'another-team-or-run' } } });
          body = { level, question_id: String(question._id), puzzle_submission: witness };
          answers[`${set_id}-${level}`] = { question_id: String(question._id), puzzle_submission: witness };
        }
        const saved = await request('/api/progress/submit', 200, { method: 'POST', token: leader.token, body });
        equal(saved.team.current_level, level + 1);
        equal(saved.points_awarded, level * 100);
        // Keep the expanded gate checks within the real 15/minute team limit.
        // Replay rejection is exercised in every interactive round and round one.
        if (!(set_id === 'L1' && level === 2)) await request('/api/progress/submit', 409, { method: 'POST', token: leader.token, body });
      }
      const finished = await Team.findOne({ email: `${set_id.toLowerCase()}@example.test` }).lean();
      equal(finished.total_points, 1500); equal(finished.outcomes.length, 5);
      equal(finished.outcomes.filter(outcome => outcome.puzzle_type).length, 2);
    }
    // Simulate an attempted edit and prove the bank cannot change during play.
    const fence = await Question.findOne({ puzzle_type: 'fence' });
    await Question.updateOne({ _id: fence._id }, { $set: { question_text: 'Changed loopback text' } });
    await assert.rejects(installInteractiveQuestions({ apply: true, backup: async () => {} }), /stopped event/); assertions++;
    await request('/api/quiz/end', 200, { method: 'POST', token: organizer.token, body: {} });
    const oldText = (await Question.findById(fence._id).lean()).question_text;
    const archivedReport = await installInteractiveQuestions({ apply: true, backup: async () => {} });
    equal(archivedReport.changed_questions, 1);
    equal((await Question.findById(fence._id).lean()).question_text, oldText, 'Referenced content retained for history');
    equal((await Question.findById(fence._id).lean()).archived, true);
    equal(await Question.countDocuments({ archived: { $ne: true } }), 15);
    equal(await Question.countDocuments(), 22);
    const report = { result: 'passed', assertions, puzzle_completions: 6, completed_teams: 3, installer_transaction_checked: true,
      preview_score_writes: 0, production_writes: 0, target: 'ephemeral-loopback-replica' };
    if (process.env.INTERACTIVE_SMOKE_REPORT) {
      fs.mkdirSync(path.dirname(process.env.INTERACTIVE_SMOKE_REPORT), { recursive: true });
      fs.writeFileSync(process.env.INTERACTIVE_SMOKE_REPORT, JSON.stringify(report, null, 2) + '\n');
    }
    console.log(JSON.stringify(report));
    if (serve) {
      // These are test-only credentials and test-only puzzle solutions.
      const directory = path.join(__dirname, '..', '..', '.private');
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'loopback-puzzle-witnesses.json'), JSON.stringify({ preview: preview.questions.map(publicQuestion => {
        const question = { ...puzzleQuestions.find(q => `preview-${q.set_id}-${q.level}` === publicQuestion._id), _id: publicQuestion._id };
        return { id: question._id, witness: organizerWitness(question, { _id: 'organizer-preview', event_run_id: 'organizer-preview-v1' }),
          discovery: organizerDiscoveryWitness(question, { _id: 'organizer-preview', event_run_id: 'organizer-preview-v1' }) };
      }), team: answers }, null, 2));
      await Question.updateOne({ _id: fence._id }, { $set: { question_text: puzzleQuestions.find(q => q.puzzle_type === 'fence').question_text } });
      await QuizState.updateOne({ key: 'global' }, { $set: { status: 'active', ended_at: null } });
      await Team.updateMany({}, { $set: { current_level: 4, event_open: true, total_points: 600, outcomes: [], round_started_at: new Date(), carry_ms: 0 } });
      console.log(`Loopback rehearsal API ready at ${base}; organizer username admin, test password LocalPuzzleOrganizer!123.`);
      await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); await replica.stop();
  }
}
run().catch(error => { console.error('Interactive loopback workflow failed:', error.message); process.exitCode = 1; });
