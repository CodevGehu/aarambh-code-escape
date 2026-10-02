const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Import each unit with in-memory dependencies. No test opens a DB connection.
function loadWithMocks(relativeFile, mocks = {}) {
  const filename = require.resolve(path.join(__dirname, '..', relativeFile));
  const replacements = Object.entries(mocks).map(([relative, exports]) => {
    const id = require.resolve(path.join(__dirname, '..', relative));
    return { id, exports, previous: require.cache[id] };
  });
  const previousUnit = require.cache[filename];
  try {
    for (const { id, exports } of replacements) require.cache[id] = { id, filename: id, loaded: true, exports };
    delete require.cache[filename];
    return require(filename);
  } finally {
    if (previousUnit) require.cache[filename] = previousUnit;
    else delete require.cache[filename];
    for (const { id, previous } of replacements) {
      if (previous) require.cache[id] = previous;
      else delete require.cache[id];
    }
  }
}

const emptyModels = {
  'models/Question.js': {}, 'models/Team.js': {}, 'models/MappedQuestion.js': {}, 'models/QuizState.js': {}
};
const { getQuestionSetIds, planSetAssignments } = loadWithMocks('services/questionSets.js', emptyModels);
const completeQuestions = (setIds) => setIds.flatMap(set_id =>
  Array.from({ length: 5 }, (_, index) => ({ _id: `${set_id}-${index + 1}`, set_id, level: index + 1 })));
const query = rows => ({ select() { return this; }, sort() { return this; }, lean: async () => rows });
const configError = { code: 'QUESTION_SET_CONFIGURATION' };

function stateStore({ overlap = false, casMisses = 0, initial } = {}) {
  let state = structuredClone(initial || {
    key: 'global', question_set_assignments: [], question_set_assignment_version: 0
  });
  let misses = casMisses;
  let ensured = 0;
  let releaseFirstRead;
  const firstReadBarrier = new Promise(resolve => { releaseFirstRead = resolve; });
  const committedPlans = [];
  const casFilters = [];
  const model = {
    async findOneAndUpdate(filter, update, options) {
      if (options?.upsert) {
        const snapshot = structuredClone(state);
        if (overlap) {
          ensured++;
          if (ensured === 1) await firstReadBarrier;
          else releaseFirstRead();
        }
        return snapshot;
      }
      casFilters.push(structuredClone(filter));
      if (misses > 0) {
        misses--;
        state.question_set_assignment_version++;
        return null;
      }
      const expectedVersion = filter.question_set_assignment_version ?? 0;
      if ((state.question_set_assignment_version || 0) !== expectedVersion) return null;
      assert.deepEqual(update.$inc, { question_set_assignment_version: 1 });
      state = {
        ...state, ...structuredClone(update.$set),
        question_set_assignment_version: (state.question_set_assignment_version || 0) + 1
      };
      committedPlans.push(structuredClone(state.question_set_assignments));
      return structuredClone(state);
    },
    async findOne() { return structuredClone(state); }
  };
  return { model, committedPlans, casFilters, get state() { return structuredClone(state); } };
}

test('seed exports three complete five-round paths with matching points and populated answers', () => {
  const { questions, teams } = loadWithMocks('seed/seedQuestions.js', {
    ...emptyModels,
    'config/db.js': () => { throw new Error('A seed test must never connect to a database'); },
    'services/questionSets.js': { getQuestionSetIds, planSetAssignments }
  });
  assert.equal(questions.length, 15);
  assert.deepEqual(getQuestionSetIds(questions), ['L1', 'L2', 'L3']);
  for (const setId of ['L1', 'L2', 'L3']) {
    const rounds = questions.filter(question => question.set_id === setId);
    assert.deepEqual(rounds.map(question => question.level), [1, 2, 3, 4, 5]);
    assert.deepEqual(rounds.map(question => question.points), [100, 200, 300, 400, 500]);
    for (const round of rounds) {
      assert.ok(round.question_text.trim());
      assert.ok(round.correct_answer.trim());
      if (setId !== 'L1') assert.match(round.question_text, /temporary event content/);
    }
  }
  assert.deepEqual(questions.filter(question => question.set_id === 'L1').map(question => question.correct_answer),
    ['3882', 'pen name', 'lcc-a0acaa69', 'team codev', 'happy coding']);
  assert.ok(teams.length > 0);
});

