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

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function matchDialogue(text: string, previousUserMessage?: string): DialogueResult | null {
  const clean = normalise(text);
  if (!clean || clean.length > 180) return null;

  for (const item of DIALOGUE) {
    for (const example of item.examples) {
      const candidate = normalise(example);
      if (clean === candidate) {
        let answer = item.response;
        if (item.intent === "confusion" && previousUserMessage) {
          answer += " You were asking about: " + previousUserMessage + ".";
        }
        return { intent: item.intent, answer };
      }
    }
  }

  return null;
}

export function dialogueIntentCount(): number {
  return DIALOGUE.length;
}

export function dialogueExampleCount(): number {
  return DIALOGUE.reduce((total, entry) => total + entry.examples.length, 0);
}
