const express = require('express');
const router = express.Router();
const { login, googleLogin, getConfig, getMe, logout } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20,
  // Most teams share one university network; bound guesses per entered email.
  keyGenerator: req => typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim().slice(0, 254) : 'invalid-email',
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many sign-in attempts for this email. Please wait 15 minutes.' }
});
router.post('/login', loginLimiter, login);
const googleLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 2000, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many sign-in requests. Please wait and try again.' } });
router.get('/config', getConfig);
router.post('/google', googleLimiter, googleLogin);
router.get('/me', authMiddleware, getMe);
router.post('/logout', authMiddleware, logout);
module.exports = router;
