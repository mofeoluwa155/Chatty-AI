import { findKnowledge, listKnowledgeTopics } from "./knowledge";
import { trySolveMath } from "./math";

export type CoreMode = "general" | "learning" | "coding" | "maths" | "writing";
export type CoreMessage = { role: "user" | "assistant"; content: string };
export type CoreReply = {
  answer: string;
  engine: "Chatty Core";
  version: "0.1.0";
  capability: "conversation" | "mathematics" | "knowledge" | "help" | "unsupported";
};

function isGreeting(value: string): boolean {
  return /^(hi|hello|hey|good morning|good afternoon|good evening|hiya|howdy)[!. ]*$/i.test(value.trim());
}

function cleanQuestion(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function formatKnowledge(entry: { title: string; explanation: string; example?: string }, mode: CoreMode): string {
  const opening = mode === "learning"
    ? "Let's learn it step by step.\n\n"
    : "";
  return opening + "**" + entry.title + "**\n\n" + entry.explanation
    + (entry.example ? "\n\n**Example:** " + entry.example : "");
}

function previousUserQuestion(messages: CoreMessage[]): string | null {
  for (let index = messages.length - 2; index >= 0; index -= 1) {
    if (messages[index].role === "user") return messages[index].content;
  }
  return null;
}

export function think(messages: CoreMessage[], mode: CoreMode = "general"): CoreReply {
  const latest = messages[messages.length - 1]?.content?.trim() ?? "";
  const question = cleanQuestion(latest);

  if (!latest) {
    return { answer: "Send me a question or a mathematical problem to work on.", engine: "Chatty Core", version: "0.1.0", capability: "conversation" };
  }

  if (isGreeting(latest)) {
    const name = latest.toLowerCase().includes("morning") ? "Good morning!" : "Hello!";
    return { answer: name + " I'm Chatty AI, running on Chatty Core. I can currently calculate expressions, solve linear equations in x, and explain topics from my built-in knowledge base.", engine: "Chatty Core", version: "0.1.0", capability: "conversation" };
  }

  if (/^(who are you|what are you|are you chatty ai|what is chatty ai)$/.test(question)) {
    return {
      answer: "I'm Chatty AI, powered by Chatty Core: a reasoning system written in this project's own TypeScript code. I do not send your questions to OpenAI, Gemini or another hosted language model. My current abilities come from programmed mathematics procedures, rules and a small local knowledge base.",
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
        "• Solve linear equations in x, including equations such as 2x + 3 = 7.",
        "• Explain a starter set of science, computing and school topics from its local knowledge base.",
        "• Use the conversation history sent with each request to understand simple follow-ups.",
        "",
        "**Current limitation:** this is an early, deterministic engine. It does not yet understand or answer every open-ended question, write or debug arbitrary code, or learn new facts automatically.",
        "",
        "To expand its knowledge, we need to add and test new reasoning modules and verified information sources.",
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

  const topic = findKnowledge(latest);
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
      const previousTopic = findKnowledge(previous);
      if (previousTopic) {
        return {
          answer: "**More on " + previousTopic.title + "**\n\n" + previousTopic.explanation + (previousTopic.example ? "\n\n**Example:** " + previousTopic.example : "") + "\n\nThis is the explanation available in my current local knowledge base.",
          engine: "Chatty Core",
          version: "0.1.0",
          capability: "knowledge",
        };
      }
    }
  }

  if (/(list|show|what topics|which topics).*(know|knowledge|cover|explain)/.test(question)) {
    return {
      answer: "My local knowledge base currently covers: " + listKnowledgeTopics().join(", ") + ". This list will grow as more tested knowledge modules are added.",
      engine: "Chatty Core",
      version: "0.1.0",
      capability: "help",
    };
  }

  return {
    answer: "I don't have a tested reasoning rule or knowledge entry for that question yet. I won't invent an answer. Chatty Core is currently strongest at arithmetic, linear equations in x, and the topics in its local knowledge base. This question is a useful candidate for a new module.",
    engine: "Chatty Core",
    version: "0.1.0",
    capability: "unsupported",
  };
}
