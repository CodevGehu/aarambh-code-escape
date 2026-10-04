const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Controller boundary checks use in-memory models. Pure geometry/program
// validators are exercised separately in interactivePuzzles.test.js.
function loadWithMocks(file, mocks) {
  const filename = require.resolve(path.join(__dirname, '..', file));
  const replaced = Object.entries(mocks).map(([relative, exports]) => {
    const id = require.resolve(path.join(__dirname, '..', relative));
    return { id, exports, prior: require.cache[id] };
  });
  const priorUnit = require.cache[filename];
  try {
    for (const { id, exports } of replaced) require.cache[id] = { id, filename: id, loaded: true, exports };
    delete require.cache[filename];
    return require(filename);
  } finally {
    if (priorUnit) require.cache[filename] = priorUnit; else delete require.cache[filename];
    for (const { id, prior } of replaced) {
      if (prior) require.cache[id] = prior; else delete require.cache[id];
    }
  }
}
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });

function fixture({ overtime = false, continued = false, closeBeforeWrite = false, expired = false } = {}) {
  const now = new Date();
  const started = new Date(now.getTime() - (expired ? 121 : overtime ? 26 : 1) * 60000);
  const state = { key: 'global', status: 'active', run_id: 'run-1', started_at: started,
    deadline: new Date(started.getTime() + 120 * 60000) };
  const team = { _id: 'team-1', email: 'leader@example.com', question_set_id: 'L1', current_level: 4,
    total_points: 600, level_points: {}, start_time: started, round_started_at: started,
    event_run_id: state.run_id, event_open: true, progress_version: 2, carry_ms: 0,
    outcomes: [], active_session_id: 'session', overtime_continued_at: continued ? started : null };
  const question = { _id: 'question-4', set_id: 'L1', level: 4, correct_answer: '[interactive]',
    question_text: 'Build a valid arrangement.', puzzle_type: 'fence' };
  let mapping = { selected_question_id: question._id };
  const logs = [], writes = [], validations = [];
  const models = {
    'models/QuizState.js': { findOne: async () => structuredClone(state) },
    'models/Team.js': {
      findOne: async filter => { assert.deepEqual(filter, { email: team.email }); return structuredClone(team); },
      async findOneAndUpdate(filter, update) {
        writes.push({ filter: structuredClone(filter), update: structuredClone(update) });
        assert.deepEqual(filter.$expr, { $lt: ['$$NOW', state.deadline] });
        if (closeBeforeWrite) team.event_open = false;
        if (filter.current_level !== team.current_level || filter.progress_version !== team.progress_version ||
          filter.event_run_id !== team.event_run_id || filter.event_open !== team.event_open ||
          filter.active_session_id !== team.active_session_id) return null;
        for (const [key, value] of Object.entries(update.$set || {})) {
          if (key.startsWith('level_points.')) team.level_points[key.split('.')[1]] = value;
          else team[key] = value;
        }
        for (const [key, value] of Object.entries(update.$inc || {})) team[key] += value;
        if (update.$push?.outcomes) team.outcomes.push(update.$push.outcomes);
        return structuredClone(team);
      }
    },
    'models/Question.js': { findById: async id => { assert.equal(id, mapping.selected_question_id); return question; } },
    'models/MappedQuestion.js': { findOne: async filter => {
      assert.deepEqual(filter, { team_id: team._id, level: team.current_level }); return mapping;
    } },
    'models/Result.js': { findOneAndUpdate: () => assert.fail('Round 4 must not create a final result') },
    'services/activityLog.js': { writeActivity: async entry => logs.push(entry), recordObservedTimeouts: async () => {} },
    // Discovery persistence/privacy is exercised with the real engine in
    // interactiveDiscovery.test.js; these cases isolate scoring and its CAS.
    'services/puzzleDiscovery.js': { discoveryUnlocked: () => true },
    'services/interactivePuzzles.js': {
      getPuzzle: () => ({ type: question.puzzle_type, instance_id: `${team._id}:${state.run_id}:${question._id}` }),
      validatePuzzle(assigned, owner, submission) {
        validations.push({ assigned, owner, submission });
        assert.equal(assigned._id, question._id);
        assert.equal(owner._id, team._id);
        assert.equal(owner.event_run_id, state.run_id);
        const valid = submission.instance_id === `${owner._id}:${owner.event_run_id}:${assigned._id}` &&
          submission.arrangement === 'valid private artifact';
        return { valid, message: 'Arrangement did not satisfy its issued instance.', summary: valid ? { area: 6 } : {} };
      }
    }
  };
  const controller = loadWithMocks('controllers/progressController.js', models);
  const req = () => ({ received_at: now, user: { email: team.email, sessionId: 'session' }, body: {
    level: 4, question_id: question._id, answer: '[interactive]', puzzle_submission: {
      instance_id: `${team._id}:${state.run_id}:${question._id}`, arrangement: 'valid private artifact' }
  } });
  return { ...controller, models, now, req, team, question, state, logs, writes, validations,
    removeMapping() { mapping = null; } };
}

