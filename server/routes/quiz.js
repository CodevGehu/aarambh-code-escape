const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const adminAuth = require('../middleware/adminAuth');

// Public — anyone can check quiz status
router.get('/status', quizController.getStatus);
router.get('/config', adminAuth, quizController.getConfig);
router.patch('/config', adminAuth, quizController.updateConfig);

// Admin-only endpoints (protected)
router.post('/start', adminAuth, quizController.startQuiz);
router.post('/end', adminAuth, quizController.endQuiz);
router.post('/reset', adminAuth, quizController.resetQuiz);

module.exports = router;
