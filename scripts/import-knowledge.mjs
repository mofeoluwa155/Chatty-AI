import { createReadStream, createWriteStream } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { once } from "node:events";
import { searchRequest } from "./search-client.mjs";

const inputArgument = process.argv[2];
if (!inputArgument) {
  console.error("Usage: node scripts/import-knowledge.mjs <knowledge.jsonl>");
  process.exit(2);
}

const inputPath = resolve(inputArgument);
const batchSize = Number.parseInt(process.env.CHATTY_IMPORT_BATCH_SIZE || "500", 10);
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 2_000) {
  throw new Error("CHATTY_IMPORT_BATCH_SIZE must be an integer from 1 to 2000.");
}

const checkpointPath = inputPath + ".chatty-checkpoint.json";
const rejectedPath = inputPath + ".rejected.jsonl";
const failuresPath = inputPath + ".failed.jsonl";

let lastCompletedLine = 0;
try {
  const saved = JSON.parse(await readFile(checkpointPath, "utf8"));
  if (Number.isInteger(saved.lastCompletedLine) && saved.lastCompletedLine > 0) {
    lastCompletedLine = saved.lastCompletedLine;
  }
} catch {
  // A missing checkpoint means this is the first import run.
}

const rejectedStream = createWriteStream(rejectedPath, { flags: lastCompletedLine ? "a" : "w" });
const failuresStream = createWriteStream(failuresPath, { flags: lastCompletedLine ? "a" : "w" });

function validateRecord(value, lineNumber) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Each JSONL line must be an object.");
  }

  const text = (field, name, max = 20_000) => {
    if (typeof field !== "string" || !field.trim() || field.length > max) {
      throw new Error(name + " must be non-empty text of at most " + max + " characters.");
    }
    return field.trim();
  };
  const list = (field, name, allowEmpty = false) => {
    if (allowEmpty && field === undefined) return [];
    if (!Array.isArray(field) || (!allowEmpty && field.length === 0) || field.length > 100) {
      throw new Error(name + " must be an array containing no more than 100 entries.");
    }
    return [...new Set(field.map((item, index) => text(item, name + "[" + index + "]", 500)))];
  };

  const id = text(value.id, "id", 512);
  if (Buffer.byteLength(id, "utf8") > 512) throw new Error("id exceeds the search engine's 512-byte limit.");
  const title = text(value.title, "title", 500);
  const domain = text(value.domain, "domain", 120);
  const explanation = text(value.explanation, "explanation", 20_000);
  const source = text(value.source, "source", 2_000);
  const sourceUrl = new URL(source);
  if (sourceUrl.protocol !== "https:") throw new Error("source must be an HTTPS reference.");

  const aliases = list(value.aliases ?? [], "aliases", true);
  const keywords = list(value.keywords, "keywords");
  const tags = list(value.tags ?? [], "tags", true);
  const example = value.example === undefined ? undefined : text(value.example, "example", 5_000);
  const language = value.language === undefined ? "en" : text(value.language, "language", 16);

  return {
    id,
    title,
    aliases,
    keywords,
    explanation,
    ...(example ? { example } : {}),
    source: sourceUrl.toString(),
    domain,
    tags,
    language,
    // Imports are unreviewed until a human review process explicitly approves them.
    reviewStatus: "starter",
    content: [title, ...aliases, ...keywords, explanation, example ?? ""].join(" ")
  };
}

async function writeCheckpoint(line) {
  const temporaryPath = checkpointPath + ".tmp";
  await writeFile(temporaryPath, JSON.stringify({ lastCompletedLine: line }) + "\n");
  await rename(temporaryPath, checkpointPath);
}

async function wait(milliseconds) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function writeLine(stream, line) {
  if (!stream.write(line + "\n")) return once(stream, "drain");
  return Promise.resolve();
}

