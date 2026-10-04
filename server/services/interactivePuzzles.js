const { createHash } = require('node:crypto');
const pentagonFixture = require('./fixtures/pentagonPacking.json');

const VERSION = 1;
const SEED_TYPES = ['fence', 'packing', 'machine', 'courier', 'fold', 'shadow'];
const TYPES = [...SEED_TYPES, 'sliding'];
const titles = ['The Shared Fence', 'Twelve Triangles, Five Walls', 'The Buttons Lie', 'One Controller, Four Deliveries', 'One Folded Cut', 'The Shadow Is the Map', 'A Fit Is Not an Exit'];
const poems = {
  fence: 'A creator went hunting for a mathematical world record,\nbut his tools were fences, and his prize was enclosed land.\nEvery fence had the same length; every field could hold at most one unit of area.\nCould one boundary serve two neighbours and make the same fences enclose more?\nFind his fence-packing video on the platform of thumbnails, subscriptions, and a red play button.\nErich Friedman’s Packing Center is the name to follow.\nBring back the video, then build your own arrangement in this room.',
  packing: 'A young creator set out to prove a point against Google’s AI.\nHe came back with 122 world records in the subject that keeps many engineers awake: mathematics.\nOn the platform of videos, thumbnails, and a red play button, find the story of how he packed shapes inside shapes.\nHis explanation runs for about fourteen minutes. Your round’s clock will not wait for the credits.\nThe tool he used is hiding in plain sight in the video’s description.\nBring back the video and its GitHub repository, then use what you learn to solve this room.',
  machine: 'Six letters stand in a row. Three buttons can move them, but their labels keep the rules secret.\nThe machine has left you before-and-after examples of each button.\nFollow the letters through those examples: which places change, and which stay still?\nOnce you understand the three moves, lead the starting row to the target row.\nYour answer is the sequence of buttons you press.',
  courier: 'One courier, four unfamiliar roads, and a fragile parcel that must never enter a tunnel.\nYou can practise on two maps; the other two will only meet your controller at the final check.\nA memorised list of turns may survive one road and fail on the next.\nWrite one set of instructions that reacts to the walls and reaches the destination on all four.\nUse the editor below to test your rule, then submit the same controller for every delivery.',
  fold: 'An unfolded sheet must carry a diamond, but your blade is allowed only one straight cut.\nFold the paper once in each direction, bringing the stated halves together.\nA cut through the stacked layers will return as several lines when the sheet opens.\nWhich two endpoints should your single cut join so those lines become the displayed diamond?\nChoose the folds and draw that cut in the folded quarter.',
  shadow: 'Three patterned layers stand between a lamp and a screen.\nEach can turn or slide; together they must cast the target shadow shown below.\nWhere two dark cells overlap, the screen stays dark.\nWork out where each layer belongs so every target cell is covered and no extra cell is darkened.\nPlace all three layers and submit their positions.'
};
const puzzleQuestions = SEED_TYPES.map((puzzle_type, index) => ({
  set_id: `L${Math.floor(index / 2) + 1}`, level: index % 2 ? 5 : 4,
  question_text: `${titles[index]}\n\n${poems[puzzle_type]}`, correct_answer: '[interactive]', points: index % 2 ? 500 : 400, puzzle_type,
  ...(puzzle_type === 'packing' ? { puzzle_version: 2 } : {})
}));

function identity(question, team) {
  return createHash('sha256').update(JSON.stringify([String(team?._id || ''), String(question?._id || ''), String(team?.event_run_id || ''), question?.puzzle_type, question?.puzzle_version || VERSION])).digest('hex');
}
function variant(question, team) { return parseInt(identity(question, team).slice(0, 8), 16); }
function base(question, team) {
  return { version: question.puzzle_version || VERSION, type: question.puzzle_type,
    title: question.puzzle_type === 'packing' && (question.puzzle_version || VERSION) === 1 ? 'Six Guests, One Small Home' : titles[TYPES.indexOf(question.puzzle_type)],
    instance_id: identity(question, team), instructions: [], sources: [] };
}
const copy = value => JSON.parse(JSON.stringify(value));
const integer = value => Number.isSafeInteger(value);
const point = value => Array.isArray(value) && value.length === 2 && value.every(integer);
const finite = value => typeof value === 'number' && Number.isFinite(value);
function insist(condition, message) { if (!condition) throw new Error(message); }

