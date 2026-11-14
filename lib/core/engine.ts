import { findKnowledge, listKnowledgeTopics } from "./knowledge";
import { searchDistributedKnowledge } from "./distributed-knowledge";
import { matchDialogue } from "./dialogue";
import { trySolveMath } from "./math";

export type CoreMode = "general" | "learning" | "coding" | "maths" | "writing";
export type CoreMessage = { role: "user" | "assistant"; content: string };
export type CoreReply = {
  answer: string;
  engine: "Chatty Core";
  version: "0.1.0";
  capability: "conversation" | "mathematics" | "knowledge" | "help" | "unsupported";
};

function cleanQuestion(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function formatKnowledge(
  entry: { title: string; explanation: string; example?: string; source?: string },
  mode: CoreMode
): string {
  const opening = mode === "learning" ? "Let's learn it step by step.\n\n" : "";
  const example = entry.example ? "\n\n**Example:** " + entry.example : "";
  const source = entry.source ? "\n\n**Source:** [Open reference](" + entry.source + ")" : "";
  return opening + "**" + entry.title + "**\n\n" + entry.explanation + example + source;
}

function previousUserQuestion(messages: CoreMessage[]): string | null {
  for (let index = messages.length - 2; index >= 0; index -= 1) {
    if (messages[index].role === "user") return messages[index].content;
  }
  return null;
}

export async function think(
  messages: CoreMessage[],
  mode: CoreMode = "general"
): Promise<CoreReply> {
  const latest = messages[messages.length - 1]?.content?.trim() ?? "";
  const question = cleanQuestion(latest);

  if (!latest) {
    return { answer: "Send me a question or a mathematical problem to work on.", engine: "Chatty Core", version: "0.1.0", capability: "conversation" };
  }

  const previousUserMessage = previousUserQuestion(messages) ?? undefined;
  const dialogue = matchDialogue(latest, previousUserMessage);
  if (dialogue) {
    return { answer: dialogue.answer, engine: "Chatty Core", version: "0.1.0", capability: "conversation" };
  }

  if (/^(who are you|what are you|are you chatty ai|what is chatty ai)$/.test(question)) {
    return {
      answer: "I'm Chatty AI, powered by Chatty Core: a reasoning system written in this project's own TypeScript code. I do not send your questions to OpenAI, Gemini or another hosted language model. My current abilities come from programmed mathematics procedures, rules and searchable knowledge records.",
      engine: "Chatty Core",
      version: "0.1.0",
      capability: "conversation",
    };
  }

  if (/(what can you do|your capabilities|what are your skills|help me use you|how do you work)/.test(question)) {
    return {
      answer: [
        "**What Chatty Core can do now**",
        "• Calculate arithmetic expressions using brackets, decimals, powers and square roots.",
        "• Solve linear equations in x.",
        "• Search its local knowledge base and, when configured, a separately hosted distributed information index.",
        "• Recognise supported conversational requests and use recent messages for simple follow-ups.",
        "",
        "**Current limitation:** it is an early, deterministic system. It does not yet understand every question or learn new facts automatically. The remote index must be connected and populated with sourced records before it can search large datasets.",
      ].join("\n"),
      engine: "Chatty Core",
      version: "0.1.0",
      capability: "help",
    };
  }

  if (/(what do you remember|do you have memory|remember me|your memory)/.test(question)) {
    return {
      answer: "I can use the messages included in the current conversation request as short-term context. Chatty Core does not yet have its own long-term memory store, and it does not permanently learn from a conversation.",
      engine: "Chatty Core",
      version: "0.1.0",
      capability: "conversation",
    };
  }

  if (/^(thanks|thank you|cheers|brilliant|great)[!. ]*$/.test(question)) {
    return { answer: "You're welcome. Send the next question when you're ready.", engine: "Chatty Core", version: "0.1.0", capability: "conversation" };
  }

  const math = trySolveMath(latest);
  if (math) {
    const prefix = mode === "learning" || mode === "maths" ? "I'll show the result and the key working.\n\n" : "";
    return {
      answer: prefix + (math.kind === "equation" ? "**Solution: " : "**Answer: ") + math.answer + "**\n\n" + math.explanation,
      engine: "Chatty Core",
      version: "0.1.0",
      capability: "mathematics",
    };
  }

  const topic = await searchDistributedKnowledge(latest) ?? findKnowledge(latest);
  if (topic) {
    return {
      answer: formatKnowledge(topic, mode),
      engine: "Chatty Core",
      version: "0.1.0",
      capability: "knowledge",
    };
  }

  const followUp = /^(why|how|explain more|tell me more|show another example|what about that|can you explain that)$/.test(question);
  if (followUp) {
    const previous = previousUserQuestion(messages);
    if (previous) {
      const previousTopic = await searchDistributedKnowledge(previous) ?? findKnowledge(previous);
      if (previousTopic) {
        return {
          answer: "**More on " + previousTopic.title + "**\n\n" + previousTopic.explanation
            + (previousTopic.example ? "\n\n**Example:** " + previousTopic.example : "")
            + (previousTopic.source ? "\n\n**Source:** [Open reference](" + previousTopic.source + ")" : "")
            + "\n\nThis is the explanation available in my current knowledge store.",
          engine: "Chatty Core",
          version: "0.1.0",
          capability: "knowledge",
        };
      }
    }
  }

  if (/(list|show|what topics|which topics).*(know|knowledge|cover|explain)/.test(question)) {
    return {
      answer: "My built-in knowledge base currently covers: " + listKnowledgeTopics().join(", ")
        + ". A connected distributed search index can provide additional sourced records.",
      engine: "Chatty Core",
      version: "0.1.0",
      capability: "help",
    };
  }

  return {
    answer: "I don't have a tested reasoning rule or knowledge entry for that question yet. I won't invent an answer. This question can be added to the development test set and matched to a reliable information source.",
    engine: "Chatty Core",
    version: "0.1.0",
    capability: "unsupported",
  };
}
