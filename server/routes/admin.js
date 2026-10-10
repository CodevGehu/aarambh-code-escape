const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const AdminSession = require('../models/AdminSession');
const { createSession, secureEqual, reserveAttempt, privateResponse } = require('../services/adminSessions');

// Bound failed guesses per client IP while allowing normal organizer sessions.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many organizer sign-in attempts. Please wait 15 minutes and try again.' }
});

// POST /api/admin/login
router.post('/login', loginLimiter, async (req, res) => {
  privateResponse(res);
  try {
  const attempt = await reserveAttempt('admin-login', String(req.ip || 'unknown'), 10);
  if (!attempt.allowed) return res.set('Retry-After', String(attempt.retry_after)).status(429).json({ error: 'Too many organizer sign-in attempts. Please try again later.' });
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 256) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const isPasswordValid = secureEqual(password, adminPassword);

  if (username === 'admin' && isPasswordValid) {
    const secret = process.env.JWT_ADMIN_SECRET;
    if (!secret) {
      console.error('JWT_ADMIN_SECRET missing.');
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    const session = await createSession();
    res.json({ ...session, message: 'Login successful' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
  } catch { res.status(503).json({ error: 'Organizer sign-in is temporarily unavailable.' }); }
});

// GET /api/admin/verify (Optional: check if token is valid)
const adminAuth = require('../middleware/adminAuth');
router.get('/verify', adminAuth, (req, res) => {
  res.json({ valid: true });
});
router.post('/logout', adminAuth, async (req, res) => {
  try {
    await AdminSession.updateOne({ session_id: req.admin.sid, revoked_at: null }, { $set: { revoked_at: new Date() } });
    res.json({ message: 'Organizer signed out.' });
  } catch { res.status(503).json({ error: 'Sign-out could not be completed. Please retry.' }); }
});
router.use('/answer-booklet', require('./adminBooklet'));

const { getTeams, getLogs, exportLogs } = require('../controllers/adminEventController');
router.get('/teams', adminAuth, getTeams);
router.get('/logs', adminAuth, getLogs);
router.get('/logs/export', adminAuth, exportLogs);
const { getPuzzles, checkPuzzle, discoverPuzzle, downloadPuzzleTool } = require('../controllers/adminPuzzleController');
router.get('/puzzles', adminAuth, getPuzzles);
router.post('/puzzles/:id/check', adminAuth, checkPuzzle);
router.post('/puzzles/:id/discover', adminAuth, discoverPuzzle);
router.post('/puzzles/:id/tool', adminAuth, downloadPuzzleTool);
router.post('/puzzles/:id/reference-check', adminAuth, (req, res) => {
  try {
    const engine = require('../services/interactivePuzzles');
    const question = engine.puzzleQuestions.find(item => `preview-${item.set_id}-${item.level}` === req.params.id);
    if (!question) return res.status(404).json({ error: 'Rehearsal puzzle not found.' });
    const preview = { ...question, _id: req.params.id };
    const team = { _id: 'organizer-preview', event_run_id: 'organizer-preview-v1' };
    const proof = engine.organizerWitness(preview, team);
    const discovery = engine.organizerDiscoveryWitness(preview, team);
    if (discovery && !engine.validateDiscovery(preview, team, discovery).valid) {
      return res.status(503).json({ error: 'The reference trail needs organizer review.' });
    }
    const result = engine.validatePuzzle(preview, team, proof);
    return res.json({ valid: result.valid, message: result.valid ? 'The server reference solution passes the competition judge.' : 'The reference solution needs organizer review.' });
  } catch { return res.status(503).json({ error: 'Reference checking is temporarily unavailable.' }); }
});

module.exports = router;
