/**
 * Shared Supabase REST client for Chatty's importer and benchmark scripts.
 * Read-only operations use the publishable key. Writes require the server-only
 * service-role key and must never be exposed to browser code.
 */
export function getSupabaseConfig({ write = false } = {}) {
  const endpointValue = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!endpointValue) throw new Error("SUPABASE_URL is required.");

  let endpoint;
  try {
    endpoint = new URL(endpointValue);
  } catch {
    throw new Error("SUPABASE_URL must be a valid URL.");
  }

  const isLocal = endpoint.hostname === "localhost" || endpoint.hostname === "127.0.0.1";
  if (endpoint.protocol !== "https:" && !isLocal) {
    throw new Error("SUPABASE_URL must use HTTPS outside localhost.");
  }
  if (!isLocal && !endpoint.hostname.endsWith(".supabase.co")) {
    throw new Error("SUPABASE_URL must point to a Supabase project.");
  }

  const apiKey = write ? serviceRoleKey : (publishableKey || serviceRoleKey);
  if (!apiKey) {
    throw new Error(write
      ? "SUPABASE_SERVICE_ROLE_KEY is required for trusted imports."
      : "SUPABASE_PUBLISHABLE_KEY is required for read-only search.");
  }

  return {
    endpoint: endpoint.toString().replace(/\/+$/, ""),
    apiKey
  };
}

export async function supabaseRequest(path, init = {}, { write = false } = {}) {
  const config = getSupabaseConfig({ write });
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new Error("Supabase REST path must start with '/'.");
  }

  return fetch(config.endpoint + path, {
    ...init,
    headers: {
      "apikey": config.apiKey,
      "Accept": "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    },
    signal: init.signal ?? AbortSignal.timeout(30_000)
  });
}
