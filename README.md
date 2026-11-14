# Chatty AI — Unified Brain

A general-purpose conversational AI application with a responsive chat interface and a model-orchestration layer for OpenAI and Google Gemini.

**Product direction:** conversational, curious, clear, practical, and capable across everyday questions, learning, maths, coding, and writing.

## What is included

- **Two model pathways:** OpenAI GPT-6.1 Terra and Google Gemini 4 Argon, routed through Vercel AI Gateway.
- **Fusion mode:** runs independent drafts through both models concurrently, then asks the synthesis model to produce one coherent answer. This mode makes up to three model calls per turn and can cost and take more than a single-model response.
- **Conversation modes:** General, Learning, Coding, Maths, and Writing. Each adjusts the assistant's instructions without changing the selected model.
- **Streaming responses:** answers appear as they are generated.
- **Conversation history:** saved in the current browser using localStorage. History is not synced across devices and is not stored in a server database in this version.
- **Responsive interface:** sidebar, conversation list, model selector, mode selector, prompt suggestions, Markdown, code blocks, and mobile layout.
- **Basic server safeguards:** input validation, model allow-list, request limits, bounded conversation context, and a lightweight in-memory rate limiter.

## Architecture

```
Browser
  ├─ Responsive Next.js chat interface
  ├─ Local conversation history (localStorage)
  └─ POST /api/chat
         ├─ Validate role, message size, model and mode
         ├─ Build mode-specific assistant instructions
         ├─ Single model: stream selected Gateway model
         └─ Fusion: GPT + Gemini drafts → GPT synthesis stream
                    │
                    ▼
              Vercel AI Gateway
                    ├─ OpenAI GPT-6.1 Terra
                    └─ Google Gemini 4 Argon
```

## Run locally

Use Node.js 22 or later.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from the example:

   ```bash
   cp .env.example .env.local
   ```

3. Add a Vercel AI Gateway API key to `.env.local`:

   ```dotenv
   AI_GATEWAY_API_KEY=your_key_here
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

Open http://localhost:3000.

## Deploy to Vercel

1. Import the GitHub repository `mofeoluwa155/Chatty-AI` into Vercel.
2. Set the project root to the repository root.
3. Ensure the project's Git production branch is `unified-brain` before promoting it to production. The existing `main` branch is deliberately left unchanged.
4. Enable Vercel OIDC for the project or add `AI_GATEWAY_API_KEY` as a sensitive environment variable. On Vercel, AI Gateway can authenticate using the automatically supplied `VERCEL_OIDC_TOKEN`; local development uses `AI_GATEWAY_API_KEY`.
5. Deploy with the Next.js framework preset and Node.js 22.

The Git branch used for this rebuild is `unified-brain`. The prior `main` branch and its current application are preserved.

## Model and usage notes

- Single-model mode makes one model request for each answer.
- Fusion mode makes two draft requests (one GPT, one Gemini) and a final GPT synthesis request. If one draft provider fails, synthesis can continue with the available draft.
- Model usage is metered by the configured AI Gateway/provider account. Check the Vercel AI Gateway usage page and provider pricing before sustained use. Fusion may use materially more tokens than single-model mode.
- This project does not claim to be a foundation model trained from scratch. Its original work is the assistant orchestration, prompting, UI, safeguards, and product experience; the language-model intelligence is provided by the selected underlying models.
- The assistant does not have live web-search tools in this version and must not present unverified current facts as live research.

## Security and limitations

- Never commit `.env.local`, API keys, credentials, or service-account files.
- The browser stores conversation text locally. Anyone with access to the same browser profile may be able to access that local history.
- The in-memory rate limiter is a basic per-process guard, not a distributed production rate limiter. A shared store and authenticated accounts should be added before opening the service to heavy public traffic.
- There is no server-side account system, shared multi-device history, file upload, or web-search connector in this initial release.
- Review model outputs before relying on them for important decisions.

## Development checks

```bash
npm run typecheck
npm run build
```

## Branding

**Chatty AI — Conversational. Clear. Connected.**
