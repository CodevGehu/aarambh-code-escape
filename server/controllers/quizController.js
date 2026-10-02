const { randomUUID } = require('node:crypto');
const QuizState = require('../models/QuizState');
const Team = require('../models/Team');
const MappedQuestion = require('../models/MappedQuestion');
const Result = require('../models/Result');
const { prepareTeamQuestionSets } = require('../services/questionSets');
const { getEventState, defaultConfig, validateConfig } = require('../services/eventRules');
const { writeActivity, recordObservedTimeouts } = require('../services/activityLog');
const { rosterFilter } = require('../services/registrationPolicy');
const safeError = res => res.status(503).json({ error: 'Event operation failed. Refresh before retrying.' });
const versionFilter = version => version ? { config_version: version } :
  { $or: [{ config_version: 0 }, { config_version: { $exists: false } }] };

async function ensureState() {
  try {
    return await QuizState.findOneAndUpdate({ key: 'global' }, { $setOnInsert: { key: 'global' } }, { upsert: true, new: true });
  } catch (error) {
    if (error.code === 11000) return QuizState.findOne({ key: 'global' });
    throw error;
  }
}
exports.getStatus = async (req, res) => {
  try {
    const state = await ensureState();
    await recordObservedTimeouts([], state);
    res.json(getEventState(state));
  } catch { safeError(res); }
};
exports.getConfig = async (req, res) => {
  try {
    const state = await ensureState();
    res.json({ config: getEventState(state).config, editable: state.status === 'not_started' });
  } catch { safeError(res); }
};
exports.updateConfig = async (req, res) => {
  try {
    const state = await ensureState();
    if (state.status !== 'not_started') return res.status(409).json({ error: 'Settings are frozen once the event starts.' });
    let config;
    try { config = validateConfig({ ...(state.config || defaultConfig()), ...req.body }); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const updated = await QuizState.findOneAndUpdate({ key: 'global', status: 'not_started', ...versionFilter(state.config_version) },
      { $set: { config }, $inc: { config_version: 1 } }, { new: true });
    if (!updated) return res.status(409).json({ error: 'Settings or event state changed. Refresh and retry.' });
    await writeActivity({ action: 'settings_updated', before: state.config || defaultConfig(), after: config });
    res.json({ config, editable: true });
  } catch { safeError(res); }
};
exports.startQuiz = async (req, res) => {
  try {
    let state = await QuizState.findOne({ key: 'global' });
    if (state && !['not_started', 'starting'].includes(state.status)) {
      return res.status(409).json({ error: 'Quiz is already active or ended. Reset before starting another event.' });
    }
    if (state?.status !== 'starting') {
      await prepareTeamQuestionSets();
      state = await ensureState();
      if (state.status !== 'not_started') return res.status(409).json({ error: 'Event state changed. Refresh and retry.' });
      const now = new Date();
      const config = validateConfig(state.config || {});
      state = await QuizState.findOneAndUpdate({ key: 'global', status: 'not_started', ...versionFilter(state.config_version) },
        { $set: { status: 'starting', started_at: now, ended_at: null,
          deadline: new Date(now.getTime() + 120 * 60000), run_id: randomUUID(), frozen_config: config } }, { new: true });
      if (!state) return res.status(409).json({ error: 'Quiz is already starting or settings changed.' });
    }
    // A retry repairs interrupted initialization without resetting initialized teams.
    await Team.updateMany({ ...rosterFilter(), event_run_id: { $ne: state.run_id } }, { $set: {
      event_run_id: state.run_id, event_open: true, current_level: 1, start_time: state.started_at,
      round_started_at: state.started_at, carry_ms: 0, overtime_continued_at: null, score_reached_at: state.started_at
    }, $inc: { progress_version: 1 } }, { timestamps: false });
    const started = await QuizState.findOneAndUpdate({ key: 'global', status: 'starting', run_id: state.run_id },
      { $set: { status: 'active' } }, { new: true });
    if (!started) return res.status(409).json({ error: 'Another organizer completed this start. Refresh the event.' });
    await writeActivity({ action: 'event_started', timestamp: state.started_at,
      metadata: { run_id: state.run_id, deadline: state.deadline, config: state.frozen_config } });
    res.json({ message: 'Quiz started!', ...getEventState(started) });
  } catch (error) {
    if (error.code === 'QUESTION_SET_CONFIGURATION') return res.status(400).json({ error: error.message });
    safeError(res);
  }
};
exports.endQuiz = async (req, res) => {
  try {
    const state = await QuizState.findOne({ key: 'global' });
    if (!state || !['active', 'starting'].includes(state.status)) return res.status(409).json({ error: 'The event is not active.' });
    const now = new Date();
    // Close the same Team document used by scoring CAS before changing global status.
    await Team.updateMany({ event_run_id: state.run_id, event_open: true }, { $set: { event_open: false } }, { timestamps: false });
    const ended = await QuizState.findOneAndUpdate({ key: 'global', run_id: state.run_id, status: state.status },
      { $set: { status: 'ended', ended_at: now } }, { new: true });
    if (!ended) return res.status(409).json({ error: 'Event state changed. Refresh the dashboard.' });
    await writeActivity({ action: 'event_ended', timestamp: now, metadata: { run_id: state.run_id } });
    res.json({ message: 'Quiz ended!', ...getEventState(ended, now) });
  } catch { safeError(res); }
};
exports.resetQuiz = async (req, res) => {
  try {
    let state = await ensureState();
    if (['active', 'starting'].includes(getEventState(state).status)) return res.status(409).json({ error: 'End the event before resetting progress.' });
    if (state.status !== 'resetting') {
      state = await QuizState.findOneAndUpdate({ key: 'global', run_id: state.run_id || null, status: state.status },
        { $set: { status: 'resetting' } }, { new: true });
      if (!state) return res.status(409).json({ error: 'Event state changed. Refresh before resetting.' });
    }
    // Team version/run identity invalidate stale in-flight submissions.
    await Team.updateMany({}, [{ $set: { event_history: { $cond: [
      { $gt: [{ $size: { $ifNull: ['$outcomes', []] } }, 0] },
      { $concatArrays: [{ $ifNull: ['$event_history', []] }, [{ run_id: '$event_run_id', outcomes: '$outcomes',
        total_points: '$total_points', score_reached_at: '$score_reached_at', archived_at: '$$NOW' }]] },
      { $ifNull: ['$event_history', []] }] }, current_level: 0, question_set_id: null,
      total_points: 0, level_points: {}, start_time: null, end_time: null, round_started_at: null,
      carry_ms: 0, overtime_continued_at: null, event_run_id: null, event_open: false, score_reached_at: null, outcomes: [],
      progress_version: { $add: [{ $ifNull: ['$progress_version', 0] }, 1] } } }], { timestamps: false });
    await MappedQuestion.deleteMany({});
    await Result.deleteMany({});
    const reset = await QuizState.findOneAndUpdate({ key: 'global', run_id: state.run_id || null, status: 'resetting' },
      { $set: { status: 'not_started', started_at: null, ended_at: null, deadline: null, run_id: null, frozen_config: null,
        question_set_assignments: [], question_set_assignment_version: 0 } }, { new: true });
    if (!reset) return res.status(409).json({ error: 'Event state changed during reset. Refresh before retrying.' });
    await writeActivity({ action: 'event_reset', metadata: { previous_run_id: state.run_id } });
    res.json({ message: 'Quiz reset! Event logs retained.', ...getEventState(reset) });
  } catch { safeError(res); }
};
