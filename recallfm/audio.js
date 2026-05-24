// audio.js — shared between index.html and quiz.html
// Loads the manifest of pre-generated ElevenLabs MP3s and plays them by key.
// Falls back to browser TTS if the manifest hasn't loaded or a key is missing.

(function () {
  let manifest = null;
  let manifestLoadPromise = null;
  let currentAudio = null;

  function loadManifest() {
    if (manifestLoadPromise) return manifestLoadPromise;
    manifestLoadPromise = fetch("./audio/manifest.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        manifest = m;
        if (!m) console.warn("No manifest found — falling back to browser TTS.");
        return m;
      })
      .catch((err) => {
        console.warn("Manifest load failed:", err);
        manifest = null;
        return null;
      });
    return manifestLoadPromise;
  }

  // Kick off manifest load immediately
  loadManifest();

  // Browser TTS fallback
  function speakBrowser(text, rate = 0.95) {
    return new Promise((resolve) => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      u.pitch = 1.0;
      u.onend = resolve;
      u.onerror = resolve;
      window.speechSynthesis.speak(u);
    });
  }

  function playMp3(filename) {
    return new Promise((resolve) => {
      stopCurrent();
      const audio = new Audio(`./audio/${filename}`);
      currentAudio = audio;
      audio.onended = () => {
        if (currentAudio === audio) currentAudio = null;
        resolve();
      };
      audio.onerror = () => {
        console.warn(`Audio playback failed for ${filename}`);
        if (currentAudio === audio) currentAudio = null;
        resolve();
      };
      audio.play().catch((err) => {
        console.warn("audio.play() rejected:", err);
        resolve();
      });
    });
  }

  function stopCurrent() {
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (e) {}
      currentAudio = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  /**
   * Play audio by semantic key.
   *
   * @param {string} key - The manifest key (e.g. "primer_q_p1", "quiz_r1_q0").
   * @param {string} fallbackText - Text to speak via browser TTS if the MP3 is unavailable.
   * @returns {Promise<void>}
   */
  async function play(key, fallbackText) {
    await loadManifest();
    if (manifest && manifest[key]) {
      return playMp3(manifest[key]);
    }
    if (fallbackText) {
      return speakBrowser(fallbackText);
    }
    console.warn(`No audio for key "${key}" and no fallback text.`);
  }

  /**
   * Unlock audio on iOS (must be called from a user gesture).
   * Plays a silent audio element so subsequent .play() calls work without a tap.
   */
  async function unlock() {
    try {
      // Silent base64 mp3
      const silent = new Audio(
        "data:audio/mp3;base64,SUQzAwAAAAAAFlRTU0UAAAAMAAACTGF2ZjU5LjI3LjEwMA=="
      );
      await silent.play().catch(() => {});
      // Also unlock speech synthesis
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(u);
      }
    } catch (e) {}
  }

  window.recallAudio = { play, unlock, stop: stopCurrent, speakBrowser };
})();
