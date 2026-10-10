const jwt = require('jsonwebtoken');
const AdminSession = require('../models/AdminSession');
const { ISSUER, AUDIENCE, privateResponse } = require('../services/adminSessions');

const adminAuth = async (req, res, next) => {
  privateResponse(res);
  // Strictly require token from Authorization header
  const authHeader = req.header('Authorization');
  let token;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace('Bearer ', '');
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No valid token provided.' });
  }

  const secret = process.env.JWT_ADMIN_SECRET;
  if (!secret) {
    console.error('JWT_ADMIN_SECRET is strictly required but missing in environment.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
    if (decoded.isAdmin !== true || decoded.role !== 'admin' || decoded.username !== 'admin' ||
      typeof decoded.sid !== 'string' || !/^[a-f0-9-]{36}$/.test(decoded.sid)) {
      throw new Error();
    }
    const session = await AdminSession.findOne({ session_id: decoded.sid, username: 'admin',
      revoked_at: null, expires_at: { $gt: new Date() } }).lean();
    if (!session) throw new Error();
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

module.exports = adminAuth;
