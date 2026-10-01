const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Team = require('../models/Team');
const Result = require('../models/Result');
const connectDB = require('../config/db');

async function seedProgress() {
  try {
    await connectDB();
    const teams = await Team.find();

    if (teams.length === 0) {
      console.error('❌ No teams found. Please run seedQuestions.js first!');
      process.exit(1);
    }

    console.log(`🚀 Found ${teams.length} teams... simulating progress!`);

    // Simulate start times (e.g., event started 1 hour ago)
    const now = new Date();
    const startTime = new Date(now.getTime() - 60 * 60 * 1000);

    for (let i = 0; i < teams.length; i++) {
        const team = teams[i];

        // Hardcode diverse progress scenarios for the leaderboard
        if (i === 0 || i === 4) {
            // Completed the game
            team.current_level = 6;
            team.total_points = 1500;
            team.start_time = startTime;
            // Slight time offset for tied score positioning
            const minAgo = i === 0 ? 10 : 3;
            team.end_time = new Date(now.getTime() - minAgo * 60 * 1000);

            const completionTime = team.end_time.getTime() - team.start_time.getTime();
            await Result.findOneAndUpdate(
              { team_id: team._id },
              { team_id: team._id, total_points: 1500, completion_time: completionTime },
              { upsert: true }
            );
            console.log(`   🏆 ${team.team_name}: Finished with 1500 pts!`);
        } else if (i === 2 || i === 6) {
            team.current_level = 5;
            team.total_points = 1000;
            team.start_time = startTime;
            team.end_time = null;
            console.log(`   🗺️ ${team.team_name}: Level 5 with 1000 pts!`);
        } else if (i === 1 || i === 5 || i === 8) {
            team.current_level = 4;
            team.total_points = 600;
            team.start_time = startTime;
            team.end_time = null;
            console.log(`   ⚔️ ${team.team_name}: Level 4 with 600 pts!`);
        } else if (i === 3 || i === 9) {
            team.current_level = 3;
            team.total_points = 300;
            team.start_time = startTime;
            team.end_time = null;
            console.log(`   🧭 ${team.team_name}: Level 3 with 300 pts!`);
        } else {
            team.current_level = 2;
            team.total_points = 100;
            team.start_time = startTime;
            team.end_time = null;
            console.log(`   ⚓ ${team.team_name}: Level 2 with 100 pts!`);
        }

        await team.save();
    }

    console.log('\n✅ Progress successfully mocked! Check the Leaderboard now.');
    process.exit(0);
  } catch(error) {
    console.error('❌ Error mocking progress:', error);
    process.exit(1);
  }
}

seedProgress();
