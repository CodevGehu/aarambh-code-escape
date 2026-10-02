// A new start time identifies a new event, including after an organizer reset.
export function getEventNotice(team, event, ended) {
  if (!team?._id || !event?.started_at) return null;
  const phase = ended ? 'ended' : event.status === 'active' ? 'started' : null;
  if (!phase) return null;
  return { phase, key: `escape-notice:${team._id}:${event.started_at}:${phase}` };
}

export function noticeWasSeen(key, storage) {
  try { return storage.getItem(key) === 'seen'; } catch { return false; }
}

export function rememberNotice(key, storage) {
  try { storage.setItem(key, 'seen'); } catch { /* In-memory acknowledgement still works. */ }
}
