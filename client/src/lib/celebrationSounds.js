// Celebration effects synthesized with Web Audio: bell-like victory jingles,
// applause built from individual hand claps, drum rolls and a cymbal. No files.

function noiseBuffer(context, seconds) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function roomImpulse(context, seconds, decay) {
  const length = Math.floor(context.sampleRate * seconds), buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return buffer;
}

const N = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98 };

export function createCelebrationKit(context) {
  const master = context.createDynamicsCompressor();
  master.threshold.value = -12; master.ratio.value = 5; master.connect(context.destination);
  const dry = context.createGain(); dry.gain.value = 0.9; dry.connect(master);
  const room = context.createConvolver(); room.buffer = roomImpulse(context, 1.6, 3);
  const wet = context.createGain(); wet.gain.value = 0.22; room.connect(wet).connect(master);
  const noise = noiseBuffer(context, 2);
  const out = node => { node.connect(dry); node.connect(room); };
  const fade = (gain, t, peak, attack, release) => {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  };

  // Glockenspiel-style bell: a few inharmonic partials that ring and decay.
  function bell(t, frequency, level = 0.16, ring = 1.1) {
    for (const [ratio, share, decay] of [[1, 1, 1], [2.76, 0.32, 0.45], [5.4, 0.12, 0.25]]) {
      const osc = context.createOscillator(), gain = context.createGain();
      osc.type = 'sine'; osc.frequency.value = frequency * ratio;
      fade(gain, t, level * share, 0.004, ring * decay);
      osc.connect(gain); out(gain); osc.start(t); osc.stop(t + ring * decay + 0.05);
    }
  }
  // Soft, warm horn for the held "ta-daa" chords.
  function horn(t, notes, length, level = 0.07) {
    for (const frequency of notes) for (const detune of [-5, 5]) {
      const osc = context.createOscillator(), filter = context.createBiquadFilter(), gain = context.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = frequency / 2; osc.detune.value = detune;
      filter.type = 'lowpass'; filter.frequency.value = 1500; filter.Q.value = 0.5;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(level / notes.length, t + 0.06);
      gain.gain.setValueAtTime(level / notes.length, t + length);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.5);
      osc.connect(filter).connect(gain); out(gain); osc.start(t); osc.stop(t + length + 0.6);
    }
  }
  function clap(t, level, pan) {
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain(), panner = context.createStereoPanner();
    source.buffer = noise; filter.type = 'bandpass'; filter.frequency.value = 900 + Math.random() * 1500; filter.Q.value = 1.4;
    panner.pan.value = pan;
    fade(gain, t, level, 0.001, 0.05 + Math.random() * 0.05);
    source.connect(filter).connect(gain).connect(panner); out(panner); source.start(t, Math.random() * 1.8); source.stop(t + 0.15);
  }
  // Applause: hundreds of single claps, swelling in then thinning out.
  function applause(t, seconds, level = 0.32) {
    const total = Math.floor(seconds * 70);
    for (let i = 0; i < total; i++) {
      const at = Math.random() * seconds, shape = Math.min(1, at / 0.35) * Math.min(1, (seconds - at) / (seconds * 0.55));
      if (Math.random() < shape) clap(t + at, level * (0.35 + Math.random() * 0.65), Math.random() * 1.6 - 0.8);
    }
  }
  function snare(t, level) {
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = noise; filter.type = 'highpass'; filter.frequency.value = 1800;
    fade(gain, t, level, 0.002, 0.07);
    source.connect(filter).connect(gain); out(gain); source.start(t, Math.random()); source.stop(t + 0.12);
  }
  function roll(t, seconds) { for (let at = 0; at < seconds; at += 0.05) snare(t + at, 0.05 + 0.2 * (at / seconds)); }
  function cymbal(t, level = 0.16) {
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = noise; filter.type = 'highpass'; filter.frequency.value = 6500;
    fade(gain, t, level, 0.004, 1.6);
    source.connect(filter).connect(gain); out(gain); source.start(t); source.stop(t + 1.7);
  }
  function kick(t, level = 0.55) {
    const osc = context.createOscillator(), gain = context.createGain();
    osc.frequency.setValueAtTime(120, t); osc.frequency.exponentialRampToValueAtTime(45, t + 0.25);
    fade(gain, t, level, 0.003, 0.35);
    osc.connect(gain); out(gain); osc.start(t); osc.stop(t + 0.45);
  }
  const sparkle = (t, notes, step = 0.055, level = 0.1) => notes.forEach((note, i) => bell(t + i * step, note, level, 0.7));

  const shows = {
    // Quick "ta-da" with a short round of applause.
    cleared(t) {
      kick(t); bell(t, N.G5); bell(t + 0.14, N.C6, 0.2, 1.4); horn(t + 0.14, [N.C5, N.E5, N.G5], 0.45);
      sparkle(t + 0.3, [N.E6, N.G6, N.C6 * 2]); applause(t + 0.1, 2.2, 0.26);
    },
    // Rising arpeggio, cymbal and a bigger cheer for the first team out of a round.
    first(t) {
      sparkle(t, [N.C5, N.E5, N.G5, N.C6, N.E6], 0.09, 0.14); kick(t + 0.45); cymbal(t + 0.45);
      bell(t + 0.45, N.G6, 0.12, 1.5); horn(t + 0.45, [N.C5, N.E5, N.G5, N.C6], 0.8, 0.08);
      sparkle(t + 0.7, [N.G6, N.E6, N.G6, N.C6 * 2], 0.07, 0.08); applause(t + 0.3, 3, 0.3);
    },
    // Drum roll into a triumphant "ta-da-daa".
    lead(t) {
      roll(t, 0.7); kick(t + 0.7); cymbal(t + 0.7);
      bell(t + 0.7, N.D5); bell(t + 0.85, N.D5); bell(t + 1, N.A5, 0.2, 1.6);
      horn(t + 1, [N.D5, N.F5 * 1.0595, N.A5], 0.9, 0.09); kick(t + 1);
      sparkle(t + 1.2, [N.A5, N.D6, N.F5 * 2.119, N.A5 * 2], 0.06, 0.08); applause(t + 0.9, 3.2, 0.32);
    },
    // Full victory fanfare and the longest applause for escaping all five rooms.
    finish(t) {
      roll(t, 0.9); kick(t + 0.9); cymbal(t + 0.9, 0.2);
      [0, 0.13, 0.26].forEach(at => bell(t + 0.9 + at, N.G5, 0.15, 0.4));
      bell(t + 1.3, N.C6, 0.22, 1.8); horn(t + 1.3, [N.C5, N.E5, N.G5, N.C6], 1.2, 0.1); kick(t + 1.3); cymbal(t + 1.3, 0.18);
      sparkle(t + 1.5, [N.C6, N.E6, N.G6, N.E6, N.G6, N.C6 * 2], 0.08, 0.09);
      bell(t + 2.2, N.E6, 0.12, 1.2); bell(t + 2.2, N.G6, 0.1, 1.2); applause(t + 1, 4.5, 0.36);
    },
  };
  return { play(kind) { (shows[kind] || shows.cleared)(context.currentTime + 0.05); } };
}
