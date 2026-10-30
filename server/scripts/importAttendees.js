const path = require('node:path');
const fs = require('node:fs/promises');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Team = require('../models/Team');
const QuizState = require('../models/QuizState');
const Question = require('../models/Question');
const { getQuestionSetIds, planSetAssignments } = require('../services/questionSets');
const { isRosterTeam } = require('../services/registrationPolicy');

function attendeeTeams(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('The attendee CSV is empty.');
  const groups = new Map(), emails = new Set();
  for (const [index, row] of rows.entries()) {
    const text = key => String(row[key] ?? '').trim();
    if (text('Event').toLowerCase() !== 'code escape room' || text('Paid').toLowerCase() !== 'yes' ||
        text('Registration status').toLowerCase() !== 'confirmed' || text('Payment status').toLowerCase() !== 'verified') {
      throw new Error(`Row ${index + 2} must be a confirmed, payment-verified Code Escape Room attendee.`);
    }
    const registration = text('Registration'), name = text('Name'), teamName = text('Team');
    const email = text('Email').toLowerCase(), leader = text('Leader').toLowerCase();
    if (!registration || registration.length > 128 || !name || name.length > 150 || !teamName || teamName.length > 150 ||
        email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['yes', 'no'].includes(leader)) {
      throw new Error(`Row ${index + 2} has invalid team, registration, member or email fields.`);
    }
    if (emails.has(email)) throw new Error(`Duplicate attendee email at row ${index + 2}.`);
    emails.add(email);
    if (!groups.has(registration)) groups.set(registration, { team_name: teamName,
      aarambh_registration_id: `csv:${registration}`, registered_members: [] });
    const team = groups.get(registration);
    if (team.team_name !== teamName) throw new Error('A registration has conflicting team names.');
    team.registered_members.push({ name, email, is_leader: leader === 'yes' });
  }
  return [...groups.values()].map(team => {
    const leaders = team.registered_members.filter(member => member.is_leader);
    if (team.registered_members.length !== 3 || leaders.length !== 1) throw new Error('Each team needs three distinct members and exactly one leader.');
    return { ...team, email: leaders[0].email, leader_name: leaders[0].name,
      members: team.registered_members.filter(member => !member.is_leader).map(member => member.name) };
  });
}

async function readAttendees(file) {
  const sheet = await new ExcelJS.Workbook().csv.readFile(file);
  const headers = sheet.getRow(1).values.slice(1).map(value => String(value ?? '').replace(/^\uFEFF/, '').trim());
  const rows = [];
  sheet.eachRow((row, number) => {
    if (number > 1 && row.values.some(value => value != null && String(value).trim())) {
      rows.push(Object.fromEntries(headers.map((header, index) => [header, row.getCell(index + 1).value ?? ''])));
    }
  });
  return attendeeTeams(rows);
}

