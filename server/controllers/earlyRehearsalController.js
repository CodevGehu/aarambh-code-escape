const { randomUUID } = require('node:crypto');
const PuzzleRehearsal = require('../models/PuzzleRehearsal');
const { earlyQuestions, generatePrivate, publicPuzzle, validateEarly, validateRepair, probeInput, artifact } = require('../services/earlyRoundPuzzles');
const { sendArtifact } = require('./earlyRoundController');
const previewQuestions = () => earlyQuestions.map(q => ({ ...q, _id: `preview-${q.set_id}-${q.level}` }));
const errorReply = (res, error) => res.status(error.status || 503).json({ error: error.status ? error.message : 'Rehearsal is temporarily unavailable.' });
function error(message, status = 400) { return Object.assign(new Error(message), { status }); }
async function loadRehearsal(id, owner) {
  if (!/^[a-f0-9]{24}$/i.test(id || '')) throw error('Rehearsal not found.', 404);
  const document = await PuzzleRehearsal.findOne({ _id: id, owner, expires_at: { $gt: new Date() } }).select('+private_data');
  if (!document) throw error('Rehearsal expired or belongs to another organizer session.', 404);
  const question = previewQuestions().find(q => q._id === document.question_id);
  if (!question) throw error('Rehearsal question is unavailable.', 404);
  return { document, question };
}
async function createRehearsal(req, res) {
  try {
    const question = previewQuestions().find(q => q._id === req.body?.question_id);
    if (!question) throw error('Choose a round 1–3 rehearsal question.', 404);
    const instanceId = randomUUID(), owner = req.admin.sid;
    if (!owner) throw error('Organizer session is required.', 401);
    const privateData = generatePrivate(question, { _id: owner, event_run_id: 'rehearsal' }, instanceId);
    const document = await PuzzleRehearsal.create({ owner, question_id: question._id, instance_id: instanceId,
      kind: question.puzzle_type, private_data: privateData, expires_at: new Date(Date.now() + 2 * 3600000), probes: [] });
    return res.set('Cache-Control', 'private, no-store').json({ rehearsal_id: String(document._id), puzzle: publicPuzzle(question, document) });
  } catch (failure) { errorReply(res, failure); }
}
async function signal(req, res) {
  try { const { question, document } = await loadRehearsal(req.params.id, req.admin.sid);
    if (question.puzzle_type !== 'devtools' || req.body.instance_id !== document.instance_id) throw error('Wrong rehearsal instance.');
    return res.set({ 'Cache-Control': 'private, no-store', 'X-Escape-Signal': String(document.private_data.y), 'Access-Control-Expose-Headers': 'X-Escape-Signal' }).json({ status: 'awake' });
  } catch (failure) { errorReply(res, failure); }
}
async function repair(req, res) {
  try { const { question, document } = await loadRehearsal(req.params.id, req.admin.sid);
    if (question.puzzle_type !== 'image_repair' || req.body.instance_id !== document.instance_id) throw error('Wrong rehearsal instance.');
    try { validateRepair(document, req.body.source, req.body.marker); } catch (failure) { throw error(failure.message); }
    document.stage = 'unlocked'; await document.save();
    return res.set('Cache-Control', 'private, no-store').json({ puzzle: publicPuzzle(question, document), message: 'Rehearsal repair verified. Digital photograph unlocked.' });
  } catch (failure) { errorReply(res, failure); }
}
async function probe(req, res) {
  try {
    // Optimistic CAS retries keep simultaneous organizer experiments within six too.
    for (let attempt = 0; attempt < 12; attempt++) {
      const { question, document } = await loadRehearsal(req.params.id, req.admin.sid);
      if (question.puzzle_type !== 'black_box' || req.body.instance_id !== document.instance_id) throw error('Wrong rehearsal instance.');
      let result; try { result = probeInput(document, req.body); } catch (failure) { throw error(failure.message); }
      if (result.prior) return res.json({ puzzle: publicPuzzle(question, document), ...result.prior, message: 'Previous experiment restored.' });
      const updated = await PuzzleRehearsal.findOneAndUpdate({ _id: document._id, owner: req.admin.sid, __v: document.__v,
        expires_at: { $gt: new Date() } }, { $push: { probes: result.entry }, $inc: { __v: 1 } }, { new: true }).select('+private_data');
      if (updated) return res.set('Cache-Control', 'private, no-store').json({ puzzle: publicPuzzle(question, updated), ...result.entry, message: 'Rehearsal experiment recorded.' });
    }
    throw error('Concurrent rehearsal changed. Retry your experiment.', 409);
  } catch (failure) { errorReply(res, failure); }
}
async function check(req, res) {
  try { const { question, document } = await loadRehearsal(req.params.id, req.admin.sid);
    const submission = req.body?.puzzle_submission;
    if (!submission || JSON.stringify(submission).length > 9000) throw error('Supply a final code of at most 9000 characters.');
    const result = validateEarly(question, document, submission);
    return res.set('Cache-Control', 'private, no-store').status(result.valid ? 200 : 400).json(result);
  } catch (failure) { errorReply(res, failure); }
}
async function referenceCheck(req, res) {
  try { const { question, document } = await loadRehearsal(req.params.id, req.admin.sid);
    if (question.puzzle_type === 'image_repair') { validateRepair(document, document.private_data.corrected, document.private_data.marker); document.stage = 'unlocked'; await document.save(); }
    const result = validateEarly(question, document, { instance_id: document.instance_id, code: document.private_data.answer || document.private_data.passphrase });
    return res.set('Cache-Control', 'private, no-store').json({ ...result, puzzle: publicPuzzle(question, document), message: 'Reference solution verified in this isolated rehearsal.' });
  } catch (failure) { errorReply(res, failure); }
}
async function downloadArtifact(req, res) {
  try { const { document } = await loadRehearsal(req.params.id, req.admin.sid);
    if (req.query.instance_id !== document.instance_id) throw error('Wrong rehearsal instance.');
    let value; try { value = artifact(document, req.params.artifactId); } catch (failure) { throw error(failure.message, 409); }
    return sendArtifact(res, value);
  } catch (failure) { errorReply(res, failure); }
}
module.exports = { previewQuestions, loadRehearsal, createRehearsal, signal, repair, probe, check, referenceCheck, downloadArtifact };
