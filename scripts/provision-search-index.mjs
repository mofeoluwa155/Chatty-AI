import { searchRequest } from "./search-client.mjs";

const index = process.env.CHATTY_SEARCH_INDEX?.trim() || "chatty-knowledge-v1";
const primaryShards = Number.parseInt(process.env.CHATTY_SEARCH_PRIMARY_SHARDS || "32", 10);
const replicas = Number.parseInt(process.env.CHATTY_SEARCH_REPLICAS || "1", 10);

if (!Number.isInteger(primaryShards) || primaryShards < 1 || primaryShards > 1_000) {
  throw new Error("CHATTY_SEARCH_PRIMARY_SHARDS must be an integer from 1 to 1000.");
}
if (!Number.isInteger(replicas) || replicas < 0 || replicas > 10) {
  throw new Error("CHATTY_SEARCH_REPLICAS must be an integer from 0 to 10.");
}

const encodedIndex = encodeURIComponent(index);
const exists = await searchRequest("/" + encodedIndex, { method: "HEAD" });

if (exists.ok) {
  console.log("Index already exists; leaving its mappings and shard settings unchanged.");
  process.exit(0);
}
if (exists.status !== 404) {
  throw new Error("Could not check index status: HTTP " + exists.status + " " + await exists.text());
}

const definition = {
  settings: {
    number_of_shards: primaryShards,
    number_of_replicas: replicas,
    refresh_interval: "30s",
    analysis: {
      analyzer: {
        chatty_text: {
          tokenizer: "standard",
          filter: ["lowercase", "asciifolding"]
        }
      }
    }
  },
  mappings: {
    dynamic: "strict",
    properties: {
      id: { type: "keyword" },
      title: {
        type: "text",
        analyzer: "chatty_text",
        fields: { exact: { type: "keyword", ignore_above: 512 } }
      },
      aliases: { type: "text", analyzer: "chatty_text" },
      keywords: { type: "text", analyzer: "chatty_text" },
      explanation: { type: "text", analyzer: "chatty_text" },
      example: { type: "text", analyzer: "chatty_text" },
      content: { type: "text", analyzer: "chatty_text" },
      source: { type: "keyword", index: false, doc_values: false },
      domain: { type: "keyword" },
      tags: { type: "keyword" },
      language: { type: "keyword" },
      reviewStatus: { type: "keyword" }
    }
  }
};

const created = await searchRequest("/" + encodedIndex, {
  method: "PUT",
  body: JSON.stringify(definition)
});
const responseText = await created.text();
if (!created.ok) throw new Error("Index creation failed: HTTP " + created.status + " " + responseText);

console.log("Created " + index + " with " + primaryShards + " primary shards and " + replicas + " replicas.");
console.log("Before aiming for a billion records, size the cluster using measured record size, indexing rate, shard size, query latency and replica storage.");