test('configuration validation rejects empty, incomplete, duplicate, and invalid rounds', () => {
  assert.throws(() => getQuestionSetIds([]), configError);
  assert.throws(() => getQuestionSetIds(completeQuestions(['L1']).slice(1)), configError);
  assert.throws(() => getQuestionSetIds([...completeQuestions(['L1']), { set_id: 'L1', level: 1 }]), configError);
  for (const level of [0, 6, 1.5, '1', undefined]) {
    assert.throws(() => getQuestionSetIds([{ set_id: 'L1', level }]), configError);
  }
  assert.throws(() => getQuestionSetIds([{ set_id: '', level: 1 }]), configError);
});

for (const setIds of [['L1', 'L2'], ['L1', 'L2', 'L3']]) {
  test(`new team assignments remain balanced across ${setIds.length} sets for every roster size`, () => {
    for (let size = 0; size <= 100; size++) {
      const teams = Array.from({ length: size }, (_, index) => ({ _id: String(index) }));
      const before = structuredClone(teams);
      const assignments = planSetAssignments(teams, setIds, () => 0);
      assert.equal(assignments.length, size);
      assert.equal(new Set(assignments.map(item => item.team._id)).size, size);
      const counts = setIds.map(setId => assignments.filter(item => item.setId === setId).length);
      assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
      assert.deepEqual(teams, before, 'Planning must not change the supplied roster');
    }
  });
}

test('assignments preserve existing teams and fill less-used sets first', () => {
  const teams = [
    { _id: 'fixed1', question_set_id: 'L1' }, { _id: 'fixed2', question_set_id: 'L1' },
    { _id: 'new1' }, { _id: 'new2', question_set_id: null }, { _id: 'new3' }
  ];
  const assignments = planSetAssignments(teams, ['L1', 'L2', 'L3'], () => 0);
  assert.ok(assignments.every(({ team }) => team._id.startsWith('new')));
  assert.ok(assignments.every(({ setId }) => setId !== 'L1'));
  assert.equal(teams[0].question_set_id, 'L1');
  assert.throws(() => planSetAssignments([{ question_set_id: 'removed' }], ['L1']), configError);
});

test('preparation persists legacy paths and balances newly assigned teams with conditional updates', async () => {
  const questions = completeQuestions(['L1', 'L2', 'L3']);
  const teams = [
    { _id: 'fixed', question_set_id: 'L1' }, { _id: 'legacy' }, { _id: 'new' }
  ];
  let operations;
  const { prepareTeamQuestionSets } = loadWithMocks('services/questionSets.js', {
    'models/Question.js': { find: () => query(questions) },
    'models/Team.js': { find: () => query(teams), bulkWrite: async ops => { operations = ops; } },
    'models/MappedQuestion.js': { find: () => query([{ team_id: 'legacy', level: 1, selected_question_id: 'L2-1' }]) },
    'models/QuizState.js': stateStore().model
  });
  await prepareTeamQuestionSets();
  assert.equal(operations.length, 2);
  const updates = Object.fromEntries(operations.map(({ updateOne }) => {
    assert.equal(updateOne.filter.question_set_id, null, 'Do not overwrite concurrent assignment');
    return [updateOne.filter._id, updateOne.update.$set.question_set_id];
  }));
  assert.deepEqual(updates, { legacy: 'L2', new: 'L3' });
});

