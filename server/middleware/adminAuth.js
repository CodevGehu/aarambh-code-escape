const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
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
    const decoded = jwt.verify(token, secret);
    if (!decoded.isAdmin) {
      throw new Error();
    }
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

module.exports = adminAuth;
