const Question = require('../models/Question');
const QuizState = require('../models/QuizState');
const { earlyQuestions } = require('./earlyRoundPuzzles');
function planEarlyReplacement(questions) {
  return earlyQuestions.map(replacement => {
    const matches = questions.filter(q => q.set_id === replacement.set_id && q.level === replacement.level);
    if (matches.length !== 1) throw new Error(`Set ${replacement.set_id}, round ${replacement.level} must have exactly one active question.`);
    const before = matches[0], changed = Object.entries(replacement).some(([key,value]) => before[key] !== value);
    return { before, replacement, changed };
  });
}
async function installEarlyQuestions({ apply = false, backup } = {}) {
  if (!process.env.EARLY_ROUND_SECRET || process.env.EARLY_ROUND_SECRET.length < 32) throw new Error('Configure EARLY_ROUND_SECRET before installing early questions.');
  const session = await Question.startSession(); let report;
  try { await session.withTransaction(async () => {
    const state = await QuizState.findOne({ key: 'global' }).session(session).lean();
    if (!state || !['not_started','ended'].includes(state.status)) throw new Error('Question installation requires a stopped event.');
    const questions = await Question.find({ archived: { $ne: true }, level: { $in: [1,2,3] }, set_id: { $in: ['L1','L2','L3'] } }).session(session).lean();
    const plan = planEarlyReplacement(questions), changed = plan.filter(item => item.changed);
    report = { applied: apply, changed_questions: changed.length, event_status: state.status,
      rounds: plan.map(item => ({ set_id: item.replacement.set_id, level: item.replacement.level, type: item.replacement.puzzle_type, changed: item.changed, retain_previous_version: item.changed })) };
    if (!apply || !changed.length) return;
    if (typeof backup !== 'function') throw new Error('A private question backup is required before installation.');
    const claimed = await QuizState.updateOne({ _id: state._id, status: state.status }, { $inc: { config_version: 1 } }, { session });
    if (claimed.modifiedCount !== 1) throw new Error('Event state changed. Retry after it stops.');
    await backup(changed.map(item => item.before));
    for (const item of changed) { await Question.updateOne({ _id: item.before._id }, { $set: { archived: true } }, { session }); await Question.create([{ ...item.replacement, archived: false }], { session }); }
  }); return report; } finally { await session.endSession(); }
}
module.exports = { planEarlyReplacement, installEarlyQuestions };
