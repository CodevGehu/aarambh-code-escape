const mongoose = require('mongoose');
const Team = require('../models/Team');
const QuizState = require('../models/QuizState');
const Question = require('../models/Question');
const MappedQuestion = require('../models/MappedQuestion');
const { getEventState, getRoundState } = require('./eventRules');
const { isEarly, ensureState } = require('./earlyRoundPuzzles');
const { teamSessionFilter } = require('./teamSessions');
class RoundError extends Error { constructor(message, status = 409, code = 'PROGRESS_CONFLICT') { super(message); this.status = status; this.code = code; } }
async function resolveContext(req, session) {
  if (!/^[a-f0-9]{24}$/i.test(req.params.questionId || '')) throw new RoundError('Invalid question.', 400, 'INVALID_QUESTION');
  const state = await QuizState.findOne({ key: 'global' }).session(session || null);
  const event = getEventState(state);
  if (event.status !== 'active') throw new RoundError('The event has ended.', 403, 'EVENT_ENDED');
  const team = await Team.findOne({ email: req.user.email.toLowerCase().trim(), ...teamSessionFilter(req.user) }).session(session || null);
  if (!team || !team.event_open || team.event_run_id !== state.run_id) throw new RoundError('Refresh your current event session.');
  const mapping = await MappedQuestion.findOne({ team_id: team._id, level: team.current_level, selected_question_id: req.params.questionId }).session(session || null);
  const question = mapping && await Question.findById(mapping.selected_question_id).session(session || null);
  if (!question || question.level !== team.current_level || question.set_id !== team.question_set_id || !isEarly(question)) throw new RoundError('Open your assigned current round first.');
  if (getRoundState(team, state).requires_decision) throw new RoundError('Choose Continue or Skip before working in overtime.', 409, 'OVERTIME_DECISION_REQUIRED');
  return { state, team, question, mapping, event };
}
async function claimContext(context, req, session) {
  const { state, team, event } = context;
  const claimedEvent = await QuizState.updateOne({ _id: state._id, status: 'active', run_id: state.run_id,
    $expr: { $lt: ['$$NOW', event.deadline] } }, { $inc: { puzzle_write_version: 1 } }, { session });
  const claimedTeam = await Team.updateOne({ _id: team._id, event_open: true, event_run_id: state.run_id,
    current_level: team.current_level, progress_version: team.progress_version, ...teamSessionFilter(req.user),
    $expr: { $lt: ['$$NOW', event.deadline] } }, { $inc: { puzzle_write_version: 1 } }, { session, timestamps: false });
  if (claimedEvent.modifiedCount !== 1 || claimedTeam.modifiedCount !== 1) throw new RoundError('The event, round or member session changed. Refresh your team.');
}
async function withCurrentPuzzle(req, operation) {
  const session = await mongoose.startSession(); let result;
  try { await session.withTransaction(async () => {
    const context = await resolveContext(req, session); await claimContext(context, req, session);
    const document = await ensureState(context.question, context.team, session);
    result = await operation({ ...context, document }, session);
  }); return result; } finally { await session.endSession(); }
}
module.exports = { RoundError, resolveContext, claimContext, withCurrentPuzzle };
