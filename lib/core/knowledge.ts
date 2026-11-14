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

function words(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 1);
}

export function findKnowledge(query: string): KnowledgeEntry | null {
  const normalised = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const queryWords = new Set(words(normalised));
  let best: { entry: KnowledgeEntry; score: number } | null = null;

  for (const entry of KNOWLEDGE) {
    const title = entry.title.toLowerCase();
    const aliases = entry.aliases.map((alias) => alias.toLowerCase());
    let score = 0;

    if (normalised.includes(title)) score += 8;
    for (const alias of aliases) {
      if (normalised.includes(alias)) score += 7;
    }
    for (const keyword of entry.keywords) {
      if (queryWords.has(keyword)) score += keyword.length > 5 ? 1.5 : 1;
    }

    if (!best || score > best.score) best = { entry, score };
  }

  return best && best.score >= 3 ? best.entry : null;
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