async function sendBulk(batch) {
  let pending = batch;
  let indexed = 0;
  let permanentFailures = [];

  for (let attempt = 0; pending.length && attempt < 6; attempt += 1) {
    const payload = pending.map((record) =>
      JSON.stringify({ index: { _index: process.env.CHATTY_SEARCH_INDEX || "chatty-knowledge-v1", _id: record.document.id } })
      + "\n" + JSON.stringify(record.document) + "\n"
    ).join("");

    let response;
    let result;
    try {
      const config = await searchRequest("/_bulk", {
        method: "POST",
        headers: { "Content-Type": "application/x-ndjson" },
        body: payload
      });
      response = config;
      if (!response.ok) throw new Error("HTTP " + response.status + ": " + (await response.text()).slice(0, 1000));
      result = await response.json();
    } catch (error) {
      if (attempt === 5) {
        permanentFailures.push(...pending.map((record) => ({
          record,
          error: error instanceof Error ? error.message : "Unknown bulk request error"
        })));
        pending = [];
        break;
      }
      await wait(Math.min(30_000, 1_000 * (2 ** attempt)));
      continue;
    }

    const items = Array.isArray(result.items) ? result.items : [];
    const retry = [];
    for (let index = 0; index < pending.length; index += 1) {
      const item = items[index];
      const operation = item && typeof item === "object" ? item.index : undefined;
      const status = operation && typeof operation.status === "number" ? operation.status : 500;

      if (status >= 200 && status < 300) {
        indexed += 1;
      } else if ([429, 502, 503, 504].includes(status) && attempt < 5) {
        retry.push(pending[index]);
      } else {
        permanentFailures.push({
          record: pending[index],
          error: "HTTP " + status + ": " + JSON.stringify(operation?.error ?? result.error ?? "Indexing failed").slice(0, 1000)
        });
      }
    }
    pending = retry;
    if (pending.length) await wait(Math.min(30_000, 1_000 * (2 ** attempt)));
  }

  for (const failure of permanentFailures) {
    await writeLine(failuresStream, JSON.stringify({
      line: failure.record.lineNumber,
      error: failure.error,
      raw: failure.record.raw
    }));
  }

  return { indexed, failed: permanentFailures.length };
}

const input = createReadStream(inputPath, { encoding: "utf8" });
const lines = createInterface({ input, crlfDelay: Infinity });
let batch = [];
let lineNumber = 0;
let indexedCount = 0;
let rejectedCount = 0;
let failedCount = 0;
let lastCheckpoint = lastCompletedLine;

for await (const raw of lines) {
  lineNumber += 1;
  if (lineNumber <= lastCompletedLine) continue;
  if (!raw.trim()) {
    lastCheckpoint = lineNumber;
    continue;
  }

  try {
    if (raw.length > 64_000) throw new Error("JSONL line exceeds 64,000 characters.");
    const value = JSON.parse(raw);
    const document = validateRecord(value, lineNumber);
    batch.push({ document, lineNumber, raw });
  } catch (error) {
    rejectedCount += 1;
    await writeLine(rejectedStream, JSON.stringify({
      line: lineNumber,
      error: error instanceof Error ? error.message : "Invalid record",
      raw
    }));
    lastCheckpoint = lineNumber;
  }

  if (batch.length >= batchSize) {
    const stats = await sendBulk(batch);
    indexedCount += stats.indexed;
    failedCount += stats.failed;
    lastCheckpoint = lineNumber;
    await writeCheckpoint(lastCheckpoint);
    batch = [];
    console.log("Processed line " + lineNumber + "; indexed this run: " + indexedCount + "; failed: " + failedCount + "; rejected: " + rejectedCount);
  }
}

if (batch.length) {
  const stats = await sendBulk(batch);
  indexedCount += stats.indexed;
  failedCount += stats.failed;
}
lastCheckpoint = lineNumber;
await writeCheckpoint(lastCheckpoint);

rejectedStream.end();
failuresStream.end();
await Promise.all([once(rejectedStream, "finish"), once(failuresStream, "finish")]);

console.log("Import complete.");
console.log("Indexed: " + indexedCount);
console.log("Permanent indexing failures: " + failedCount + " (see " + failuresPath + ")");
console.log("Rejected input rows: " + rejectedCount + " (see " + rejectedPath + ")");
console.log("Checkpoint line: " + lastCheckpoint);
if (failedCount > 0 || rejectedCount > 0) process.exitCode = 1;
