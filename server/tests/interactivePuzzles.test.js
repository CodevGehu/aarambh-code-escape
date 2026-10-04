const test = require('node:test');
const assert = require('node:assert/strict');
const { getPuzzle, validatePuzzle, validateDiscovery, puzzleQuestions, organizerWitness, organizerDiscoveryWitness } = require('../services/interactivePuzzles');

const question = type => ({ ...puzzleQuestions.find(q => q.puzzle_type === type), puzzle_type: type, _id: `question-${type}` });
const team = index => ({ _id: `team-${index}`, event_run_id: 'rehearsal-1' });

test('six independent puzzle families have verified witnesses across all label/orientation variants', () => {
  assert.equal(puzzleQuestions.length, 6);
  const seen = new Set();
  for (const type of puzzleQuestions.map(q => q.puzzle_type)) for (let i = 0; i < 40; i += 1) {
    const q = question(type), t = team(i), puzzle = getPuzzle(q, t), witness = organizerWitness(q, t);
    assert.equal(puzzle.version, type === 'packing' ? 2 : 1);
    assert.equal(validatePuzzle(q, t, witness).valid, true, `${type} team ${i}`);
    assert.equal(JSON.stringify(puzzle), JSON.stringify(getPuzzle(q, t)));
    assert.equal(Object.hasOwn(puzzle, 'solution'), false);
    seen.add(puzzle.instance_id);
  }
  assert.equal(seen.size, 240);
});

test('all proofs are bound to team, question, event run and version', () => {
  for (const type of puzzleQuestions.map(q => q.puzzle_type)) {
    const q = question(type), t = team(0), proof = organizerWitness(q, t);
    assert.equal(validatePuzzle(q, team(1), proof).valid, false);
    assert.equal(validatePuzzle({ ...q, _id: 'another-question' }, t, proof).valid, false);
    assert.equal(validatePuzzle(q, { ...t, event_run_id: 'next-event' }, proof).valid, false);
    assert.equal(validatePuzzle(q, t, { ...proof, instance_id: undefined }).valid, false);
    assert.equal(validatePuzzle(q, t, '[interactive]').valid, false);
  }
  assert.equal(getPuzzle({ _id: 'legacy' }, team(0)), null);
  assert.equal(getPuzzle({ puzzle_type: 'unknown' }, team(0)), null);
});

test('packing places twelve tool-generated unit triangles inside a tight pentagon with SAT judging', () => {
  const q = question('packing'), t = team(0), proof = organizerWitness(q, t), config = getPuzzle(q, t);
  assert.equal(config.pieces.length, 12);
  assert.equal(config.container.sides, 5);
  assert.equal(validatePuzzle(q, t, { ...proof, container_side: 2.08 }).valid, true);
  assert.equal(validatePuzzle(q, t, { ...proof, container_side: 2.09 }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, container_side: 1.72 }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, container_side: NaN }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, positions: proof.positions.map((p, i) => i === 0 ? { ...p, x: 3 } : p) }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, positions: proof.positions.map((p, i) => i === 0 ? { ...proof.positions[1], id: p.id } : p) }).valid, false);
  for (const changed of [{ ...proof.positions[0], rotation: 360 }, { ...proof.positions[0], x: Infinity }, { ...proof.positions[0], rotation: '0' }, { ...proof.positions[0], id: 'unknown' }, { ...proof.positions[0], y: undefined }]) {
    assert.equal(validatePuzzle(q, t, { ...proof, positions: [changed, ...proof.positions.slice(1)] }).valid, false);
  }
  assert.equal(validatePuzzle(q, t, { ...proof, positions: Array(10000).fill(proof.positions[0]) }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, positions: [proof.positions[0], proof.positions[0], ...proof.positions.slice(2)] }).valid, false);
});

test('packing geometry accepts touching edges and practical decimal precision without trusting client polygons', () => {
  for (let i = 0; i < 24; i += 1) {
    const q = question('packing'), t = team(i), proof = organizerWitness(q, t);
    const decimalProof = { ...proof, container_side: 2.08, positions: proof.positions.map(p => ({ ...p, x: Number(p.x.toFixed(6)), y: Number(p.y.toFixed(6)) })) };
    assert.equal(validatePuzzle(q, t, decimalProof).valid, true);
    assert.equal(validatePuzzle(q, t, { ...proof, positions: proof.positions.map(p => ({ ...p, vertices: [[0, 0], [0, 0], [0, 0]] })) }).valid, true);
  }
});

