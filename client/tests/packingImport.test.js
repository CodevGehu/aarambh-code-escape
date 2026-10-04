import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { importPackingLayout } from '../src/lib/packingImport.js';
const require = createRequire(import.meta.url);
const engine = require('../../server/services/interactivePuzzles');
const result = require('../../server/services/fixtures/pentagonPacking.json');

test('real repository output converts to valid side-length poses across team orientations', () => {
  for (let i = 0; i < 24; i++) {
    const question = { ...engine.puzzleQuestions.find(q => q.puzzle_type === 'packing'), _id: 'tool-import' };
    const team = { _id: `team-${i}`, event_run_id: 'tool-run' };
    const puzzle = engine.getPuzzle(question, team), proof = importPackingLayout(puzzle, result);
    assert.equal(proof.positions.length, 12);
    assert.ok(Math.abs(proof.container_side - 2.055204283074058) < 1e-10);
    assert.equal(engine.validatePuzzle(question, team, proof).valid, true);
  }
});

test('tool import rejects mismatched shape parameters and malformed numerical results', () => {
  const puzzle = engine.getPuzzle({ ...engine.puzzleQuestions[1], _id: 'tool-import' }, { _id: 'team', event_run_id: 'run' });
  for (const change of [{ inner_polygons: 6 }, { inner_sides: 4 }, { container_sides: 6 }, { inner_radius: 0 },
    { inner_radius: Infinity }, { container_radius: NaN }, { positions: [] },
    { positions: result.positions.map((p,i)=> i ? p : { ...p, angle_radians: '0' }) }]) {
    assert.throws(() => importPackingLayout(puzzle, { ...result, ...change }));
  }
});
