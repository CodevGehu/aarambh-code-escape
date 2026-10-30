const Team = require('../models/Team');
const Result = require('../models/Result');
const MappedQuestion = require('../models/MappedQuestion');
const Question = require('../models/Question');
const QuizState = require('../models/QuizState');
const { getEventState, getRoundState, publicTeam, outcomeUpdate } = require('../services/eventRules');
const { writeActivity, recordObservedTimeouts } = require('../services/activityLog');
const { validatePuzzle, getPuzzle } = require('../services/interactivePuzzles');
const { discoveryUnlocked } = require('../services/puzzleDiscovery');
const { isEarly, validateEarly } = require('../services/earlyRoundPuzzles');
const { consumeAnswerAttempt } = require('./earlyRoundController');
const { withCurrentPuzzle } = require('../services/earlyRoundContext');
const { teamSessionFilter } = require('../services/teamSessions');
const normalize = value => value.toLowerCase().trim().replace(/\s+/g, ' ');
const reply = (res, team, state, extra = {}, now = new Date()) => res.json({ success: true,
  team: publicTeam(team, state, now), event: getEventState(state, now), ...extra });

async function context(req, res, needsLevel = true, now = new Date()) {
  const state = await QuizState.findOne({ key: 'global' });
  const team = await Team.findOne({ email: req.user.email.toLowerCase().trim() });
  if (!team) { res.status(404).json({ error: 'Team not found.' }); return null; }
  if (needsLevel) {
    if (getEventState(state, now).status !== 'active') {
      res.status(403).json({ error: 'The event is inactive or its two-hour deadline has passed.', code: 'EVENT_ENDED' }); return null;
    }
    const level = Number(req.body?.level);
    if (!Number.isInteger(level) || level < 1 || level > 5) {
      res.status(400).json({ error: 'Enter a valid round number.' }); return null;
    }
    if (level !== team.current_level) {
      res.status(409).json({ error: 'Round progress changed. Refresh your team.', code: 'PROGRESS_CONFLICT' }); return null;
    }
    if (state.run_id && team.event_run_id !== state.run_id) {
      res.status(409).json({ error: 'The event is initializing. Please retry.', code: 'EVENT_INITIALIZING' }); return null;
    }
  }
  return { state, team };
}

// $$NOW is evaluated by MongoDB at the write, closing the network-delay cutoff race.
function casFilter(team, state, req) {
  const event = getEventState(state);
  return { _id: team._id, current_level: team.current_level,
    progress_version: team.progress_version || 0,
    ...(state.run_id ? { event_run_id: state.run_id } : {}),
    event_open: true,
    ...teamSessionFilter(req.user),
    $expr: { $lt: ['$$NOW', event.deadline] } };
}
const conflict = res => res.status(409).json({ error: 'Progress already changed or the event ended. Refresh your team.', code: 'PROGRESS_CONFLICT' });
const safeError = res => res.status(503).json({ error: 'Unable to save progress. Refresh your team before retrying.' });

const getState = async (req, res) => {
  try {
    const data = await context(req, res, false);
    if (data) { await recordObservedTimeouts([data.team], data.state); reply(res, data.team, data.state); }
  } catch { safeError(res); }
};

