const test = require('node:test');
const assert = require('node:assert/strict');
const jpeg = require('jpeg-js');
const e = require('../services/earlyRoundPuzzles');
const previousSecret = process.env.EARLY_ROUND_SECRET;
test.before(() => { process.env.EARLY_ROUND_SECRET = 'test-only-early-round-secret-1234567890'; });
test.after(() => { if (previousSecret === undefined) delete process.env.EARLY_ROUND_SECRET; else process.env.EARLY_ROUND_SECRET = previousSecret; });
const documentFor = question => ({ instance_id: 'issued-instance', kind: question.puzzle_type,
  stage: 'initial', probes: [], private_data: e.generatePrivate({ ...question, _id: 'question' }, { _id: 'team', event_run_id: 'run' }, 'issued-instance') });
test('nine aligned early-round questions keep fresh generated values outside participant DTOs', () => {
  assert.equal(e.earlyQuestions.length, 9);
  for (const q of e.earlyQuestions) {
    const d = documentFor(q), dto = e.publicPuzzle(q, d), wire = JSON.stringify(dto);
    assert.equal(dto.instance_id, d.instance_id);
    assert.equal('private_data' in dto, false);
    for (const key of ['answer','base','passphrase','canonical','corrected','marker']) assert.equal(Object.hasOwn(dto, key), false);
    if (q.level === 2) { assert.equal(wire.includes(d.private_data.passphrase), false); assert.equal(dto.artifacts.length, 1); }
  }
});
test('private generation is instance/team/run-bound and fails closed without a secret', () => {
  const q = { ...e.earlyQuestions[0], _id: 'q' }, team = { _id: 't', event_run_id: 'run' };
  assert.deepEqual(e.generatePrivate(q, team, 'id'), e.generatePrivate(q, team, 'id'));
  assert.notDeepEqual(e.generatePrivate(q, team, 'id'), e.generatePrivate(q, team, 'other-id'));
  assert.notDeepEqual(e.generatePrivate(q, team, 'id'), e.generatePrivate(q, { ...team, event_run_id: 'new' }, 'id'));
  const saved = process.env.EARLY_ROUND_SECRET; delete process.env.EARLY_ROUND_SECRET;
  assert.throws(() => e.generatePrivate(q, team, 'id'), /unavailable/); process.env.EARLY_ROUND_SECRET = saved;
});
for (const setId of ['L1','L2','L3']) {
  test(`${setId}: booklet fixes Image 1 and distinguishes its marker from Photograph 2 answer`, () => {
    const q = e.earlyQuestions.find(q => q.set_id === setId && q.level === 2), d = documentFor(q);
    const guide = e.reference(q, d), participant = e.publicPuzzle(q, d);
    assert.equal(guide.broken_source, participant.source, 'Guide starts with the exact participant Image 1');
    assert.throws(() => e.canonicalSvg(guide.broken_source), /Invalid XML/);
    assert.equal(e.validateRepair(d, guide.corrected_source, guide.marker), true, 'Booklet correction repairs the first image');
    assert.equal(guide.repairs.length, 3);
    assert.notEqual(guide.marker, guide.answer, 'Marker is not the final passphrase');
    assert.throws(() => e.artifact(d, 'photo-2'), /before/);
    assert.equal(e.validateEarly(q, d, guide.reference_submission).valid, false, 'Knowing the final answer does not skip Image 1');
    d.stage = 'unlocked';
    const photo = e.artifact(d, 'photo-2'), tiff = photo.bytes.subarray(12);
    assert.equal(jpeg.decode(photo.bytes).width, 320, 'Photograph 2 is a separate valid JPEG');
    assert.equal(tiff.readUInt16LE(10), 0x013b, 'Final answer is in EXIF Artist');
    const offset = tiff.readUInt32LE(18), length = tiff.readUInt32LE(14);
    assert.equal(tiff.subarray(offset, offset + length - 1).toString(), guide.answer);
    assert.equal(e.validateEarly(q, d, guide.reference_submission).valid, true);
    assert.equal(e.validateEarly(q, d, { ...guide.reference_submission, code: guide.marker }).valid, false);
  });
  test(`${setId}: SVG begins malformed, reference repair passes, every fault must be restored`, () => {
    const q = e.earlyQuestions.find(q => q.set_id === setId && q.level === 2), d = documentFor(q);
    assert.throws(() => e.canonicalSvg(d.private_data.source), /Invalid XML/);
    assert.equal(e.validateRepair(d, d.private_data.corrected, d.private_data.marker), true);
    const visualFault = setId === 'L1' ? d.private_data.corrected.replace('viewBox="0 0 340 210"', 'viewBox="0 0 340 85"') : setId === 'L2' ? d.private_data.corrected.replace('id="clue" fill="#ffffff" opacity="1" transform="translate(0 0)"', 'id="clue" fill="#ffffff" opacity="1" transform="translate(0 230)"') : d.private_data.corrected.replace('id="clue" fill="#ffffff" opacity="1"', 'id="clue" fill="#ffffff" opacity="0"');
    assert.throws(() => e.validateRepair(d, visualFault, d.private_data.marker), /does not match/);
    assert.throws(() => e.validateRepair(d, d.private_data.corrected, '000000'), /marker/);
    assert.throws(() => e.validateRepair(d, d.private_data.corrected.replace('fill="#ffffff"', 'fill="#000000"'), d.private_data.marker), /does not match/);
    assert.equal(e.validateRepair(d, d.private_data.corrected.replace(/"/g, "'").replace('width=\'340\'', 'width=\'340.000\''), d.private_data.marker), true);
    assert.equal(d.private_data.corrected.includes(d.private_data.marker), false, 'Marker rendered as outlined paths, not literal text');
    assert.equal(d.private_data.corrected.includes(d.private_data.passphrase), false);
  });
}
test('bounded non-resolving XML parser rejects active content, entities, external references and namespace tricks', () => {
  const safe = e.svgPair('L1', '123456').corrected;
  const payloads = [safe.replace('<svg ', '<svg onload="alert(1)" '), safe.replace('</svg>', '<script>alert(1)</script></svg>'),
    safe.replace('</svg>', '<use href="https://example.com"/></svg>'), safe.replace('</svg>', '<foreignObject/></svg>'),
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + safe, safe.replace('fill="#ffffff"', 'fill="url(https://example.com)"'),
    safe.replace('xmlns="http://www.w3.org/2000/svg"', 'xmlns="https://evil.test"'), safe.replace('width="340"', 'width="Infinity"'),
    safe.replace('width="340"', 'width="1e99"'), safe.replace('<g id="frame"', '<g id="frame" id="frame"'),
    safe.replace('</svg>', '<text>answer</text></svg>'), safe + ' '.repeat(65536), safe.replace('</svg>', '<g>'.repeat(17) + '</g>'.repeat(17) + '</svg>')];
  for (const payload of payloads) assert.throws(() => e.canonicalSvg(payload));
});
test('round one validates exactly four ASCII digits and ignores modified client clues', () => {
  const q = e.earlyQuestions[0], d = documentFor(q), good = { instance_id: d.instance_id, code: d.private_data.answer };
  assert.equal(e.validateEarly(q, d, good).valid, true);
  for (const code of [good.code + ' ', '１２３４', good.code + '0', Number(good.code)]) assert.equal(e.validateEarly(q, d, { ...good, code }).valid, false);
  assert.equal(e.validateEarly(q, d, { ...good, instance_id: 'other' }).valid, false);
});
test('round two photo metadata and final answer are inaccessible until repair and marker acceptance', () => {
  const q = e.earlyQuestions[1], d = documentFor(q), proof = { instance_id: d.instance_id, code: d.private_data.passphrase };
  assert.throws(() => e.artifact(d, 'photo-2'), /before/);
  assert.equal(e.validateEarly(q, d, proof).valid, false);
  d.stage = 'unlocked'; const photo = e.artifact(d, 'photo-2');
  assert.equal(photo.type, 'image/jpeg'); assert.equal(jpeg.decode(photo.bytes).width, 320);
  assert.equal(photo.bytes.subarray(2,4).readUInt16BE(0), 0xffe1);
  const exifStart = 12, tiff = photo.bytes.subarray(exifStart), field = tiff.readUInt32LE(18), length = tiff.readUInt32LE(14);
  assert.equal(tiff.readUInt16LE(10), 0x013b); assert.equal(tiff.subarray(field, field + length - 1).toString(), d.private_data.passphrase);
  assert.equal(e.validateEarly(q, d, proof).valid, true);
  assert.throws(() => e.artifact(d, 'corrected-svg'), /before/);
});
test('black box blocks every sealed letter without charging and enforces six idempotent experiments', () => {
  const q = e.earlyQuestions[2], d = documentFor(q);
  for (const input of d.private_data.final_input) assert.throws(() => e.probeInput(d, { input, idempotency_key: 'request-123' }), /sealed/);
  assert.throws(() => e.probeInput(d, { input: 'AA', idempotency_key: 'request-123' }), /exactly/); assert.equal(d.probes.length, 0);
  for (let i = 0; i < 6; i++) { const result = e.probeInput(d, { input: 'A', idempotency_key: `request-${i}` }); d.probes.push(result.entry); }
  assert.equal(e.probeInput(d, { input: 'a', idempotency_key: 'request-0' }).prior.output, d.probes[0].output);
  assert.throws(() => e.probeInput(d, { input: 'B', idempotency_key: 'request-0' }), /another letter/);
  assert.throws(() => e.probeInput(d, { input: 'B', idempotency_key: 'request-new' }), /six/);
  assert.equal(e.validateEarly(q, d, { instance_id: d.instance_id, code: d.private_data.answer.toLowerCase() }).valid, true);
  assert.equal(e.publicPuzzle(q, d).remaining_probes, 0);
});
