const test = require('node:test');
const assert = require('node:assert/strict');
const { OAuth2Client } = require('google-auth-library');
const { verifyGoogleCredential } = require('../services/googleIdentity');

test('Google credentials require the configured audience and a verified, unexpired signed identity', async t => {
  const saved = process.env.GOOGLE_CLIENT_ID, verify = OAuth2Client.prototype.verifyIdToken;
  t.after(() => {
    if (saved === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = saved;
    OAuth2Client.prototype.verifyIdToken = verify;
  });
  delete process.env.GOOGLE_CLIENT_ID;
  await assert.rejects(verifyGoogleCredential('credential'), error => error.status === 503);
  process.env.GOOGLE_CLIENT_ID = 'test-audience.apps.googleusercontent.com';
  for (const value of [undefined, {}, '', 'x'.repeat(8001)]) await assert.rejects(verifyGoogleCredential(value), error => error.status === 400);
  const good = { sub: 'verified-google-subject', email: 'Member@Example.test', email_verified: true,
    aud: process.env.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', exp: Math.floor(Date.now() / 1000) + 3600 };
  let payload = good;
  OAuth2Client.prototype.verifyIdToken = async options => {
    assert.deepEqual(options, { idToken: 'credential', audience: process.env.GOOGLE_CLIENT_ID });
    return { getPayload: () => payload };
  };
  assert.deepEqual(await verifyGoogleCredential('credential'), { email: 'member@example.test', subject: good.sub });
  payload = { ...good, email: 'confirmed@icloud.in' };
  assert.deepEqual(await verifyGoogleCredential('credential'), { email: 'confirmed@icloud.in', subject: good.sub }, 'Registered Google accounts need not use Gmail addresses');
  for (const change of [{ sub: '' }, { email_verified: false }, { email: 'bad' }, { aud: 'another-client' },
    { iss: 'https://malicious.example' }, { exp: Math.floor(Date.now() / 1000) - 1 }]) {
    payload = { ...good, ...change };
    await assert.rejects(verifyGoogleCredential('credential'), error => error.status === 401);
  }
  OAuth2Client.prototype.verifyIdToken = async () => { throw new Error('Invalid signature, expired token, or certificate verification failure'); };
  await assert.rejects(verifyGoogleCredential('credential'), error => error.status === 401 && !error.message.includes('signature'));
});
