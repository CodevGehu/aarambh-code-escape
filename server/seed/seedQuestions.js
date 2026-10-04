require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Question = require('../models/Question');
const Team = require('../models/Team');

const connectDB = require('../config/db');

// ========================================
// Three complete sets: existing L1 hunt + temporary easy L2 and L3 sets.
// Replace temporary content in placeholderQuestions.js before the event.
// ========================================
const legacyQuestions = [
  // Level 1 — Easy (100 points) — from LAST QUESTION in MD
  {
    level: 1, set_id: 'L1',
    question_text: `Recognition leaves traces—but rarely where you expect them.
Step outside the system you are in.
Look into a space where achievements are shared, not stored. A place where institutions speak through posts, not pages.
Somewhere in that stream lies a moment of pride—
a problem not solved, but created.
Find the individual behind it.
Find what they contributed—not who they are.
Do not summarize it.
Do not interpret it.
Do not classify it.
Return with it exactly as it was given.

Hint:
The answer is not a concept.
It is not a category.
It is not a type.
It is verbatim.`,
    correct_answer: '3882',
    points: 100
  },
  // Level 2 — Medium (200 points) — from 4TH QUESTION in MD
  {
    level: 2, set_id: 'L1',
    question_text: `Every system leaves a trace of its creators—but rarely in plain sight.
Begin where endings usually reside, yet information quietly persists. There, you will encounter two identifiers that seem intentionally crafted rather than inherited.
Now pause. Do not accept them at face value.
Ask yourself: would such structured, almost symbolic names ever be assigned at birth?
To move forward, shift your perspective beyond the system itself.
Observe how individuals in digital spaces—especially those who create, write, or build—choose to represent themselves when identity is flexible but recognition is essential.

Hint:
If your answer depends on where you saw the names, it's wrong.
If your answer still makes sense when applied to writers, artists, and creators across history, you're getting closer.`,
    correct_answer: 'pen name',
    points: 200
  },
  // Level 3 — Medium-Hard (300 points) — from 3RD QUESTION in MD
  {
    level: 3, set_id: 'L1',
    question_text: `Every creation carries a signature—but not always in ink.
Begin where the system quietly credits its architects.
Find the one who built it. Not by searching, but by observing where acknowledgment naturally resides.
Once you uncover the creator, your task is not complete—it has only just begun.
Follow their trail beyond this system.
Across platforms, identities may shift—sometimes consistent, sometimes altered, sometimes concealed in plain sight.
Look carefully.
On one such platform, you will find something that does not behave like a name, nor like a title.
It appears structured, almost mechanical—out of place among identities.
Do not ignore it.
Now consider this:
The platform you seek may not carry the same name as the creator.
It could reflect what they choose to be known as—or what they were originally called.
And one more detail, often overlooked:
A number repeats itself in their presence.
Not random. Not accidental.
Find the anomaly. Return it exactly as it appears.

Hint:
The answer is not a person.
It is not a platform.
It is something attached to an identity—but unlike anything else around it.
And remember—
27 is not decoration.`,
    correct_answer: 'lcc-a0acaa69',
    points: 300
  },
  // Level 4 — Hard (400 points) — from 2ND QUESTION in MD
  {
    level: 4, set_id: 'L1',
    question_text: `Not every secret is hidden behind complexity—some are hidden in plain sight, where few choose to look carefully.
You've already found the creator.
Now, don't wander—focus only on what they choose to present publicly and prominently.
Among their creations, there exists a collection—not everything, but not just one.
Stay within that set. Do not go beyond it.
Within this space, you will find something that appears where explanations usually live.
Most will read it and move on.
But something there does not belong.
It follows no format.
It explains nothing.
It exists without purpose—unless you are searching for it.
Do not analyze it.
Do not transform it.
Return it exactly as it appears.

Hint:
You are not looking across all projects—only within what is visibly highlighted.
The answer is hidden where developers usually introduce their work.`,
    correct_answer: 'team codev',
    points: 400
  },
  // Level 5 — Expert (500 points) — from 1ST QUESTION in MD
  {
    level: 5, set_id: 'L1',
    question_text: `Not every system is complete within itself.
Some extend beyond—into places where updates are shared, not stored.
If you have found the creator, you are only at the beginning.
Creators don't just build—they announce.
Somewhere in a stream of professional signals, there exists a moment where this creation was introduced to the world.
It does not live inside the system—but it points directly back to it.
Find that moment.
From there, follow what was referenced—not described.
You will arrive at the source of the creation itself.
But even that is not the end.
Projects are static. Communities are not.
Look for where this creation continues to live, evolve, and communicate.
A place where presence is real-time, not archived.
Enter it.
Your answer lies there.

Hint:
● If you are still inside one platform, you are incomplete.
● The journey moves: Signal → Source → Community
● The final answer is not on a webpage.`,
    correct_answer: 'happy coding',
    points: 500
  }
];


