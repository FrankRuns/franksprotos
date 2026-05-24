#!/usr/bin/env node
/**
 * generate-audio.js
 *
 * Pre-generates ElevenLabs MP3s for recallfm.
 *
 * Strategy: every phrase is rendered as a single continuous MP3 so it sounds
 * natural (no splicing). For the quiz, that means we generate one MP3 per
 * question per round (3 rounds x 8 questions = 24 quiz MP3s) using the same
 * seeded shuffle the page uses.
 *
 * Setup:
 *   1. ELEVENLABS_API_KEY env var
 *   2. node generate-audio.js
 *
 * Output: ./audio/*.mp3  +  ./audio/manifest.json
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

const OUT_DIR = path.join(__dirname, "audio");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------- Data: must stay in sync with index.html / quiz.html ----------

const PRIMER = [
  {
    id: "p1",
    text: "Question one. When AI gets better at doing knowledge work, what do you expect happens to the number of humans employed at AI-forward companies? Say A for drops sharply. Say B for drops slightly. Say C for stays flat. Say D for grows.",
    blurbs: {
      A: "Dan Shipper would push back hard. His company Every doubled headcount in the last year while becoming more AI-forward, not less. His frame: every agent needs a human babysitter, and automation creates new work as fast as it removes old work.",
      B: "Dan Shipper would push back hard. His company Every doubled headcount in the last year while becoming more AI-forward, not less. His frame: every agent needs a human babysitter, and automation creates new work as fast as it removes old work.",
      C: "Closer to Dan's view but still too pessimistic. He'd say you're missing that AI generates more work to do — more pull requests to review, more agents to maintain, more output to curate.",
      D: "You'd be in violent agreement with Dan. He calls the AI jobpocalypse not really a thing and is hiring aggressively. His mental model: models make yesterday's human competence cheap, which frees humans to push the frontier further.",
    },
  },
  {
    id: "p2",
    text: "Question two. Where will most professional work happen in a year? Say A for a traditional SaaS app with AI features. Say B for a chat interface like ChatGPT. Say C for a coding agent environment like Codex or Claude Code. Say D for the command line.",
    blurbs: {
      A: "Dan thinks this is wrong but not for the reason you'd expect. He's actually bullish on SaaS — would buy SaaS stocks today. But he thinks the SaaS apps will run inside a coding agent's browser, with you and the agent collaborating on them. SaaS survives, but the container changes.",
      B: "Dan would say you were right a year ago. But the new pattern is agents that live on your computer with full access to your files and an in-app browser. Chat alone is too thin a surface — the agent needs to see what you see.",
      C: "Dead on. Dan calls Codex his daily driver and says all knowledge work is migrating there. The unlock was when these agents got an in-app browser, so the agent watches you work in real time. He hit inbox zero for ten days using it — unprecedented for him.",
      D: "Dan would say you're six months behind. His phrase: we speed-ran the CLI era. GUIs are back because the in-app browser pattern needs visual surface. CLIs aren't dying, but they're not the main work surface anymore.",
    },
  },
  {
    id: "p3",
    text: "Question three. What's the biggest risk to a SaaS company in the AI era? Say A for AI agents replace SaaS entirely. Say B for margins crushed by token costs. Say C for users will demand AI features they can't afford to build. Say D for nothing major, SaaS will thrive.",
    blurbs: {
      A: "Dan calls this take dumb. His contrarian bet: agents increase the number of users of SaaS, not get rid of it. Every employee at his company uses tons of SaaS even though they're maximally AI-forward.",
      B: "Interesting one — Dan flipped this. He argues margins actually improve because users bring their own tokens via Codex or Cowork. The SaaS company doesn't pay for the AI, the user's agent does. Inverts the usual margin-crush story.",
      C: "Partially right but Dan's reframe is that you shouldn't be building the AI features inside your product anyway. Build for humans and agents to collaborate on your product together. The agent comes with the user.",
      D: "You'd be aligned with Dan's most contrarian take in the whole episode. I would buy SaaS stocks right now. The world thinks SaaS is dying. Dan thinks it's about to see an insane spike in demand from agent users.",
    },
  },
];

const QUIZ_QUESTIONS = [
  {
    id: "q1",
    prompt: "Dan's super-agent prediction — which two companies did he name as already having one?",
    options: { A: "OpenAI and Anthropic", B: "Shopify and Ramp", C: "Google and Meta", D: "Cursor and Vercel" },
    correct: "B",
    explain: "Shopify has one called Sidekick, Ramp has Ramp Agent. Dan held them up as the model — one super-agent per company instead of one per employee.",
  },
  {
    id: "q2",
    prompt: "Dan flipped his view this past year on agent architecture. What did he move from and to?",
    options: { A: "Personal agents per employee, to one super-agent per company", B: "Super-agents, to personal agents per employee", C: "Human-only workflows, to fully autonomous agents", D: "Slack-based agents, to CLI-based agents" },
    correct: "A",
    explain: "He started bullish on the Golden Compass daemon model — one agent per person. Realized agents need a human babysitter, and most people won't maintain their own. So: one super-agent, one forward-deployed engineer keeping it running.",
  },
  {
    id: "q3",
    prompt: "Why does Dan think SaaS margins might actually improve in the AI era?",
    options: { A: "Agents make products cheaper to build", B: "Users bring their own tokens via Codex or Cowork", C: "AI eliminates the need for customer support", D: "Subscription prices will rise across the board" },
    correct: "B",
    explain: "When users run his app Proof inside Codex, they spend their own OpenAI tokens, not his. Inverts the AI-crushes-margins story.",
  },
  {
    id: "q4",
    prompt: "Dan says CLIs are over. What replaces them as the main work surface?",
    options: { A: "Browser-based chat interfaces", B: "Voice-only agents", C: "GUI environments like Codex or Cowork with an in-app browser", D: "Slack with embedded AI" },
    correct: "C",
    explain: "His exact phrase: we speed-ran the CLI era. The unlock was the in-app browser — agent and human watching the same screen, working together.",
  },
  {
    id: "q5",
    prompt: "What new role does Dan call the most essential in the AI era?",
    options: { A: "Prompt engineer", B: "AI ethicist", C: "Forward deployed engineer", D: "Full-stack designer" },
    correct: "C",
    explain: "The person who keeps the company's super-agent working. Every agent needs a human who cares about it. That's the new job that doesn't go away.",
  },
  {
    id: "q6",
    prompt: "Dan's mental model for why human jobs survive — models make blank cheap. Fill in the blank.",
    options: { A: "Software development", B: "Yesterday's human competence", C: "Customer acquisition", D: "Writing and content" },
    correct: "B",
    explain: "Models ingest everything humans already figured out and commoditize it. Humans then push past the frontier. That gap is where the work is.",
  },
  {
    id: "q7",
    prompt: "Dan claims the edge of AI is not in San Francisco. Where is it?",
    options: { A: "Wherever AI meets a real human doing real work", B: "Inside the model labs themselves", C: "In Brooklyn, where Every is based", D: "In enterprise companies adopting AI at scale" },
    correct: "A",
    explain: "Model builders make the tool but don't know all the uses. The edge is the user who turns the rock over and finds a new use case.",
  },
  {
    id: "q8",
    prompt: "Dan's one-line career advice for staying employed in the AI era.",
    options: { A: "Learn to code", B: "Become a manager", C: "Specialize deeply in one domain", D: "Ride the models" },
    correct: "D",
    explain: "Use every new model the day it drops on whatever you do. Turn the rock over again. The people who do this consistently are very hard to replace.",
  },
];

// ---------- Shuffle (must match quiz.html exactly) ----------

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
    return {
      ...q,
      options: newOptions,
      correct: oldToNew[q.correct],
      // Track which original-letter each new-letter maps to, for feedback strings
      letterMapNewToOld: Object.fromEntries(Object.entries(oldToNew).map(([o, n]) => [n, o])),
    };
  });
}

// ---------- Build full natural-sounding phrases ----------

function buildQuestionText(q, qIdx) {
  return `Question ${qIdx + 1}. ${q.prompt} Say A for ${q.options.A}. Say B for ${q.options.B}. Say C for ${q.options.C}. Say D for ${q.options.D}.`;
}

function buildCorrectFeedback(q) {
  return `Correct. ${q.explain}`;
}

function buildWrongFeedback(q) {
  const correctOpt = q.options[q.correct];
  return `Not quite. The answer was ${q.correct}. ${correctOpt}. ${q.explain}`;
}

function buildSkipFeedback(q) {
  return `Skipping. The answer was ${q.correct}. ${q.options[q.correct]}. ${q.explain}`;
}

function collectPhrases() {
  const phrases = new Set();
  const lookupTable = {}; // key -> phrase text, used to build the manifest with semantic keys

  // ---- Wrapper / generic phrases (page-level) ----
  const wrappers = {
    "primer_intro": "Primer. Three questions. After each one, say A, B, C, or D out loud. You'll hear Dan Shipper's take after each answer.",
    "primer_outro": "Primer done. Now go listen to the Dan Shipper episode on Lenny's podcast. When you finish listening, come back to this page and enter your email so we can schedule the followup quizzes.",
    "didnt_catch_primer": "Sorry, didn't catch that. Try again. Just say A, B, C, or D.",
    "didnt_catch_quiz": "Didn't catch that. Say A, B, C, D, or repeat.",
    "repeating": "Repeating.",
    "skipping_primer": "Skipping this one. Moving on.",
    "come_back_24h": "Come back tomorrow. Set a calendar reminder before you forget.",
    "come_back_1wk": "Come back in 6 days. Set a calendar reminder before you forget.",
  };
  for (const [key, text] of Object.entries(wrappers)) {
    phrases.add(text);
    lookupTable[key] = text;
  }

  // Quiz round intros
  for (let r = 1; r <= 3; r++) {
    const text = `Round ${r}. 8 questions. Say A, B, C, or D. Or say repeat to hear the question again.`;
    phrases.add(text);
    lookupTable[`round_intro_${r}`] = text;
    const completeText = `Round ${r} complete.`;
    phrases.add(completeText);
    lookupTable[`round_complete_${r}`] = completeText;
  }

  // "You said A.", etc.
  ["A", "B", "C", "D"].forEach(l => {
    const text = `You said ${l}.`;
    phrases.add(text);
    lookupTable[`you_said_${l}`] = text;
  });

  // Score readouts
  for (let i = 0; i <= 8; i++) {
    const text = `You got ${i} out of 8.`;
    phrases.add(text);
    lookupTable[`score_${i}`] = text;
  }

  // ---- Primer (3 questions, 4 blurbs each = 15 phrases) ----
  PRIMER.forEach(q => {
    phrases.add(q.text);
    lookupTable[`primer_q_${q.id}`] = q.text;
    Object.entries(q.blurbs).forEach(([letter, blurb]) => {
      phrases.add(blurb);
      lookupTable[`primer_blurb_${q.id}_${letter}`] = blurb;
    });
  });

  // ---- Quiz: 3 rounds x 8 questions = 24 unique question MP3s ----
  //       PLUS feedback (correct/wrong/skip) per question per round = 72 more
  //       Total quiz: ~96 MP3s
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
  console.log(`${phrases.length} unique phrases to generate.`);

  // text -> filename
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

  // Build the final manifest: semantic key -> filename
  const manifest = {};
  for (const [key, text] of Object.entries(lookupTable)) {
    manifest[key] = textToFile[text];
  }

  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\nDone. Generated ${generated} new, skipped ${skipped} cached.`);
  console.log(`Manifest: audio/manifest.json (${Object.keys(manifest).length} keys)`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
