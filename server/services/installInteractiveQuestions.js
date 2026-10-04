const Question = require('../models/Question');
const QuizState = require('../models/QuizState');
const { puzzleQuestions } = require('./interactivePuzzles');

function planReplacement(questions) {
  return puzzleQuestions.map(replacement => {
    const matches = questions.filter(question => question.set_id === replacement.set_id && question.level === replacement.level);
    if (matches.length !== 1) throw new Error(`Set ${replacement.set_id}, round ${replacement.level} must have exactly one existing question.`);
    const before = matches[0];
    const changed = Object.entries(replacement).some(([key, value]) => before[key] !== value);
    return { before, replacement, changed };
  });
}

async function installInteractiveQuestions({ apply = false, backup } = {}) {
  const session = await Question.startSession();
  let report;
  try {
    await session.withTransaction(async () => {
      const state = await QuizState.findOne({ key: 'global' }).session(session).lean();
      if (!state || !['not_started', 'ended'].includes(state.status)) {
        throw new Error('Question installation requires a stopped event. End the event before changing its question bank.');
      }
      const questions = await Question.find({ archived: { $ne: true }, level: { $in: [4, 5] }, set_id: { $in: ['L1', 'L2', 'L3'] } }).session(session).lean();
      const plan = planReplacement(questions);
      const changed = plan.filter(item => item.changed);
      // Always retain the previous document. A question request that began just
      // before the event ended may still create its mapping during installation.
      // Updating an apparently unreferenced document would change that history.
      report = { applied: apply, changed_questions: changed.length, rounds: plan.map(item => ({ set_id: item.replacement.set_id,
        level: item.replacement.level, type: item.replacement.puzzle_type, changed: item.changed,
        retain_previous_version: item.changed })), event_status: state.status };
      if (!apply || !changed.length) return;
      if (typeof backup !== 'function') throw new Error('A private question backup is required before installation.');
      // Claim the same document used by start/reset so a simultaneous organizer
      // action conflicts with this transaction instead of changing a live bank.
      const claimed = await QuizState.updateOne({ _id: state._id, status: state.status }, { $inc: { config_version: 1 } }, { session });
      if (claimed.modifiedCount !== 1) throw new Error('The event state changed. Retry after it stops.');
      await backup(changed.map(item => item.before));
      for (const item of changed) {
        await Question.updateOne({ _id: item.before._id }, { $set: { archived: true } }, { session });
        await Question.create([{ ...item.replacement, archived: false }], { session });
      }
    });
    return report;
  } finally { await session.endSession(); }
}

module.exports = { planReplacement, installInteractiveQuestions };
