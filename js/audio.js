// Background music — HTML5 Audio
// Plays "Sunny Garden Quest.mp3" on loop from the project root.
// AudioSystem.init() is called on first keypress (satisfies autoplay policy).
// AudioSystem.toggle() mutes/unmutes with a smooth volume fade.

const AudioSystem = (() => {
  let audio = null;
  let muted = false;
  let started = false;
  let fadeInterval = null;

  const TARGET_VOL = 0.55;
  const FADE_MS    = 600;  // fade duration in ms
  const FADE_STEPS = 30;

  function fadeTo(targetVol) {
    if (!audio) return;
    if (fadeInterval) clearInterval(fadeInterval);
    const startVol = audio.volume;
    const delta    = (targetVol - startVol) / FADE_STEPS;
    let   step     = 0;
    fadeInterval = setInterval(() => {
      step++;
      audio.volume = Math.max(0, Math.min(1, startVol + delta * step));
      if (step >= FADE_STEPS) {
        audio.volume = targetVol;
        clearInterval(fadeInterval);
        fadeInterval = null;
      }
    }, FADE_MS / FADE_STEPS);
  }

  return {
    init() {
      if (started) return;
      started = true;

      audio = new Audio('Sunny Garden Quest.mp3');
      audio.loop   = true;
      audio.volume = 0;          // start silent, fade in
      audio.play().catch(() => {
        // Autoplay blocked — will retry silently; user can press B to unmute
      });

      fadeTo(TARGET_VOL);        // fade in over ~600 ms
    },

    toggle() {
      muted = !muted;
      if (muted) {
        fadeTo(0);
      } else {
        fadeTo(TARGET_VOL);
      }
      return muted;
    },

    isMuted() { return muted; },
  };
})();