test('preparation validates existing assignments without querying legacy mappings or writing', async () => {
  const { prepareTeamQuestionSets } = loadWithMocks('services/questionSets.js', {
    'models/Question.js': { find: () => query(completeQuestions(['L1'])) },
    'models/Team.js': { find: () => query([{ _id: 'team', question_set_id: 'L1' }]), bulkWrite: () => assert.fail('Unexpected write') },
    'models/MappedQuestion.js': { find: () => assert.fail('Unexpected legacy lookup') },
    'models/QuizState.js': { findOneAndUpdate: () => assert.fail('Already assigned roster needs no plan write') }
  });
  await prepareTeamQuestionSets();
});

for (const mappings of [
  [{ team_id: 'legacy', selected_question_id: 'missing', level: 1 }],
  [{ team_id: 'legacy', selected_question_id: 'L1-1', level: 1 }, { team_id: 'legacy', selected_question_id: 'L2-2', level: 2 }]
]) {
  test(`preparation rejects ${mappings.length === 1 ? 'missing questions' : 'mixed legacy sets'} before writing`, async () => {
    const { prepareTeamQuestionSets } = loadWithMocks('services/questionSets.js', {
      'models/Question.js': { find: () => query(completeQuestions(['L1', 'L2'])) },
      'models/Team.js': { find: () => query([{ _id: 'legacy' }]), bulkWrite: () => assert.fail('Unexpected write') },
      'models/MappedQuestion.js': { find: () => query(mappings) },
      'models/QuizState.js': { findOneAndUpdate: () => assert.fail('Invalid mapping needs no plan write') }
    });
    await assert.rejects(prepareTeamQuestionSets(), configError);
  });
}

function preparationFixture(options = {}) {
  const teams = structuredClone(options.teams || Array.from({ length: 12 }, (_, index) => ({ _id: `team-${index}` })));
  const setIds = options.setIds || ['L1', 'L2', 'L3'];
  const store = stateStore(options);
  const bulkPlans = [];
  const { prepareTeamQuestionSets } = loadWithMocks('services/questionSets.js', {
    'models/Question.js': { find: () => query(completeQuestions(setIds)) },
    'models/Team.js': {
      find: () => query(structuredClone(teams)),
      async bulkWrite(operations) {
        bulkPlans.push(structuredClone(operations));
        for (const { updateOne } of operations) {
          assert.equal(updateOne.filter.question_set_id, null);
          const team = teams.find(item => item._id === updateOne.filter._id);
          if (team && !team.question_set_id) team.question_set_id = updateOne.update.$set.question_set_id;
          await Promise.resolve(); // Force interleaved per-team writes from overlapping calls.
        }
      }
    },
    'models/MappedQuestion.js': { find: () => query(options.mappings || []) },
    'models/QuizState.js': store.model
  });
  return { teams, setIds, store, bulkPlans, prepareTeamQuestionSets };
}

test('overlapping preparation calls adopt one committed plan and retain balanced assignments', async () => {
  const fixture = preparationFixture({ overlap: true });
  await Promise.all([fixture.prepareTeamQuestionSets(), fixture.prepareTeamQuestionSets()]);
  assert.equal(fixture.store.committedPlans.length, 1);
  assert.equal(fixture.store.casFilters.length, 2, 'Both workers initially try their own plan');
  assert.equal(fixture.bulkPlans.length, 2);
  const committed = new Map(fixture.store.state.question_set_assignments.map(item => [item.team_id, item.set_id]));
  for (const team of fixture.teams) assert.equal(team.question_set_id, committed.get(team._id));
  for (const operations of fixture.bulkPlans) {
    for (const { updateOne } of operations) {
      assert.equal(updateOne.update.$set.question_set_id, committed.get(updateOne.filter._id));
    }
  }
  assert.deepEqual(fixture.setIds.map(id => fixture.teams.filter(team => team.question_set_id === id).length), [4, 4, 4]);
});