const DISCOVERY_VIDEO_IDS = { fence: 'PhvX-5ymga8', packing: 'mVH7OPx4QZU' };
function validateDiscovery(question, team, proof) {
  try {
    insist(Object.hasOwn(DISCOVERY_VIDEO_IDS, question?.puzzle_type), 'This question has no video-discovery checkpoint.');
    insist(proof && typeof proof === 'object' && !Array.isArray(proof) && proof.instance_id === identity(question, team), 'This discovery belongs to another team, question, or event run.');
    insist(typeof proof.url === 'string' && proof.url.length <= 500, 'Paste the discovered YouTube video URL.');
    const url = new URL(proof.url.trim());
    insist(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !url.port, 'Use a normal YouTube video URL.');
    const host = url.hostname.toLowerCase(); let id;
    if (host === 'youtu.be') { const match = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname); id = match?.[1]; }
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
      if (url.pathname === '/watch') { const ids = url.searchParams.getAll('v'); if (ids.length === 1) id = ids[0]; }
      else { const match = /^\/shorts\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname); id = match?.[1]; }
    }
    insist(id === DISCOVERY_VIDEO_IDS[question.puzzle_type], 'That is not the video described by this clue. Keep searching.');
    if (question.puzzle_type === 'packing') {
      insist(typeof proof.tool_url === 'string' && proof.tool_url.length <= 500, 'Also paste the open-source tool URL from the creator’s description.');
      const tool = new URL(proof.tool_url.trim());
      insist(tool.protocol === 'https:' && tool.hostname.toLowerCase() === 'github.com' && !tool.username && !tool.password && !tool.port && /^\/Flamethr0wer\/polygon-packer(?:\.git)?\/?$/i.test(tool.pathname), 'That is not the tool repository linked by this creator. Use its GitHub repository URL.');
    }
    return { valid: true, message: 'Source verified. Your workbench is unlocked.' };
  } catch (error) { return { valid: false, message: error.message === 'Invalid URL' ? 'Paste a valid YouTube video URL.' : error.message }; }
}
function organizerDiscoveryWitness(question, team) {
  if (!Object.hasOwn(DISCOVERY_VIDEO_IDS, question?.puzzle_type)) return null;
  const proof = { instance_id: identity(question, team), url: `https://youtu.be/${DISCOVERY_VIDEO_IDS[question.puzzle_type]}` };
  if (question.puzzle_type === 'packing') proof.tool_url = 'https://github.com/Flamethr0wer/polygon-packer';
  return proof;
}

