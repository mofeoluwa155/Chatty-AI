import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const corpus = readJson("data/core-corpus.json");
const schema = readJson("data/knowledge-import.schema.json");
const benchmark = readJson("benchmarks/knowledge-search-cases.json");

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(label + " must be non-empty text.");
  }
}

function requireTextArray(value, label, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some(
    (item) => typeof item !== "string" || !item.trim()
  )) {
    throw new Error(label + " must be a valid list of text values.");
  }
}

if (!corpus || typeof corpus !== "object") throw new Error("Corpus must be an object.");
requireText(corpus.version, "version");
if (!Array.isArray(corpus.knowledge) || !Array.isArray(corpus.dialogue)) {
  throw new Error("Corpus must contain knowledge and dialogue arrays.");
}
if (corpus.knowledge.length > 1000) throw new Error("Built-in corpus exceeds its 1,000-entry limit.");

const ids = new Set();
for (const [index, item] of corpus.knowledge.entries()) {
  requireText(item.id, "knowledge[" + index + "].id");
  requireText(item.title, item.id + ".title");
  requireText(item.explanation, item.id + ".explanation");
  requireTextArray(item.keywords, item.id + ".keywords");
  requireTextArray(item.aliases, item.id + ".aliases", true);
  if (item.reviewStatus !== "starter" && item.reviewStatus !== "reviewed") {
    throw new Error(item.id + " has an invalid reviewStatus.");
  }
  if (item.reviewStatus === "reviewed") requireText(item.source, item.id + ".source");
  if (ids.has(item.id)) throw new Error("Duplicate corpus id: " + item.id);
  ids.add(item.id);
}

const normalise = (value) => value.toLowerCase()
  .replace(/[^a-z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();
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
if (exampleCount > 1000) throw new Error("Built-in conversation corpus exceeds its 1,000-example limit.");

if (schema.type !== "object" || !Array.isArray(schema.required)) {
  throw new Error("Knowledge import schema is incomplete.");
}
if (!Array.isArray(benchmark.cases) || benchmark.cases.length < 20) {
  throw new Error("Retrieval benchmark must contain at least 20 cases.");
}
for (const [index, item] of benchmark.cases.entries()) {
  requireText(item.expectedId, "benchmark.cases[" + index + "].expectedId");
  requireText(item.query, "benchmark.cases[" + index + "].query");
  if (!corpus.knowledge.some((entry) => entry.id === item.expectedId)) {
    throw new Error("Benchmark references unknown built-in ID: " + item.expectedId);
  }
}

const scripts = [
  "scripts/search-client.mjs",
  "scripts/provision-search-index.mjs",
  "scripts/seed-core-corpus.mjs",
  "scripts/import-knowledge.mjs",
  "scripts/benchmark-search.mjs"
];
for (const path of scripts) {
  const checked = spawnSync(process.execPath, ["--check", resolve(root, path)], { encoding: "utf8" });
  if (checked.status !== 0) {
    throw new Error("JavaScript syntax check failed for " + path + ": " + checked.stderr);
  }
}

const reviewedCount = corpus.knowledge.filter((item) => item.reviewStatus === "reviewed").length;
console.log(
  "Chatty Core checks passed: " +
  corpus.knowledge.length + " built-in knowledge entries, " +
  corpus.dialogue.length + " dialogue intents, " +
  exampleCount + " conversation examples, " +
  benchmark.cases.length + " retrieval benchmark cases, " +
  reviewedCount + " reviewed knowledge entries; ingestion scripts parse successfully."
);
