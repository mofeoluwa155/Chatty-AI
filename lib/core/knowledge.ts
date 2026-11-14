import { CORE_CORPUS } from "./training";

export type KnowledgeEntry = {
  id: string;
  title: string;
  aliases: string[];
  keywords: string[];
  explanation: string;
  example?: string;
  reviewStatus?: string;
  source?: string;
  domain?: string;
  tags?: string[];
  language?: string;
};

const KNOWLEDGE: KnowledgeEntry[] = CORE_CORPUS.knowledge;
const STOP_WORDS = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "by", "can", "define",
  "definition", "do", "does", "explain", "for", "give", "how", "i", "in",
  "is", "it", "me", "of", "on", "please", "tell", "that", "the", "this",
  "to", "use", "what", "which", "who", "why", "with", "would"
]);

function normalise(value: string): string {
  return value.normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function words(value: string): string[] {
  return normalise(value).split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map(stem);
}

type Posting = { entryIndex: number; weight: number };
const postings = new Map<string, Posting[]>();
const documentFrequency = new Map<string, number>();
const entryTokens: Set<string>[] = [];

function addField(entryIndex: number, value: string, weight: number): void {
  for (const token of new Set(words(value))) {
    const list = postings.get(token) ?? [];
    const existing = list.find((posting) => posting.entryIndex === entryIndex);
    if (existing) existing.weight = Math.max(existing.weight, weight);
    else list.push({ entryIndex, weight });
    postings.set(token, list);
  }
}

KNOWLEDGE.forEach((entry, entryIndex) => {
  entryTokens[entryIndex] = new Set([
    ...words(entry.title),
    ...entry.aliases.flatMap(words),
    ...entry.keywords.flatMap(words)
  ]);
  addField(entryIndex, entry.title, 8);
  for (const alias of entry.aliases) addField(entryIndex, alias, 6);
  for (const keyword of entry.keywords) addField(entryIndex, keyword, 3);
});

for (const [token, list] of postings) documentFrequency.set(token, list.length);

function inverseDocumentFrequency(token: string): number {
  const total = Math.max(KNOWLEDGE.length, 1);
  const frequency = documentFrequency.get(token) ?? 0;
  return Math.log(1 + (total - frequency + 0.5) / (frequency + 0.5));
}

export function normaliseKnowledgeQuery(value: string): string {
  return normalise(value);
}

export function findKnowledge(query: string): KnowledgeEntry | null {
  const normalised = normalise(query);
  const queryTokens = [...new Set(words(normalised))];
  if (!queryTokens.length) return null;

  const scores = new Map<number, number>();
  let availableQueryWeight = 0;

  for (const token of queryTokens) {
    const idf = inverseDocumentFrequency(token);
    availableQueryWeight += idf;
    for (const posting of postings.get(token) ?? []) {
      scores.set(posting.entryIndex, (scores.get(posting.entryIndex) ?? 0) + posting.weight * idf);
    }
  }

  let bestIndex = -1;
  let bestScore = 0;
  let secondScore = 0;
  let exactMatch = false;

  for (const [entryIndex, rawScore] of scores) {
    const entry = KNOWLEDGE[entryIndex];
    const title = normalise(entry.title);
    const aliasMatch = entry.aliases.some((alias) => {
      const value = normalise(alias);
      return value.length > 2 && normalised.includes(value);
    });
    const titleMatch = title.length > 2 && normalised.includes(title);
    const phraseBonus = titleMatch ? 24 : aliasMatch ? 18 : 0;
    const matchedQueryWeight = queryTokens
      .filter((token) => entryTokens[entryIndex].has(token))
      .reduce((total, token) => total + inverseDocumentFrequency(token), 0);
    const coverage = availableQueryWeight > 0 ? matchedQueryWeight / availableQueryWeight : 0;
    const score = rawScore * (0.5 + coverage * 0.5) + phraseBonus;

    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestIndex = entryIndex;
      exactMatch = titleMatch || aliasMatch;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  if (bestIndex < 0) return null;
  const confidence = availableQueryWeight > 0
    ? bestScore / (bestScore + availableQueryWeight * 8)
    : 0;
  const margin = bestScore - secondScore;
  if (!exactMatch && (confidence < 0.24 || (secondScore > 0 && margin < bestScore * 0.12))) {
    return null;
  }
  return KNOWLEDGE[bestIndex];
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