function fenceConfig(seed) {
  const nodes = [];
  for (let r = -2; r <= 2; r += 1) for (let q = -2; q <= 2; q += 1) {
    if (Math.abs(q + r) <= 2) nodes.push({ id: `N${nodes.length + 1}`, q, r, x: q + r / 2, y: r * Math.sqrt(3) / 2 });
  }
  const edges = [];
  for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) {
    if (Math.abs(Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) - 1) < 1e-8) edges.push({ id: `F${edges.length + 1}`, a: nodes[i].id, b: nodes[j].id });
  }
  // Rotate the lattice without changing any edge lengths or the solving budget.
  const angle = (seed % 6) * Math.PI / 3;
  return { nodes: nodes.map(({ id, x, y }) => ({ id, x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) })), edges, fence_budget: 12, target_area: 3 * Math.sqrt(3) / 2, max_field_area: 1 };
}
function slidingConfig(seed) {
  const pieces = [{ id: 'cargo', x: 1, y: 2, length: 2, axis: 'x', target: true }, { id: 'A', x: 2, y: 3, length: 3, axis: 'y' }, { id: 'B', x: 0, y: 0, length: 2, axis: 'x' }, { id: 'C', x: 0, y: 2, length: 2, axis: 'y' }, { id: 'D', x: 3, y: 3, length: 2, axis: 'y' }, { id: 'E', x: 0, y: 1, length: 3, axis: 'x' }, { id: 'F', x: 5, y: 2, length: 3, axis: 'y' }, { id: 'G', x: 3, y: 1, length: 2, axis: 'x' }, { id: 'H', x: 2, y: 0, length: 3, axis: 'x' }, { id: 'I', x: 4, y: 2, length: 3, axis: 'y' }, { id: 'J', x: 4, y: 5, length: 2, axis: 'x' }];
  if (seed % 2) for (const p of pieces) { p.x = 6 - p.x - (p.axis === 'x' ? p.length : 1); p.y = 6 - p.y - (p.axis === 'y' ? p.length : 1); }
  return { board: { width: 6, height: 6 }, pieces, exit: { side: seed % 2 ? 'left' : 'right', row: seed % 2 ? 3 : 2 }, max_moves: 40 };
}
function regularPolygon(sides, radius, rotation = 0) {
  return Array.from({ length: sides }, (_, index) => { const angle = (rotation + index * 360 / sides) * Math.PI / 180; return [radius * Math.cos(angle), radius * Math.sin(angle)]; });
}
function packingConfig(seed, version = 1) {
  const rotation = (seed % 12) * 15;
  if (version === 2) return { container: { sides: 5, rotation, unit_vertices: regularPolygon(5, 1 / (2 * Math.sin(Math.PI / 5)), rotation) },
    pieces: Array.from({ length: 12 }, (_, i) => ({ id: `triangle-${i + 1}`, vertices: regularPolygon(3, 1 / Math.sqrt(3)) })),
    initial_container_side: 3, target_container_side: 2.08, min_container_side: 1.73, coordinate_limit: 5, tolerance: 1e-6, tool_available: true };
  return { container: { sides: 6, rotation, unit_vertices: regularPolygon(6, 1, rotation) }, pieces: Array.from({ length: 6 }, (_, i) => ({ id: `triangle-${i + 1}`, vertices: regularPolygon(3, 1 / Math.sqrt(3)) })), initial_container_side: 1.8, target_container_side: 1.02, min_container_side: 1, coordinate_limit: 4, tolerance: 1e-6 };
}
function packingWitness(seed, version = 1) {
  const rotation = (seed % 12) * 15;
  if (version === 2) {
    const angle = rotation * Math.PI / 180, scale = 1.0001 / Math.sqrt(3);
    return pentagonFixture.positions.map((p, i) => ({ id: `triangle-${i + 1}`,
      x: scale * (p.x * Math.cos(angle) - p.y * Math.sin(angle)), y: scale * (p.x * Math.sin(angle) + p.y * Math.cos(angle)),
      rotation: ((p.angle_radians * 180 / Math.PI + rotation) % 360 + 360) % 360 }));
  }
  return Array.from({ length: 6 }, (_, i) => { const angle = (rotation + i * 60 + 30) * Math.PI / 180; return { id: `triangle-${i + 1}`, x: Math.cos(angle) / Math.sqrt(3), y: Math.sin(angle) / Math.sqrt(3), rotation: (rotation + i * 60 + 90) % 360 }; });
}
function machineOps(seed) {
  const labels = ['SUN', 'MOON', 'STAR'];
  return Object.fromEntries(labels.map((label, i) => [label, ['rotate', 'swap', 'reverse'][(i + seed % 3) % 3]]));
}
function machineMove(state, operation) {
  if (operation === 'rotate') return [state[5], ...state.slice(0, 5)];
  if (operation === 'swap') return [state[1], state[0], ...state.slice(2)];
  return [...state].reverse();
}
let hardestMachineStates;
function machineWitness(seed) {
  if (!hardestMachineStates) {
    const start = ['A', 'B', 'C', 'D', 'E', 'F'], queue = [{ state: start, program: [] }], seen = new Set([start.join('')]);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      for (const op of ['rotate', 'swap', 'reverse']) {
        const state = machineMove(current.state, op), key = state.join('');
        if (!seen.has(key)) { seen.add(key); queue.push({ state, program: [...current.program, op] }); }
      }
    }
    const distance = Math.max(...queue.map(item => item.program.length));
    hardestMachineStates = queue.filter(item => item.program.length === distance);
  }
  const selected = hardestMachineStates[seed % hardestMachineStates.length], ops = machineOps(seed);
  return { target: [...selected.state], program: selected.program.map(operation => Object.keys(ops).find(label => ops[label] === operation)) };
}
function machineConfig(seed) {
  const operations = machineOps(seed), labels = Object.keys(operations), start = ['A', 'B', 'C', 'D', 'E', 'F'];
  const witness = machineWitness(seed);
  return { start, target: witness.target, buttons: labels.map(label => ({ label })), observations: labels.map((button, i) => { const before = i ? ['C', 'F', 'A', 'E', 'B', 'D'] : start; return { button, before, after: machineMove(before, operations[button]) }; }), max_steps: witness.program.length + 2 };
}