// Retain the original hunt questions for organizers. Fresh rehearsals replace
// only rounds 4/5; rounds 1–3 and the roster retain their previous content.
const legacyQuestionBank = [...legacyQuestions, ...require('./placeholderQuestions')];
const interactiveQuestions = require('../services/interactivePuzzles').puzzleQuestions;
const questions = legacyQuestionBank.map(question =>
  interactiveQuestions.find(item => item.set_id === question.set_id && item.level === question.level) || question);

const { getQuestionSetIds, planSetAssignments } = require('../services/questionSets');
const { prepareAccessCodes, savePrivateExport } = require('./accessCodeExport');

const teams = [
  // =============================================
  // TEST TEAMS
  // =============================================
  {
    team_name: 'Code Graphers',
    leader_name: 'Himanshu Rawat',
    email: 'himu35311@gmail.com',
    members: ['Abhishek', 'Ayush', 'Ashutosh']
  },
  {
    team_name: 'Code Rafters',
    leader_name: 'Abhishek Negi',
    email: 'aabhinegi05@gmail.com',
    members: ['Himanshu Papa', 'Ayush chacha', 'Ashutosh Tau']
  },
  {
    team_name: 'Kudev',
    leader_name: 'Random Dev',
    email: 'ishant.off@gmail.com',
    members: []
  },
  // =============================================
  // SELECTED TEAMS (from confirm team.csv - Top 30)
  // =============================================
  {
    team_name: 'LCS / LIS Family',
    leader_name: 'Lucky Singh Rawat',
    email: 'cyberboy3131@gmail.com',
    members: ['Adarsh Gairola', 'Vaishnavi Bisht', 'Priyanshu Bhatt']
  },
  {
    team_name: 'Trinity Devs',
    leader_name: 'Harendra Singh Negi',
    email: 'negih1849@gmail.com',
    members: ['Shubham Singh Bisht', 'Prityush Kumar']
  },
  {
    team_name: 'THE ROOKIES',
    leader_name: 'Prathamraj Giri',
    email: 'prathamraj2409@gmail.com',
    members: ['Satyam Vohra', 'Arjun Singh']
  },
  {
    team_name: 'INTERCEPTORS',
    leader_name: 'Ayush Bhatt',
    email: 'ayushbhatt7900@gmail.com',
    members: ['Priyanjal Gairola', 'Nikhil Rawat', 'Akshat Sharma']
  },
  {
    team_name: 'Syntax Squad',
    leader_name: 'sakshamChauhan',
    email: 'sakshamc3070@gmail.com',
    members: ['ashwinKishorDangwal', 'akhilMaithani', 'adityaPharswan']
  },
  {
    team_name: 'Syntex Error',
    leader_name: 'Tanish Kothiyal',
    email: 'tanishkothiyal74@gmail.com',
    members: ['Ishant Chamoli', 'Bhaumik Negi', 'Himanshu Raturi']
  },
  {
    team_name: 'Runtime Terrors',
    leader_name: 'ABHISHEK PUNDEER',
    email: 'abhishek1240pundir@gmail.com',
    members: ['MOHIT SINGH KHATRI', 'SACHIN LAKHEDA', 'BALAM CHAUHAN']
  },
  {
    team_name: 'Phishbusters',
    leader_name: 'ABHISHEK KUMAR',
    email: 'abhishek12.ak12345@gmail.com',
    members: ['YASHU BANSAL', 'PAWAN SINGH']
  },
  {
    team_name: 'Team Blocks',
    leader_name: 'priyanshuGupta',
    email: 'pg937029@gmail.com',
    members: ['anujDobhal', 'vedantDevrani', 'dewangJoshi']
  },
  {
    team_name: 'Prompt Pirate',
    leader_name: 'Payal Kirola Kirola',
    email: 'payalkirola50@gmail.com',
    members: ['Kunal Rana', 'Shardul', 'Himadri Mani']
  },
  {
    team_name: 'Pirate Hunter Devs',
    leader_name: 'Charanjeet Singh',
    email: 'charanjeetsinghkrish@gmail.com',
    members: ['Ayush Chauhan', 'Ayush Sariyal', 'Nirmal Bhakuni']
  },
  {
    team_name: 'TEAM AIMERS',
    leader_name: 'Shaswat Shukla',
    email: 'shaswats271@gmail.com',
    members: ['Vaibhav Bahuguna', 'Himanshu Pokhriyal', 'Yuvraj Singh Bisht']
  },
  {
    team_name: 'Team Titans',
    leader_name: 'VAISHNAV PAINULY',
    email: 'tuler132006@gmail.com',
    members: ['ADITI NEGI', 'RISHABH JOSHI', 'SHOBHIT RAWAT']
  },
  {
    team_name: 'TechX',
    leader_name: 'NEHA TYAGI',
    email: 'nehatyagi1717@gmail.com',
    members: ['AYUSH BUTOLA', 'DIVYAM SAMANT', 'ADITYA RAWAT']
  },
  {
    team_name: 'Brahmos',
    leader_name: 'Sonakshi Negi',
    email: 'sonakshinegi580@gmail.com',
    members: ['Saksham Godiyal', 'Sarthak Pundir', 'Ritik Brijwasi']
  },
  {
    team_name: 'MindFlux',
    leader_name: 'Ashish Kumar',
    email: 'ashish56kk@gmail.com',
    members: ['Priyanka Negi', 'Vibhanshu Parmar', 'Sakshi Adhikari']
  },
  {
    team_name: 'Cypher Chaser',
    leader_name: 'Ashish Rautela',
    email: 'ashishrautela190@gmail.com',
    members: ['Ashutosh Rathour', 'Krishna Negi', 'Sahil Negi']
  },
  {
    team_name: 'Azrion',
    leader_name: 'Prins Kanyal',
    email: 'prinskanyal@gmail.com',
    members: ['Yuvraj Kabadwal', 'Vandana Bhandari', 'Aadarsh Dimri']
  },
  {
    team_name: 'codeJ2',
    leader_name: 'harendraSinghRawat',
    email: 'rawatnikhil923@gmail.com',
    members: ['ayushGusain', 'riyaBisht', 'ayushRawat']
  },
  {
    team_name: 'Team Opportunity makers',
    leader_name: 'CHIRAG MAHARA',
    email: 'chirag.mhra1@gmail.com',
    members: ['AYUSHI RAWAT', 'ADITYA MISHRA', 'ANSHIKA GARG']
  },
  {
    team_name: '404Devs',
    leader_name: 'Priyanshu',
    email: 'priyanshu42910@gmail.com',
    members: ['Priyanshu Negi', 'Mayank Chauhan', 'Mohit Pandey']
  },
  {
    team_name: 'Bugyal Bytes',
    leader_name: 'Rituraj Verma',
    email: 'riturajv185@gmail.com',
    members: ['Priyanshu Bisht', 'Saniya', 'Aditi Singh']
  },
  {
    team_name: 'Project Hail Mary',
    leader_name: 'PULKIT JAKHMOLA',
    email: 'jakhmolapulkit4@gmail.com',
    members: ['KRISHNA CHOUDHARY', 'Satya Prakash']
  },
  {
    team_name: 'NeuroBrains',
    leader_name: 'Shaanvi Bisht',
    email: 'shaanvibisht10@gmail.com',
    members: ['Sakshi Rawat', 'Harshit Bora']
  },
  {
    team_name: 'soulsync',
    leader_name: 'VAISHNAVI SHUKLA',
    email: 'vaishnavishukla45@gmail.com',
    members: ['NIKITA TRIPATHI', 'ABHISHEK KUMAR SINGH', 'PADMAKAR TIWARI']
  },
  {
    team_name: 'CherryPixels',
    leader_name: 'Vaani Bisht',
    email: 'vaanibisht18@gmail.com',
    members: ['Harshita Rawat', 'Adarsh Dabral', 'Divyanshu Tomer']
  },
  {
    team_name: 'ASCode',
    leader_name: 'ADNAN SHEIKH',
    email: 'saifadnansheikh@gmail.com',
    members: ['MIMANSHA CHAUHAN', 'ASHUTOSH RAUTHAN', 'ADITYA PHARSWAN']
  },
  {
    team_name: 'Horizon',
    leader_name: 'Jigansa Satapathy',
    email: 'jigansasatapathy@gmail.com',
    members: ['Astha Kavtiyal', 'Anjali Sindhwal', 'Bani Khurana']
  },
  {
    team_name: 'charkhamba',
    leader_name: 'Ritika Rawat',
    email: 'ritikarawat.9536@gmail.com',
    members: ['Anmol Bisht', 'Rohit Singh', 'Shubham Joshi']
  },
  {
    team_name: 'WantedDevs',
    leader_name: 'Ayush Chauhan',
    email: 'ayushchauhan54989@gmail.com',
    members: ['Keshav Rawat', 'Deepshikha', 'Gauri Chauhan']
  }
];