test('interactive answer sentinel alone cannot complete a round', async () => {
  const f = fixture(), req = f.req(), res = response(); delete req.body.puzzle_submission;
  await f.submitProgress(req, res);
  assert.equal(res.statusCode, 400); assert.equal(res.body.code, 'INVALID_PUZZLE_SUBMISSION');
  assert.equal(f.writes.length, 0); assert.equal(f.validations.length, 0); assert.equal(f.team.total_points, 600);
});

test('interactive sentinel cannot rescue an invalid arrangement', async () => {
  const f = fixture(), req = f.req(), res = response(); req.body.puzzle_submission.arrangement = 'invalid';
  await f.submitProgress(req, res);
  assert.equal(res.statusCode, 400); assert.equal(res.body.code, 'INVALID_PUZZLE_SOLUTION');
  assert.equal(f.writes.length, 0); assert.equal(f.team.current_level, 4);
  assert.equal(f.logs[0].action, 'incorrect_answer');
  assert.ok(!JSON.stringify(f.logs).includes('valid private artifact'));
});

for (const instance_id of ['other-team:run-1:question-4', 'team-1:old-run:question-4']) {
  test(`controller passes ${instance_id.includes('other-team') ? 'cross-team' : 'prior-run'} artifact to its actual owner validator and rejects it`, async () => {
    const f = fixture(), req = f.req(), res = response(); req.body.puzzle_submission.instance_id = instance_id;
    await f.submitProgress(req, res);
    assert.equal(res.statusCode, 400); assert.equal(f.writes.length, 0); assert.equal(f.validations.length, 1);
  });
}

test('changed question ID is rejected before puzzle validation', async () => {
  const f = fixture(), req = f.req(), res = response(); req.body.question_id = 'old-question';
  await f.submitProgress(req, res);
  assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'PUZZLE_INSTANCE_CHANGED');
  assert.equal(f.validations.length, 0); assert.equal(f.writes.length, 0);
});

for (const change of [{ level: 3 }, { set_id: 'L2' }]) {
  test(`wrong ${change.level ? 'round' : 'set'} mapping cannot validate an artifact`, async () => {
    const f = fixture(), res = response(); Object.assign(f.question, change);
    await f.submitProgress(f.req(), res);
    assert.equal(res.statusCode, 409); assert.equal(f.validations.length, 0); assert.equal(f.writes.length, 0);
  });
}

test('teams from an earlier event run cannot submit even a valid artifact', async () => {
  const f = fixture(), res = response(); f.team.event_run_id = 'old-run';
  await f.submitProgress(f.req(), res);
  assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'EVENT_INITIALIZING'); assert.equal(f.validations.length, 0);
});

test('successful puzzle preserves normal reward/carryover and records trusted type and summary only', async () => {
  const f = fixture(), req = f.req(), res = response(); req.body.puzzle_submission.type = 'client-forged-type';
  await f.submitProgress(req, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.points_awarded, 400);
  assert.equal(f.team.current_level, 5); assert.equal(f.team.total_points, 1000); assert.equal(f.team.carry_ms, 24 * 60000);
  assert.equal(f.team.outcomes[0].puzzle_type, 'fence'); assert.deepEqual(f.team.outcomes[0].puzzle_summary, { area: 6 });
  assert.ok(!JSON.stringify(f.logs).includes('valid private artifact'));
  assert.ok(!JSON.stringify(f.team.outcomes).includes('client-forged-type'));
});

test('overlapping valid artifacts award exactly one score and one outcome', async () => {
  const f = fixture(), responses = [response(), response()];
  await Promise.all(responses.map(res => f.submitProgress(f.req(), res)));
  assert.deepEqual(responses.map(res => res.statusCode).sort(), [200, 409]);
  assert.equal(f.team.total_points, 1000); assert.equal(f.team.progress_version, 3); assert.equal(f.team.outcomes.length, 1);
});

test('puzzle validation does not bypass the overtime decision or point reduction', async () => {
  const waiting = fixture({ overtime: true }), waitingRes = response();
  await waiting.submitProgress(waiting.req(), waitingRes);
  assert.equal(waitingRes.statusCode, 409); assert.equal(waitingRes.body.code, 'OVERTIME_DECISION_REQUIRED');
  assert.equal(waiting.validations.length, 0);
  const continuing = fixture({ overtime: true, continued: true }), res = response();
  await continuing.submitProgress(continuing.req(), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.points_awarded, 380); assert.equal(continuing.team.carry_ms, 0);
});

test('event closure during puzzle submission still blocks the authoritative write', async () => {
  const f = fixture({ closeBeforeWrite: true }), res = response(); await f.submitProgress(f.req(), res);
  assert.equal(res.statusCode, 409); assert.equal(f.team.total_points, 600); assert.equal(f.team.outcomes.length, 0);
});

test('event hard deadline rejects artifact before evaluation', async () => {
  const f = fixture({ expired: true }), res = response(); await f.submitProgress(f.req(), res);
  assert.equal(res.statusCode, 403); assert.equal(res.body.code, 'EVENT_ENDED'); assert.equal(f.validations.length, 0);
});