async function finishRound(req, res, action) {
  // Reward and saved time use server receipt time; client clocks are never trusted.
  const now = req.received_at instanceof Date ? req.received_at : new Date();
  try {
    const data = await context(req, res, true, now);
    if (!data) return;
    const { state, team } = data;
    let puzzleResult = null;
    let puzzleType = null;
    await recordObservedTimeouts([team], state, now);
    if (action === 'solved') {
      const mapping = await MappedQuestion.findOne({ team_id: team._id, level: team.current_level });
      if (!mapping) return res.status(404).json({ error: 'Open the round question before submitting.' });
      const question = await Question.findById(mapping.selected_question_id);
      if (!question || question.set_id !== team.question_set_id || question.level !== team.current_level) {
        return res.status(409).json({ error: 'Question assignment changed. Contact an organizer.' });
      }
      if (getRoundState(team, state, now).requires_decision) {
        return res.status(409).json({ code: 'OVERTIME_DECISION_REQUIRED', error: 'Choose Continue or Skip before answering in overtime.' });
      }
      let valid;
      let validationMessage = 'Incorrect answer.';
      if (question.puzzle_type) {
        puzzleType = question.puzzle_type;
        if (req.body.question_id !== String(question._id)) {
          return res.status(409).json({ error: 'This puzzle has changed. Reload the round before submitting.', code: 'PUZZLE_INSTANCE_CHANGED' });
        }
        const submission = req.body.puzzle_submission;
        if (!submission || typeof submission !== 'object' || Array.isArray(submission) || JSON.stringify(submission).length > 9000) {
          return res.status(400).json({ error: 'Submit a puzzle arrangement or program of at most 9000 characters.', code: 'INVALID_PUZZLE_SUBMISSION' });
        }
        if (!isEarly(question) && !discoveryUnlocked(getPuzzle(question, team), mapping)) {
          return res.status(409).json({ error: 'Decipher the clue and find its resource before submitting this puzzle.', code: 'DISCOVERY_REQUIRED' });
        }
        if (isEarly(question)) {
          req.params.questionId = String(question._id);
          puzzleResult = await withCurrentPuzzle(req, async ({ document }, session) => {
            await consumeAnswerAttempt(document, session);
            return validateEarly(question, document, submission);
          });
        } else puzzleResult = validatePuzzle(question, team, submission);
        valid = puzzleResult.valid;
        validationMessage = puzzleResult.message || 'The arrangement does not satisfy the puzzle rules.';
      } else {
        if (typeof req.body.answer !== 'string' || req.body.answer.length > 2000) {
          return res.status(400).json({ error: 'Enter an answer of at most 2000 characters.' });
        }
        valid = normalize(req.body.answer) === normalize(question.correct_answer);
      }
      if (!valid) {
        await writeActivity({ team_id: team._id, action: 'incorrect_answer', level: team.current_level, timestamp: now,
          before: team.total_points, after: team.total_points, metadata: { run_id: state.run_id,
            ...(question.puzzle_type ? { puzzle_type: question.puzzle_type } : {}) } });
        return res.status(400).json({ code: question.puzzle_type ? 'INVALID_PUZZLE_SOLUTION' : 'INCORRECT_ANSWER', error: validationMessage });
      }
    }
    let changes;
    try { changes = outcomeUpdate(team, state, action, now); }
    catch (error) {
      return res.status(error.code === 'EVENT_ENDED' ? 403 : 409).json({ error: error.message, code: error.code });
    }
    if (puzzleResult) {
      changes.outcome.puzzle_summary = puzzleResult.summary || {};
      changes.outcome.puzzle_type = puzzleType;
    }
    const updated = await Team.findOneAndUpdate(casFilter(team, state, req), changes.update, { new: true });
    if (!updated) return conflict(res);
    const outcome = changes.outcome;
    await writeActivity({ event_id: outcome.id, team_id: team._id, action, level: outcome.level,
      timestamp: outcome.timestamp, delta: outcome.points, before: outcome.before, after: outcome.after,
      metadata: { run_id: state.run_id, carry_ms: outcome.carry_ms, overtime_ms: outcome.overtime_ms,
        ...(puzzleResult ? { puzzle_type: puzzleType, puzzle_summary: puzzleResult.summary || {} } : {}) } });
    if (updated.current_level <= 5) {
      const nextRound = getRoundState(updated, state, now);
      await writeActivity({ event_id: `${outcome.id}:next`, team_id: team._id, action: 'round_started',
        level: updated.current_level, timestamp: now, metadata: { run_id: state.run_id,
          carry_ms: nextRound.carry_ms, deadline: nextRound.deadline } });
    }
    if (updated.current_level === 6) {
      // Derived result delivery must never turn a committed score into a failed answer.
      try {
        await Result.findOneAndUpdate({ team_id: updated._id }, { team_id: updated._id,
          total_points: updated.total_points, completion_time: now.getTime() - new Date(updated.start_time).getTime() },
        { upsert: true, new: true, maxTimeMS: 2000 });
      } catch { console.error('[RESULT] Derived result delivery failed; team outcome remains authoritative.'); }
    }
    reply(res, updated, state, { outcome, ...(action === 'solved' ? { points_awarded: outcome.points } :
      { points_deducted: -outcome.points }) });
  } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message, code: error.code }); safeError(res); }
}
const submitProgress = (req, res) => finishRound(req, res, 'solved');
const skipRound = (req, res) => finishRound(req, res, 'skipped');
const continueRound = async (req, res) => {
  const now = req.received_at instanceof Date ? req.received_at : new Date();
  try {
    const data = await context(req, res, true, now);
    if (!data) return;
    const { state, team } = data;
    const round = getRoundState(team, state, now);
    if (round.continued) return reply(res, team, state);
    if (!round.requires_decision) return res.status(409).json({ error: 'The round still has time remaining.', code: 'OVERTIME_NOT_STARTED' });
    const updated = await Team.findOneAndUpdate(casFilter(team, state, req), {
      $inc: { progress_version: 1 }, $set: { overtime_continued_at: now }
    }, { new: true, timestamps: false });
    if (!updated) return conflict(res);
    await writeActivity({ team_id: team._id, action: 'continued', level: team.current_level, timestamp: now,
      before: team.total_points, after: team.total_points, metadata: { run_id: state.run_id } });
    reply(res, updated, state);
  } catch { safeError(res); }
};
module.exports = { submitProgress, skipRound, continueRound, getState };
