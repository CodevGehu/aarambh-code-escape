const mongoose = require('mongoose');
const { hashAccessCode } = require('../services/accessCodes');
const Team = require('../models/Team');

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required.');

async function createTestTeam() {
  await mongoose.connect(uri);
  const email = 'test@aarambh.dev';
  const accessCode = 'test-code-1234';
  const hash = await hashAccessCode(accessCode);

  const team = await Team.findOneAndUpdate(
    { email: email },
    {
      $set: {
        team_name: 'Test Team',
        leader_name: 'Test Leader',
        email: email,
        members: ['Member 1', 'Member 2'],
        question_set_id: 'L1',
        current_level: 0,
        access_code_hash: hash,
        active_session_id: null,
        total_points: 0,
        level_points: {},
        start_time: null,
        end_time: null
      }
    },
    { upsert: true, new: true }
  );

  console.log('SUCCESS_CREATED_TEST_TEAM:');
  console.log(JSON.stringify({
    team_name: team.team_name,
    leader_name: team.leader_name,
    email: team.email,
    access_code: accessCode
  }, null, 2));

  await mongoose.disconnect();
}

createTestTeam().catch(err => {
  console.error(err);
  process.exit(1);
});
