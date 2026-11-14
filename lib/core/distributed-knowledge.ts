import type { KnowledgeEntry } from "./knowledge";

type SearchConfig = {
  endpoint: string;
  index: string;
  authorization: string;
};

type SearchHit = {
  _score?: number | null;
  _source?: unknown;
};

type SearchResponse = {
  hits?: {
    hits?: SearchHit[];
  };
};

function getSearchConfig(): SearchConfig | null {
  const endpointValue = process.env.CHATTY_SEARCH_URL?.trim();
  const apiKey = process.env.CHATTY_SEARCH_API_KEY?.trim();
  const username = process.env.CHATTY_SEARCH_USERNAME?.trim();
  const password = process.env.CHATTY_SEARCH_PASSWORD?.trim();
  const index = process.env.CHATTY_SEARCH_INDEX?.trim() || "chatty-knowledge-v1";

  if (!endpointValue || (!apiKey && !(username && password))) return null;

  let endpoint: URL;
  try {
    endpoint = new URL(endpointValue);
  } catch {
    return null;
  }

  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost") return null;
  if (!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(index)) return null;
  endpoint.pathname = endpoint.pathname.replace(/\/+$/, "");

  const authorization = apiKey
    ? "ApiKey " + apiKey
    : "Basic " + Buffer.from(username + ":" + password).toString("base64");

  return { endpoint: endpoint.toString().replace(/\/$/, ""), index, authorization };
}

export function distributedSearchConfigured(): boolean {
  return getSearchConfig() !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toKnowledgeEntry(value: unknown): KnowledgeEntry | null {
  if (!isRecord(value)) return null;
  const { id, title, aliases, keywords, explanation, example, source, domain, tags, language } = value;
  if (
    typeof id !== "string" || !id.trim()
    || typeof title !== "string" || !title.trim()
    || typeof explanation !== "string" || !explanation.trim()
    || !Array.isArray(aliases) || !aliases.every((item) => typeof item === "string")
    || !Array.isArray(keywords) || !keywords.every((item) => typeof item === "string")
  ) return null;

  let safeSource: string | undefined;
  if (typeof source === "string") {
    try {
      const parsed = new URL(source);
      if (parsed.protocol === "https:") safeSource = parsed.toString();
    } catch {
      safeSource = undefined;
    }
  }

  return {
    id,
    title,
    aliases: aliases as string[],
    keywords: keywords as string[],
    explanation,
    ...(typeof example === "string" ? { example } : {}),
    reviewStatus: value.reviewStatus === "reviewed" ? "reviewed" : "starter",
    ...(safeSource ? { source: safeSource } : {}),
    ...(typeof domain === "string" ? { domain } : {}),
    ...(Array.isArray(tags) && tags.every((item) => typeof item === "string") ? { tags: tags as string[] } : {}),
    ...(typeof language === "string" ? { language } : {})
  };
}

/**
 * Searches the separately hosted OpenSearch index. The app downloads only a few
 * matching records per question; it never loads the full dataset into a Vercel function.
 */
export async function searchDistributedKnowledge(query: string): Promise<KnowledgeEntry | null> {
  const config = getSearchConfig();
  const cleanQuery = query.trim();
  if (!config || !cleanQuery || cleanQuery.length > 1_000) return null;

  const url = config.endpoint + "/" + config.index + "/_search";
  const body = {
    size: 3,
    track_total_hits: false,
    _source: ["id", "title", "aliases", "keywords", "explanation", "example", "source", "domain", "tags", "language", "reviewStatus"],
    query: {
      bool: {
        should: [
          {
            multi_match: {
              query: cleanQuery,
              fields: ["title^10", "aliases^7", "keywords^4"],
              type: "cross_fields",
              operator: "or",
              minimum_should_match: "60%"
            }
          },
          {
            match: {
              content: {
                query: cleanQuery,
                operator: "or",
                minimum_should_match: "60%",
                fuzziness: "AUTO",
                boost: 1.2
              }
            }
          },
          {
            multi_match: {
              query: cleanQuery,
              fields: ["title^12", "aliases^9"],
              type: "phrase",
              boost: 5
            }
          }
        ],
        minimum_should_match: 1
      }
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": config.authorization,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(2_500)
    });
    if (!response.ok) return null;

    const result = await response.json() as SearchResponse;
    const hits = Array.isArray(result.hits?.hits) ? result.hits.hits : [];
    if (!hits.length) return null;

    const first = hits[0];
    const second = hits[1];
    const firstScore = typeof first._score === "number" ? first._score : 0;
    const secondScore = second && typeof second._score === "number" ? second._score : 0;
    const entry = toKnowledgeEntry(first._source);
    if (!entry || firstScore <= 0) return null;

    const normalisedQuery = cleanQuery.toLowerCase();
    const exactTitleOrAlias = [entry.title, ...entry.aliases].some((value) => {
      const candidate = value.toLowerCase().trim();
      return candidate.length > 2 && normalisedQuery.includes(candidate);
    });
    if (!exactTitleOrAlias && secondScore > 0 && firstScore - secondScore < firstScore * 0.04) {
      return null;
    }
    return entry;
  } catch {
    // The built-in knowledge base remains available if the remote cluster is offline.
    return null;
  }
}
