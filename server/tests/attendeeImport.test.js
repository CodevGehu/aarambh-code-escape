const test = require('node:test');
const assert = require('node:assert/strict');
const { attendeeTeams } = require('../scripts/importAttendees');
const { planSetAssignments } = require('../services/questionSets');
const rows = () => Array.from({ length: 21 }, (_, index) => ({ Event: 'Code Escape Room', Team: `Team ${Math.floor(index / 3)}`,
  Registration: `REG-${Math.floor(index / 3)}`, Name: `Participant ${index}`, Email: `member${index}@gmail.com`,
  Leader: index % 3 === 0 ? 'Yes' : 'No', Paid: 'Yes', 'Payment status': 'verified', 'Registration status': 'confirmed' }));
test('attendee CSV preserves seven complete teams, all twenty-one emails and random balanced paths', () => {
  const teams = attendeeTeams(rows());
  assert.equal(teams.length, 7); assert.equal(teams.flatMap(team => team.registered_members).length, 21);
  assert.equal(teams.every(team => team.registered_members.length === 3 && team.members.length === 2), true);
  assert.equal(teams[0].email, 'member0@gmail.com');
  const assignments = planSetAssignments(teams, ['L1', 'L2', 'L3'], () => 0);
  const counts = ['L1', 'L2', 'L3'].map(set => assignments.filter(item => item.setId === set).length).sort();
  assert.deepEqual(counts, [2, 2, 3]);
  const assigned = assignments.map(({ team, setId }) => ({ ...team, question_set_id: setId }));
  assert.deepEqual(planSetAssignments(assigned, ['L1', 'L2', 'L3']), []);
});
test('attendee import rejects duplicates, unpaid rows and malformed team membership before writing', () => {
  for (const mutate of [r => { r[1].Email = r[0].Email; }, r => { r[0].Paid = 'No'; },
    r => { r[0]['Payment status'] = 'submitted'; }, r => { r[0].Event = 'Other Event'; },
    r => { r[1].Leader = 'Yes'; }, r => { r[1].Email = 'invalid'; }, r => { r.pop(); }]) {
    const input = rows(); mutate(input); assert.throws(() => attendeeTeams(input));
  }
});
test('registered email normalization keeps external Google-account addresses rather than inventing replacements', () => {
  const input = rows(); input[0].Email = ' OWNER@ICLOUD.IN ';
  const teams = attendeeTeams(input); assert.equal(teams[0].email, 'owner@icloud.in');
  assert.equal(teams[0].registered_members[0].email, 'owner@icloud.in');
});
