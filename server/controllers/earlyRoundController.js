const RoundPuzzleState = require('../models/RoundPuzzleState');
const { withCurrentPuzzle, RoundError } = require('../services/earlyRoundContext');
const { publicPuzzle, validateRepair, probeInput, artifact } = require('../services/earlyRoundPuzzles');
const fail = (res, error) => res.status(error.status || 503).json({ error: error.status ? error.message : 'The round is temporarily unavailable. Retry without changing your work.', ...(error.code ? { code: error.code } : {}) });
function instance(document, body) { if (body?.instance_id !== document.instance_id) throw new RoundError('This puzzle instance changed. Reload the round.', 409, 'PUZZLE_INSTANCE_CHANGED'); }
async function signal(req, res) {
  try { const value = await withCurrentPuzzle(req, async ({ question, document }) => {
    if (question.puzzle_type !== 'devtools') throw new RoundError('This round has no signal.', 404);
    instance(document, req.body); return document.private_data.y;
  }); res.set({ 'Cache-Control': 'private, no-store', 'X-Escape-Signal': String(value), 'Access-Control-Expose-Headers': 'X-Escape-Signal' }).json({ status: 'awake' }); }
  catch (error) { fail(res, error); }
}
async function repair(req, res) {
  try { const value = await withCurrentPuzzle(req, async ({ question, document }, session) => {
    if (question.puzzle_type !== 'image_repair') throw new RoundError('This round has no image repair.', 404);
    instance(document, req.body);
    try { validateRepair(document, req.body.source, req.body.marker); } catch (error) { throw new RoundError(error.message, 400, 'INVALID_REPAIR'); }
    document.stage = 'unlocked'; await document.save({ session }); return { puzzle: publicPuzzle(question, document), message: 'Repair and marker verified. The digital vault photograph is unlocked.' };
  }); res.set('Cache-Control', 'private, no-store').json(value); } catch (error) { fail(res, error); }
}
async function probe(req, res) {
  try { const value = await withCurrentPuzzle(req, async ({ question, document }, session) => {
    if (question.puzzle_type !== 'black_box') throw new RoundError('This round has no experiment machine.', 404);
    instance(document, req.body); let result;
    try { result = probeInput(document, req.body); } catch (error) { throw new RoundError(error.message, 400, 'INVALID_PROBE'); }
    if (result.entry) { document.probes.push(result.entry); await document.save({ session }); }
    const entry = result.entry || result.prior;
    return { puzzle: publicPuzzle(question, document), input: entry.input, output: entry.output, message: result.prior ? 'Previous experiment restored; no extra probe spent.' : 'Experiment recorded.' };
  }); res.set('Cache-Control', 'private, no-store').json(value); } catch (error) { fail(res, error); }
}
function sendArtifact(res, value) {
  return res.set({ 'Cache-Control': 'private, no-store', 'Content-Type': value.type, 'Content-Disposition': `attachment; filename="${value.filename}"`,
    'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' }).send(value.bytes);
}
async function downloadArtifact(req, res) {
  try { const value = await withCurrentPuzzle(req, async ({ document }) => {
    if (req.query.instance_id !== document.instance_id) throw new RoundError('This puzzle instance changed. Reload the round.');
    try { return artifact(document, req.params.artifactId); } catch (error) { throw new RoundError(error.message, 409, 'ARTIFACT_LOCKED'); }
  }); return sendArtifact(res, value); } catch (error) { fail(res, error); }
}
async function consumeAnswerAttempt(document, session) {
  // One durable per-instance bucket shared by every server worker. No score penalty.
  const now = new Date(), expired = !document.answer_window || now - document.answer_window >= 60000;
  const filter = { _id: document._id, ...(expired ? { answer_window: document.answer_window || null } : { answer_window: document.answer_window, answer_attempts: { $lt: 12 } }) };
  const update = expired ? { $set: { answer_window: now, answer_attempts: 1 } } : { $inc: { answer_attempts: 1 } };
  const saved = await RoundPuzzleState.findOneAndUpdate(filter, update, { new: true, session });
  if (!saved) throw new RoundError('Too many final checks. Wait one minute before trying again.', 429, 'ANSWER_RATE_LIMIT');
}
module.exports = { signal, repair, probe, downloadArtifact, consumeAnswerAttempt, sendArtifact };
