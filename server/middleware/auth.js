const jwt = require('jsonwebtoken');
const Team = require('../models/Team');
const { isRosterTeam } = require('../services/registrationPolicy');
const { teamSessionFilter } = require('../services/teamSessions');

const authMiddleware = async (req, res, next) => {
  const secret = process.env.JWT_TEAM_SECRET;
  if (!secret) return res.status(503).json({ error: 'Team authentication is not configured.' });
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Please sign in with your registered Google account.' });
  let claims;
  try {
    claims = jwt.verify(authHeader.slice(7), secret, {
      algorithms: ['HS256'], issuer: 'aarambh-code-escape', audience: 'participant'
    });
    if (claims.role !== 'team' || typeof claims.sid !== 'string' || !claims.sid || claims.sid.length > 128 || !claims.sub ||
      (claims.member_email !== undefined && (typeof claims.member_email !== 'string' || claims.member_email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.member_email)))) throw new Error('Invalid participant token');
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
  try {
    const identity = { sessionId: claims.sid, ...(claims.member_email ? { memberEmail: claims.member_email } : {}) };
    const team = await Team.findOne({ _id: claims.sub, ...teamSessionFilter(identity) });
    if (!isRosterTeam(team)) {
      return res.status(401).json({ error: 'Your team session has ended or access is no longer active. Check your Aarambh registration.' });
    }
    req.user = { id: String(team._id), email: team.email, ...identity };
    req.team = team;
    return next();
  } catch {
    return res.status(503).json({ error: 'Team authentication is temporarily unavailable.' });
  }
};
module.exports = { authMiddleware };
