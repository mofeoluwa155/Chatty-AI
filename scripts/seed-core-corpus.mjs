import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { supabaseRequest } from "./search-client.mjs";

const corpusPath = resolve("data/core-corpus.json");
const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
if (!Array.isArray(corpus.knowledge)) {
  throw new Error("data/core-corpus.json must contain a knowledge array.");
}

const categories = [...new Set(corpus.knowledge.map((entry) => entry.id.split(".")[0]))]
  .map((slug) => ({
    slug,
    name: slug.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  }));

const categoryResponse = await supabaseRequest(
  "/rest/v1/knowledge_categories?on_conflict=slug",
  {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(categories)
  },
  { write: true }
);
if (!categoryResponse.ok) {
  throw new Error(
    "Could not upsert categories: HTTP " +
    categoryResponse.status + " " + (await categoryResponse.text()).slice(0, 1000)
  );
}

const records = corpus.knowledge.map((entry) => ({
  id: entry.id,
  title: entry.title,
  domain: entry.id.split(".")[0],
  aliases: entry.aliases ?? [],
  keywords: entry.keywords ?? [],
  explanation: entry.explanation,
  example: entry.example ?? null,
  source_url: entry.source ?? null,
  tags: entry.tags ?? [],
  language: entry.language ?? "en",
  review_status: entry.reviewStatus === "reviewed" ? "reviewed" : "starter"
}));

const recordResponse = await supabaseRequest(
  "/rest/v1/knowledge_records?on_conflict=id",
  {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(records)
  },
  { write: true }
);
if (!recordResponse.ok) {
  throw new Error(
    "Could not upsert knowledge records: HTTP " +
    recordResponse.status + " " + (await recordResponse.text()).slice(0, 1000)
  );
}

const links = records.map((record) => ({
  knowledge_id: record.id,
  category_slug: record.domain
}));
const linkResponse = await supabaseRequest(
  "/rest/v1/knowledge_record_categories?on_conflict=knowledge_id,category_slug",
  {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(links)
  },
  { write: true }
);
if (!linkResponse.ok) {
  throw new Error(
    "Could not link categories: HTTP " +
    linkResponse.status + " " + (await linkResponse.text()).slice(0, 1000)
  );
}

console.log("Chatty Core starter corpus seeded.");
console.log("Knowledge records: " + records.length);
console.log("Categories: " + categories.length);
