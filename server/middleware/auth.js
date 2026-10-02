const jwt = require('jsonwebtoken');
const Team = require('../models/Team');
const { isRosterTeam } = require('../services/registrationPolicy');

const authMiddleware = async (req, res, next) => {
  const secret = process.env.JWT_TEAM_SECRET;
  if (!secret) return res.status(503).json({ error: 'Team authentication is not configured.' });
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Please sign in with your team access code.' });
  let claims;
  try {
    claims = jwt.verify(authHeader.slice(7), secret, {
      algorithms: ['HS256'], issuer: 'aarambh-code-escape', audience: 'participant'
    });
    if (claims.role !== 'team' || typeof claims.sid !== 'string' || !claims.sub) throw new Error('Invalid participant token');
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
  try {
    const team = await Team.findOne({ _id: claims.sub, active_session_id: claims.sid });
    if (!isRosterTeam(team)) {
      return res.status(401).json({ error: 'Your team session has ended or access is no longer active. Check your Aarambh registration.' });
    }
    req.user = { id: String(team._id), email: team.email, sessionId: claims.sid };
    req.team = team;
    return next();
  } catch {
    return res.status(503).json({ error: 'Team authentication is temporarily unavailable.' });
  }
};
module.exports = { authMiddleware };