test('preparation retries lost compare-and-set writes against the current plan version', async () => {
  const fixture = preparationFixture({ casMisses: 2 });
  await fixture.prepareTeamQuestionSets();
  assert.equal(fixture.store.casFilters.length, 3);
  assert.deepEqual(fixture.store.casFilters[0].$or, [
    { question_set_assignment_version: 0 }, { question_set_assignment_version: { $exists: false } }
  ]);
  assert.equal(fixture.store.casFilters[1].question_set_assignment_version, 1);
  assert.equal(fixture.store.casFilters[2].question_set_assignment_version, 2);
  assert.equal(fixture.store.state.question_set_assignment_version, 3);
  assert.equal(fixture.store.committedPlans.length, 1);
  assert.ok(fixture.teams.every(team => team.question_set_id));
});

test('exhausted plan retries fail before any team assignments are written', async () => {
  const fixture = preparationFixture({ casMisses: 3 });
  await assert.rejects(fixture.prepareTeamQuestionSets(), configError);
  assert.equal(fixture.bulkPlans.length, 0);
  assert.equal(fixture.store.committedPlans.length, 0);
  assert.ok(fixture.teams.every(team => !team.question_set_id));
});

test('late roster additions extend the committed plan while preserving existing team assignments', async () => {
  const fixture = preparationFixture({ teams: [
    { _id: 'fixed', question_set_id: 'L1' }, { _id: 'new1' }, { _id: 'new2' }
  ] });
  await fixture.prepareTeamQuestionSets();
  const originalAssignments = new Map(fixture.teams.map(team => [team._id, team.question_set_id]));
  const originalPlan = fixture.store.state.question_set_assignments;
  fixture.teams.push({ _id: 'late1' }, { _id: 'late2' }, { _id: 'late3' });
  await fixture.prepareTeamQuestionSets();
  assert.equal(fixture.store.state.question_set_assignment_version, 2);
  for (const team of fixture.teams) {
    if (originalAssignments.has(team._id)) assert.equal(team.question_set_id, originalAssignments.get(team._id));
  }
  assert.equal(fixture.teams[0].question_set_id, 'L1');
  assert.ok(originalPlan.every(entry => fixture.store.state.question_set_assignments.some(item =>
    item.team_id === entry.team_id && item.set_id === entry.set_id)));
  assert.deepEqual(fixture.setIds.map(id => fixture.teams.filter(team => team.question_set_id === id).length), [2, 2, 2]);
  assert.deepEqual(fixture.bulkPlans[1].map(({ updateOne }) => updateOne.filter._id), ['late1', 'late2', 'late3']);
});

test('committed allocation conflicting with existing team assignment is rejected', async () => {
  const fixture = preparationFixture({ teams: [{ _id: 'fixed', question_set_id: 'L1' }, { _id: 'new' }],
    initial: { key: 'global', question_set_assignment_version: 1,
      question_set_assignments: [{ team_id: 'fixed', set_id: 'L2' }] }
  });
  await assert.rejects(fixture.prepareTeamQuestionSets(), configError);
  assert.equal(fixture.bulkPlans.length, 0);
});