async function seed() {
  try {
    const setIds = getQuestionSetIds(questions);
    const assignments = planSetAssignments(teams, setIds);
    let seededTeams = assignments.map(({ team, setId }) => ({ ...team, question_set_id: setId }));
    // Catch invalid replacement content before connecting or deleting any data.
    await Promise.all([
      ...questions.map(question => new Question(question).validate()),
      ...seededTeams.map(team => new Team(team).validate())
    ]);
    await connectDB();

    // ============================================================
    // SAFETY CHECK — Show current data counts before doing anything
    // ============================================================
    const existingTeams = await Team.countDocuments();
    const existingQuestions = await Question.countDocuments();
    const existingMappings = await require('../models/MappedQuestion').countDocuments();
    const existingResults = await require('../models/Result').countDocuments();
    const existingQuizState = await require('../models/QuizState').countDocuments();

    console.log('\n⚠️  WARNING: This will permanently delete ALL existing data!');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`   Teams currently in database:     ${existingTeams}`);
    console.log(`   Questions currently in database: ${existingQuestions}`);
    console.log(`   Question assignments:             ${existingMappings}`);
    console.log(`   Results:                          ${existingResults}`);
    console.log(`   Quiz state documents:             ${existingQuizState}`);
    console.log('   Quiz state will be reset to not_started.');
    console.log('─────────────────────────────────────────────────────────');

    if (existingTeams > 0 || existingQuestions > 0 || existingMappings > 0 || existingResults > 0 || existingQuizState > 0) {
      // Require explicit typed confirmation before destroying live data
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const confirmed = await new Promise((resolve) => {
        readline.question(
          '\n❗ Type exactly "YES DELETE EVERYTHING" to confirm, or press Enter to cancel:\n> ',
          (answer) => {
            readline.close();
            resolve(answer.trim() === 'YES DELETE EVERYTHING');
          }
        );
      });

      if (!confirmed) {
        console.log('\n✅ Seed cancelled. Your data is safe.\n');
        process.exit(0);
      }
    }

    const issued = await prepareAccessCodes(seededTeams);
    seededTeams = issued.documents;
    const credentialFile = await savePrivateExport(issued.credentials);
    console.log(`Private team access-code export: ${credentialFile}`);

    // ⚠️ DANGER: Only reaches here after explicit confirmation
    console.log('\n🗑️  Clearing existing data...');
    await Question.deleteMany({});
    await Team.deleteMany({});

    // Seed questions
    console.log('📝 Seeding questions...');
    await Question.insertMany(questions);
    console.log(`   ✅ ${questions.length} questions seeded`);

    // Seed teams
    console.log('👥 Seeding teams...');
    // Question mappings/results cannot survive replacing questions and team IDs.
    await require('../models/MappedQuestion').deleteMany({});
    await require('../models/Result').deleteMany({});
    await require('../models/QuizState').findOneAndUpdate(
      { key: 'global' },
      {
        status: 'not_started', started_at: null, ended_at: null,
        question_set_assignments: [], question_set_assignment_version: 0
      },
      { upsert: true }
    );
    await Team.insertMany(seededTeams);
    console.log(`   ✅ ${teams.length} teams seeded`);

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Teams registered:');
    teams.forEach(t => console.log(`   • ${t.team_name} (${t.email})`));
    console.log('\n📋 Questions per level:');
    for (let i = 1; i <= 5; i++) {
      const count = questions.filter(q => q.level === i).length;
      console.log(`   • Level ${i}: ${count} questions (${questions.find(q => q.level === i).points} pts each)`);
    }
    console.log('\n📋 Teams per question set:');
    setIds.forEach(setId => console.log(`   • ${setId}: ${seededTeams.filter(t => t.question_set_id === setId).length} teams`));

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  if (process.argv.includes('--preview')) {
    console.log(JSON.stringify({
      question_count: questions.length,
      team_count: teams.length,
      sets: getQuestionSetIds(questions).map(setId => ({
        set_id: setId,
        rounds: questions.filter(question => question.set_id === setId).map(question => question.level),
        placeholder_rounds: questions.filter(question => question.set_id === setId && /temporary event content/.test(question.question_text)).map(question => question.level),
        interactive_rounds: questions.filter(question => question.set_id === setId && question.puzzle_type).map(question => ({ level: question.level, type: question.puzzle_type }))
      }))
    }, null, 2));
  } else {
    seed();
  }
}

module.exports = { questions, teams, legacyQuestions, legacyQuestionBank };

