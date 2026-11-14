import { supabaseRequest } from "./search-client.mjs";

const records = await supabaseRequest("/rest/v1/knowledge_records?select=id&limit=1");
if (!records.ok) {
  throw new Error(
    "Could not reach public knowledge records: HTTP " +
    records.status + " " + (await records.text()).slice(0, 1000)
  );
}

const search = await supabaseRequest("/rest/v1/rpc/search_knowledge", {
  method: "POST",
  body: JSON.stringify({ query_text: "photosynthesis", result_limit: 3 })
});
if (!search.ok) {
  throw new Error(
    "The search_knowledge RPC is not ready: HTTP " +
    search.status + " " + (await search.text()).slice(0, 1000)
  );
}

const hits = await search.json();
if (!Array.isArray(hits)) throw new Error("Search RPC returned an unexpected response.");
console.log("Chatty Core Supabase database check passed.");
console.log("Search RPC is reachable. Photosynthesis matches: " + hits.length);