const CORRIDOR_MAPS = [
  { grid: ['#######', '#....G#', '#.#####', '#.....#', '#####.#', '#.....#', '#######'], start: { x: 1, y: 5, direction: 1 } },
  { grid: ['#######', '#.....#', '#####.#', '#G....#', '#.#####', '#....T#', '#######'], start: { x: 4, y: 5, direction: 3 } },
  { grid: ['########', '#.....G#', '#.######', '#......#', '######.#', '#......#', '#.######', '########'], start: { x: 1, y: 6, direction: 0 } },
  { grid: ['#######', '#G....#', '#####.#', '#.....#', '#.#####', '#.....#', '#######'], start: { x: 5, y: 5, direction: 3 } }
];
function rotateMap(map, turns) {
  let value = copy(map);
  for (let i = 0; i < turns; i += 1) {
    const h = value.grid.length, w = value.grid[0].length;
    value = { grid: Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => value.grid[h - 1 - x][y]).join('')), start: { x: h - 1 - value.start.y, y: value.start.x, direction: (value.start.direction + 1) % 4 } };
  }
  return value;
}
function courierMaps(seed) { return CORRIDOR_MAPS.map((map, i) => rotateMap(map, (seed + i) % 4)); }
function courierConfig(seed) {
  return { examples: courierMaps(seed).slice(0, 2).map((map, i) => ({ id: `practice-${i + 1}`, ...map })), commands: ['MOVE', 'TURN_LEFT', 'TURN_RIGHT', 'STOP', 'REPEAT n', 'IF_WALL', 'IF_RIGHT_OPEN', 'IF_GOAL', 'ELSE', 'END'], max_steps: 1500, max_lines: 60, max_repeat: 160, max_depth: 4 };
}
function foldConfig(seed) {
  return { sheet: { width: 8, height: 8 }, operations: [{ id: 'vertical', label: seed % 2 ? 'Right half onto left' : 'Left half onto right', axis: 'x', line: 4, side: seed % 2 ? 'high' : 'low' }, { id: 'horizontal', label: seed % 4 >= 2 ? 'Bottom half onto top' : 'Top half onto bottom', axis: 'y', line: 4, side: seed % 4 >= 2 ? 'high' : 'low' }], target_segments: [[[4, 2], [6, 4]], [[6, 4], [4, 6]], [[4, 6], [2, 4]], [[2, 4], [4, 2]]], required_folds: 2 };
}
const SHAPES = [[[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]]];
function rotateCell(cell, rotation, size = 3) { let [x, y] = cell; for (let i = 0; i < rotation / 90; i += 1) [x, y] = [size - 1 - y, x]; return [x, y]; }
function shadowWitness(seed) { return SHAPES.map((_, i) => ({ id: `layer-${i + 1}`, rotation: ((seed + i) % 4) * 90, x: [0, 2, 1][i], y: [0, 1, 3][i] })); }
function projected(layers, placements) {
  return [...new Set(placements.flatMap(p => layers.find(l => l.id === p.id).cells.map(cell => { const [x, y] = rotateCell(cell, p.rotation); return `${x + p.x},${y + p.y}`; })))].sort();
}
function shadowConfig(seed) {
  const layers = SHAPES.map((cells, i) => ({ id: `layer-${i + 1}`, size: 3, cells: copy(cells) }));
  return { board: { width: 7, height: 7 }, layers, target_cells: projected(layers, shadowWitness(seed)).map(key => key.split(',').map(Number)) };
}

function getPuzzle(question, team) {
  if (!question?.puzzle_type) return null;
  if (!TYPES.includes(question.puzzle_type)) return null;
  const seed = variant(question, team), result = base(question, team);
  const configs = { fence: fenceConfig, packing: seed => packingConfig(seed, result.version), sliding: slidingConfig, machine: machineConfig, courier: courierConfig, fold: foldConfig, shadow: shadowConfig };
  Object.assign(result, configs[question.puzzle_type](seed));
  const instructions = {
    fence: ['Research the shared-fence principle from the packing video. Every candidate edge is one unit long.', 'Select at most 12 fences forming one connected network. Every used node must join at least two fences. Every enclosed field must have area at most 1.', 'Enclose a total area of at least 2.5980762114. Internal shared fences count once; open fences enclose no area. This is a finite rehearsal challenge, not a world-record claim.'],
    packing: ['Fit all six equilateral triangles, each with side length 1, inside the regular hexagon. Touching edges are allowed; overlapping interiors are not.', 'Translate and rotate the triangles, then shrink the container to side length at most 1.02. The starting side length is 1.8; the minimum allowed side length is 1.', 'Coordinates are centred on the container: x increases right, y increases down. Positive angles rotate clockwise. Submit every triangle once with finite x/y coordinates and rotation from 0 up to, but not including, 360 degrees.', 'Use the video’s geometry ideas or your own construction. This is a bounded rehearsal task with a known feasible arrangement; no world record or prolonged numerical optimisation is required. Geometry comparisons allow 0.000001 units of tolerance.'],
    sliding: ['Slide pieces only along their long axis; pieces cannot overlap or rotate.', 'Move the marked cargo completely through the exit. Every intermediate square is checked.', 'Submit up to 40 moves. Negative steps move left/up; positive steps move right/down.'],
    machine: ['Observe each maintenance demonstration to infer its button permutation.', 'Apply the same three buttons to transform the starting tiles into the target.', `Submit a sequence of at most ${result.max_steps} button labels. Demonstrations are evidence, not a list of operations.`],
    courier: ['Write one controller that reaches G on all four deliveries. Two practice maps are visible; two withheld maps follow the same corridor rules.', 'Maps contain one connected, nonbranching corridor without loops. # and T block movement. Direction 0 is up, 1 right, 2 down, 3 left. Your fragile package must never enter T.', 'Use one instruction per line. REPEAT n and IF_WALL / IF_RIGHT_OPEN / IF_GOAL blocks end with END. Conditional blocks may contain ELSE. IF_WALL checks ahead; IF_RIGHT_OPEN checks your right. STOP succeeds only on G.', 'Only the listed instructions are accepted. No JavaScript, Python, network access, coordinates, or arbitrary code is executed.'],
    fold: ['Fold the sheet using each available fold exactly once, then make one straight cut through every folded layer.', 'Coordinates increase right/down. Each fold reflects the stated half across coordinate 4; draw the cut in the final folded quarter.', 'Use integer endpoints. After unfolding, the cut edges must match the displayed diamond exactly. Either fold order and either endpoint order are accepted.'],
    shadow: ['Rotate and place each opaque layer once so the combined shadow matches the target exactly.', 'Layers may overlap. Opaque cells combine by union: overlapping cells remain dark.', 'Only clockwise quarter-turns and whole-cell translations are permitted. Keep every layer inside the board.']
  };
  result.instructions = instructions[question.puzzle_type];
  if (question.puzzle_type === 'packing' && result.version === 2) result.instructions = [
    'Twelve equilateral triangles, each with side length 1, must fit inside a regular pentagon with side length at most 2.08. Every triangle must be fully inside; interiors must not overlap. Touching edges are allowed.',
    'The creator’s tool takes three positional arguments: how many inner shapes, how many sides each inner shape has, and how many sides the container has. Work out those values from this room, then generate and inspect an arrangement.',
    'After finding the repository, you can download a working event copy below. Run it on your device, import its result JSON, and refine the fit in the studio. A picture or printed side length alone does not complete the round.',
    'The studio accepts both the tool’s radius/radian export and a room layout of container_side plus positions containing id, x, y and rotation. Tool results are converted to unit side lengths and your container orientation automatically.',
    'Room coordinates increase right/down; angles are clockwise degrees from 0 up to, but not including, 360. Use every triangle once. The server judges the full geometry with tolerance 0.000001. The round timer continues throughout research and tool runs.'
  ];
  if (Object.hasOwn(DISCOVERY_VIDEO_IDS, question.puzzle_type)) result.discovery = { clue: poems[question.puzzle_type], platform: 'YouTube', kind: 'video' };
  if (question.puzzle_type === 'packing') Object.assign(result.discovery, { tool_required: true, second_resource: 'From the moving lesson, follow the creator’s description to the open-source tool.' });
  return result;
}

