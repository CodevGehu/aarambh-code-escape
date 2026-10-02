const express = require('express');
const router = express.Router();
const { submitProgress, getState, continueRound, skipRound } = require('../controllers/progressController');
const { authMiddleware } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limit answer submissions per Gmail address (not IP).
// Reason: The game is played in university labs where many teams share
// the same public IP — IP-based limiting would block multiple legitimate
// teams simultaneously. authMiddleware runs first, so req.user.email is
// guaranteed to be set by the time the limiter evaluates.
const submitLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 15,             // 15 attempts per minute per Gmail account
  keyGenerator: (req) => req.user?.email || 'unknown', // email-first, fallback
  // Since we key on email (not IP), suppress the X-Forwarded-For
  // header validation warning that fires on proxied deployments.
  validate: { xForwardedForHeader: false, ip: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submission attempts. Please wait a moment before trying again.' }
});

// Order matters: authMiddleware runs first → populates req.user.email
// → submitLimiter uses email as the rate-limit key
router.post('/submit', authMiddleware, submitLimiter, submitProgress);
router.get('/state', authMiddleware, getState);
router.post('/continue', authMiddleware, submitLimiter, continueRound);
router.post('/skip', authMiddleware, submitLimiter, skipRound);

module.exports = router;
