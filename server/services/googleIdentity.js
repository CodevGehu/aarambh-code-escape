const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client();

async function verifyGoogleCredential(credential) {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) throw Object.assign(new Error('Google sign-in is not configured. Contact an organizer.'), { status: 503 });
  if (typeof credential !== 'string' || !credential || credential.length > 8000) {
    throw Object.assign(new Error('Sign in with your registered Google account.'), { status: 400 });
  }
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience });
    const identity = ticket.getPayload();
    if (!identity || typeof identity.sub !== 'string' || !identity.sub || identity.sub.length > 255 ||
      identity.email_verified !== true || typeof identity.email !== 'string' || identity.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email) || identity.aud !== audience ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(identity.iss) ||
      !Number.isFinite(identity.exp) || identity.exp <= Date.now() / 1000) throw new Error('Invalid Google identity');
    return { email: identity.email.toLowerCase().trim(), subject: identity.sub };
  } catch {
    throw Object.assign(new Error('Google sign-in could not be verified. Please sign in again.'), { status: 401 });
  }
}
module.exports = { verifyGoogleCredential };
