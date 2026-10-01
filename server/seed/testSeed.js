/**
 * Test seed — creates 5 teams with varied progress/scores
 * Run: node seed/testSeed.js
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Team = require('../models/Team');
const QuizState = require('../models/QuizState');
const connectDB = require('../config/db');

const now = new Date();
const minutesAgo = (m) => new Date(now.getTime() - m * 60000);

const testTeams = [
  {
    team_name: 'Straw Hat Pirates',
    leader_name: 'Monkey D. Luffy',
    email: process.env.TEAM1_EMAIL || 'luffy@example.com',
    members: ['Zoro', 'Nami', 'Sanji'],
    current_level: 6,          // completed all 5 levels
    total_points: 1500,
    start_time: minutesAgo(45),
    end_time: minutesAgo(5)    // finished 5 min ago
  },
  {
    team_name: 'Heart Pirates',
    leader_name: 'Trafalgar Law',
    email: 'law@example.com',
    members: ['Bepo', 'Shachi', 'Penguin'],
    current_level: 4,          // on level 4
    total_points: 600,
    start_time: minutesAgo(40),
    end_time: null
  },
  {
    team_name: 'Red Hair Pirates',
    leader_name: 'Shanks',
    email: 'shanks@example.com',
    members: ['Benn Beckman', 'Yasopp', 'Lucky Roux'],
    current_level: 6,          // also completed
    total_points: 1500,
    start_time: minutesAgo(50),
    end_time: minutesAgo(2)    // finished 2 min ago (faster)
  },
  {
    team_name: 'Whitebeard Pirates',
    leader_name: 'Edward Newgate',
    email: 'whitebeard@example.com',
    members: ['Marco', 'Ace', 'Jozu'],
    current_level: 2,          // on level 2
    total_points: 100,
    start_time: minutesAgo(30),
    end_time: null
  },
  {
    team_name: 'Kid Pirates',
    leader_name: 'Eustass Kid',
    email: 'kid@example.com',
    members: ['Killer', 'Heat', 'Wire'],
    current_level: 5,          // on level 5
    total_points: 1000,
    start_time: minutesAgo(42),
    end_time: null
  }
];

async function testSeed() {
  try {
    await connectDB();

    console.log('🧹 Clearing teams...');
    await Team.deleteMany({});

    // Set quiz to active
    await QuizState.findOneAndUpdate(
      { key: 'global' },
      { status: 'active', started_at: minutesAgo(50), ended_at: null },
      { upsert: true }
    );

    console.log('👥 Seeding 5 test teams with varied progress...');
    await Team.insertMany(testTeams);

    console.log('\n✅ Test seed complete!\n');
    console.log('📋 Teams:');
    testTeams.forEach(t => {
      const status = t.current_level >= 6 ? '✅ Done' : `Level ${t.current_level}/5`;
      console.log(`   • ${t.team_name} — ${t.total_points} pts — ${status}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testSeed();