function startQuizFixture(initial = null) {
  let state = initial;
  const calls = { preparation: 0, ensure: 0, teamStart: [] };
  const { startQuiz } = loadWithMocks('controllers/quizController.js', {
    'models/QuizState.js': {
      async findOne() { return state ? structuredClone(state) : null; },
      async findOneAndUpdate(filter, update, options) {
        if (options?.upsert) {
          calls.ensure++;
          assert.deepEqual(filter, { key: 'global' });
          assert.deepEqual(update, { $setOnInsert: { key: 'global' } });
          if (!state) state = { key: 'global', status: 'not_started' };
          return structuredClone(state);
        }
        assert.equal(filter.key, 'global');
        assert.ok(['not_started', 'starting'].includes(filter.status));
        if (!state || state.status !== filter.status || (filter.run_id && state.run_id !== filter.run_id)) return null;
        state = { ...state, ...update.$set };
        return structuredClone(state);
      },
      create() { assert.fail('Preparation already created the global state'); }
    },
    'models/Team.js': { async updateMany(filter, update) { calls.teamStart.push({ filter, update }); } },
    'models/MappedQuestion.js': {},
    'services/activityLog.js': { writeActivity: async () => true, recordObservedTimeouts: async () => {} },
    'services/questionSets.js': { async prepareTeamQuestionSets() {
      calls.preparation++;
      await Promise.resolve();
      if (!state) state = {
        key: 'global', status: 'not_started', question_set_assignment_version: 1,
        question_set_assignments: [{ team_id: 'team', set_id: 'L1' }]
      };
    } }
  });
  const response = () => ({
    statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  });
  return { startQuiz, calls, response, get state() { return state; } };
}

