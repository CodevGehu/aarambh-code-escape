const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Bound failed guesses per client IP while allowing normal organizer sessions.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many organizer sign-in attempts. Please wait 15 minutes and try again.' }
});

// POST /api/admin/login
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 256) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const isPasswordValid = crypto.timingSafeEqual(
    crypto.createHash('sha256').update(String(password)).digest(),
    crypto.createHash('sha256').update(String(adminPassword)).digest()
  );

  if (username === 'admin' && isPasswordValid) {
    const secret = process.env.JWT_ADMIN_SECRET;
    if (!secret) {
      console.error('JWT_ADMIN_SECRET missing.');
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    const token = jwt.sign(
      { isAdmin: true, username: 'admin' },
      secret,
      { expiresIn: '12h' } // Token valid for 12 hours
    );

    res.json({ token, message: 'Login successful' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// GET /api/admin/verify (Optional: check if token is valid)
const adminAuth = require('../middleware/adminAuth');
router.get('/verify', adminAuth, (req, res) => {
  res.json({ valid: true });
});

const { getTeams, getLogs, exportLogs } = require('../controllers/adminEventController');
router.get('/teams', adminAuth, getTeams);
router.get('/logs', adminAuth, getLogs);
router.get('/logs/export', adminAuth, exportLogs);
const { getPuzzles, checkPuzzle, discoverPuzzle } = require('../controllers/adminPuzzleController');
router.get('/puzzles', adminAuth, getPuzzles);
router.post('/puzzles/:id/check', adminAuth, checkPuzzle);
router.post('/puzzles/:id/discover', adminAuth, discoverPuzzle);

module.exports = router;
