import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { supabaseRequest } from "./search-client.mjs";

const casesPath = resolve("benchmarks/knowledge-search-cases.json");
const benchmark = JSON.parse(await readFile(casesPath, "utf8"));
const threshold = Number(process.env.CHATTY_SEARCH_TARGET_ACCURACY || benchmark.targetAccuracy || 0.9);
if (!Array.isArray(benchmark.cases) || benchmark.cases.length === 0) {
  throw new Error("Benchmark must contain at least one case.");
}
if (!(threshold > 0 && threshold <= 1)) {
  throw new Error("Target accuracy must be between 0 and 1.");
}

let top1 = 0;
let top5 = 0;
const failures = [];

for (const item of benchmark.cases) {
  const response = await supabaseRequest("/rest/v1/rpc/search_knowledge", {
    method: "POST",
    body: JSON.stringify({ query_text: item.query, result_limit: 5 })
  });
  if (!response.ok) {
    throw new Error(
      "Search RPC failed with HTTP " +
      response.status + ": " + (await response.text()).slice(0, 1000)
    );
  }

  const result = await response.json();
  const ids = Array.isArray(result)
    ? result.map((row) => row?.id).filter((id) => typeof id === "string")
    : [];
  const firstCorrect = ids[0] === item.expectedId;
  const withinFive = ids.includes(item.expectedId);
  if (firstCorrect) top1 += 1;
  if (withinFive) top5 += 1;
  if (!withinFive) failures.push({ query: item.query, expected: item.expectedId, returned: ids });
}

const count = benchmark.cases.length;
const top1Accuracy = top1 / count;
const top5Recall = top5 / count;
console.log("Chatty Core Supabase-search benchmark");
console.log("Queries: " + count);
console.log("Top-1 accuracy: " + (top1Accuracy * 100).toFixed(1) + "%");
console.log("Top-5 recall: " + (top5Recall * 100).toFixed(1) + "%");
console.log("Target top-1 accuracy: " + (threshold * 100).toFixed(1) + "%");

if (failures.length) {
  console.log("Misses:");
  for (const failure of failures) {
    console.log(
      "- " + failure.query +
      " | expected " + failure.expected +
      " | got " + JSON.stringify(failure.returned)
    );
  }
}
if (top1Accuracy < threshold) process.exitCode = 1;
