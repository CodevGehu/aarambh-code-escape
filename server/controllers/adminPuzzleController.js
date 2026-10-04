const { getPuzzle, validatePuzzle, validateDiscovery, puzzleQuestions } = require('../services/interactivePuzzles');
const { visiblePuzzle, discoveryRequired } = require('../services/puzzleDiscovery');
const { sendPackingTool } = require('../services/packingTool');

// The organizer's rehearsal uses separate, deterministic instances and performs
// no database writes. It never advances a team, starts an event, or awards points.
const previewTeam = { _id: 'organizer-preview', event_run_id: 'organizer-preview-v1' };
const previewQuestions = () => puzzleQuestions.map(question => ({ ...question,
  _id: `preview-${question.set_id}-${question.level}` }));

function getPuzzles(req, res) {
  res.json({ questions: previewQuestions().map(question => ({ _id: question._id,
    set_id: question.set_id, level: question.level, question_text: question.question_text,
    puzzle: visiblePuzzle(question, previewTeam) })) });
}

function discoverPuzzle(req, res) {
  const question = previewQuestions().find(item => item._id === req.params.id);
  if (!question) return res.status(404).json({ error: 'Rehearsal puzzle not found.' });
  if (!discoveryRequired(getPuzzle(question, previewTeam))) return res.status(400).json({ error: 'This room has no resource trail.' });
  const result = validateDiscovery(question, previewTeam, req.body?.discovery_submission);
  if (!result.valid) return res.status(400).json({ error: result.message });
  return res.json({ puzzle: getPuzzle(question, previewTeam), message: 'Resource found. The rehearsal workbench is open.' });
}

function checkPuzzle(req, res) {
  const question = previewQuestions().find(item => item._id === req.params.id);
  if (!question) return res.status(404).json({ error: 'Rehearsal puzzle not found.' });
  const submission = req.body?.puzzle_submission;
  if (!submission || typeof submission !== 'object' || Array.isArray(submission) || JSON.stringify(submission).length > 9000) {
    return res.status(400).json({ error: 'Supply a puzzle solution of at most 9000 characters.' });
  }
  if (discoveryRequired(getPuzzle(question, previewTeam))) {
    const discovery = validateDiscovery(question, previewTeam, submission.discovery_submission);
    if (!discovery.valid) return res.status(409).json({ error: 'Find the resource before checking this rehearsal puzzle.', code: 'DISCOVERY_REQUIRED' });
  }
  const result = validatePuzzle(question, previewTeam, submission);
  return res.status(result.valid ? 200 : 400).json({ valid: result.valid,
    message: result.message, ...(result.valid ? { summary: result.summary || {} } : {}) });
}

async function downloadPuzzleTool(req, res) {
  const question = previewQuestions().find(item => item._id === req.params.id);
  if (!question || question.puzzle_type !== 'packing' || question.puzzle_version !== 2) return res.status(404).json({ error: 'Tool not found for this room.' });
  const proof = validateDiscovery(question, previewTeam, req.body?.discovery_submission);
  if (!proof.valid) return res.status(409).json({ error: 'Find the video and repository before opening the tool.', code: 'DISCOVERY_REQUIRED' });
  try { return await sendPackingTool(res); }
  catch { return res.status(503).json({ error: 'The tool download is temporarily unavailable.' }); }
}
module.exports = { getPuzzles, checkPuzzle, discoverPuzzle, downloadPuzzleTool };