test('archived version-one packing questions retain their original six-piece puzzle', () => {
  const q = { ...question('packing'), puzzle_version: 1 }, t = team(0);
  const config = getPuzzle(q, t), proof = organizerWitness(q, t);
  assert.equal(config.version, 1);
  assert.equal(config.pieces.length, 6);
  assert.equal(config.container.sides, 6);
  assert.equal(config.target_container_side, 1.02);
  assert.equal(validatePuzzle(q, t, proof).valid, true);
  assert.equal(validatePuzzle({ ...q, puzzle_version: 2 }, t, proof).valid, false);
});

test('source discovery parses only approved YouTube URLs and binds proof to this puzzle instance', () => {
  for (const type of ['fence', 'packing']) {
    const q = question(type), t = team(0), proof = organizerDiscoveryWitness(q, t), id = proof.url.split('/').at(-1);
    for (const url of [proof.url, `https://www.youtube.com/watch?v=${id}&t=3`, `https://m.youtube.com/watch?v=${id}`, `https://youtube.com/shorts/${id}`, `http://youtu.be/${id}`]) {
      assert.equal(validateDiscovery(q, t, { ...proof, url }).valid, true, url);
    }
    for (const url of [`https://youtube.com.evil.example/watch?v=${id}`, `https://evil.example/${id}`, `https://youtube.com@evil.example/watch?v=${id}`, `https://evil@youtube.com/watch?v=${id}`, `https://youtu.be:444/${id}`, `file:///watch?v=${id}`, `https://youtube.com/watch?v=${id}&v=${id}`, `https://youtu.be/${id}/extra`, 'https://youtu.be/abcdefghijk', id]) {
      assert.equal(validateDiscovery(q, t, { ...proof, url }).valid, false, url);
    }
    assert.equal(validateDiscovery(q, team(1), proof).valid, false);
    assert.equal(validateDiscovery(q, { ...t, event_run_id: 'next-run' }, proof).valid, false);
    assert.equal(validateDiscovery(q, t, { ...proof, url: 'x'.repeat(501) }).valid, false);
    const publicJson = JSON.stringify(getPuzzle(q, t));
    assert.equal(publicJson.includes(id), false);
    assert.equal(publicJson.includes('https://'), false);
  }
  assert.equal(validateDiscovery(question('machine'), team(0), { url: 'https://youtube.com' }).valid, false);
  assert.equal(organizerDiscoveryWitness(question('machine'), team(0)), null);
});

test('packing discovery also requires the creator-linked GitHub tool repository', () => {
  const q = question('packing'), t = team(0), proof = organizerDiscoveryWitness(q, t);
  for (const tool_url of [proof.tool_url, `${proof.tool_url}/`, 'https://github.com/flamethr0wer/POLYGON-PACKER.git']) assert.equal(validateDiscovery(q, t, { ...proof, tool_url }).valid, true);
  for (const tool_url of [undefined, '', 'https://github.com/another/polygon-packer', 'https://github.com/Flamethr0wer/another', 'https://github.com/Flamethr0wer/polygon-packer/tree/main', 'http://github.com/Flamethr0wer/polygon-packer', 'https://github.com.evil.example/Flamethr0wer/polygon-packer', 'https://github.com@evil.example/Flamethr0wer/polygon-packer', 'https://evil@github.com/Flamethr0wer/polygon-packer', 'https://github.com:444/Flamethr0wer/polygon-packer']) assert.equal(validateDiscovery(q, t, { ...proof, tool_url }).valid, false, String(tool_url));
  const config = getPuzzle(q, t);
  assert.equal(config.discovery.tool_required, true);
  assert.equal(JSON.stringify(config).includes('Flamethr0wer'), false);
  assert.equal(JSON.stringify(config).includes('polygon-packer'), false);
});

test('fence computes the bounded faces and rejects oversized fields, duplicates, dangling edges and client claims', () => {
  const q = question('fence'), t = team(0), puzzle = getPuzzle(q, t), proof = organizerWitness(q, t);
  const result = validatePuzzle(q, t, proof);
  assert.equal(result.summary.fields, 6);
  assert.ok(Math.abs(result.summary.area - 3 * Math.sqrt(3) / 2) < 1e-7);
  const center = puzzle.nodes.find(n => Math.hypot(n.x, n.y) < 1e-8).id;
  const outerOnly = proof.edges.filter(id => { const edge = puzzle.edges.find(e => e.id === id); return edge.a !== center && edge.b !== center; });
  assert.equal(validatePuzzle(q, t, { ...proof, edges: outerOnly, area: 100 }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, edges: [...proof.edges.slice(0, 11), proof.edges[0]] }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, edges: proof.edges.slice(0, 3) }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, edges: Array(10000).fill('F1') }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, edges: ['__proto__', 'F1', 'F2'] }).valid, false);
});

