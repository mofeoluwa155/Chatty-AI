import { CORE_CORPUS } from "./training";

export type KnowledgeEntry = {
  id: string;
  title: string;
  aliases: string[];
  keywords: string[];
  explanation: string;
  example?: string;
  reviewStatus?: string;
};

const KNOWLEDGE: KnowledgeEntry[] = CORE_CORPUS.knowledge;
const STOP_WORDS = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "by", "can", "define",
  "definition", "do", "does", "explain", "for", "give", "how", "i", "in",
  "is", "it", "me", "of", "on", "please", "tell", "that", "the", "this",
  "to", "use", "what", "which", "who", "why", "with"
]);

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\\s]/g, " ").replace(/\\s+/g, " ").trim();
}

function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function words(value: string): string[] {
  return normalise(value)
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map(stem);
}

export function findKnowledge(query: string): KnowledgeEntry | null {
  const normalised = normalise(query);
  const queryWords = new Set(words(normalised));
  if (!queryWords.size) return null;

  let best: { entry: KnowledgeEntry; score: number } | null = null;

  for (const entry of KNOWLEDGE) {
    const title = normalise(entry.title);
    const aliases = entry.aliases.map(normalise);
    const titleWords = new Set(words(entry.title));
    const aliasWords = new Set(entry.aliases.flatMap(words));
    const keywordWords = new Set(entry.keywords.flatMap(words));
    let score = 0;

    if (normalised.includes(title) && title.length > 2) score += 12;
    for (const alias of aliases) {
      if (alias.length > 2 && normalised.includes(alias)) score += 10;
    }

    for (const word of queryWords) {
      if (titleWords.has(word)) score += 3.5;
      else if (aliasWords.has(word)) score += 3;
      else if (keywordWords.has(word)) score += 2;
    }

    if (!best || score > best.score) best = { entry, score };
  }

  return best && best.score >= 2 ? best.entry : null;
}

export function listKnowledgeTopics(): string[] {
  return KNOWLEDGE.map((entry) => entry.title);
}

export function knowledgeCount(): number {
  return KNOWLEDGE.length;
}

export function findKnowledgeById(id: string): KnowledgeEntry | null {
  return KNOWLEDGE.find((entry) => entry.id === id) ?? null;
}
