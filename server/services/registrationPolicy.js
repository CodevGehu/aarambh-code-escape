// Read at request time so a deployment can enable paid registrations independently
// of the rehearsal seed. Historical teams remain stored for organizer audit logs.
function registrationRequired() {
  return process.env.AARAMBH_REGISTRATION_REQUIRED === 'true';
}

function rosterFilter({ includeRevoked = false } = {}) {
  return {
    ...(registrationRequired() ? { aarambh_registration_id: { $type: 'string' } } : {}),
    ...(!includeRevoked ? { access_enabled: { $ne: false } } : {})
  };
}

function isRosterTeam(team, { includeRevoked = false } = {}) {
  return Boolean(team && (includeRevoked || team.access_enabled !== false) &&
    (!registrationRequired() || typeof team.aarambh_registration_id === 'string'));
}

module.exports = { registrationRequired, rosterFilter, isRosterTeam };
