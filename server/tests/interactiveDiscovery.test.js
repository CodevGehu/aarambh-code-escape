const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { getPuzzle, puzzleQuestions, organizerWitness, organizerDiscoveryWitness } = require('../services/interactivePuzzles');

function loadWithMocks(file, mocks) {
  const filename = require.resolve(path.join(__dirname, '..', file));
  const replaced = Object.entries(mocks).map(([relative, exports]) => {
    const id = require.resolve(path.join(__dirname, '..', relative));
    return { id, exports, prior: require.cache[id] };
  });
  const priorUnit = require.cache[filename];
  try {
    for (const { id, exports } of replaced) require.cache[id] = { id, filename: id, loaded: true, exports };
    delete require.cache[filename]; return require(filename);
  } finally {
    if (priorUnit) require.cache[filename] = priorUnit; else delete require.cache[filename];
    for (const { id, prior } of replaced) { if (prior) require.cache[id] = prior; else delete require.cache[id]; }
  }
}
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });

function fixture(type = 'fence', { overtime = false, expireDuringSave = false, changeDuringSave = false } = {}) {
  const question = { ...puzzleQuestions.find(item => item.puzzle_type === type), _id: '64aa00000000000000000004' };
  const now = new Date(), started = new Date(now.getTime() - (overtime ? 31 : 1) * 60000);
  const state = { key: 'global', status: 'active', run_id: 'discovery-run', started_at: started,
    deadline: new Date(started.getTime() + 120 * 60000) };
  const team = { _id: '64aa00000000000000000001', email: 'leader@example.test', current_level: question.level,
    question_set_id: question.set_id, event_run_id: state.run_id, start_time: started, round_started_at: started,
    total_points: 600, level_points: {}, carry_ms: 0, outcomes: [], progress_version: 0,
    active_session_id: 'team-session', event_open: true, overtime_continued_at: null };
  const mapping = { _id: '64aa00000000000000000002', team_id: team._id, level: question.level,
    selected_question_id: question._id, discovery_instance_id: null, discovered_at: null };
  const mappingWrites = [], scoreWrites = [], logs = [];
  const clone = value => structuredClone(value);
  const mocks = {
    'models/QuizState.js': { findOne: async () => clone(state) },
    'models/Team.js': {
      findOne: async filter => { assert.deepEqual(filter, { email: team.email }); return clone(team); },
      findById: async id => { assert.equal(id, team._id); return clone(team); },
      findOneAndUpdate: async (filter, update) => {
        scoreWrites.push(clone({ filter, update }));
        if (filter.current_level !== team.current_level || filter.progress_version !== team.progress_version ||
          filter.event_run_id !== team.event_run_id || filter.active_session_id !== team.active_session_id || !team.event_open) return null;
        for (const [key, value] of Object.entries(update.$set || {})) {
          if (key.startsWith('level_points.')) team.level_points[key.split('.')[1]] = value;
          else team[key] = value;
        }
        for (const [key, value] of Object.entries(update.$inc || {})) team[key] += value;
        if (update.$push?.outcomes) team.outcomes.push(update.$push.outcomes);
        return clone(team);
      }
    },
    'models/Question.js': { findById: async id => String(id) === question._id ? clone(question) : null },
    'models/MappedQuestion.js': {
      findOne: async filter => Object.entries(filter).every(([key, value]) => String(mapping[key]) === String(value)) ? clone(mapping) : null,
      findOneAndUpdate: async (filter, update) => {
        mappingWrites.push(clone({ filter, update }));
        if (!Object.entries(filter).every(([key, value]) => String(mapping[key]) === String(value))) return null;
        Object.assign(mapping, clone(update.$set));
        if (expireDuringSave) state.status = 'ended';
        if (changeDuringSave) team.current_level++;
        return clone(mapping);
      }
    },
    'models/Result.js': { findOneAndUpdate: async () => {} },
    'services/activityLog.js': { writeActivity: async entry => logs.push(entry), recordObservedTimeouts: async () => {} },
    'services/questionSets.js': { prepareTeamQuestionSets: () => assert.fail('Set is already assigned') }
  };
  const questions = loadWithMocks('controllers/questionController.js', mocks);
  const progress = loadWithMocks('controllers/progressController.js', mocks);
  const user = () => ({ email: team.email, sessionId: team.active_session_id });
  const readReq = () => ({ user: user(), params: { level: String(question.level), teamId: 'ignored-attacker-team' } });
  const discoverReq = () => ({ user: user(), params: { questionId: question._id },
    body: { discovery_submission: organizerDiscoveryWitness(question, team) } });
  const solveReq = () => ({ user: user(), received_at: now, body: { level: question.level,
    question_id: question._id, puzzle_submission: organizerWitness(question, team) } });
  return { ...questions, ...progress, state, team, question, mapping, mappingWrites, scoreWrites, logs,
    readReq, discoverReq, solveReq };
}

