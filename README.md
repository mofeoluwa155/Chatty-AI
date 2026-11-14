# Chatty AI — Chatty Core

Chatty Core is an independent, code-based reasoning project. It does not send questions to OpenAI, Gemini, or another hosted language-model API.

## Current architecture

```
Browser chat interface
   ├─ Local conversation history
   └─ POST /api/chat
        ├─ Request validation and rate limiting
        └─ Chatty Core
             ├─ Mathematics parser and evaluator
             ├─ Linear equation solver
             ├─ Local knowledge retrieval
             ├─ Conversational intent matching
             └─ Response construction
```

## Current capabilities

- Arithmetic with brackets, decimals, powers, division and square roots.
- Linear equations in one variable, x, including a substitution check in the explanation.
- A small local knowledge corpus covering starter computing, biology, chemistry and science topics.
- Local conversational examples for greetings, identity, thanks, corrections, confusion and related interactions.
- Conversation context from messages submitted with the current request.
- Responses are returned directly by the TypeScript engine; there is no AI Gateway or external model call in the chat route.

## Training corpus

The local data is stored in `data/core-corpus.json`. It contains two kinds of records:

1. **Knowledge entries:** a stable ID, topic, aliases, keywords, explanation, optional example, review status and optional source reference.
2. **Conversation examples:** an intent, example user messages and the response pattern Chatty Core should use.

The corpus loader in `lib/core/training.ts` checks required fields, duplicate IDs, review status and dataset limits. The initial seed currently contains 12 knowledge entries and 10 dialogue intents. The target is up to 1,000 knowledge entries and 1,000 conversational examples.

**Important:** adding curated entries expands Chatty Core's searchable knowledge and conversational coverage. It does not train a neural language model from random weights. To keep the corpus trustworthy, new factual entries should include a reliable source and be reviewed before their status is changed to `reviewed`. Do not fill the dataset with duplicated, guessed or contradictory facts just to reach 1,000.

## Current limitations

Chatty Core is an early deterministic system, not a general-purpose language model. It cannot reliably answer arbitrary open-ended questions, independently write or debug arbitrary software, browse the live internet, understand every paraphrase, or learn permanently from conversations. Unsupported questions should be identified rather than answered with invented facts.

Its conversation history is saved in the current browser using localStorage. This version has no account system, cross-device sync or long-term server-side memory. The in-memory rate limiter is a basic guard and should be replaced with shared storage before a large public launch.

## Run locally

Use Node.js 22 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

No OpenAI, Gemini or Vercel AI Gateway API key is required by Chatty Core.

## Deploy

The working branch for this rebuild is `unified-brain`. Connect the repository `mofeoluwa155/Chatty-AI` to Vercel and deploy that branch using the Next.js framework preset and Node.js 22.

## Development checks

```bash
npm run typecheck
npm run build
```