test('malformed or oversized puzzle artifacts never reach validation', async () => {
  for (const submission of [[], 'not an object', { arrangement: 'x'.repeat(9001) }]) {
    const f = fixture(), req = f.req(), res = response(); req.body.puzzle_submission = submission;
    await f.submitProgress(req, res);
    assert.equal(res.statusCode, 400); assert.equal(res.body.code, 'INVALID_PUZZLE_SUBMISSION');
    assert.equal(f.validations.length, 0); assert.equal(f.writes.length, 0);
  }
});

test('retrieval returns explicit public puzzle fields and hides question-private data', async () => {
  const f = fixture(), publicPuzzle = { type: 'fence', instance_id: 'issued', rules: ['No overlaps.'] };
  f.question.solution = 'secret solution'; f.question.private_key = 'secret key';
  const { getQuestion } = loadWithMocks('controllers/questionController.js', { ...f.models,
    'services/questionSets.js': { prepareTeamQuestionSets: () => assert.fail('Already assigned') },
    'services/puzzleDiscovery.js': { visiblePuzzle: (question, team) => {
      assert.equal(question._id, f.question._id); assert.equal(team._id, f.team._id); return publicPuzzle;
    } },
    'services/interactivePuzzles.js': { getPuzzle: (question, team) => {
      assert.equal(question._id, f.question._id); assert.equal(team._id, f.team._id); return publicPuzzle;
    } }
  });
  const res = response(); await getQuestion({ params: { level: '4', teamId: 'other-team' }, user: { email: f.team.email } }, res);
  assert.equal(res.statusCode, 200); assert.deepEqual(res.body.question.puzzle, publicPuzzle);
  const serialized = JSON.stringify(res.body);
  for (const secret of ['correct_answer', 'secret solution', 'secret key', 'set_id']) assert.ok(!serialized.includes(secret));
});

// This solver reads only the public board, independently of the server move
// validator/witness. Each BFS edge is one legal axis-slide of arbitrary length.
function shortestSlidingSolution(board) {
  const pieces = board.pieces;
  const initial = pieces.map(piece => piece[piece.axis]);
  const queue = [{ positions: initial, depth: 0 }], visited = new Set([initial.join(',')]);
  const width = board.board.width, height = board.board.height;
  const cargoIndex = pieces.findIndex(piece => piece.target);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const { positions, depth } = queue[cursor];
    const occupied = new Int16Array(width * height); occupied.fill(-1);
    pieces.forEach((piece, index) => {
      const x = piece.axis === 'x' ? positions[index] : piece.x;
      const y = piece.axis === 'y' ? positions[index] : piece.y;
      for (let k = 0; k < piece.length; k++) {
        const cell = (y + (piece.axis === 'y' ? k : 0)) * width + x + (piece.axis === 'x' ? k : 0);
        assert.equal(occupied[cell], -1, 'Issued pieces must never overlap'); occupied[cell] = index;
      }
    });
    const cargo = pieces[cargoIndex];
    const from = board.exit.side === 'right' ? positions[cargoIndex] + cargo.length : 0;
    const to = board.exit.side === 'right' ? width : positions[cargoIndex];
    let clear = true;
    for (let x = from; x < to; x++) if (occupied[board.exit.row * width + x] !== -1) clear = false;
    if (clear) return depth + 1; // Complete exit is the final slide.
    for (let index = 0; index < pieces.length; index++) {
      const piece = pieces[index], limit = piece.axis === 'x' ? width : height;
      for (const direction of [-1, 1]) {
        for (let distance = 1; distance < limit; distance++) {
          const position = positions[index] + direction * distance;
          if (position < 0 || position + piece.length > limit) break;
          const edge = direction > 0 ? position + piece.length - 1 : position;
          const x = piece.axis === 'x' ? edge : piece.x, y = piece.axis === 'y' ? edge : piece.y;
          if (occupied[y * width + x] !== -1 && occupied[y * width + x] !== index) break;
          const next = positions.slice(); next[index] = position;
          const key = next.join(',');
          if (!visited.has(key)) { visited.add(key); queue.push({ positions: next, depth: depth + 1 }); }
        }
      }
    }
  }
  return Infinity;
}

test('both issued sliding orientations require exactly eight slides by independent shortest-path search', () => {
  const { getPuzzle } = require('../services/interactivePuzzles');
  // Archived sliding questions remain playable even though the current L1-R5
  // question bank uses packing. Read this legacy fixture explicitly.
  const question = { puzzle_type: 'sliding', level: 5, set_id: 'L1', _id: 'sliding-review' };
  const orientations = new Map();
  for (let index = 0; index < 40 && orientations.size < 2; index++) {
    const board = getPuzzle(question, { _id: `review-${index}`, event_run_id: 'review-run' });
    if (!orientations.has(board.exit.side)) orientations.set(board.exit.side, board);
  }
  assert.equal(orientations.size, 2);
  for (const [side, board] of orientations) {
    assert.equal(board.pieces.length, 11);
    assert.equal(shortestSlidingSolution(board), 8, `${side} exit`);
  }
});
