const Question = require('../models/Question');
const MappedQuestion = require('../models/MappedQuestion');
const Team = require('../models/Team');
const QuizState = require('../models/QuizState');
const { prepareTeamQuestionSets } = require('../services/questionSets');
const { getEventState, getRoundState } = require('../services/eventRules');
const { getPuzzle, validateDiscovery } = require('../services/interactivePuzzles');
const { visiblePuzzle, discoveryRequired } = require('../services/puzzleDiscovery');
const { writeActivity } = require('../services/activityLog');

// GET /api/questions/:level
//
// SECURITY: The team is identified from the authenticated user's email (req.user set
// by authMiddleware), NOT from a URL parameter. This eliminates the IDOR vulnerability
// where Team A could pass Team B's teamId in the URL to view their assigned question.
//
// HOW QUESTION ASSIGNMENT WORKS:
// 1. Teams receive a persistent complete set; each round uses only that set.
// 2. The assignment is stored in MappedQuestion with a unique index {team_id, level}
//    → this guarantees exactly ONE question per team per level, FOREVER
// 3. On all subsequent requests → the same question is returned from the mapping
//    → a team can never "refresh" to get a different question
// 4. correct_answer is NEVER sent to the client — validation happens server-side only
//
const getQuestion = async (req, res) => {
  try {
    // 1. Gate: quiz must be active
    const state = await QuizState.findOne({ key: 'global' });
    if (getEventState(state).status !== 'active') {
      return res.status(403).json({ error: 'Quiz is currently inactive or has ended.', code: 'EVENT_ENDED' });
    }

    // 2. Parse and validate level
    const levelNum = Number(req.params.level);
    if (!Number.isInteger(levelNum) || levelNum < 1 || levelNum > 5) {
      return res.status(400).json({ error: 'Invalid level. Must be 1–5.' });
    }

    // 3. Identify team from authenticated email (IDOR-safe)
    const email = req.user.email?.toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ error: 'Email not found in token.' });
    }

    let team = await Team.findOne({ email });
    if (!team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

    // 4. Enforce sequential progression — cannot skip levels
    if (levelNum > team.current_level) {
      return res.status(403).json({ error: 'Level not yet unlocked.' });
    }
    if (state.run_id && team.event_run_id !== state.run_id) {
      return res.status(409).json({ error: 'The event is initializing. Please retry.', code: 'EVENT_INITIALIZING' });
    }

    // Compatibility for a quiz started before persistent set assignments existed.
    if (!team.question_set_id) {
      await prepareTeamQuestionSets();
      team = await Team.findById(team._id);
      if (!team?.question_set_id) {
        return res.status(409).json({ error: 'Team assignment changed. Please refresh.' });
      }
    }

    // 5. Check for existing assignment (idempotent — always returns same question)
    let mapping = await MappedQuestion.findOne({
      team_id: team._id,
      level: levelNum
    });

    if (!mapping) {
      // 6. Resolve this round inside the team's assigned path, never another set.
      const selectedQuestion = await Question.findOne({ level: levelNum, set_id: team.question_set_id, archived: { $ne: true } });

      if (!selectedQuestion) {
        return res.status(404).json({ error: 'No question available for this round in your assigned set.' });
      }

      const mappingKey = { team_id: team._id, level: levelNum };
      try {
        mapping = await MappedQuestion.findOneAndUpdate(
          mappingKey,
          { $setOnInsert: { ...mappingKey, selected_question_id: selectedQuestion._id } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
        mapping = await MappedQuestion.findOne(mappingKey);
        if (!mapping) throw error;
      }
    }

    // 7. Fetch the assigned question
    const question = await Question.findById(mapping.selected_question_id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found in the database.' });
    }
    if (question.set_id !== team.question_set_id || question.level !== levelNum) {
      return res.status(409).json({ error: 'Question assignment does not match your team set. Contact an organizer.' });
    }

    // 8. NEVER return correct_answer — it only lives on the server
    const puzzle = visiblePuzzle(question, team, mapping);
    res.json({
      event: getEventState(state),
      round: getRoundState(team, state),
      question: {
        _id: question._id,
        level: question.level,
        question_text: question.question_text,
        points: getEventState(state).config.round_points[levelNum - 1],
        ...(puzzle ? { puzzle } : {})
      }
    });

  } catch (error) {
    if (error.code === 'QUESTION_SET_CONFIGURATION') {
      return res.status(503).json({ error: 'Question sets need organizer attention before play can continue.' });
    }
    console.error('[QUESTION] Retrieval failed.');
    res.status(500).json({ error: 'Server error fetching question.' });
  }
};

async function discoverQuestion(req, res) {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.questionId || '')) return res.status(400).json({ error: 'Invalid question.' });
    const state = await QuizState.findOne({ key: 'global' });
    if (getEventState(state).status !== 'active') return res.status(403).json({ error: 'The event has ended.', code: 'EVENT_ENDED' });
    const team = await Team.findOne({ email: req.user.email?.toLowerCase().trim() });
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    if (state.run_id && team.event_run_id !== state.run_id) return res.status(409).json({ error: 'Refresh your event session.', code: 'EVENT_INITIALIZING' });
    const mapping = await MappedQuestion.findOne({ team_id: team._id, level: team.current_level, selected_question_id: req.params.questionId });
    if (!mapping) return res.status(409).json({ error: 'Open your current round before following its trail.', code: 'PROGRESS_CONFLICT' });
    const question = await Question.findById(mapping.selected_question_id);
    if (!question || question.level !== team.current_level || question.set_id !== team.question_set_id) return res.status(409).json({ error: 'Question assignment changed.' });
    if (getRoundState(team, state).requires_decision) return res.status(409).json({ error: 'Choose Continue or Skip before following the trail in overtime.', code: 'OVERTIME_DECISION_REQUIRED' });
    const puzzle = getPuzzle(question, team);
    if (!discoveryRequired(puzzle)) return res.status(400).json({ error: 'This room has no resource trail.' });
    const result = validateDiscovery(question, team, req.body?.discovery_submission);
    if (!result.valid) return res.status(400).json({ error: result.message, code: 'INVALID_DISCOVERY' });
    const saved = await MappedQuestion.findOneAndUpdate({ _id: mapping._id, selected_question_id: question._id },
      { $set: { discovery_instance_id: puzzle.instance_id, discovered_at: new Date() } }, { new: true });
    const [latestState, latestTeam] = await Promise.all([QuizState.findOne({ key: 'global' }), Team.findById(team._id)]);
    if (!saved || !latestTeam || latestTeam.current_level !== team.current_level || latestTeam.event_run_id !== team.event_run_id || getEventState(latestState).status !== 'active') return res.status(409).json({ error: 'The event or your round changed. Refresh your team.', code: 'PROGRESS_CONFLICT' });
    await writeActivity({ event_id: `discovery:${puzzle.instance_id}`, team_id: team._id, action: 'resource_discovered', level: team.current_level,
      metadata: { run_id: state.run_id, puzzle_type: question.puzzle_type } });
    return res.json({ puzzle, message: 'Resource found. Apply its method to your team’s puzzle.' });
  } catch { return res.status(503).json({ error: 'Unable to save your discovery. Retry when connected.' }); }
}

module.exports = { getQuestion, discoverQuestion };
