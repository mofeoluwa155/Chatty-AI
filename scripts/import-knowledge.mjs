import { createReadStream, createWriteStream } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { basename, resolve } from "node:path";
import { once } from "node:events";
import { supabaseRequest } from "./search-client.mjs";

const inputArgument = process.argv[2];
if (!inputArgument) {
  console.error("Usage: node scripts/import-knowledge.mjs <knowledge.jsonl>");
  process.exit(2);
}

const inputPath = resolve(inputArgument);
const batchSize = Number.parseInt(process.env.SUPABASE_IMPORT_BATCH_SIZE || "500", 10);
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 2_000) {
  throw new Error("SUPABASE_IMPORT_BATCH_SIZE must be an integer from 1 to 2000.");
}

const checkpointPath = inputPath + ".chatty-checkpoint.json";
const rejectedPath = inputPath + ".rejected.jsonl";
const failuresPath = inputPath + ".failed.jsonl";
const errorsPath = inputPath + ".errors.jsonl";

let lastCompletedLine = 0;
try {
  const saved = JSON.parse(await readFile(checkpointPath, "utf8"));
  if (Number.isInteger(saved.lastCompletedLine) && saved.lastCompletedLine > 0) {
    lastCompletedLine = saved.lastCompletedLine;
  }
} catch {
  // No checkpoint means this is the first run.
}

const appendMode = lastCompletedLine > 0 ? "a" : "w";
const rejectedStream = createWriteStream(rejectedPath, { flags: appendMode });
const failuresStream = createWriteStream(failuresPath, { flags: appendMode });
const errorsStream = createWriteStream(errorsPath, { flags: appendMode });

function requireText(value, name, maxLength = 20_000) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new Error(name + " must be non-empty text of at most " + maxLength + " characters.");
  }
  return value.trim();
}

function optionalText(value, name, maxLength = 2_000) {
  if (value === undefined || value === null || value === "") return null;
  return requireText(value, name, maxLength);
}

function textArray(value, name, allowEmpty = false) {
  if (allowEmpty && value === undefined) return [];
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.length > 100) {
    throw new Error(name + " must be an array containing no more than 100 entries.");
  }
  return [...new Set(value.map((item, index) => requireText(item, name + "[" + index + "]", 500)))];
}

function validateRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Each JSONL line must be an object.");
  }

  const id = requireText(value.id, "id", 512);
  if (Buffer.byteLength(id, "utf8") > 512) throw new Error("id exceeds the 512-byte limit.");
  const title = requireText(value.title, "title", 500);
  const domain = requireText(value.domain, "domain", 120);
  const explanation = requireText(value.explanation, "explanation", 20_000);
  const source = requireText(value.source, "source", 2_000);
  const sourceUrl = new URL(source);
  if (sourceUrl.protocol !== "https:") throw new Error("source must be an HTTPS reference.");

  const keywords = textArray(value.keywords, "keywords");
  const aliases = textArray(value.aliases ?? [], "aliases", true);
  const tags = textArray(value.tags ?? [], "tags", true);
  const example = value.example === undefined ? null : requireText(value.example, "example", 5_000);
  const language = value.language === undefined ? "en" : requireText(value.language, "language", 16);

  return {
    id,
    title,
    domain,
    aliases,
    keywords,
    explanation,
    example,
    source_url: sourceUrl.toString(),
    licence: optionalText(value.licence ?? value.license, "licence", 500),
    attribution: optionalText(value.attribution, "attribution", 2_000),
    tags,
    language,
    // New imports are starter records and require human review before approval.
    review_status: "starter"
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

async function writeLine(stream, line) {
  if (!stream.write(line + "\n")) await once(stream, "drain");
}

async function createIngestionJob() {
  const response = await supabaseRequest("/rest/v1/ingestion_jobs?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([{
      dataset_name: basename(inputPath),
      dataset_version: process.env.SUPABASE_IMPORT_DATASET_VERSION || null,
      status: "running",
      started_at: new Date().toISOString()
    }])
  }, { write: true });

  if (!response.ok) {
    throw new Error(
      "Could not create ingestion job: HTTP " +
      response.status + " " + (await response.text()).slice(0, 1000)
    );
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || typeof rows[0]?.id !== "string") {
    throw new Error("Supabase did not return an ingestion job ID.");
  }
  return rows[0].id;
}

async function updateIngestionJob(jobId, values) {
  const response = await supabaseRequest(
    "/rest/v1/ingestion_jobs?id=eq." + encodeURIComponent(jobId),
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(values)
    },
    { write: true }
  );
  if (!response.ok) {
    throw new Error(
      "Could not update ingestion job: HTTP " +
      response.status + " " + (await response.text()).slice(0, 1000)
    );
  }
}

