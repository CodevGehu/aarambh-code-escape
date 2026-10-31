const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const rehearsal = require('../controllers/earlyRehearsalController');
const { getPuzzles, checkPuzzle, discoverPuzzle, downloadPuzzleTool } = require('../controllers/adminPuzzleController');
const router = express.Router();

// Always-open practice for registered teams: the organizer rehearsal sandbox and
// answer booklet, owned per team. It never touches official progress or scores.
router.use(authMiddleware, (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  req.admin = { sid: `practice:${req.team._id}` };
  next();
});
router.get('/puzzles', getPuzzles);
router.post('/puzzles/:id/check', checkPuzzle);
router.post('/puzzles/:id/discover', discoverPuzzle);
router.post('/puzzles/:id/tool', downloadPuzzleTool);
router.post('/rehearsals', rehearsal.createRehearsal);
router.post('/rehearsals/:id/signal', rehearsal.signal);
router.post('/rehearsals/:id/repair', rehearsal.repair);
router.post('/rehearsals/:id/probe', rehearsal.probe);
router.post('/rehearsals/:id/check', rehearsal.check);
router.post('/rehearsals/:id/reference-check', rehearsal.referenceCheck);
router.get('/rehearsals/:id/artifacts/:artifactId', rehearsal.downloadArtifact);
router.get('/answer-booklet', async (req, res) => {
  const { set_id: setId, level, rehearsal_id: rehearsalId } = req.query;
  if (!['L1', 'L2', 'L3'].includes(setId) ||
      (level !== undefined && (typeof level !== 'string' || !/^[1-5]$/.test(level))) ||
      (rehearsalId !== undefined && (typeof rehearsalId !== 'string' || rehearsalId.length > 100))) {
    return res.status(400).json({ error: 'Choose a valid set and round.' });
  }
  try {
    const { getAnswerBooklet } = require('../services/adminBookletContent');
    return res.json(await getAnswerBooklet({ setId, level: level ? Number(level) : undefined, rehearsalId, adminSessionId: req.admin.sid }));
  } catch (error) {
    const status = [400, 404, 409].includes(error.status) ? error.status : 503;
    return res.status(status).json({ error: status === 404 ? 'Practice round not found.' : 'The answer booklet is temporarily unavailable.' });
  }
});
module.exports = router;