test('first start succeeds when question-set preparation creates the initially missing quiz state', async () => {
  const fixture = startQuizFixture();
  const res = fixture.response();
  await fixture.startQuiz({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'active');
  assert.equal(fixture.calls.preparation, 1);
  assert.equal(fixture.calls.ensure, 1);
  assert.equal(fixture.state.question_set_assignment_version, 1);
  assert.deepEqual(fixture.state.question_set_assignments, [{ team_id: 'team', set_id: 'L1' }]);
  assert.equal(fixture.calls.teamStart.length, 1);
  assert.deepEqual(fixture.calls.teamStart[0].filter, { ...require('../services/registrationPolicy').rosterFilter(), event_run_id: { $ne: fixture.state.run_id } });
  assert.deepEqual(fixture.calls.teamStart[0].update.$set.start_time, res.body.started_at);
  assert.deepEqual(fixture.state.started_at, res.body.started_at);
});

test('overlapping quiz starts yield one start and one conflict without resetting the shared timer', async () => {
  const fixture = startQuizFixture();
  const responses = [fixture.response(), fixture.response()];
  await Promise.all(responses.map(res => fixture.startQuiz({}, res)));
  assert.deepEqual(responses.map(res => res.statusCode).sort(), [200, 409]);
  const winner = responses.find(res => res.statusCode === 200);
  assert.equal(fixture.calls.teamStart.length, 1);
  assert.deepEqual(fixture.calls.teamStart[0].update.$set.start_time, winner.body.started_at);
  assert.deepEqual(fixture.state.started_at, winner.body.started_at);
});

test('already active quiz rejects a duplicate start before allocating or updating teams', async () => {
  const originalStart = new Date('2026-10-01T04:30:00Z');
  const fixture = startQuizFixture({ key: 'global', status: 'active', started_at: originalStart });
  const res = fixture.response();
  await fixture.startQuiz({}, res);
  assert.equal(res.statusCode, 409);
  assert.equal(fixture.calls.preparation, 0);
  assert.equal(fixture.calls.ensure, 0);
  assert.equal(fixture.calls.teamStart.length, 0);
  assert.equal(fixture.state.started_at, originalStart);
});

function controllerFixture(overrides = {}) {
  const team = { _id: 'team', question_set_id: 'L2', current_level: 2 };
  const question = { _id: 'L2-2', set_id: 'L2', level: 2, question_text: 'Practice clue', correct_answer: 'secret', points: 200 };
  const mapping = { team_id: team._id, level: 2, selected_question_id: question._id };
  const calls = { findQuestion: [], mappings: [] };
  const models = {
    'models/Team.js': { findOne: async filter => { assert.deepEqual(filter, { email: 'leader@example.com' }); return team; } },
    'models/QuizState.js': { findOne: async () => ({ status: 'active', started_at: new Date() }) },
    'models/Question.js': {
      findOne: async filter => { calls.findQuestion.push(filter); return question; },
      findById: async id => { assert.equal(id, question._id); return question; }
    },
    'models/MappedQuestion.js': {
      findOne: async () => null,
      findOneAndUpdate: async (...args) => { calls.mappings.push(args); return mapping; }
    },
    'services/questionSets.js': { prepareTeamQuestionSets: () => assert.fail('Team already has a set') },
    ...overrides
  };
  const { getQuestion } = loadWithMocks('controllers/questionController.js', models);
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const req = { params: { level: '2', teamId: 'another-team' }, user: { email: ' LEADER@example.com ' } };
  return { getQuestion, req, res, calls, team, question, mapping };
}

test('question retrieval selects the authenticated team set and omits answers and set identifiers', async () => {
  const fixture = controllerFixture();
  await fixture.getQuestion(fixture.req, fixture.res);
  assert.equal(fixture.res.statusCode, 200);
  assert.deepEqual(fixture.calls.findQuestion, [{ level: 2, set_id: 'L2' }]);
  assert.deepEqual(fixture.calls.mappings[0], [
    { team_id: 'team', level: 2 },
    { $setOnInsert: { team_id: 'team', level: 2, selected_question_id: 'L2-2' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ]);
  assert.deepEqual(fixture.res.body.question, { _id: 'L2-2', level: 2, question_text: 'Practice clue', points: 200 });
  assert.equal(fixture.res.body.event.status, 'active');
  assert.equal(fixture.res.body.round.level, 2);
  assert.equal('correct_answer' in fixture.res.body.question, false);
});

test('refresh uses the existing mapping without assigning another question', async () => {
  const fixture = controllerFixture({ 'models/MappedQuestion.js': {
    findOne: async () => ({ selected_question_id: 'L2-2' }),
    findOneAndUpdate: () => assert.fail('Refresh must not create another mapping')
  } });
  await fixture.getQuestion(fixture.req, fixture.res);
  assert.equal(fixture.res.statusCode, 200);
  assert.deepEqual(fixture.calls.findQuestion, []);
});

test('duplicate-key mapping race retries the existing assignment', async () => {
  let reads = 0;
  const fixture = controllerFixture({ 'models/MappedQuestion.js': {
    findOne: async () => ++reads === 1 ? null : { selected_question_id: 'L2-2' },
    findOneAndUpdate: async () => { throw Object.assign(new Error('Concurrent insertion'), { code: 11000 }); }
  } });
  await fixture.getQuestion(fixture.req, fixture.res);
  assert.equal(reads, 2);
  assert.equal(fixture.res.statusCode, 200);
});

test('an old mapping from another set is rejected without leaking its question', async () => {
  const fixture = controllerFixture({
    'models/MappedQuestion.js': { findOne: async () => ({ selected_question_id: 'wrong-set' }) },
    'models/Question.js': { findById: async () => ({ set_id: 'L3', correct_answer: 'never disclose', question_text: 'other team clue' }) }
  });
  await fixture.getQuestion(fixture.req, fixture.res);
  assert.equal(fixture.res.statusCode, 409);
  assert.deepEqual(Object.keys(fixture.res.body), ['error']);
});

test('future rounds remain locked even with a valid assigned set', async () => {
  const fixture = controllerFixture();
  fixture.req.params.level = '3';
  await fixture.getQuestion(fixture.req, fixture.res);
  assert.equal(fixture.res.statusCode, 403);
  assert.deepEqual(fixture.calls.findQuestion, []);
});

test('missing round in assigned set never falls back to another set', async () => {
  const fixture = controllerFixture({ 'models/Question.js': {
    findOne: async filter => { assert.deepEqual(filter, { level: 2, set_id: 'L2' }); return null; },
    findById: () => assert.fail('No mapping should have been created')
  } });
  await fixture.getQuestion(fixture.req, fixture.res);
  assert.equal(fixture.res.statusCode, 404);
  assert.equal(fixture.calls.mappings.length, 0);
});
