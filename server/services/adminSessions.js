const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AdminSession = require('../models/AdminSession');
const AdminAccessAttempt = require('../models/AdminAccessAttempt');

const ISSUER = 'aarambh-code-escape';
const AUDIENCE = 'aarambh-organizer';
const SESSION_MS = 2 * 60 * 60 * 1000;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const secureEqual = (left, right) => crypto.timingSafeEqual(Buffer.from(hash(left), 'hex'), Buffer.from(hash(right), 'hex'));
const privateResponse = res => res.set({
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin'
});

async function createSession() {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await AdminSession.create({ session_id: sessionId, username: 'admin', expires_at: expiresAt });
  const token = jwt.sign({ isAdmin: true, role: 'admin', username: 'admin', sid: sessionId }, process.env.JWT_ADMIN_SECRET,
    { algorithm: 'HS256', issuer: ISSUER, audience: AUDIENCE, expiresIn: SESSION_MS / 1000 });
  return { token, expires_at: expiresAt.toISOString() };
}

// A fixed time bucket is shared by all serverless instances. Its unique key makes
// concurrent guesses increment one counter, without storing passwords or raw IPs.
async function reserveAttempt(scope, identity, limit, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const key = hash(`${scope}:${identity}:${bucket}`);
  const update = { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date((bucket + 2) * windowMs) } };
  let record;
  try { record = await AdminAccessAttempt.findOneAndUpdate({ key }, update, { upsert: true, new: true }); }
  catch (error) {
    if (error.code !== 11000) throw error;
    record = await AdminAccessAttempt.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
  }
  return { allowed: !!record && record.count <= limit, key,
    retry_after: Math.ceil(((bucket + 1) * windowMs - now) / 1000) };
}

module.exports = { ISSUER, AUDIENCE, SESSION_MS, hash, secureEqual, privateResponse, createSession, reserveAttempt };
