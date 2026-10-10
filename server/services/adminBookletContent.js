const { randomUUID } = require('node:crypto');
const PuzzleRehearsal = require('../models/PuzzleRehearsal');
const { earlyQuestions, reference, generatePrivate } = require('./earlyRoundPuzzles');
const { loadRehearsal } = require('../controllers/earlyRehearsalController');
const { puzzleQuestions, getPuzzle, organizerWitness, organizerDiscoveryWitness } = require('./interactivePuzzles');
async function bookletRehearsal(question, owner) {
  const key = { owner, question_id: question._id, purpose: 'booklet' };
  let document = await PuzzleRehearsal.findOne(key).select('+private_data');
  if (document && document.expires_at > new Date()) return document;
  const instanceId = randomUUID(), values = { ...key, kind: question.puzzle_type, instance_id: instanceId,
    private_data: generatePrivate(question, { _id: owner, event_run_id: 'booklet' }, instanceId),
    stage: 'initial', probes: [], expires_at: new Date(Date.now() + 2 * 3600000) };
  try { document = await PuzzleRehearsal.findOneAndUpdate(key, { $set: values }, { upsert: true, new: true }).select('+private_data'); }
  catch (error) { if (error.code !== 11000) throw error; document = await PuzzleRehearsal.findOne(key).select('+private_data'); }
  return document;
}
async function getAnswerBooklet({ setId, level, rehearsalId, adminSessionId }) {
  if (!['L1', 'L2', 'L3'].includes(setId)) throw Object.assign(new Error('Choose Set 1, 2 or 3.'), { status: 400 });
  if (level !== undefined && (!Number.isInteger(Number(level)) || Number(level) < 1 || Number(level) > 5)) throw Object.assign(new Error('Choose round 1–5.'), { status: 400 });
  const rounds = [];
  const selected = rehearsalId ? await loadRehearsal(rehearsalId, adminSessionId) : null;
  for (const question of [...earlyQuestions, ...puzzleQuestions].filter(q => q.set_id === setId && (!level || q.level === Number(level))).sort((a,b) => a.level - b.level)) {
    const q = { ...question, _id: `preview-${question.set_id}-${question.level}` };
    if (question.level < 4) {
      if (selected && level && selected.question._id !== q._id) throw Object.assign(new Error('Select the matching rehearsal for this round.'), { status: 409 });
      const document = selected?.question._id === q._id ? selected.document : await bookletRehearsal(q, adminSessionId);
      rounds.push({ ...reference(q, document), rehearsal_id: String(document._id) });
    } else {
      const team = { _id: 'organizer-preview', event_run_id: 'organizer-preview-v1' }, puzzle = getPuzzle(q, team);
      rounds.push({ level: q.level, title: puzzle.title, question_text: q.question_text, instance_id: puzzle.instance_id,
        reference_submission: organizerWitness(q, team), discovery_submission: organizerDiscoveryWitness(q, team),
        explanation: puzzle.instructions.join('\n'), context: 'Certified isolated rehearsal arrangement; live team instances can differ.' });
    }
  }
  return { set_id: setId, rounds };
}
module.exports = { getAnswerBooklet };
