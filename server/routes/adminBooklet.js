const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const AdminSession = require('../models/AdminSession');
const { privateResponse } = require('../services/adminSessions');
const router = express.Router();

router.get('/', adminAuth, async (req, res) => {
  privateResponse(res);
  const { set_id: setId, level, rehearsal_id: rehearsalId } = req.query;
  if (!['L1', 'L2', 'L3'].includes(setId) ||
      (level !== undefined && (typeof level !== 'string' || !/^[1-5]$/.test(level))) ||
      (rehearsalId !== undefined && (typeof rehearsalId !== 'string' || rehearsalId.length > 100))) {
    return res.status(400).json({ error: 'Choose a valid set and round.' });
  }
  try {
    const { getAnswerBooklet } = require('../services/adminBookletContent');
    const booklet = await getAnswerBooklet({ setId, level: level ? Number(level) : undefined,
      rehearsalId, adminSessionId: req.admin.sid });
    // Recheck after asynchronous generation: logout must also cancel an in-flight
    // request that has not yet released the confidential response.
    if (!await AdminSession.exists({ session_id: req.admin.sid, revoked_at: null, expires_at: { $gt: new Date() } })) {
      return res.status(401).json({ error: 'Organizer session expired. Sign in again.' });
    }
    return res.json(booklet);
  } catch (error) {
    const status = [400, 404, 409, 503].includes(error.status) ? error.status : 503;
    return res.status(status).json({ error: status === 404 ? 'Rehearsal instance not found.' :
      status === 409 ? 'Create a rehearsal for this round before opening its answers.' :
      'The answer booklet is temporarily unavailable.' });
  }
});

module.exports = router;
