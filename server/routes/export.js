const express = require('express');
const router = express.Router();
const { exportExcel } = require('../controllers/exportController');
const adminAuth = require('../middleware/adminAuth');
const rateLimit = require('express-rate-limit');

const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per 15 minutes
  message: { error: 'Too many export requests from this IP, please try again later.' }
});

// Export is protected for admin use
router.get('/excel', adminAuth, exportLimiter, exportExcel);

module.exports = router;
