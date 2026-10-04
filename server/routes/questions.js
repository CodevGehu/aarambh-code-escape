const express = require('express');
const router = express.Router();
const { getQuestion, discoverQuestion, downloadQuestionTool } = require('../controllers/questionController');
const { authMiddleware } = require('../middleware/auth');

// GET /api/questions/:level
// Team identity comes from the JWT (authMiddleware sets req.user) — no teamId in URL.
// This prevents IDOR attacks where one team could request questions on behalf of another.
router.get('/:level', authMiddleware, getQuestion);
router.post('/:questionId/discover', authMiddleware, discoverQuestion);
router.get('/:questionId/tool', authMiddleware, downloadQuestionTool);

module.exports = router;
