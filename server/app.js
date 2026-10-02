const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_TEAM_SECRET', 'JWT_ADMIN_SECRET', 'ADMIN_PASSWORD'];
const missingConfiguration = () => REQUIRED_ENV.filter(key => !process.env[key]);

const app = express();
app.set('trust proxy', 1);
app.use((req, res, next) => {
  req.received_at = new Date();
  next();
});
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = ['http://localhost:5173', 'http://localhost:3000',
      ...(process.env.FRONTEND_URL || '').split(',').map(value => value.trim()).filter(Boolean)];
    // Same-origin requests need no CORS header; preview deployments work too.
    return callback(null, allowed.includes(origin));
  },
  credentials: false
}));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', async (req, res) => {
  const missing = missingConfiguration();
  if (missing.length) {
    return res.status(503).json({ status: 'setup_required', missing,
      database: connectDB.getStatus(), timestamp: new Date().toISOString() });
  }
  try {
    await connectDB();
    await require('mongoose').connection.db.admin().ping();
    return res.json({ status: 'ready', database: connectDB.getStatus(), timestamp: new Date().toISOString() });
  } catch {
    return res.status(503).json({ status: 'database_unavailable',
      database: { configured: true, connected: false }, timestamp: new Date().toISOString() });
  }
});
app.use('/api', async (req, res, next) => {
  if (missingConfiguration().length) {
    return res.status(503).json({ error: 'The event server needs organizer setup.', code: 'SETUP_REQUIRED' });
  }
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(503).json({ error: error.message, code: error.code });
  }
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/integrations/aarambh', require('./routes/aarambhIntegration').router);
app.use('/api/questions', require('./routes/questions'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/export', require('./routes/export'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use((error, req, res, next) => {
  // Raw driver exceptions may contain credentials. Keep logs and responses safe.
  const status = error.status || error.statusCode || 500;
  console.error(`[API_ERROR] ${req.method} ${req.path} status=${status}`);
  res.status(status).json({ error: status === 413 ? 'Request is too large.' :
    status === 400 ? 'Invalid request.' : 'An internal server error occurred.' });
});
module.exports = app;