for (const type of ['fence', 'packing']) {
  test(`${type}: locked question exposes only clue identity, never source destination or workbench configuration`, async () => {
    const f = fixture(type), res = response(); await f.getQuestion(f.readReq(), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(Object.keys(res.body.question.puzzle).sort(), ['discovery', 'instance_id', 'locked', 'title', 'type', 'version']);
    assert.equal(res.body.question.puzzle.locked, true);
    const videoId = organizerDiscoveryWitness(f.question, f.team).url.split('/').pop();
    const serialized = JSON.stringify(res.body);
    for (const secret of [videoId, 'correct_answer', 'target_area', 'target_container_side', 'unit_vertices', 'fence_budget']) {
      assert.ok(!serialized.includes(secret), secret);
    }
    const privateTool = organizerDiscoveryWitness(f.question, f.team).tool_url;
    if (privateTool) for (const part of new URL(privateTool).pathname.split('/').filter(Boolean)) assert.ok(!serialized.includes(part));
    assert.equal(f.mappingWrites.length, 0); assert.equal(f.scoreWrites.length, 0);
  });

  test(`${type}: a verified source persists for refresh without changing scores, timers or progress`, async () => {
    const f = fixture(type), before = structuredClone(f.team), res = response();
    await f.discoverQuestion(f.discoverReq(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(f.mapping.discovery_instance_id, getPuzzle(f.question, f.team).instance_id);
    assert.ok(f.mapping.discovered_at instanceof Date); assert.deepEqual(f.team, before);
    assert.equal(f.scoreWrites.length, 0);
    const refreshed = response(); await f.getQuestion(f.readReq(), refreshed);
    assert.equal(refreshed.statusCode, 200); assert.notEqual(refreshed.body.question.puzzle.locked, true);
    assert.ok(type === 'fence' ? refreshed.body.question.puzzle.nodes.length : refreshed.body.question.puzzle.pieces.length);
    assert.equal(f.logs[0].action, 'resource_discovered');
    assert.ok(!JSON.stringify(f.logs).includes(f.discoverReq().body.discovery_submission.url));
  });

  test(`${type}: a valid puzzle artifact and a forged embedded discovery cannot bypass the persisted checkpoint`, async () => {
    const f = fixture(type), req = f.solveReq(), res = response();
    req.body.puzzle_submission.discovery_submission = organizerDiscoveryWitness(f.question, f.team);
    await f.submitProgress(req, res);
    assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'DISCOVERY_REQUIRED');
    assert.equal(f.team.total_points, 600); assert.equal(f.scoreWrites.length, 0);
  });

  test(`${type}: discovery unlock permits the normal authoritative puzzle completion`, async () => {
    const f = fixture(type), opened = response(), solved = response();
    await f.discoverQuestion(f.discoverReq(), opened); assert.equal(opened.statusCode, 200);
    await f.submitProgress(f.solveReq(), solved);
    assert.equal(solved.statusCode, 200); assert.equal(solved.body.points_awarded, f.question.level * 100);
    assert.equal(f.team.current_level, f.question.level + 1); assert.equal(f.team.outcomes.length, 1);
  });
}

test('wrong source URL and malformed discovery proof never write an approval', async () => {
  const rejected = [null, [], {}, { url: 'https://youtu.be/abcdefghijk' }, 'not an object'];
  for (const proof of rejected) {
    const f = fixture(), req = f.discoverReq(), res = response();
    req.body.discovery_submission = proof && !Array.isArray(proof) && typeof proof === 'object'
      ? { instance_id: getPuzzle(f.question, f.team).instance_id, ...proof } : proof;
    await f.discoverQuestion(req, res);
    assert.equal(res.statusCode, 400); assert.equal(res.body.code, 'INVALID_DISCOVERY'); assert.equal(f.mappingWrites.length, 0);
  }
});

test('packing requires discovery of the actual tool repository as well as the matching video', async () => {
  for (const tool_url of [undefined, 'https://github.com/unrelated/project',
    'https://github.com.evil.test/Flamethr0wer/polygon-packer',
    'https://name:password@github.com/Flamethr0wer/polygon-packer',
    'http://github.com/Flamethr0wer/polygon-packer', 'file:///Flamethr0wer/polygon-packer']) {
    const f = fixture('packing'), req = f.discoverReq(), res = response();
    req.body.discovery_submission.tool_url = tool_url;
    await f.discoverQuestion(req, res);
    assert.equal(res.statusCode, 400); assert.equal(res.body.code, 'INVALID_DISCOVERY'); assert.equal(f.mappingWrites.length, 0);
  }
});

test('discovery accepts source identity only, rejecting lookalike hosts, local/network schemes and ambiguous URLs', async () => {
  for (const url of ['https://youtube.com.evil.test/watch?v=PhvX-5ymga8', 'https://evil.test/?v=PhvX-5ymga8',
    'http://127.0.0.1/watch?v=PhvX-5ymga8', 'file:///PhvX-5ymga8', 'https://youtu.be:444/PhvX-5ymga8',
    'https://name:password@youtu.be/PhvX-5ymga8', 'https://youtube.com/watch?v=PhvX-5ymga8&v=other',
    'https://youtu.be/PhvX-5ymga8/unrelated', 'javascript:alert(1)']) {
    const f = fixture(), req = f.discoverReq(), res = response(); req.body.discovery_submission.url = url;
    await f.discoverQuestion(req, res);
    assert.equal(res.statusCode, 400, url); assert.equal(f.mappingWrites.length, 0);
  }
});

test('another team or earlier event proof cannot approve the current mapped question', async () => {
  for (const changed of [{ _id: 'another-team' }, { event_run_id: 'previous-run' }]) {
    const f = fixture(), req = f.discoverReq(), res = response();
    req.body.discovery_submission = organizerDiscoveryWitness(f.question, { ...f.team, ...changed });
    await f.discoverQuestion(req, res);
    assert.equal(res.statusCode, 400); assert.equal(f.mappingWrites.length, 0);
  }
});

test('a saved approval from a previous run or previous question version relocks both retrieval and completion', async () => {
  for (const change of ['run', 'question']) {
    const f = fixture(); f.mapping.discovery_instance_id = getPuzzle(f.question, f.team).instance_id;
    if (change === 'run') { f.state.run_id = 'new-run'; f.team.event_run_id = 'new-run'; }
    else { f.question._id = '64bb00000000000000000004'; f.mapping.selected_question_id = f.question._id; }
    const read = response(); await f.getQuestion(f.readReq(), read);
    assert.equal(read.statusCode, 200); assert.equal(read.body.question.puzzle.locked, true);
    const solve = response(); await f.submitProgress(f.solveReq(), solve);
    assert.equal(solve.statusCode, 409); assert.equal(solve.body.code, 'DISCOVERY_REQUIRED');
  }
});

test('invalid IDs and questions outside the authenticated current mapping cannot create discovery records', async () => {
  for (const [id, expected] of [['invalid', 400], ['64ff00000000000000000099', 409]]) {
    const f = fixture(), req = f.discoverReq(), res = response(); req.params.questionId = id;
    await f.discoverQuestion(req, res); assert.equal(res.statusCode, expected); assert.equal(f.mappingWrites.length, 0);
  }
});

test('ended event, run initialization and overtime decision all gate source discovery', async () => {
  for (const reason of ['ended', 'initializing', 'overtime']) {
    const f = fixture('fence', { overtime: reason === 'overtime' }), res = response();
    if (reason === 'ended') f.state.status = 'ended';
    if (reason === 'initializing') f.team.event_run_id = 'old-run';
    await f.discoverQuestion(f.discoverReq(), res);
    assert.equal(res.statusCode, reason === 'ended' ? 403 : 409);
    assert.equal(res.body.code, { ended: 'EVENT_ENDED', initializing: 'EVENT_INITIALIZING', overtime: 'OVERTIME_DECISION_REQUIRED' }[reason]);
    assert.equal(f.mappingWrites.length, 0);
  }
});

test('event ending or round advancing while discovery saves withholds the workbench response', async () => {
  for (const options of [{ expireDuringSave: true }, { changeDuringSave: true }]) {
    const f = fixture('fence', options), res = response(); await f.discoverQuestion(f.discoverReq(), res);
    assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'PROGRESS_CONFLICT');
    assert.equal('puzzle' in res.body, false); assert.equal(f.logs.length, 0); assert.equal(f.scoreWrites.length, 0);
  }
});

test('non-discovery puzzle families and archived text mappings keep their existing behavior', async () => {
  for (const type of ['machine', 'courier', 'fold', 'shadow']) {
    const f = fixture(type), res = response(); await f.getQuestion(f.readReq(), res);
    assert.equal(res.statusCode, 200); assert.notEqual(res.body.question.puzzle.locked, true);
    const discover = response(); await f.discoverQuestion(f.discoverReq(), discover);
    assert.equal(discover.statusCode, 400); assert.equal(f.mappingWrites.length, 0);
  }
  const f = fixture(); delete f.question.puzzle_type; f.question.correct_answer = 'legacy answer'; f.question.archived = true;
  const res = response(); await f.getQuestion(f.readReq(), res);
  assert.equal(res.statusCode, 200); assert.equal('puzzle' in res.body.question, false);
  const solved = response(); await f.submitProgress({ user: f.readReq().user,
    body: { level: f.question.level, answer: 'legacy answer' } }, solved);
  assert.equal(solved.statusCode, 200); assert.equal(solved.body.points_awarded, 400);
});
