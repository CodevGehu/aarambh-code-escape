const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');
const { SaxesParser } = require('saxes');
const jpeg = require('jpeg-js');
const RoundPuzzleState = require('../models/RoundPuzzleState');
const EARLY_TYPES = ['devtools', 'image_repair', 'black_box'];
const titles = [['The Three Traces', 'The Frame That Forgot', 'The Black Box'],
  ['A Message Between Layers', 'A Window Without a Picture', 'The Unseen Rule'],
  ['What the Browser Keeps', 'The Drawing Behind the Curtain', 'The Sealed Message']];
const wording = [
  'Three traces remain in this room. One belongs to its appearance, one travelled back from the server, and one survived in the browser’s storage. Use Developer Tools to find X, Y and Z. Wake the signal when you are ready to inspect its reply. Add the three values and enter exactly four digits, including leading zeroes.',
  'This picture has lost its grammar. An image viewer cannot finish the sentence, but a text editor can show you where it broke. Open the SVG source, repair its structure, then restore its frame. There are two structural faults and one frame or visibility fault. Read the six-digit marker it reveals and validate your repair to open the digital vault. Download its original photograph and inspect its metadata for the final passphrase. The clock continues while you work.',
  'The machine follows one rule. These four observations are its footprints. You have six experiments to test your idea. The sealed letters in the final message cannot be queried directly. Work out the rule, transform each letter of the message, and submit the resulting three-letter code.'
];
const earlyQuestions = ['L1', 'L2', 'L3'].flatMap((set_id, index) => EARLY_TYPES.map((puzzle_type, round) => ({
  set_id, level: round + 1, puzzle_type, puzzle_version: 1, points: (round + 1) * 100,
  correct_answer: '[private-instance]', question_text: `${titles[index][round]}\n\n${wording[round]}`
})));
const isEarly = question => EARLY_TYPES.includes(question?.puzzle_type);
function secret() {
  const value = process.env.EARLY_ROUND_SECRET;
  if (!value || value.length < 32) throw new Error('Private round configuration is unavailable.');
  return value;
}
function seedFor(question, team, instanceId) {
  return createHmac('sha256', secret()).update(JSON.stringify([String(team._id), team.event_run_id,
    String(question._id), question.puzzle_version || 1, instanceId])).digest();
}
const digits = {
  '0':['11111','10001','10011','10101','11001','10001','11111'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['11110','00001','00001','11110','10000','10000','11111'],
  '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['10010','10010','10010','11111','00010','00010','00010'],
  '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01111','10000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00001','11110'],
  'V':['10001','10001','10001','10001','10001','01010','00100'],
  'A':['01110','10001','10001','11111','10001','10001','10001'],
  'U':['10001','10001','10001','10001','10001','10001','01110'],
  'L':['10000','10000','10000','10000','10000','10000','11111'],
  'T':['11111','00100','00100','00100','00100','00100','00100']
};
function glyphs(text, y, cell = 8) {
  return [...text].map((letter, index) => {
    let d = '';
    (digits[letter] || []).forEach((row, rowIndex) => [...row].forEach((bit, column) => {
      if (bit === '1') { const x = 24 + index * cell * 6 + column * cell, top = y + rowIndex * cell;
        d += `M${x} ${top}h${cell - 1}v${cell - 1}h-${cell - 1}z `; }
    }));
    return `    <path d="${d.trim()}" />`;
  }).join('\n');
}
function svgPair(setId, marker) {
  const corrected = `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="210" viewBox="0 0 340 210">\n  <!-- The border and clue share a 340 by 210 frame. Keep the drawing unchanged. -->\n  <rect x="4" y="4" width="332" height="202" rx="8" fill="#101d33" />\n  <g id="frame" fill="#56e0c0" opacity="1" transform="translate(0 0)">\n${glyphs('VAULT', 30)}\n  </g>\n  <!-- The next group belongs beside the visible group, inside the same frame. -->\n  <g id="clue" fill="#ffffff" opacity="1" transform="translate(0 0)">\n${glyphs(marker, 112)}\n  </g>\n</svg>`;
  let broken;
  if (setId === 'L1') broken = corrected.replace('viewBox="0 0 340 210"', 'viewBox="0 0 340 85"')
    .replace('fill="#101d33"', 'fill="#101d33').replace('  </g>\n</svg>', '  </g>\n  </g>\n</svg>');
  else if (setId === 'L2') broken = corrected.replace('id="clue" fill="#ffffff"', 'id="clue" fill="#ffffff" fill="#ffffff"')
    .replace('id="clue" fill="#ffffff" fill="#ffffff" opacity="1" transform="translate(0 0)"', 'id="clue" fill="#ffffff" fill="#ffffff" opacity="1" transform="translate(0 230)"')
    .replace('  </g>\n</svg>', '  </path>\n</svg>');
  else broken = corrected.replace('fill="#101d33"', 'fill="#101d33')
    .replace('id="clue" fill="#ffffff" opacity="1"', 'id="clue" fill="#ffffff" opacity="0"')
    .replace('  </g>\n</svg>', '  </rect>\n</svg>');
  return { corrected, broken };
}
const numericAttrs = new Set(['width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','stroke-width','opacity','fill-opacity','stroke-opacity']);
const allowed = new Set(['xmlns','viewBox',...numericAttrs,'d','points','fill','stroke','transform','id']);
const tags = new Set(['svg','g','path','rect','circle','line','polyline','polygon']);
const numberPattern = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
function normalizeNumbers(value) {
  return value.replace(new RegExp(numberPattern, 'g'), token => {
    const n = Number(token); if (!Number.isFinite(n) || Math.abs(n) > 10000) throw new Error('Geometry exceeds the allowed bounds.');
    return String(n === 0 ? 0 : n);
  });
}
function canonicalSvg(source) {
  if (typeof source !== 'string' || Buffer.byteLength(source, 'utf8') > 65536 || !source.trim()) throw new Error('SVG source must be nonempty and at most 64 KiB.');
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|&|<\?/i.test(source)) throw new Error('Entities, document declarations and processing instructions are not allowed.');
  const parser = new SaxesParser({ xmlns: false }); const roots = [], stack = []; let count = 0;
  parser.on('error', error => { throw new Error(`Invalid XML: ${error.message}`); });
  parser.on('doctype', () => { throw new Error('DOCTYPE is not allowed.'); });
  parser.on('text', text => { if (text.trim()) throw new Error('Only the supplied vector drawing is allowed.'); });
  parser.on('opentag', tag => {
    if (!tags.has(tag.name) || ++count > 1500 || stack.length >= 16) throw new Error('The SVG element or structure is not allowed.');
    if (!stack.length && tag.name !== 'svg') throw new Error('The document must have an SVG root.');
    const attributes = {};
    for (const [key, raw] of Object.entries(tag.attributes).sort(([a],[b]) => a.localeCompare(b))) {
      if (!allowed.has(key) || typeof raw !== 'string' || raw.length > 16000) throw new Error('An SVG attribute is not allowed.');
      let value = raw.trim();
      if (key === 'xmlns') { if (tag.name !== 'svg' || value !== 'http://www.w3.org/2000/svg') throw new Error('Unexpected namespace.'); }
      else if (key === 'id') { if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,40}$/.test(value)) throw new Error('Invalid group identifier.'); }
      else if (key === 'fill' || key === 'stroke') { if (!/^(?:#[a-fA-F0-9]{3,8}|none)$/.test(value)) throw new Error('Only local solid colors are allowed.'); value = value.toLowerCase(); }
      else if (numericAttrs.has(key)) {
        if (!new RegExp(`^${numberPattern}$`).test(value)) throw new Error('Invalid numeric attribute.'); value = normalizeNumbers(value);
        if (key.includes('opacity') && (Number(value) < 0 || Number(value) > 1)) throw new Error('Opacity is out of bounds.');
      } else if (key === 'transform') {
        if (!/^translate\(\s*[-+\d.eE ,]+\s*\)$/.test(value)) throw new Error('Only the supplied translate operation is allowed.');
        const values = value.slice(value.indexOf('(') + 1, -1).trim().split(/[ ,]+/); if (values.length !== 2) throw new Error('Invalid translation.');
        value = `translate(${values.map(n => normalizeNumbers(n)).join(' ')})`;
      } else {
        const tokenRegex = key === 'd' ? new RegExp(`[MmLlHhVvZz]|${numberPattern}`, 'g') : new RegExp(numberPattern, 'g');
        const tokens = value.match(tokenRegex) || []; const remainder = value.replace(tokenRegex, '').replace(/[\s,]/g, '');
        if (remainder || !tokens.length || tokens.length > 4000) throw new Error('Invalid or excessive vector geometry.');
        if (key === 'viewBox' && tokens.length !== 4) throw new Error('Invalid frame.');
        value = tokens.map(token => /^[MmLlHhVvZz]$/.test(token) ? token : normalizeNumbers(token)).join(' ');
      }
      attributes[key] = value;
    }
    const node = { tag: tag.name, attributes, children: [] }; if (stack.length) stack.at(-1).children.push(node); else roots.push(node);
    stack.push(node);
  });
  parser.on('closetag', () => stack.pop()); parser.write(source).close();
  if (roots.length !== 1 || stack.length || roots[0].attributes.xmlns !== 'http://www.w3.org/2000/svg') throw new Error('A single SVG document with the standard namespace is required.');
  return JSON.stringify(roots[0]);
}
function transformLetter(input, base) { const n = input.charCodeAt(0) - 65; return String.fromCharCode(65 + (n + base + n * (n + 1) / 2) % 26); }
function generatePrivate(question, team, instanceId) {
  const seed = seedFor(question, team, instanceId);
  if (question.puzzle_type === 'devtools') {
    const x = 100 + seed.readUInt16BE(0) % 2700, y = 100 + seed.readUInt16BE(2) % 2700, z = 100 + seed.readUInt16BE(4) % 2700;
    return { x, y, z, answer: String(x + y + z).padStart(4, '0') };
  }
  if (question.puzzle_type === 'image_repair') {
    const marker = String(100000 + seed.readUInt32BE(0) % 900000), passphrase = `VAULT-${seed.subarray(6, 12).toString('hex').toUpperCase()}`;
    const pair = svgPair(question.set_id, marker);
    return { marker, passphrase, source: pair.broken, corrected: pair.corrected, canonical: canonicalSvg(pair.corrected), mode: 'digital' };
  }
  const base = 1 + seed[0] % 25, finalInput = { L1: 'ELM', L2: 'EKN', L3: 'ELO' }[question.set_id];
  return { base, final_input: finalInput, answer: [...finalInput].map(input => transformLetter(input, base)).join('') };
}
function publicPuzzle(question, document) {
  const data = document.private_data, puzzle = { type: question.puzzle_type, version: question.puzzle_version || 1,
    title: question.question_text.split('\n')[0], instance_id: document.instance_id, stage: document.stage, instructions: [] };
  if (question.puzzle_type === 'devtools') Object.assign(puzzle, { css_value: data.x, storage_key: document.instance_id,
    storage_value: data.z, storage_database: 'CodeEscape', storage_store: 'clues',
    instructions: ['Inspect the computed --discovery-signal property of the clue panel for X.', 'Wake the signal and inspect its response headers for Y.', 'Inspect the active record in CodeEscape → clues in IndexedDB for Z.', 'Add X + Y + Z and enter exactly four digits.'] });
  if (question.puzzle_type === 'image_repair') Object.assign(puzzle, { source: data.source, mode: data.mode,
    marker_prompt: 'Enter the six-digit marker shown in the restored drawing.', image_repaired: document.stage === 'unlocked', marker_validated: document.stage === 'unlocked',
    artifacts: [{ id: 'broken-svg', label: 'Original broken SVG', filename: 'damaged-image.svg' }, ...(document.stage === 'unlocked' ? [{ id: 'photo-2', label: 'Vault photograph (original JPEG)', filename: 'vault-photograph.jpg' }] : [])],
    instructions: ['Repair two structural faults and one frame/visibility fault.', 'Keep the supplied drawing unchanged. Equivalent formatting is accepted; arbitrary redraws are not.', 'Read the six-digit marker, then validate the repair to unlock the photograph.', 'Download the original JPEG and inspect its EXIF Artist field; screenshots may lose metadata.'] });
  if (question.puzzle_type === 'black_box') Object.assign(puzzle, { observations: [...'ABCD'].map(input => ({ input, output: transformLetter(input, data.base) })),
    final_input: data.final_input, blocked_letters: [...new Set(data.final_input)], remaining_probes: 6 - document.probes.length,
    probe_history: document.probes.map(({ input, output, idempotency_key }) => ({ input, output, idempotency_key })),
    instructions: ['Experiment with one A–Z letter at a time. Six valid experiments are available.', 'Each letter in the sealed final input is blocked; invalid or blocked experiments do not spend a probe.', 'Infer the rule and submit a three-letter output. Lowercase answers are normalized to uppercase.'] });
  return puzzle;
}
async function ensureState(question, team, session) {
  if (!isEarly(question)) return null;
  const key = { event_run_id: team.event_run_id, team_id: String(team._id), question_id: String(question._id), puzzle_version: question.puzzle_version || 1 };
  let query = RoundPuzzleState.findOne(key).select('+private_data'); if (session) query = query.session(session);
  let document = await query;
  if (!document) {
    const instanceId = randomUUID(), privateData = generatePrivate(question, team, instanceId);
    try { document = await RoundPuzzleState.findOneAndUpdate(key, { $setOnInsert: { ...key, instance_id: instanceId,
      private_data: privateData, kind: question.puzzle_type, stage: 'initial', probes: [] } }, { upsert: true, new: true, session, setDefaultsOnInsert: true }).select('+private_data'); }
    catch (error) { if (error.code !== 11000 || session) throw error; document = await RoundPuzzleState.findOne(key).select('+private_data'); }
  }
  return document;
}
const equal = (left, right) => { const a = Buffer.from(left), b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); };
function validateEarly(question, document, submission) {
  if (!submission || submission.instance_id !== document.instance_id) return { valid: false, message: 'This puzzle instance has changed. Reload the round.' };
  if (typeof submission.code !== 'string' || submission.code.length > 100) return { valid: false, message: 'Enter the round’s final code.' };
  let code = submission.code;
  if (question.puzzle_type === 'devtools') { if (!/^[0-9]{4}$/.test(code)) return { valid: false, message: 'Enter exactly four digits, including leading zeroes.' }; }
  else if (question.puzzle_type === 'black_box') { code = code.toUpperCase(); if (!/^[A-Z]{3}$/.test(code)) return { valid: false, message: 'Enter exactly three A–Z letters.' }; }
  else {
    if (document.stage !== 'unlocked') return { valid: false, message: 'Repair the image and validate its marker before submitting the final passphrase.' };
    code = code.trim().toUpperCase();
  }
  const answer = question.puzzle_type === 'image_repair' ? document.private_data.passphrase : document.private_data.answer;
  return { valid: equal(code, answer), message: equal(code, answer) ? 'Round solution verified.' : 'Incorrect answer.', summary: { instance_id: document.instance_id, ...(question.puzzle_type === 'black_box' ? { probes_used: document.probes.length } : {}) } };
}
function validateRepair(document, source, marker) {
  const normalized = canonicalSvg(source);
  if (normalized !== document.private_data.canonical) throw new Error('The restored frame or drawing does not match this image. Keep the supplied vector shapes unchanged.');
  if (typeof marker !== 'string' || !/^[0-9]{6}$/.test(marker) || !equal(marker, document.private_data.marker)) throw new Error('The marker does not match the restored drawing.');
  return true;
}
function probeInput(document, body) {
  if (typeof body.input !== 'string' || !/^[a-zA-Z]$/.test(body.input)) throw new Error('Experiment with exactly one A–Z letter.');
  const input = body.input.toUpperCase(); if (document.private_data.final_input.includes(input)) throw new Error('That letter is sealed in the final input and cannot be queried.');
  if (typeof body.idempotency_key !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(body.idempotency_key)) throw new Error('An experiment retry key is required.');
  const prior = document.probes.find(item => item.idempotency_key === body.idempotency_key);
  if (prior) { if (prior.input !== input) throw new Error('A retry key cannot be reused for another letter.'); return { prior }; }
  if (document.probes.length >= 6) throw new Error('All six experiments have been used. Final submission is still available.');
  return { entry: { input, output: transformLetter(input, document.private_data.base), idempotency_key: body.idempotency_key } };
}
function photoBytes(document) {
  // A real JPEG generated in memory, with TIFF/EXIF Artist. No public static photo or password file exists.
  const width = 320, height = 200, rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const i = (y * width + x) * 4;
    rgba[i] = 18 + Math.floor(x / 10); rgba[i + 1] = 35 + Math.floor(y / 4); rgba[i + 2] = 60 + Math.floor((x + y) / 10); rgba[i + 3] = 255;
    if ((x > 100 && x < 220 && y > 40 && y < 160) && (x < 109 || x > 211 || y < 49 || y > 151)) { rgba[i] = 90; rgba[i + 1] = 220; rgba[i + 2] = 190; }
  }
  const image = jpeg.encode({ data: rgba, width, height }, 70).data;
  const artist = Buffer.from(`${document.private_data.passphrase}\0`, 'ascii'), tiff = Buffer.alloc(26 + artist.length);
  tiff.write('II', 0); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4); tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x013b, 10); tiff.writeUInt16LE(2, 12); tiff.writeUInt32LE(artist.length, 14); tiff.writeUInt32LE(26, 18); tiff.writeUInt32LE(0, 22); artist.copy(tiff, 26);
  const payload = Buffer.concat([Buffer.from('Exif\0\0'), tiff]), marker = Buffer.alloc(4); marker.writeUInt16BE(0xffe1, 0); marker.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([image.subarray(0, 2), marker, payload, image.subarray(2)]);
}
function artifact(document, id) {
  if (document.kind !== 'image_repair') throw new Error('This round has no image artifact.');
  if (id === 'broken-svg') return { bytes: Buffer.from(document.private_data.source), type: 'application/octet-stream', filename: 'damaged-image.svg' };
  if (id !== 'photo-2' || document.stage !== 'unlocked') throw new Error('Repair and validate the marker before opening the vault photograph.');
  return { bytes: photoBytes(document), type: 'image/jpeg', filename: 'vault-photograph.jpg' };
}
function reference(question, document) {
  const data = document.private_data, common = { question_id: String(question._id), level: question.level, set_id: question.set_id,
    version: question.puzzle_version || 1, title: question.question_text.split('\n')[0], question_text: question.question_text,
    instance_id: document.instance_id, context: 'Isolated organizer rehearsal; live team values differ.',
    reference_submission: { instance_id: document.instance_id, code: data.answer || data.passphrase } };
  if (question.puzzle_type === 'devtools') return { ...common, values: { X: data.x, Y: data.y, Z: data.z }, answer: data.answer,
    explanation: `Computed CSS X (${data.x}) + X-Escape-Signal header Y (${data.y}) + IndexedDB Z (${data.z}) = ${data.answer}. Submit exactly four ASCII digits.` };
  if (question.puzzle_type === 'image_repair') return { ...common, answer: data.passphrase, marker: data.marker, corrected_source: data.corrected, broken_source: data.source,
    repairs: question.set_id === 'L1' ? ['Close the rect fill quote.', 'Remove the extra closing g tag.', 'Restore viewBox to 0 0 340 210, matching the frame.'] : question.set_id === 'L2' ? ['Remove the duplicated fill attribute.', 'Close the clue group with g rather than path.', 'Restore clue translation to 0 0, matching its visible sibling.'] : ['Close the rect fill quote.', 'Close the clue group with g rather than rect.', 'Restore clue opacity to 1, matching its visible sibling.'],
    explanation: 'Restore the supplied source and read its six-digit marker. In this entirely digital event valid repair plus marker unlocks photograph 2. Download its original bytes; EXIF Artist contains the passphrase. No QR or physical movement is required.' };
  return { ...common, answer: data.answer, base: data.base, final_input: data.final_input,
    worked_examples: [...'ABCD' + data.final_input].map(input => ({ input, output: transformLetter(input, data.base) })),
    explanation: 'A=0, B=1, … Z=25. Output position = (n + base + n(n+1)/2) mod 26. Each final-input letter is blocked. Six valid probes total; lowercase normalizes to uppercase.' };
}
module.exports = { EARLY_TYPES, earlyQuestions, isEarly, generatePrivate, publicPuzzle, ensureState, validateEarly, validateRepair, probeInput,
  canonicalSvg, svgPair, transformLetter, photoBytes, artifact, reference };
