import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corpusPath = resolve(root, "data/core-corpus.json");
const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(label + " must be non-empty text.");
  }
}

function requireTextArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(label + " must be a non-empty array.");
  }
  value.forEach((item, index) => requireText(item, label + "[" + index + "]"));
}

if (!corpus || typeof corpus !== "object") throw new Error("Corpus must be an object.");
requireText(corpus.version, "version");
if (!Array.isArray(corpus.knowledge) || !Array.isArray(corpus.dialogue)) {
  throw new Error("Corpus must contain knowledge and dialogue arrays.");
}
if (corpus.knowledge.length > 1000) throw new Error("Knowledge corpus exceeds its 1,000-entry limit.");

const ids = new Set();
for (const [index, item] of corpus.knowledge.entries()) {
  requireText(item.id, "knowledge[" + index + "].id");
  requireText(item.title, item.id + ".title");
  requireText(item.explanation, item.id + ".explanation");
  requireTextArray(item.keywords, item.id + ".keywords");
  if (!Array.isArray(item.aliases)) throw new Error(item.id + ".aliases must be an array.");
  item.aliases.forEach((value, aliasIndex) => requireText(value, item.id + ".aliases[" + aliasIndex + "]"));
  if (item.reviewStatus !== "starter" && item.reviewStatus !== "reviewed") {
    throw new Error(item.id + " has an invalid reviewStatus.");
  }
  if (item.reviewStatus === "reviewed") requireText(item.source, item.id + ".source");
  if (ids.has(item.id)) throw new Error("Duplicate corpus id: " + item.id);
  ids.add(item.id);
}

const normalise = (value) => value.toLowerCase().replace(/[^a-z0-9\\s]/g, " ").replace(/\\s+/g, " ").trim();
const examples = new Set();
let exampleCount = 0;
for (const [index, item] of corpus.dialogue.entries()) {
  requireText(item.id, "dialogue[" + index + "].id");
  requireText(item.intent, item.id + ".intent");
  requireText(item.response, item.id + ".response");
  requireTextArray(item.examples, item.id + ".examples");
  if (ids.has(item.id)) throw new Error("Duplicate corpus id: " + item.id);
  ids.add(item.id);
  for (const example of item.examples) {
    const key = normalise(example);
    if (examples.has(key)) throw new Error("Duplicate conversation example: " + example);
    examples.add(key);
    exampleCount += 1;
  }
}
if (exampleCount > 1000) throw new Error("Conversation corpus exceeds its 1,000-example limit.");

const reviewedCount = corpus.knowledge.filter((item) => item.reviewStatus === "reviewed").length;
console.log(
  "Chatty Core corpus passed: " +
  corpus.knowledge.length + " knowledge entries, " +
  corpus.dialogue.length + " dialogue intents, " +
  exampleCount + " conversation examples, " +
  reviewedCount + " reviewed knowledge entries."
);