async function sendBatch(batch) {
  let pending = batch;
  for (let attempt = 0; pending.length && attempt < 6; attempt += 1) {
    try {
      const response = await supabaseRequest("/rest/v1/knowledge_records?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(pending.map((item) => item.document))
      }, { write: true });

      if (response.ok) {
        return { inserted: pending.length, failures: [] };
      }

      const detail = "HTTP " + response.status + ": " + (await response.text()).slice(0, 1000);
      if (![429, 502, 503, 504].includes(response.status) || attempt === 5) {
        return { inserted: 0, failures: pending.map((item) => ({ item, error: detail })) };
      }
    } catch (error) {
      if (attempt === 5) {
        const detail = error instanceof Error ? error.message : "Unknown request error";
        return { inserted: 0, failures: pending.map((item) => ({ item, error: detail })) };
      }
    }
    await wait(Math.min(30_000, 1_000 * (2 ** attempt)));
  }
  return { inserted: 0, failures: [] };
}

const jobId = await createIngestionJob();
const input = createReadStream(inputPath, { encoding: "utf8" });
const lines = createInterface({ input, crlfDelay: Infinity });
let batch = [];
let lineNumber = 0;
let insertedCount = 0;
let rejectedCount = 0;
let failedCount = 0;

try {
  for await (const raw of lines) {
    lineNumber += 1;
    if (lineNumber <= lastCompletedLine) continue;
    if (!raw.trim()) continue;

    try {
      if (raw.length > 64_000) throw new Error("JSONL line exceeds 64,000 characters.");
      const document = validateRecord(JSON.parse(raw));
      batch.push({ document, lineNumber, raw });
    } catch (error) {
      rejectedCount += 1;
      await writeLine(rejectedStream, raw);
      await writeLine(errorsStream, JSON.stringify({
        line: lineNumber,
        error: error instanceof Error ? error.message : "Invalid record"
      }));
    }

    if (batch.length >= batchSize) {
      const stats = await sendBatch(batch);
      insertedCount += stats.inserted;
      failedCount += stats.failures.length;
      for (const failure of stats.failures) {
        await writeLine(failuresStream, failure.item.raw);
        await writeLine(errorsStream, JSON.stringify({
          line: failure.item.lineNumber,
          error: failure.error
        }));
      }
      await writeCheckpoint(lineNumber);
      await updateIngestionJob(jobId, {
        records_seen: lineNumber,
        records_inserted: insertedCount,
        records_rejected: rejectedCount + failedCount
      });
      batch = [];
      console.log(
        "Processed line " + lineNumber +
        "; upserted this run: " + insertedCount +
        "; failed: " + failedCount +
        "; rejected: " + rejectedCount
      );
    }
  }

  if (batch.length) {
    const stats = await sendBatch(batch);
    insertedCount += stats.inserted;
    failedCount += stats.failures.length;
    for (const failure of stats.failures) {
      await writeLine(failuresStream, failure.item.raw);
      await writeLine(errorsStream, JSON.stringify({
        line: failure.item.lineNumber,
        error: failure.error
      }));
    }
  }

  await writeCheckpoint(lineNumber);
  await updateIngestionJob(jobId, {
    status: failedCount > 0 || rejectedCount > 0 ? "failed" : "completed",
    records_seen: lineNumber,
    records_inserted: insertedCount,
    records_rejected: rejectedCount + failedCount,
    completed_at: new Date().toISOString()
  });
} catch (error) {
  await updateIngestionJob(jobId, {
    status: "failed",
    records_seen: lineNumber,
    records_inserted: insertedCount,
    records_rejected: rejectedCount + failedCount,
    error_message: (error instanceof Error ? error.message : "Unknown import error").slice(0, 4000),
    completed_at: new Date().toISOString()
  });
  throw error;
} finally {
  const finished = Promise.all([
    once(rejectedStream, "finish"),
    once(failuresStream, "finish"),
    once(errorsStream, "finish")
  ]);
  rejectedStream.end();
  failuresStream.end();
  errorsStream.end();
  await finished;
}

console.log("Supabase knowledge import complete.");
console.log("Ingestion job: " + jobId);
console.log("Upserted: " + insertedCount);
console.log("Permanent failures: " + failedCount + " (valid JSONL in " + failuresPath + ")");
console.log("Rejected input rows: " + rejectedCount + " (raw JSONL in " + rejectedPath + ")");
console.log("Error details: " + errorsPath);
console.log("Checkpoint line: " + lineNumber);
if (failedCount > 0 || rejectedCount > 0) process.exitCode = 1;
