require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Team = require('../models/Team');
const connectDB = require('../config/db');
const { prepareAccessCodes, savePrivateExport } = require('./accessCodeExport');

async function issueAccessCodes() {
  const args = process.argv.slice(2);
  const rotate = args.includes('--rotate');
  if (rotate && !args.includes('--confirm-rotate')) throw new Error('Rotation invalidates active team sessions. Pass --confirm-rotate to authorize it.');
  const emailIndex = args.indexOf('--email');
  const email = emailIndex >= 0 ? args[emailIndex + 1] : null;
  if (emailIndex >= 0 && (!email || email.startsWith('--'))) throw new Error('--email requires a registered leader email.');
  await connectDB();
  const filter = email ? { email: email.toLowerCase().trim() } : {};
  if (!rotate) filter.$or = [{ access_code_hash: { $exists: false } }, { access_code_hash: null }, { access_code_hash: '' }];
  const teams = await Team.find(filter).lean();
  if (!teams.length) { console.log('No teams need access codes. Existing codes and sessions were preserved.'); return; }
  const { documents, credentials } = await prepareAccessCodes(teams);
  // Save secrets before DB writes so any partial failure remains recoverable locally.
  const filename = await savePrivateExport(credentials);
  const result = await Team.bulkWrite(documents.map(team => ({ updateOne: {
    filter: { _id: team._id, ...(!rotate ? { $or: filter.$or } : {}) },
    update: { $set: { access_code_hash: team.access_code_hash, active_session_id: null } }, timestamps: false
  } })));
  console.log(`Issued ${result.modifiedCount} team access codes. Private export: ${filename}`);
  if (result.modifiedCount !== documents.length) throw new Error('Concurrent organizer operation detected. Verify which codes are active before distributing the export.');
}

if (require.main === module) {
  issueAccessCodes().catch(() => {
    console.error('Access code issuing failed. Check configuration, command flags, and any saved private export.');
    process.exitCode = 1;
  }).finally(() => mongoose.disconnect());
}
module.exports = { issueAccessCodes };
