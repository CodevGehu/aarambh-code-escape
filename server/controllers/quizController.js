const QuizState = require('../models/QuizState');
const Team = require('../models/Team');
const MappedQuestion = require('../models/MappedQuestion');
const { prepareTeamQuestionSets } = require('../services/questionSets');

// Get current quiz status
exports.getStatus = async (req, res) => {
  try {
    let state = await QuizState.findOne({ key: 'global' });
    if (!state) {
      state = await QuizState.create({ key: 'global', status: 'not_started' });
    }
    res.json({ status: state.status, started_at: state.started_at, ended_at: state.ended_at });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Start the quiz
exports.startQuiz = async (req, res) => {
  try {
    let state = await QuizState.findOne({ key: 'global' });
    if (state && state.status === 'active') {
      return res.status(409).json({ error: 'Quiz is already active' });
    }
    // Validate all five rounds in each set, then persist balanced team assignments.
    await prepareTeamQuestionSets();
    // Preparation may create the global state; don't reuse the earlier snapshot.
    try {
      await QuizState.findOneAndUpdate(
        { key: 'global' }, { $setOnInsert: { key: 'global' } }, { upsert: true, new: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }

    const now = new Date();
    state = await QuizState.findOneAndUpdate(
      { key: 'global', status: { $ne: 'active' } },
      { $set: { status: 'active', started_at: now, ended_at: null } },
      { new: true }
    );
    if (!state) return res.status(409).json({ error: 'Quiz is already active' });

    // Set start_time on ALL teams that haven't started yet.
    // This is the single authoritative place start_time is set for pre-quiz logins.
    // Teams that logged in BEFORE quiz started have current_level=1 but start_time=null → set now.
    // Teams that logged in AFTER quiz starts have their start_time set in authController.login().
    await Team.updateMany(
      { start_time: null },
      { $set: { start_time: now } }
    );

    res.json({ message: 'Quiz started!', status: state.status, started_at: now });
  } catch (error) {
    if (error.code === 'QUESTION_SET_CONFIGURATION') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

// End the quiz
exports.endQuiz = async (req, res) => {
  try {
    let state = await QuizState.findOne({ key: 'global' });
    if (!state || state.status !== 'active' || !state.started_at) {
      return res.status(400).json({ error: 'Quiz has not been started or is already ended.' });
    }

    const now = new Date();
    state.status = 'ended';
    state.ended_at = now;
    await state.save();

    // Set end_time on all teams that haven't finished (for leaderboard tie-breaking)
    await Team.updateMany(
      { end_time: null },
      { $set: { end_time: now } }
    );

    res.json({ message: 'Quiz ended!', status: state.status, ended_at: now });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reset the quiz (clears ALL progress — use with caution)
exports.resetQuiz = async (req, res) => {
  try {
    // Reset quiz state
    await QuizState.findOneAndUpdate(
      { key: 'global' },
      {
        status: 'not_started', started_at: null, ended_at: null,
        question_set_assignments: [], question_set_assignment_version: 0
      },
      { upsert: true }
    );

    // Reset all teams back to clean state
    // FIX: current_level resets to 0 (not 1!) so the first-login logic in authController
    // correctly triggers (it checks current_level === 0 to set up the team for a new game)
    await Team.updateMany({}, {
      $set: {
        current_level: 0,
        question_set_id: null,
        total_points: 0,
        level_points: {},  // Clear per-level points tracking
        start_time: null,
        end_time: null
      }
    });

    // Clear ALL question mappings so teams get fresh random questions after reset
    // Without this, teams would get the same question they had before
    await MappedQuestion.deleteMany({});

    res.json({ message: 'Quiz reset! All progress cleared.', status: 'not_started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