test('sliding checks intermediate collisions, direction, bounds and a fully exited cargo', () => {
  const q = question('sliding'), t = team(0), proof = organizerWitness(q, t), puzzle = getPuzzle(q, t);
  const sign = puzzle.exit.side === 'right' ? 1 : -1;
  assert.equal(validatePuzzle(q, t, { ...proof, moves: [{ id: 'cargo', delta: 6 * sign }] }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, moves: proof.moves.slice(0, 2) }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, moves: [{ id: 'cargo', delta: Infinity }] }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, moves: [...proof.moves, { id: 'cargo', delta: sign }] }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, moves: [{ id: 'unknown', delta: 1 }] }).valid, false);
});

test('machine demonstrations are consistent and arbitrary properties cannot operate as buttons', () => {
  const q = question('machine'), t = team(0), proof = organizerWitness(q, t);
  assert.equal(validatePuzzle(q, t, { ...proof, program: [] }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, program: ['__proto__'] }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, program: ['toString'] }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, program: Array(25).fill('SUN') }).valid, false);
});

test('machine targets have independently verified minimum distance twelve and public allowance fourteen', () => {
  for (let index = 0; index < 12; index += 1) {
    const q = question('machine'), t = team(index), config = getPuzzle(q, t);
    const permutations = config.observations.map(observation => ({ label: observation.button, indices: observation.after.map(tile => observation.before.indexOf(tile)) }));
    const start = config.start.join(''), target = config.target.join(''), queue = [{ state: start, distance: 0 }], seen = new Set([start]);
    let distance;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (current.state === target) { distance = current.distance; break; }
      for (const operation of permutations) {
        const state = operation.indices.map(i => current.state[i]).join('');
        if (!seen.has(state)) { seen.add(state); queue.push({ state, distance: current.distance + 1 }); }
      }
    }
    assert.equal(distance, 12);
    assert.equal(config.max_steps, 14);
    assert.equal(organizerWitness(q, t).program.length, distance);
  }
});

test('courier accepts only the restricted language and checks all four maps without eval', () => {
  const q = question('courier'), t = team(0), proof = organizerWitness(q, t);
  assert.equal(validatePuzzle(q, t, proof).summary.deliveries, 4);
  for (const program of ['process.exit()', 'STOP', 'REPEAT 999999999999\nMOVE\nEND', 'MOVE\nEND', 'REPEAT 2\nMOVE', 'IF_GOAL\nEND\nELSE', 'REPEAT 160\nREPEAT 160\nTURN_RIGHT\nEND\nEND', 'IF_WALL\nMOVE\nEND']) {
    assert.equal(validatePuzzle(q, t, { ...proof, program }).valid, false, program);
  }
  assert.equal(validatePuzzle(q, t, { ...proof, program: { code: 'MOVE' } }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, program: 'MOVE\n'.repeat(1000) }).valid, false);
});

test('fold reconstructs exact reflected segments and accepts equivalent fold/endpoint orders', () => {
  const q = question('fold'), t = team(0), proof = organizerWitness(q, t);
  assert.equal(validatePuzzle(q, t, { ...proof, folds: [...proof.folds].reverse(), cut: { a: proof.cut.b, b: proof.cut.a } }).valid, true);
  for (const cut of [{ a: [4, 4], b: [4, 4] }, { a: [4, 3.5], b: [2, 4] }, { a: [NaN, 4], b: [2, 4] }, { a: [4, -2], b: [2, 4] }]) {
    assert.equal(validatePuzzle(q, t, { ...proof, cut }).valid, false);
  }
  assert.equal(validatePuzzle(q, t, { ...proof, folds: ['vertical', 'vertical'] }).valid, false);
});

test('shadow validates union geometry instead of trusting supplied target cells', () => {
  const q = question('shadow'), t = team(0), proof = organizerWitness(q, t);
  const first = proof.layers[0];
  for (const changed of [{ ...first, rotation: 45 }, { ...first, x: 99 }, { ...first, y: Infinity }, { ...first, id: 'missing' }, { ...first, x: 0.5 }]) {
    assert.equal(validatePuzzle(q, t, { ...proof, layers: [changed, ...proof.layers.slice(1)] }).valid, false);
  }
  assert.equal(validatePuzzle(q, t, { ...proof, layers: [first, first, first] }).valid, false);
  assert.equal(validatePuzzle(q, t, { ...proof, layers: [], target_cells: getPuzzle(q, t).target_cells }).valid, false);
});
