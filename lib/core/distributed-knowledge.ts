import type { KnowledgeEntry } from "./knowledge";

type SearchConfig = {
  endpoint: string;
  publishableKey: string;
};

type SearchRow = {
  id?: unknown;
  title?: unknown;
  aliases?: unknown;
  keywords?: unknown;
  explanation?: unknown;
  example?: unknown;
  source?: unknown;
  domain?: unknown;
  tags?: unknown;
  language?: unknown;
  review_status?: unknown;
};

function getSearchConfig(): SearchConfig | null {
  const endpointValue = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!endpointValue || !publishableKey) return null;

  try {
    const endpoint = new URL(endpointValue);
    const isLocal = endpoint.hostname === "localhost" || endpoint.hostname === "127.0.0.1";
    if (endpoint.protocol !== "https:" && !isLocal) return null;
    if (!isLocal && !endpoint.hostname.endsWith(".supabase.co")) return null;

    return {
      endpoint: endpoint.toString().replace(/\/+$/, ""),
      publishableKey
    };
  } catch {
    return null;
  }
}

export function distributedSearchConfigured(): boolean {
  return getSearchConfig() !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function toKnowledgeEntry(value: unknown): KnowledgeEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const row = value as SearchRow;
  if (
    typeof row.id !== "string" || !row.id.trim()
    || typeof row.title !== "string" || !row.title.trim()
    || typeof row.explanation !== "string" || !row.explanation.trim()
    || !isStringArray(row.aliases)
    || !isStringArray(row.keywords)
  ) return null;

  let safeSource: string | undefined;
  if (typeof row.source === "string") {
    try {
      const parsed = new URL(row.source);
      if (parsed.protocol === "https:") safeSource = parsed.toString();
    } catch {
      safeSource = undefined;
    }
  }

  return {
    id: row.id,
    title: row.title,
    aliases: row.aliases,
    keywords: row.keywords,
    explanation: row.explanation,
    ...(typeof row.example === "string" ? { example: row.example } : {}),
    ...(typeof row.review_status === "string" ? { reviewStatus: row.review_status } : {}),
    ...(safeSource ? { source: safeSource } : {}),
    ...(typeof row.domain === "string" ? { domain: row.domain } : {}),
    ...(isStringArray(row.tags) ? { tags: row.tags } : {}),
    ...(typeof row.language === "string" ? { language: row.language } : {})
  };
}

/**
 * Searches Chatty's own Supabase PostgreSQL knowledge store.
 * Only read-only search is performed here; writes use a separate trusted importer.
 */
export async function searchDistributedKnowledge(query: string): Promise<KnowledgeEntry | null> {
  const config = getSearchConfig();
  const cleanQuery = query.trim();
  if (!config || !cleanQuery || cleanQuery.length > 1_000) return null;

  try {
    const response = await fetch(config.endpoint + "/rest/v1/rpc/search_knowledge", {
      method: "POST",
      headers: {
        "apikey": config.publishableKey,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ query_text: cleanQuery, result_limit: 3 }),
      cache: "no-store",
      signal: AbortSignal.timeout(2_500)
    });

    if (!response.ok) return null;
    const result = await response.json() as unknown;
    if (!Array.isArray(result) || result.length === 0) return null;

    return toKnowledgeEntry(result[0]);
  } catch {
    // The built-in corpus remains available if Supabase is temporarily unavailable.
    return null;
  }
}
