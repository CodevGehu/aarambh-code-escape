const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { generateAccessCode, hashAccessCode } = require('../services/accessCodes');

async function prepareAccessCodes(teams) {
  const documents = [], credentials = [];
  // Sequential scrypt checks keep setup memory bounded for large rosters.
  for (const team of teams) {
    const accessCode = generateAccessCode();
    documents.push({ ...team, access_code_hash: await hashAccessCode(accessCode), active_session_id: null });
    credentials.push({ team_name: team.team_name, leader_name: team.leader_name, email: team.email, access_code: accessCode });
  }
  return { documents, credentials };
}

async function savePrivateExport(credentials) {
  const directory = path.join(__dirname, '..', '..', '.private');
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, `team-access-codes-${Date.now()}-${randomBytes(4).toString('hex')}.json`);
  await fs.writeFile(filename, JSON.stringify(credentials, null, 2), { flag: 'wx', mode: 0o600 });
  return filename;
}
module.exports = { prepareAccessCodes, savePrivateExport };