function transformedPolygon(piece, pose) {
  const angle = pose.rotation * Math.PI / 180, cosine = Math.cos(angle), sine = Math.sin(angle);
  return piece.vertices.map(([x, y]) => [x * cosine - y * sine + pose.x, x * sine + y * cosine + pose.y]);
}
function polygonAxes(polygon) {
  return polygon.map((p, index) => { const q = polygon[(index + 1) % polygon.length], dx = q[0] - p[0], dy = q[1] - p[1], length = Math.hypot(dx, dy); return [-dy / length, dx / length]; });
}
function interiorsOverlap(a, b, tolerance) {
  for (const [ax, ay] of [...polygonAxes(a), ...polygonAxes(b)]) {
    const pa = a.map(([x, y]) => x * ax + y * ay), pb = b.map(([x, y]) => x * ax + y * ay);
    if (Math.max(...pa) <= Math.min(...pb) + tolerance || Math.max(...pb) <= Math.min(...pa) + tolerance) return false;
  }
  return true;
}
function validatePacking(config, submission) {
  insist(finite(submission.container_side) && submission.container_side >= config.min_container_side && submission.container_side <= config.target_container_side + config.tolerance, 'The container side must be between 1 and 1.02.');
  insist(Array.isArray(submission.positions) && submission.positions.length === config.pieces.length && new Set(submission.positions.map(p => p?.id)).size === config.pieces.length, 'Place every triangle exactly once.');
  const container = config.container.unit_vertices.map(([x, y]) => [x * submission.container_side, y * submission.container_side]);
  const polygons = submission.positions.map(pose => {
    insist(pose && typeof pose.id === 'string', 'Each position needs a triangle ID.');
    const piece = config.pieces.find(p => p.id === pose.id); insist(piece, 'Unknown triangle.');
    insist(finite(pose.x) && finite(pose.y) && Math.abs(pose.x) <= config.coordinate_limit && Math.abs(pose.y) <= config.coordinate_limit && finite(pose.rotation) && pose.rotation >= 0 && pose.rotation < 360, 'Use finite, bounded coordinates and rotations from 0 up to 360 degrees.');
    const polygon = transformedPolygon(piece, pose);
    for (const vertex of polygon) for (let i = 0; i < container.length; i += 1) {
      const a = container[i], b = container[(i + 1) % container.length], dx = b[0] - a[0], dy = b[1] - a[1];
      const inwardDistance = (dx * (vertex[1] - a[1]) - dy * (vertex[0] - a[0])) / Math.hypot(dx, dy);
      insist(inwardDistance >= -config.tolerance, 'A triangle crosses the container boundary.');
    }
    return polygon;
  });
  for (let i = 0; i < polygons.length; i += 1) for (let j = i + 1; j < polygons.length; j += 1) insist(!interiorsOverlap(polygons[i], polygons[j], config.tolerance), 'Triangles overlap.');
  return { triangles: polygons.length, container_side: Number(submission.container_side.toFixed(8)), triangle_area: Number((config.pieces.length * Math.sqrt(3) / 4).toFixed(8)) };
}

