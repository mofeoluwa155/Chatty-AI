export type SearchConfig = {
  endpoint: string;
  index: string;
  authorization: string;
};

export function getSearchConfig(): SearchConfig {
  const endpointValue = process.env.CHATTY_SEARCH_URL?.trim();
  const apiKey = process.env.CHATTY_SEARCH_API_KEY?.trim();
  const username = process.env.CHATTY_SEARCH_USERNAME?.trim();
  const password = process.env.CHATTY_SEARCH_PASSWORD?.trim();
  const index = process.env.CHATTY_SEARCH_INDEX?.trim() || "chatty-knowledge-v1";

  if (!endpointValue) throw new Error("CHATTY_SEARCH_URL is required.");
  if (!apiKey && !(username && password)) {
    throw new Error("Set CHATTY_SEARCH_API_KEY or both CHATTY_SEARCH_USERNAME and CHATTY_SEARCH_PASSWORD.");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(endpointValue);
  } catch {
    throw new Error("CHATTY_SEARCH_URL must be a valid URL.");
  }

  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost") {
    throw new Error("CHATTY_SEARCH_URL must use HTTPS outside localhost.");
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(index)) {
    throw new Error("CHATTY_SEARCH_INDEX contains unsupported characters.");
  }

  endpoint.pathname = endpoint.pathname.replace(/\/+$/, "");
  const authorization = apiKey
    ? "ApiKey " + apiKey
    : "Basic " + Buffer.from(username + ":" + password).toString("base64");

  return {
    endpoint: endpoint.toString().replace(/\/$/, ""),
    index,
    authorization
  };
}

export async function searchRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const config = getSearchConfig();
  return fetch(config.endpoint + path, {
    ...init,
    headers: {
      "Authorization": config.authorization,
      "Accept": "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    },
    signal: init.signal ?? AbortSignal.timeout(30_000)
  });
}
