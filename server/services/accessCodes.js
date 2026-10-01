const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(scrypt);

function generateAccessCode() { return randomBytes(12).toString('base64url'); }
async function hashAccessCode(code) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(code, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
async function verifyAccessCode(code, encoded) {
  if (typeof code !== 'string' || code.length < 1 || code.length > 128 || typeof encoded !== 'string') return false;
  const [format, salt, digest] = encoded.split(':');
  if (format !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(digest || '')) return false;
  const key = await derive(code, salt, 64);
  return timingSafeEqual(key, Buffer.from(digest, 'hex'));
}
module.exports = { generateAccessCode, hashAccessCode, verifyAccessCode };