function validateFence(config, submission) {
  insist(Array.isArray(submission.edges) && submission.edges.length <= config.fence_budget && submission.edges.length >= 3, 'Choose between 3 and 12 fences.');
  insist(submission.edges.every(id => typeof id === 'string') && new Set(submission.edges).size === submission.edges.length, 'Fence IDs must be unique.');
  const byId = new Map(config.nodes.map(n => [n.id, n])), adjacency = new Map();
  for (const id of submission.edges) {
    const edge = config.edges.find(e => e.id === id); insist(edge, 'Unknown fence.');
    for (const [a, b] of [[edge.a, edge.b], [edge.b, edge.a]]) { if (!adjacency.has(a)) adjacency.set(a, []); adjacency.get(a).push(b); }
  }
  for (const neighbors of adjacency.values()) insist(neighbors.length >= 2, 'Every fence end must join another fence.');
  const connected = new Set(), pending = [adjacency.keys().next().value];
  while (pending.length) { const id = pending.pop(); if (connected.has(id)) continue; connected.add(id); pending.push(...adjacency.get(id)); }
  insist(connected.size === adjacency.size, 'The fences must form one connected network.');
  for (const [id, neighbors] of adjacency) { const a = byId.get(id); neighbors.sort((p, q) => Math.atan2(byId.get(p).y - a.y, byId.get(p).x - a.x) - Math.atan2(byId.get(q).y - a.y, byId.get(q).x - a.x)); }
  const visited = new Set(), faces = [];
  for (const [start, neighbors] of adjacency) for (const next of neighbors) {
    if (visited.has(`${start}/${next}`)) continue;
    let a = start, b = next; const polygon = [];
    do {
      const key = `${a}/${b}`; insist(!visited.has(key), 'Invalid fence topology.'); visited.add(key); polygon.push(byId.get(a));
      const around = adjacency.get(b), index = around.indexOf(a), c = around[(index - 1 + around.length) % around.length]; a = b; b = c;
      insist(polygon.length <= 2 * config.fence_budget + 1, 'Invalid fence topology.');
    } while (a !== start || b !== next);
    const area = polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.y - q.x * p.y; }, 0) / 2;
    if (area > 1e-8) faces.push(area);
  }
  insist(faces.length && faces.every(area => area <= config.max_field_area + 1e-8), 'Each enclosed field must have area at most 1.');
  const area = faces.reduce((sum, value) => sum + value, 0);
  insist(area + 1e-8 >= config.target_area, 'Your fences do not yet enclose the target area.');
  return { area: Number(area.toFixed(8)), fields: faces.length, fences: submission.edges.length };
}
function occupied(piece) { return Array.from({ length: piece.length }, (_, i) => [piece.x + (piece.axis === 'x' ? i : 0), piece.y + (piece.axis === 'y' ? i : 0)]); }
function validateSliding(config, submission) {
  insist(Array.isArray(submission.moves) && submission.moves.length > 0 && submission.moves.length <= config.max_moves, 'Supply 1–40 moves.');
  const pieces = copy(config.pieces); let escaped = false;
  for (const move of submission.moves) {
    insist(!escaped, 'The cargo has already exited.');
    insist(move && typeof move.id === 'string' && integer(move.delta) && move.delta !== 0 && Math.abs(move.delta) <= 6, 'Each move needs a piece ID and 1–6 signed steps.');
    const p = pieces.find(piece => piece.id === move.id); insist(p, 'Unknown piece.');
    for (let step = 0; step < Math.abs(move.delta); step += 1) {
      p[p.axis] += Math.sign(move.delta);
      const cells = occupied(p), others = new Set(pieces.filter(piece => piece !== p).flatMap(piece => occupied(piece).map(cell => cell.join(','))));
      for (const [x, y] of cells) {
        const inside = x >= 0 && x < 6 && y >= 0 && y < 6;
        const exit = p.target && y === config.exit.row && ((config.exit.side === 'right' && x >= 6) || (config.exit.side === 'left' && x < 0));
        insist(inside || exit, 'A piece cannot cross that board edge.'); insist(!inside || !others.has(`${x},${y}`), 'Pieces collided during this move.');
      }
      escaped = p.target && (config.exit.side === 'right' ? p.x >= 6 : p.x + p.length <= 0);
      insist(!escaped || step === Math.abs(move.delta) - 1, 'Stop the move when the cargo fully exits.');
    }
  }
  insist(escaped, 'The cargo must fully leave through the marked exit.'); return { moves: submission.moves.length };
}
function validateMachine(config, submission, seed) {
  insist(Array.isArray(submission.program) && submission.program.length <= config.max_steps, `Supply at most ${config.max_steps} button presses.`);
  const ops = machineOps(seed); let state = [...config.start];
  for (const label of submission.program) { insist(typeof label === 'string' && Object.hasOwn(ops, label), 'Unknown machine button.'); state = machineMove(state, ops[label]); }
  insist(JSON.stringify(state) === JSON.stringify(config.target), 'The machine has not reached the target.'); return { presses: submission.program.length };
}

