import { think, type CoreMessage, type CoreMode } from "@/lib/core/engine";
import { distributedSearchConfigured } from "@/lib/core/distributed-knowledge";
import { CORE_CORPUS_STATS } from "@/lib/core/training";

export const runtime = "nodejs";
export const maxDuration = 10;

type RequestBody = {
  messages?: unknown;
  mode?: unknown;
};

type RateEntry = { count: number; resetAt: number };
const rateWindow = new Map<string, RateEntry>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const MODES: CoreMode[] = ["general", "learning", "coding", "maths", "writing"];

function clientKey(request: Request): string {
  return request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const current = rateWindow.get(key);
  if (!current || current.resetAt <= now) {
    rateWindow.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
}

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function validateMessages(value: unknown): CoreMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 30) return null;
  let totalCharacters = 0;
  const result: CoreMessage[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;

    const clean = content.trim();
    if (!clean || clean.length > 12_000) return null;
    totalCharacters += clean.length;
    if (totalCharacters > 40_000) return null;
    result.push({ role, content: clean });
  }

  return result[result.length - 1]?.role === "user" ? result : null;
}

export async function GET(): Promise<Response> {
  return Response.json({
    status: "ready",
    engine: "Chatty Core",
    version: "0.1.0",
    corpus: CORE_CORPUS_STATS,
    distributedKnowledgeSearch: distributedSearchConfigured() ? "configured" : "not_configured",
    capabilities: [
      "arithmetic",
      "square-roots",
      "powers",
      "linear-equations",
      "local-knowledge",
      "distributed-knowledge-search",
      "conversation-intents"
    ],
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Chatty-Engine": "Chatty-Core/0.1.0",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  if (isRateLimited(clientKey(request))) {
    return errorResponse("Too many requests. Please pause briefly and try again.", 429);
  }

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return errorResponse("The request body must be valid JSON.", 400);
  }

  const messages = validateMessages(body.messages);
  if (!messages) {
    return errorResponse("The conversation is invalid or too long. Send up to 30 messages with a maximum of 40,000 characters.", 400);
  }

  const mode = MODES.includes(body.mode as CoreMode) ? body.mode as CoreMode : "general";

  try {
    const reply = await think(messages, mode);
    return Response.json(reply, {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Chatty-Engine": "Chatty-Core/0.1.0",
      },
    });
  } catch (error) {
    console.error("Chatty Core failed:", error instanceof Error ? error.message : "Unknown core error");
    return errorResponse("Chatty Core encountered an internal error while processing that request.", 500);
  }
}
