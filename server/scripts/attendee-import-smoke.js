// Synthetic CSV and Mongo transactions only; no dotenv or production connections.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
async function run() {
  delete process.env.MONGODB_URI;
  process.env.AARAMBH_REGISTRATION_REQUIRED = 'true';
  const { MongoMemoryReplSet } = require('mongodb-memory-server'), mongoose = require('mongoose');
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' },
    binary: process.env.AARAMBH_TEST_MONGOD ? { systemBinary: process.env.AARAMBH_TEST_MONGOD } : undefined });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'escape-import-smoke-'));
  let checks = 0;
  const equal = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };
  try {
    const uri = replica.getUri('attendee_import_loopback'); assert.ok(uri.startsWith('mongodb://127.0.0.1:'));
    await mongoose.connect(uri);
    const Team = require('../models/Team'), QuizState = require('../models/QuizState'), Question = require('../models/Question');
    const { attendeeTeams, readAttendees, importAttendees } = require('./importAttendees');
    await Promise.all([Team.init(), QuizState.init(), Question.init()]);
    await QuizState.create({ key: 'global', status: 'not_started' });
    await Question.insertMany(['L1', 'L2', 'L3'].flatMap(set_id => [1, 2, 3, 4, 5]
      .map(level => ({ set_id, level, question_text: 'Synthetic round', correct_answer: 'synthetic', points: level * 100 }))));
    const rows = Array.from({ length: 7 }, (_, team) => Array.from({ length: 3 }, (_, member) => ({
      Event: ' Code Escape Room ', Team: `Import Team ${team + 1}`, Registration: `synthetic-${team + 1}`,
      Name: `Member ${team + 1}-${member + 1}`, Email: `member-${team + 1}-${member + 1}@example.test`,
      Leader: member === 0 ? 'Yes' : 'No', Paid: 'Yes', 'Registration status': 'Confirmed', 'Payment status': 'Verified'
    }))).flat();
    const headers = Object.keys(rows[0]), csv = '\uFEFF' + headers.map(h => ` ${h} `).join(',') + '\r\n' + rows
      .map(row => headers.map(h => `" ${row[h].replace(/"/g, '""')} "`).join(',')).join('\r\n') + '\r\n\r\n';
    const csvFile = path.join(directory, 'synthetic.csv'); await fs.writeFile(csvFile, csv);
    const incoming = await readAttendees(csvFile);
    equal(incoming, attendeeTeams(rows), 'BOM, header/value whitespace and blank lines normalize without changing membership');
    const legacy = await Team.create({ team_name: 'Excluded legacy collision', leader_name: 'Legacy',
      email: rows[1].Email, members: [], total_points: 9999, current_level: 6 });
    const rehearsal = await Team.insertMany(['L1', 'L2', 'L3'].map(set => ({ team_name: `Original rehearsal ${set}`,
      leader_name: 'Rehearsal', email: `rehearsal-${set}@example.test`, aarambh_registration_id: `organizer-test-${set}` })));
    const unrelated = await Team.create({ team_name: 'Unrelated test', leader_name: 'Unrelated',
      email: 'unrelated@example.test', aarambh_registration_id: 'organizer-test-extra' });
    const snapshot = async () => ({ teams: await Team.find().select('+access_code_hash +active_session_id +google_subject +registered_members.google_subject +registered_members.active_session_id').sort({ _id: 1 }).lean(), state: await QuizState.findOne().lean() });
    const before = await snapshot();
    const preview = await importAttendees(incoming);
    equal(preview.applied, false); equal(preview.teams, 7); equal(preview.attendees, 21);
    equal(Object.values(preview.set_counts).sort(), [2, 2, 3]); equal(await snapshot(), before, 'Preview writes nothing');
    const backupDirectory = path.join(directory, 'backup');
    const applied = await importAttendees(incoming, { apply: true, backupDirectory });
    equal(applied.applied, true); equal(applied.rehearsal_accounts_disabled, 3);
    const imported = await Team.find({ aarambh_registration_id: /^csv:/ }).sort({ email: 1 }).lean();
    equal(imported.length, 7); equal(imported.reduce((n, team) => n + team.registered_members.length, 0), 21);
    equal(Object.values(imported.reduce((counts, team) => ({ ...counts, [team.question_set_id]: (counts[team.question_set_id] || 0) + 1 }), {})).sort(), [2, 2, 3]);
    for (const id of rehearsal.map(team => team._id)) equal((await Team.findById(id)).access_enabled, false);
    equal((await Team.findById(unrelated._id)).access_enabled, true, 'Only the three original rehearsal identities are disabled');
    equal((await Team.findById(legacy._id)).total_points, 9999, 'Excluded legacy collision keeps its historical score');
    await Team.updateOne({ _id: imported[0]._id }, { $set: { access_code_hash: 'synthetic-private-hash', active_session_id: 'leader-session', google_subject: 'leader-google-subject',
      'registered_members.1.active_session_id': 'member-session', 'registered_members.1.google_subject': 'member-google-subject' } });
    const identities = (await snapshot()).teams.filter(team => /^csv:/.test(team.aarambh_registration_id || ''));
    await new Promise(resolve => setTimeout(resolve, 2));
    await importAttendees(incoming, { apply: true, backupDirectory });
    const repeated = (await snapshot()).teams.filter(team => /^csv:/.test(team.aarambh_registration_id || ''));
    equal(repeated.map(t => [String(t._id), t.question_set_id, t.access_code_hash, t.active_session_id, t.google_subject, t.registered_members]),
      identities.map(t => [String(t._id), t.question_set_id, t.access_code_hash, t.active_session_id, t.google_subject, t.registered_members]), 'Repeated import preserves IDs, sets, credentials, identity bindings and member sessions');
    const backupFiles = (await fs.readdir(backupDirectory)).sort();
    const backup = JSON.parse(await fs.readFile(path.join(backupDirectory, backupFiles.at(-1)), 'utf8'));
    const recoverable = backup.teams.find(t => t._id === String(imported[0]._id));
    equal(recoverable.access_code_hash, 'synthetic-private-hash', 'Private backup retains the leader credential hash');
    equal(recoverable.active_session_id, 'leader-session'); equal(recoverable.google_subject, 'leader-google-subject');
    equal(recoverable.registered_members[1].active_session_id, 'member-session');
    equal(recoverable.registered_members[1].google_subject, 'member-google-subject');
    incoming[0] = { ...incoming[0], email: 'replacement-leader@example.test', leader_name: 'Replacement Leader',
      registered_members: [{ name: 'Replacement Leader', email: 'replacement-leader@example.test', is_leader: true },
        ...incoming[0].registered_members.filter(member => !member.is_leader)] };
    await importAttendees(incoming, { apply: true, backupDirectory });
    const changedLeader = await Team.findById(imported[0]._id)
      .select('+active_session_id +google_subject +registered_members.active_session_id +registered_members.google_subject').lean();
    equal(changedLeader.email, 'replacement-leader@example.test');
    equal(changedLeader.active_session_id, null, 'Replacing the leader revokes the previous leader JWT session');
    equal(changedLeader.google_subject, null, 'New leader does not inherit the previous Google subject');
    equal(changedLeader.registered_members.some(member => member.email === rows[0].Email), false, 'Removed leader is absent from the allowlist');
    equal(changedLeader.registered_members[1].active_session_id, 'member-session', 'Unchanged members keep their own session');
    equal(changedLeader.registered_members[1].google_subject, 'member-google-subject');
    const collision = await Team.create({ team_name: 'Other paid roster', leader_name: 'Other', email: 'other-paid@example.test',
      aarambh_registration_id: 'other-paid-roster', registered_members: [{ name: 'Collision', email: rows[2].Email }] });
    const beforeCollision = await snapshot();
    await assert.rejects(importAttendees(incoming, { apply: true, backupDirectory }), /belongs to a different/); checks++;
    equal(await snapshot(), beforeCollision, 'Cross-roster email collision aborts atomically');
    await Team.deleteOne({ _id: collision._id });
    await QuizState.updateOne({ key: 'global' }, { $set: { status: 'active' } });
    const beforeActive = await snapshot();
    await assert.rejects(importAttendees(incoming, { apply: true, backupDirectory }), /only before/); checks++;
    equal(await snapshot(), beforeActive, 'Active event rejects import without changing scores, sessions or state');
    equal((await fs.readdir(backupDirectory)).length >= 2, true, 'Private backup exists for each applied import');
    console.log(JSON.stringify({ passed: true, checks, teams: 7, members: 21, balanced_sets: [3, 2, 2], dry_run_writes: 0,
      idempotent_roster: true, google_bindings_and_sessions_preserved: true, collisions_and_active_event_abort: true }));
  } finally {
    await mongoose.disconnect(); await replica.stop();
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.match(path.basename(directory), /^escape-import-smoke-/);
    await fs.rm(directory, { recursive: true, force: true });
  }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
