const { getPuzzle } = require('./interactivePuzzles');

function discoveryRequired(puzzle) { return Boolean(puzzle?.discovery?.kind === 'video'); }
function discoveryUnlocked(puzzle, mapping) {
  return !discoveryRequired(puzzle) || mapping?.discovery_instance_id === puzzle.instance_id;
}
function visiblePuzzle(question, team, mapping) {
  const puzzle = getPuzzle(question, team);
  if (!puzzle || discoveryUnlocked(puzzle, mapping)) return puzzle;
  // The unfinished trail exposes neither the destination nor the workbench rules.
  return { type: puzzle.type, version: puzzle.version, instance_id: puzzle.instance_id,
    title: puzzle.title, discovery: puzzle.discovery, locked: true };
}
module.exports = { discoveryRequired, discoveryUnlocked, visiblePuzzle };
