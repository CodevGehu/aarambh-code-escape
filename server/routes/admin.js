const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
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

module.exports = router;
