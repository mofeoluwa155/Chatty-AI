import rawCorpus from "@/data/core-corpus.json";

export type KnowledgeRecord = {
  id: string;
  title: string;
  aliases: string[];
  keywords: string[];
  explanation: string;
  example?: string;
  reviewStatus: "starter" | "reviewed";
  source?: string;
};

export type DialogueRecord = {
  id: string;
  intent: string;
  examples: string[];
  response: string;
};

export type TrainingCorpus = {
  version: string;
  status: "starter" | "reviewed";
  knowledge: KnowledgeRecord[];
  dialogue: DialogueRecord[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Chatty Core corpus validation failed: " + field + " must be a non-empty string.");
  }
  return value;
}

function requireTextArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("Chatty Core corpus validation failed: " + field + " must be a non-empty list of text values.");
  }
  return value as string[];
}

function parseCorpus(value: unknown): TrainingCorpus {
  if (!isRecord(value)) throw new Error("Chatty Core corpus must be an object.");

  const version = requireText(value.version, "version");
  if (!Array.isArray(value.knowledge) || !Array.isArray(value.dialogue)) {
    throw new Error("Chatty Core corpus must contain knowledge and dialogue arrays.");
  }

  if (value.knowledge.length > 1000) {
    throw new Error("Chatty Core supports up to 1,000 knowledge entries in this corpus version.");
  }
  const conversationExamples = value.dialogue.reduce((total, record) => {
    if (!isRecord(record) || !Array.isArray(record.examples)) {
      throw new Error("Every dialogue record must contain an examples array.");
    }
    return total + record.examples.length;
  }, 0);
  if (conversationExamples > 1000) {
    throw new Error("Chatty Core supports up to 1,000 conversation examples in this corpus version.");
  }

  const ids = new Set<string>();
  const knowledge = value.knowledge.map((record, index): KnowledgeRecord => {
    if (!isRecord(record)) throw new Error("Knowledge entry " + index + " must be an object.");
    const id = requireText(record.id, "knowledge[" + index + "].id");
    if (ids.has(id)) throw new Error("Duplicate corpus record ID: " + id);
    ids.add(id);

    const reviewStatus = record.reviewStatus;
    if (reviewStatus !== "starter" && reviewStatus !== "reviewed") {
      throw new Error("Knowledge entry " + id + " must have reviewStatus starter or reviewed.");
    }
    const source = typeof record.source === "string" && record.source.trim() ? record.source : undefined;
    if (reviewStatus === "reviewed" && !source) {
      throw new Error("Reviewed knowledge entry " + id + " must include a source reference.");
    }

    return {
      id,
      title: requireText(record.title, id + ".title"),
      aliases: Array.isArray(record.aliases) ? requireTextArray(record.aliases, id + ".aliases") : [],
      keywords: requireTextArray(record.keywords, id + ".keywords"),
      explanation: requireText(record.explanation, id + ".explanation"),
      ...(typeof record.example === "string" ? { example: record.example } : {}),
      reviewStatus,
      ...(source ? { source } : {}),
    };
  });

  const dialogue = value.dialogue.map((record, index): DialogueRecord => {
    if (!isRecord(record)) throw new Error("Dialogue entry " + index + " must be an object.");
    const id = requireText(record.id, "dialogue[" + index + "].id");
    if (ids.has(id)) throw new Error("Duplicate corpus record ID: " + id);
    ids.add(id);
    return {
      id,
      intent: requireText(record.intent, id + ".intent"),
      examples: requireTextArray(record.examples, id + ".examples"),
      response: requireText(record.response, id + ".response"),
    };
  });

  return {
    version,
    status: value.status === "reviewed" ? "reviewed" : "starter",
    knowledge,
    dialogue,
  };
}

export const CORE_CORPUS = parseCorpus(rawCorpus);

export const CORE_CORPUS_STATS = {
  version: CORE_CORPUS.version,
  knowledgeEntries: CORE_CORPUS.knowledge.length,
  dialogueIntents: CORE_CORPUS.dialogue.length,
  conversationExamples: CORE_CORPUS.dialogue.reduce((total, item) => total + item.examples.length, 0),
  reviewedKnowledgeEntries: CORE_CORPUS.knowledge.filter((item) => item.reviewStatus === "reviewed").length,
  targetKnowledgeEntries: 1000,
  targetConversationExamples: 1000,
};
