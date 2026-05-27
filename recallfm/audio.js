// audio.js — shared between index.html and quiz.html
// Loads the manifest of pre-generated ElevenLabs MP3s and plays them by key.
//
// iOS Safari quirk: audio.play() only works during a user gesture. To work
// around this, we create ONE Audio element during the Start button tap, give
// it a silent payload, and call .play() while we still have the gesture. After
// that, we mutate its .src to play subsequent MP3s — iOS treats this as the
// same playback session and allows it.

(function () {
  let manifest = null;
  let manifestLoadPromise = null;
  let sharedAudio = null; // The single reused Audio element

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

  loadManifest();

  // Browser TTS fallback (only used if manifest is missing)
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
      if (!sharedAudio) {
        console.warn("playMp3 called before unlock() — audio not initialized");
        resolve();
        return;
      }
      const src = `./audio/${filename}`;
      // Set up handlers BEFORE changing src
      const onEnded = () => {
        cleanup();
        resolve();
      };
      const onError = (e) => {
        console.warn(`Audio playback failed for ${filename}`, e);
        cleanup();
        resolve();
      };
      const cleanup = () => {
        sharedAudio.removeEventListener("ended", onEnded);
        sharedAudio.removeEventListener("error", onError);
      };
      sharedAudio.addEventListener("ended", onEnded);
      sharedAudio.addEventListener("error", onError);

      sharedAudio.src = src;
      sharedAudio.load();
      const playPromise = sharedAudio.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch((err) => {
          console.warn("audio.play() rejected:", err);
          cleanup();
          resolve();
        });
      }
    });
  }

  function stopCurrent() {
    if (sharedAudio) {
      try {
        sharedAudio.pause();
      } catch (e) {}
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  /**
   * Play audio by semantic key.
   */
  async function play(key, fallbackText) {
    await loadManifest();
    if (manifest && manifest[key] && sharedAudio) {
      return playMp3(manifest[key]);
    }
    if (fallbackText) {
      return speakBrowser(fallbackText);
    }
    console.warn(`No audio for key "${key}" and no fallback text.`);
  }

  /**
   * Unlock audio on iOS (MUST be called from a user gesture, e.g. button onclick).
   *
   * Creates ONE Audio element and plays a silent payload to establish playback
   * rights. After this, we mutate .src to play other MP3s — iOS treats this as
   * the same user-initiated session.
   *
   * NOTE: We deliberately do NOT request mic permission here. The browser will
   * prompt for mic the first time SpeechRecognition.start() runs. That first
   * recognition may abort due to the prompt, but the retry logic handles it.
   */
  async function unlock() {
    try {
      if (!sharedAudio) {
        sharedAudio = new Audio();
        sharedAudio.preload = "auto";
      }
      // Silent base64 mp3 to establish playback rights during the user gesture
      sharedAudio.src =
        "data:audio/mp3;base64,SUQzAwAAAAAAFlRTU0UAAAAMAAACTGF2ZjU5LjI3LjEwMA==";
      sharedAudio.load();
      await sharedAudio.play().catch((err) => {
        console.warn("Initial unlock play failed:", err);
      });
      // Unlock speech synthesis fallback as well
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      console.warn("unlock failed:", e);
    }
  }

  window.recallAudio = { play, unlock, stop: stopCurrent, speakBrowser };
})();