function parseProgram(program, config) {
  insist(typeof program === 'string' && program.length <= 4000, 'Controller must be text of at most 4000 characters.');
  const lines = program.split(/\r?\n/).map(line => line.trim()).filter(Boolean); insist(lines.length && lines.length <= config.max_lines, 'Supply 1–60 instruction lines.');
  let cursor = 0;
  function block(depth) {
    insist(depth <= config.max_depth, 'Controller blocks are nested too deeply.'); const nodes = [];
    while (cursor < lines.length && !['END', 'ELSE'].includes(lines[cursor])) {
      const line = lines[cursor++];
      if (['MOVE', 'TURN_LEFT', 'TURN_RIGHT', 'STOP'].includes(line)) nodes.push({ op: line });
      else if (/^REPEAT [0-9]+$/.test(line)) { const count = Number(line.slice(7)); insist(integer(count) && count >= 1 && count <= config.max_repeat, 'REPEAT must be between 1 and 160.'); const body = block(depth + 1); insist(lines[cursor++] === 'END', 'REPEAT requires END.'); nodes.push({ op: 'REPEAT', count, body }); }
      else if (['IF_WALL', 'IF_RIGHT_OPEN', 'IF_GOAL'].includes(line)) { const yes = block(depth + 1); let no = []; if (lines[cursor] === 'ELSE') { cursor += 1; no = block(depth + 1); } insist(lines[cursor++] === 'END', 'Conditional requires END.'); nodes.push({ op: line, yes, no }); }
      else throw new Error(`Unknown instruction: ${line.slice(0, 30)}`);
    }
    return nodes;
  }
  const ast = block(0); insist(cursor === lines.length, 'Unexpected END or ELSE.'); return ast;
}
function runController(ast, map, maxSteps) {
  let { x, y, direction } = map.start, steps = 0, stopped = false;
  const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const blocked = d => { const [dx, dy] = vectors[d], cell = map.grid[y + dy]?.[x + dx]; return !cell || cell === '#' || cell === 'T'; };
  function execute(nodes) {
    for (const node of nodes) {
      if (stopped) return;
      insist(++steps <= maxSteps, 'Controller exceeded its execution budget.');
      if (node.op === 'REPEAT') { for (let i = 0; i < node.count && !stopped; i += 1) { insist(++steps <= maxSteps, 'Controller exceeded its execution budget.'); execute(node.body); } }
      else if (node.op.startsWith('IF_')) { const yes = node.op === 'IF_WALL' ? blocked(direction) : node.op === 'IF_RIGHT_OPEN' ? !blocked((direction + 1) % 4) : map.grid[y][x] === 'G'; execute(yes ? node.yes : node.no); }
      else if (node.op === 'TURN_LEFT') direction = (direction + 3) % 4;
      else if (node.op === 'TURN_RIGHT') direction = (direction + 1) % 4;
      else if (node.op === 'STOP') { insist(map.grid[y][x] === 'G', 'STOP was used before delivery.'); stopped = true; }
      else { insist(!blocked(direction), 'The controller tried to move into a wall or tunnel.'); const [dx, dy] = vectors[direction]; x += dx; y += dy; }
    }
  }
  execute(ast); insist(map.grid[y][x] === 'G', 'The controller did not deliver every package.'); return steps;
}
function validateCourier(config, submission, seed) {
  const ast = parseProgram(submission.program, config), steps = courierMaps(seed).map(map => runController(ast, map, config.max_steps)); return { deliveries: steps.length, max_steps_used: Math.max(...steps) };
}
function segmentKey(segment) { return segment.map(p => p.join(',')).sort().join('/'); }
function validateFold(config, submission) {
  insist(Array.isArray(submission.folds) && submission.folds.length === 2 && new Set(submission.folds).size === 2, 'Use each fold exactly once.');
  const operations = submission.folds.map(id => { const op = config.operations.find(o => o.id === id); insist(op, 'Unknown fold.'); return op; });
  insist(submission.cut && point(submission.cut.a) && point(submission.cut.b), 'Cut endpoints must be integer coordinate pairs.');
  const points = [submission.cut.a, submission.cut.b]; insist(segmentKey(points).split('/')[0] !== segmentKey(points).split('/')[1], 'The cut must have length.');
  for (const p of points) { insist(p.every(n => n >= 0 && n <= 8), 'The cut is outside the sheet.'); for (const op of operations) { const n = p[op.axis === 'x' ? 0 : 1]; insist(op.side === 'low' ? n >= 4 : n <= 4, 'The cut must lie inside the final folded quarter.'); } }
  let segments = [copy(points)];
  for (const op of [...operations].reverse()) { const axis = op.axis === 'x' ? 0 : 1; segments = segments.flatMap(segment => [segment, segment.map(p => { const q = [...p]; q[axis] = 8 - q[axis]; return q; })]); }
  const actual = [...new Set(segments.map(segmentKey))].sort(), target = config.target_segments.map(segmentKey).sort();
  insist(JSON.stringify(actual) === JSON.stringify(target), 'The unfolded cut does not match the target.'); return { folds: 2, cut_edges: actual.length };
}
function validateShadow(config, submission) {
  insist(Array.isArray(submission.layers) && submission.layers.length === 3 && new Set(submission.layers.map(p => p?.id)).size === 3, 'Place every layer exactly once.');
  for (const p of submission.layers) {
    insist(p && config.layers.some(l => l.id === p.id) && [0, 90, 180, 270].includes(p.rotation) && integer(p.x) && integer(p.y), 'Use known layers, quarter-turns, and integer positions.');
    insist(p.x >= 0 && p.y >= 0 && p.x + 3 <= config.board.width && p.y + 3 <= config.board.height, 'Keep each whole layer within the board.');
  }
  const actual = projected(config.layers, submission.layers), target = config.target_cells.map(p => p.join(',')).sort(); insist(JSON.stringify(actual) === JSON.stringify(target), 'The combined shadow does not match the target.'); return { dark_cells: actual.length };
}

