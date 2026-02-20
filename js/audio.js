// Peaceful ambient music using Web Audio API
// I–V–vi–IV chord progression in C major, 3 layers: bass, pad, melody

const AudioSystem = (() => {
  let ctx = null;
  let masterGain = null;
  let muted = false;
  let started = false;
  let nextChordTime = 0;
  let chordIndex = 0;
  let tickInterval = null;

  // C major: C – G – Am – F  (each chord lasts 8 seconds)
  const CHORD_DUR = 8.0;
  const CHORDS = [
    { bass: 65.41,  pad: [261.63, 329.63, 392.00] }, // C major
    { bass: 98.00,  pad: [196.00, 246.94, 293.66] }, // G major
    { bass: 110.00, pad: [220.00, 261.63, 329.63] }, // A minor
    { bass: 87.31,  pad: [174.61, 220.00, 261.63] }, // F major
  ];

  // Pentatonic scale (E4 up to A5) for sparse melody
  const MELODY = [329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

  // Build a simple reverb impulse response (exponential decay)
  function makeReverb(decaySec) {
    const rate = ctx.sampleRate;
    const len  = Math.ceil(rate * decaySec);
    const buf  = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  // Play a single oscillator note with envelope (returns nothing; self-cleans)
  function note(freq, type, gainVal, startT, dur, dest) {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const attack  = 0.08;
    const release = Math.min(dur * 0.4, 1.2);
    g.gain.setValueAtTime(0, startT);
    g.gain.linearRampToValueAtTime(gainVal, startT + attack);
    g.gain.setValueAtTime(gainVal, startT + dur - release);
    g.gain.linearRampToValueAtTime(0, startT + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(startT);
    osc.stop(startT + dur + 0.05);
  }

  // Schedule a pair of detuned sine pads for richness
  function padNote(freq, startT, dur, dest) {
    note(freq * 0.998, 'sine', 0.07, startT, dur, dest);
    note(freq * 1.002, 'sine', 0.07, startT, dur, dest);
  }

  function scheduleChord(chord, startT) {
    // Bass — two octaves below pad, very soft
    note(chord.bass / 2, 'sine', 0.18, startT, CHORD_DUR * 0.9, masterGain);

    // Pad — each chord tone as a detuned pair
    for (const freq of chord.pad) {
      padNote(freq, startT, CHORD_DUR * 0.95, masterGain);
    }

    // Melody — 1-2 sparse notes per chord, random from pentatonic
    const numNotes = Math.random() < 0.4 ? 1 : 2;
    for (let i = 0; i < numNotes; i++) {
      const melFreq  = MELODY[Math.floor(Math.random() * MELODY.length)];
      const offset   = (Math.random() * 0.55 + 0.05) * CHORD_DUR;
      const melDur   = 0.6 + Math.random() * 1.4;
      // Melody goes through reverb to feel spacious
      note(melFreq, 'sine', 0.12, startT + offset, melDur, masterGain);
    }
  }

  // Look-ahead scheduler: called every 150ms, looks 0.5s ahead
  function tick() {
    if (!ctx || muted) return;
    const lookAhead = 0.5;
    while (nextChordTime < ctx.currentTime + lookAhead) {
      scheduleChord(CHORDS[chordIndex % CHORDS.length], nextChordTime);
      chordIndex++;
      nextChordTime += CHORD_DUR;
    }
  }

  return {
    init() {
      if (started) return;
      started = true;

      ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Compressor at output to prevent clipping
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      comp.connect(ctx.destination);

      // Master gain — fade in over 5 seconds
      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 5);
      masterGain.connect(comp);

      // Start scheduling immediately
      nextChordTime = ctx.currentTime + 0.1;
      tick();
      tickInterval = setInterval(tick, 150);
    },

    toggle() {
      if (!ctx) return;
      muted = !muted;
      const now = ctx.currentTime;
      if (muted) {
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime(0, now + 0.8);
      } else {
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime(0.7, now + 0.8);
      }
      return muted;
    },

    isMuted() { return muted; },
  };
})();