async function importAttendees(teams, { apply = false, backupDirectory } = {}) {
  if (!Team.schema.path('registered_members')) throw new Error('Deploy the registered-member model before importing attendees.');
  let report;
  await mongoose.connection.transaction(async session => {
    const state = await QuizState.findOne({ key: 'global' }).session(session);
    if (!state || state.status !== 'not_started') throw new Error('Import attendees only before the event starts. Existing progress is never reset.');
    const questions = await Question.find({}).select('_id set_id level archived').session(session).lean();
    const setIds = getQuestionSetIds(questions);
    const all = await Team.find({}).select('+access_code_hash +active_session_id +google_subject +registered_members.google_subject +registered_members.active_session_id').session(session).lean();
    const planned = [], used = new Set();
    for (const incoming of teams) {
      const matching = all.filter(team => team.aarambh_registration_id === incoming.aarambh_registration_id || team.email === incoming.email);
      if (matching.length > 1) throw new Error('A registration and leader email match different existing teams.');
      const existing = matching[0];
      if (existing && (used.has(String(existing._id)) || (existing.aarambh_registration_id && existing.aarambh_registration_id !== incoming.aarambh_registration_id))) {
        throw new Error('An attendee registration conflicts with an existing team.');
      }
      if (existing && (existing.start_time || existing.total_points || existing.outcomes?.length)) throw new Error('Cannot replace a team that has played. No progress was changed.');
      const id = existing?._id || new mongoose.Types.ObjectId(); used.add(String(id));
      planned.push({ incoming, existing, _id: id, question_set_id: existing?.question_set_id || null });
    }
    const attendeeEmails = new Set(teams.flatMap(team => team.registered_members.map(member => member.email)));
    if (all.some(team => isRosterTeam(team) && !used.has(String(team._id)) && [team.email, ...(team.registered_members || []).map(member => member.email)].some(email => attendeeEmails.has(email)))) {
      throw new Error('An attendee email belongs to a different existing team.');
    }
    for (const { team, setId } of planSetAssignments(planned, setIds)) team.question_set_id = setId;
    const counts = Object.fromEntries(setIds.map(id => [id, planned.filter(team => team.question_set_id === id).length]));
    if (Math.max(...Object.values(counts)) - Math.min(...Object.values(counts)) > 1) throw new Error('Existing set allocations are not balanced. No assignments were changed.');
    const rehearsal = all.filter(team => /^organizer-test-L[123]$/.test(team.aarambh_registration_id || '') && team.access_enabled !== false);
    if (rehearsal.some(team => team.start_time || team.total_points || team.outcomes?.length)) throw new Error('A rehearsal account has played; review it before changing the roster.');
    report = { applied: apply, teams: planned.length, attendees: attendeeEmails.size, set_counts: counts,
      rehearsal_accounts_disabled: rehearsal.length, event_status: state.status,
      non_gmail_members: [...attendeeEmails].filter(email => !email.endsWith('@gmail.com')).length };
    if (!apply) return;
    if (!backupDirectory) throw new Error('A private backup directory is required.');
    await fs.mkdir(backupDirectory, { recursive: true });
    await fs.writeFile(path.join(backupDirectory, `roster-before-${Date.now()}.json`), JSON.stringify({ state,
      teams: planned.filter(team => team.existing).map(team => team.existing), rehearsal }, null, 2), { flag: 'wx' });
    const assignments = new Map((state.question_set_assignments || []).map(item => [item.team_id, item.set_id]));
    for (const team of planned) {
      const fields = { ...team.incoming, access_enabled: true, question_set_id: team.question_set_id };
      if (team.existing) {
        if (team.existing.email !== fields.email) { fields.active_session_id = null; fields.google_subject = null; }
        fields.registered_members = fields.registered_members.map(member => {
          const previous = team.existing.registered_members?.find(old => old.email === member.email);
          return previous ? { ...previous, ...member } : member;
        });
        await Team.updateOne({ _id: team._id }, { $set: fields }, { session });
      } else await Team.create([{ ...fields, _id: team._id }], { session });
      assignments.set(String(team._id), team.question_set_id);
    }
    if (rehearsal.length) await Team.updateMany({ _id: { $in: rehearsal.map(team => team._id) } },
      { $set: { access_enabled: false, active_session_id: null } }, { session });
    const updated = await QuizState.updateOne({ _id: state._id, status: 'not_started' }, { $set: {
      question_set_assignments: [...assignments].map(([team_id, set_id]) => ({ team_id, set_id }))
    }, $inc: { question_set_assignment_version: 1 } }, { session });
    if (updated.modifiedCount !== 1) throw new Error('Event state changed. Import aborted.');
  });
  return report;
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  const file = process.argv.find(argument => argument.toLowerCase().endsWith('.csv'));
  if (!file) throw new Error('Pass the attendee CSV path; add --apply to import after reviewing the default preview.');
  const teams = await readAttendees(path.resolve(file));
  await require('../config/db')();
  const report = await importAttendees(teams, { apply: process.argv.includes('--apply'), backupDirectory: path.resolve(__dirname, '../../.private/roster-backups') });
  console.log(JSON.stringify(report));
}
if (require.main === module) main().catch(error => { console.error(error.name === 'MongoServerError' ? 'Database import failed; no transaction was committed.' : error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
module.exports = { attendeeTeams, readAttendees, importAttendees };