function validatePuzzle(question, team, submission) {
  try {
    const config = getPuzzle(question, team); insist(config, 'This question has no supported interactive puzzle.');
    insist(submission && typeof submission === 'object' && !Array.isArray(submission), 'Supply a puzzle submission.');
    insist(submission.instance_id === config.instance_id, 'This puzzle belongs to another team, question, or event run. Refresh your round.');
    const seed = variant(question, team), validators = { fence: validateFence, packing: validatePacking, sliding: validateSliding, machine: validateMachine, courier: validateCourier, fold: validateFold, shadow: validateShadow };
    return { valid: true, message: 'Puzzle verified.', summary: validators[question.puzzle_type](config, submission, seed) };
  } catch (error) { return { valid: false, message: error.message }; }
}

// Organizer/testing witnesses stay server-side. They must never enter a public API payload.
function organizerWitness(question, team) {
  const seed = variant(question, team), config = getPuzzle(question, team); const answer = { instance_id: config.instance_id };
  if (question.puzzle_type === 'fence') {
    const center = config.nodes.find(n => Math.hypot(n.x, n.y) < 1e-8), ring = config.nodes.filter(n => Math.abs(Math.hypot(n.x, n.y) - 1) < 1e-8).map(n => n.id);
    answer.edges = config.edges.filter(e => (e.a === center.id && ring.includes(e.b)) || (e.b === center.id && ring.includes(e.a)) || (ring.includes(e.a) && ring.includes(e.b))).map(e => e.id);
  } else if (question.puzzle_type === 'packing') { answer.container_side = config.version === 2 ? 2.06 : 1; answer.positions = packingWitness(seed, config.version); }
  else if (question.puzzle_type === 'sliding') { const sign = seed % 2 ? -1 : 1; answer.moves = [{ id: 'C', delta: sign }, { id: 'cargo', delta: -sign }, { id: 'A', delta: -sign }, { id: 'J', delta: -4 * sign }, { id: 'A', delta: sign }, { id: 'F', delta: sign }, { id: 'I', delta: sign }, { id: 'cargo', delta: 6 * sign }]; }
  else if (question.puzzle_type === 'machine') answer.program = machineWitness(seed).program;
  else if (question.puzzle_type === 'courier') answer.program = 'REPEAT 160\nIF_GOAL\nSTOP\nEND\nIF_RIGHT_OPEN\nTURN_RIGHT\nEND\nIF_WALL\nTURN_LEFT\nELSE\nMOVE\nEND\nEND';
  else if (question.puzzle_type === 'fold') { answer.folds = ['vertical', 'horizontal']; answer.cut = { a: [4, seed % 4 >= 2 ? 2 : 6], b: [seed % 2 ? 2 : 6, 4] }; }
  else answer.layers = shadowWitness(seed);
  return answer;
}

module.exports = { getPuzzle, validatePuzzle, validateDiscovery, puzzleQuestions, organizerWitness, organizerDiscoveryWitness };
