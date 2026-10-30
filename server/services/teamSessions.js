// Keep the leader email as the shared team identity in existing scoring paths.
function teamSessionFilter(user) {
  if (user.memberEmail) return { registered_members: { $elemMatch: { email: user.memberEmail, active_session_id: user.sessionId } } };
  return user.sessionId ? { active_session_id: user.sessionId } : {};
}
module.exports = { teamSessionFilter };
