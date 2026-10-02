const test = require('node:test');
const assert = require('node:assert/strict');
const { rosterFilter, isRosterTeam } = require('../services/registrationPolicy');

test('paid roster policy isolates portal teams and keeps revoked teams available only for audit', t => {
  const previous = process.env.AARAMBH_REGISTRATION_REQUIRED;
  t.after(() => {
    if (previous === undefined) delete process.env.AARAMBH_REGISTRATION_REQUIRED;
    else process.env.AARAMBH_REGISTRATION_REQUIRED = previous;
  });
  delete process.env.AARAMBH_REGISTRATION_REQUIRED;
  assert.deepEqual(rosterFilter(), { access_enabled: { $ne: false } });
  assert.equal(isRosterTeam({ team_name: 'Rehearsal' }), true);
  assert.equal(isRosterTeam({ access_enabled: false }), false);
  process.env.AARAMBH_REGISTRATION_REQUIRED = 'true';
  assert.deepEqual(rosterFilter(), { aarambh_registration_id: { $type: 'string' }, access_enabled: { $ne: false } });
  assert.deepEqual(rosterFilter({ includeRevoked: true }), { aarambh_registration_id: { $type: 'string' } });
  for (const aarambh_registration_id of [undefined, null, 42, { $ne: null }]) {
    assert.equal(isRosterTeam({ aarambh_registration_id }), false);
  }
  assert.equal(isRosterTeam({ aarambh_registration_id: 'registration' }), true);
  assert.equal(isRosterTeam({ aarambh_registration_id: 'registration', access_enabled: false }), false);
  assert.equal(isRosterTeam({ aarambh_registration_id: 'registration', access_enabled: false }, { includeRevoked: true }), true);
});
