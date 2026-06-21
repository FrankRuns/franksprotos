#!/usr/bin/env node
/**
 * generate-pages.js <episode-slug>
 *
 * Reads episodes/<slug>/content.json and renders index.html + quiz.html
 * for that episode from lib/index.template.html and lib/quiz.template.html.
 *
 * Usage:
 *   node lib/generate-pages.js dan-shipper-lennys-podcast
 *   node lib/generate-pages.js --all
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const EPISODES_DIR = path.join(ROOT, "episodes");

function renderEpisode(slug) {
  const episodeDir = path.join(EPISODES_DIR, slug);
  const contentPath = path.join(episodeDir, "content.json");
  if (!fs.existsSync(contentPath)) {
    throw new Error(`No content.json found at ${contentPath}`);
  }
  const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));

  const indexTemplate = fs.readFileSync(path.join(__dirname, "index.template.html"), "utf8");
  const quizTemplate = fs.readFileSync(path.join(__dirname, "quiz.template.html"), "utf8");

  const indexHtml = indexTemplate
    .replaceAll("__PAGE_TITLE__", content.pageTitle || "recallfm — primer")
    .replaceAll("__AUDIO_JS_PATH__", "../../audio.js")
    .replaceAll("__PRIMER_JSON__", JSON.stringify(content.primer, null, 2))
    .replaceAll("__PRIMER_INTRO_TEXT_JSON__", JSON.stringify(content.primerIntroText))
    .replaceAll("__PRIMER_OUTRO_SPOKEN_JSON__", JSON.stringify(content.primerOutroSpoken))
    .replaceAll("__PRIMER_OUTRO_DISPLAY_JSON__", JSON.stringify(content.primerOutroDisplay));

  const quizHtml = quizTemplate
    .replaceAll("__PAGE_TITLE_QUIZ__", (content.pageTitle || "recallfm").replace("primer", "quiz"))
    .replaceAll("__AUDIO_JS_PATH__", "../../audio.js")
    .replaceAll("__STORAGE_KEY__", `recallfm_rounds_${slug}`)
    .replaceAll("__QUIZ_JSON__", JSON.stringify(content.quiz, null, 2));

  fs.writeFileSync(path.join(episodeDir, "index.html"), indexHtml);
  fs.writeFileSync(path.join(episodeDir, "quiz.html"), quizHtml);
  console.log(`Rendered episodes/${slug}/index.html and quiz.html`);
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: node lib/generate-pages.js <episode-slug> | --all");
    process.exit(1);
  }
  if (arg === "--all") {
    const slugs = fs.readdirSync(EPISODES_DIR).filter(name =>
      fs.statSync(path.join(EPISODES_DIR, name)).isDirectory()
    );
    slugs.forEach(renderEpisode);
  } else {
    renderEpisode(arg);
  }
}

main();
