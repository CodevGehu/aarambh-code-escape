const Question = require('../models/Question');
const MappedQuestion = require('../models/MappedQuestion');
const Team = require('../models/Team');
const QuizState = require('../models/QuizState');
const { prepareTeamQuestionSets } = require('../services/questionSets');
const { getEventState, getRoundState } = require('../services/eventRules');

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
      const selectedQuestion = await Question.findOne({ level: levelNum, set_id: team.question_set_id });

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
    if (question.set_id !== team.question_set_id) {
      return res.status(409).json({ error: 'Question assignment does not match your team set. Contact an organizer.' });
    }

    // 8. NEVER return correct_answer — it only lives on the server
    res.json({
      event: getEventState(state),
      round: getRoundState(team, state),
      question: {
        _id: question._id,
        level: question.level,
        question_text: question.question_text,
        points: getEventState(state).config.round_points[levelNum - 1]
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

module.exports = { getQuestion };
