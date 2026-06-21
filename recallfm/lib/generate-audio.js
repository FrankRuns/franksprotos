#!/usr/bin/env node
/**
 * generate-audio.js <episode-slug>
 *
 * Pre-generates ElevenLabs MP3s for a recallfm episode, reading its
 * episodes/<slug>/content.json. Mirrors the phrase set the rendered
 * index.html/quiz.html will ask for (must use the same seeded shuffle).
 *
 * Setup:
 *   1. ELEVENLABS_API_KEY env var
 *   2. node lib/generate-audio.js <episode-slug>
 *
 * Output: episodes/<slug>/audio/*.mp3  +  episodes/<slug>/audio/manifest.json
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("Missing ELEVENLABS_API_KEY env var.");
  process.exit(1);
}

const VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam
const MODEL_ID = "eleven_turbo_v2_5";

const ROOT = path.join(__dirname, "..");
const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node lib/generate-audio.js <episode-slug>");
  process.exit(1);
}

const EPISODE_DIR = path.join(ROOT, "episodes", slug);
const CONTENT_PATH = path.join(EPISODE_DIR, "content.json");
if (!fs.existsSync(CONTENT_PATH)) {
  console.error(`No content.json found at ${CONTENT_PATH}`);
  process.exit(1);
}
const content = JSON.parse(fs.readFileSync(CONTENT_PATH, "utf8"));
const PRIMER = content.primer;
const QUIZ_QUESTIONS = content.quiz;

const OUT_DIR = path.join(EPISODE_DIR, "audio");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------- Shuffle (must match quiz.template.html exactly) ----------

function shuffleArray(arr, seed) {
  let a = seed;
  const random = () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function shuffleQuestions(round) {
  const seed = round * 1000 + 7;
  const shuffled = shuffleArray(QUIZ_QUESTIONS, seed);
  return shuffled.map((q, i) => {
    const letters = ["A", "B", "C", "D"];
    const shuffledLetters = shuffleArray(letters, seed + i * 17);
    const newOptions = {};
    const oldToNew = {};
    letters.forEach((oldLetter, idx) => {
      const newLetter = shuffledLetters[idx];
      newOptions[newLetter] = q.options[oldLetter];
      oldToNew[oldLetter] = newLetter;
    });
    return { ...q, options: newOptions, correct: oldToNew[q.correct] };
  });
}

// ---------- Build full natural-sounding phrases ----------

function buildQuestionText(q, qIdx) {
  return `Question ${qIdx + 1}. ${q.prompt} Say A for ${q.options.A}. Say B for ${q.options.B}. Say C for ${q.options.C}. Say D for ${q.options.D}.`;
}
function buildCorrectFeedback(q) { return `Correct. ${q.explain}`; }
function buildWrongFeedback(q) { return `Not quite. The answer was ${q.correct}. ${q.options[q.correct]}. ${q.explain}`; }
function buildSkipFeedback(q) { return `Skipping. The answer was ${q.correct}. ${q.options[q.correct]}. ${q.explain}`; }

function collectPhrases() {
  const phrases = new Set();
  const lookupTable = {};

  const wrappers = {
    primer_intro: content.primerIntroText,
    primer_outro: content.primerOutroSpoken,
    repeating: "Repeating.",
    skipping_primer: "Skipping this one. Moving on.",
    come_back_24h: "Come back tomorrow. Set a calendar reminder before you forget.",
    come_back_1wk: "Come back in 6 days. Set a calendar reminder before you forget.",
  };
  for (const [key, text] of Object.entries(wrappers)) {
    phrases.add(text);
    lookupTable[key] = text;
  }

  for (let r = 1; r <= 3; r++) {
    const text = `Round ${r}. 8 questions. Say A, B, C, or D. Or say repeat to hear the question again.`;
    phrases.add(text);
    lookupTable[`round_intro_${r}`] = text;
    const completeText = `Round ${r} complete.`;
    phrases.add(completeText);
    lookupTable[`round_complete_${r}`] = completeText;
  }

  ["A", "B", "C", "D"].forEach(l => {
    const text = `You said ${l}.`;
    phrases.add(text);
    lookupTable[`you_said_${l}`] = text;
  });

  for (let i = 0; i <= QUIZ_QUESTIONS.length; i++) {
    const text = `You got ${i} out of ${QUIZ_QUESTIONS.length}.`;
    phrases.add(text);
    lookupTable[`score_${i}`] = text;
  }

  PRIMER.forEach(q => {
    phrases.add(q.text);
    lookupTable[`primer_q_${q.id}`] = q.text;
    Object.entries(q.blurbs).forEach(([letter, blurb]) => {
      phrases.add(blurb);
      lookupTable[`primer_blurb_${q.id}_${letter}`] = blurb;
    });
  });

  for (let round = 1; round <= 3; round++) {
    const shuffled = shuffleQuestions(round);
    shuffled.forEach((q, qIdx) => {
      const questionKey = `quiz_r${round}_q${qIdx}`;
      const questionText = buildQuestionText(q, qIdx);
      phrases.add(questionText);
      lookupTable[questionKey] = questionText;

      const correctText = buildCorrectFeedback(q);
      phrases.add(correctText);
      lookupTable[`${questionKey}_correct`] = correctText;

      const wrongText = buildWrongFeedback(q);
      phrases.add(wrongText);
      lookupTable[`${questionKey}_wrong`] = wrongText;

      const skipText = buildSkipFeedback(q);
      phrases.add(skipText);
      lookupTable[`${questionKey}_skip`] = skipText;
    });
  }

  return { phrases: Array.from(phrases), lookupTable };
}

// ---------- Generate ----------

function hashText(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 16);
}

async function generateOne(text) {
  const filename = hashText(text) + ".mp3";
  const filepath = path.join(OUT_DIR, filename);

  if (fs.existsSync(filepath)) return { filename, skipped: true };

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${err}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
  return { filename, skipped: false };
}

async function main() {
  const { phrases, lookupTable } = collectPhrases();
  console.log(`Episode: ${slug}`);
  console.log(`${phrases.length} unique phrases to generate.`);

  const textToFile = {};
  let generated = 0, skipped = 0;

  for (let i = 0; i < phrases.length; i++) {
    const text = phrases[i];
    const preview = text.length > 70 ? text.slice(0, 70) + "…" : text;
    process.stdout.write(`[${i + 1}/${phrases.length}] ${preview} ... `);
    try {
      const result = await generateOne(text);
      textToFile[text] = result.filename;
      if (result.skipped) { skipped++; console.log("cached"); }
      else { generated++; console.log("ok"); }
      if (!result.skipped) await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.log("FAIL");
      console.error("   " + err.message);
      process.exit(1);
    }
  }

  const manifest = {};
  for (const [key, text] of Object.entries(lookupTable)) {
    manifest[key] = textToFile[text];
  }

  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\nDone. Generated ${generated} new, skipped ${skipped} cached.`);
  console.log(`Manifest: episodes/${slug}/audio/manifest.json (${Object.keys(manifest).length} keys)`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
