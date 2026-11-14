import { CORE_CORPUS } from "./training";

export type DialogueResult = {
  answer: string;
  intent: string;
};

type DialogueRecord = {
  id: string;
  intent: string;
  examples: string[];
  response: string;
};

const DIALOGUE: DialogueRecord[] = CORE_CORPUS.dialogue;
const FILLER_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "can", "could", "do", "does", "for",
  "give", "hey", "how", "i", "in", "is", "it", "me", "my", "of", "please",
  "the", "that", "this", "to", "you", "your"
]);

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\\s]/g, " ").replace(/\\s+/g, " ").trim();
}

function meaningfulWords(value: string): Set<string> {
  return new Set(
    normalise(value)
      .split(" ")
      .filter((word) => word.length > 1 && !FILLER_WORDS.has(word))
  );
}

function similarity(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  const precision = shared / right.size;
  const recall = shared / left.size;
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

export function matchDialogue(text: string, previousUserMessage?: string): DialogueResult | null {
  const clean = normalise(text);
  if (!clean || clean.length > 180) return null;

  for (const item of DIALOGUE) {
    for (const example of item.examples) {
      if (clean === normalise(example)) {
        let answer = item.response;
        if (item.intent === "confusion" && previousUserMessage) {
          answer += " You were asking about: " + previousUserMessage + ".";
        }
        return { intent: item.intent, answer };
      }
    }
  }

  const queryWords = meaningfulWords(clean);
  if (queryWords.size < 2) return null;

  let best: { item: DialogueRecord; score: number } | null = null;
  let ambiguous = false;

  for (const item of DIALOGUE) {
    for (const example of item.examples) {
      const exampleWords = meaningfulWords(example);
      if (exampleWords.size < 2) continue;

      const score = similarity(queryWords, exampleWords);
      if (score > (best?.score ?? 0)) {
        best = { item, score };
        ambiguous = false;
      } else if (best && Math.abs(score - best.score) < 0.015 && item.intent !== best.item.intent) {
        ambiguous = true;
      }
    }
  }

  // A high threshold avoids turning a loosely related sentence into a guessed intent.
  if (!best || best.score < 0.84 || ambiguous) return null;

  let answer = best.item.response;
  if (best.item.intent === "confusion" && previousUserMessage) {
    answer += " You were asking about: " + previousUserMessage + ".";
  }
  return { intent: best.item.intent, answer };
}

export function dialogueIntentCount(): number {
  return DIALOGUE.length;
}

export function dialogueExampleCount(): number {
  return DIALOGUE.reduce((total, entry) => total + entry.examples.length, 0);
}
