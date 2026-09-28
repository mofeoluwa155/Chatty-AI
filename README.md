# Chatty AI — Production Assistant

> **"Chatty AI: Conversational. Clear. Connected."**  
> *Created by Akintayo Mofeoluwa Richard*

Chatty AI is a modular, high-performance, general-purpose AI assistant application built with Node.js, Express, Groq LLMs (`qwen/qwen3.8-27b`), Firebase Authentication, and Cloud Firestore. It includes live web search, image search, provider-based Pollinations image generation (`black-forest-labs/flux.1-schnell`), multi-format document analysis, Web Speech API voice typing, tabbed settings, prompt-injection defense, and an authenticated issue reporting system.

---

## Key Features

1. **Groq AI Core Chat**: Fast text completions powered by Groq (`qwen/qwen3.8-27b`) with double-checking guidelines and adaptive explanations.
2. **Intelligent Web Search**: Automatic time-sensitivity detection routing queries to Brave Search / SerpAPI with strict prompt-injection defanging and citation grounding.
3. **Image Search**: Visual photo gallery queries powered by Brave Images, SerpApi Google Images, or Unsplash.
4. **AI Image Generation**: Modular provider-based image creation powered by Pollinations (`black-forest-labs/flux.1-schnell` model) with Bearer token authentication, timeout controls, and transient retry handling.
5. **Document Analysis**: Multi-format document parser (PDF, DOCX, TXT, CSV, JSON, MD) with BM25 keyword relevance retrieval and per-user UID isolation.
6. **Voice-to-Text**: Real-time browser speech recognition via Web Speech API writing to the prompt composer for manual submission.
7. **Firebase Auth & Cloud Firestore**: Per-user authenticated session persistence, conversation creation, history loading, renaming, and deletion.
8. **Tabbed Settings**: Modern settings modal with tabs for Appearance, Chat Preferences, AI Personality, Response & Explanation, Voice, Privacy & Security, Account, and Support.
9. **Report an Issue System**: Authenticated issue reporting form auto-attaching user email to prevent impersonation, generating unique Report IDs (`CHAT-YYYYMMDD-XXXXXX`), and delivering email server-side to `chattyai119@gmail.com`.
10. **Security & Guardrails**: Sliding-window rate limiting, prompt injection defanging, model-control token stripping, path traversal validation, and zero client-side secret leakage.

---

## Architecture & System Flow

```
[User Browser / Mobile]
       │
       ▼
[Express Server (server.js)]
       │
       ├── Auth Guard (authMiddleware.js via Firebase Admin JWKS)
       ├── Rate Limiter (securityService.js)
       │
       ├── POST /api/chat ──► [AI Router (aiRouter.js)]
       │                           ├── Document Analysis (documentService.js)
       │                           ├── Image Generation (imageGenerationService.js ──► pollinationsProvider.js)
       │                           ├── Image Search (imageSearchService.js)
       │                           ├── Web Search (searchService.js)
       │                           └── Normal LLM Chat (groqService.js)
       │
       ├── POST /api/documents/upload ──► [Document Service (documentService.js)]
       ├── POST /api/support/report   ──► [Support Service (supportService.js)] ──► chattyai119@gmail.com
       └── GET  /api/health            ──► Health Monitor
```

---

## Project Structure

```
Chatty AI/
├── .env                         # Server environment configuration (git-ignored)
├── .env.example                 # Environment variables reference template
├── .gitignore                   # Excluded paths (.env, node_modules, temp uploads)
├── package.json                 # Core dependencies and scripts
├── package-lock.json
├── server.js                    # Express application server and endpoint routes
├── firestore.rules              # Firebase Cloud Firestore security rules
├── README.md                    # Production documentation
│
├── middleware/
│   └── authMiddleware.js        # Firebase ID Token verification middleware
│
├── services/
│   ├── aiRouter.js              # Central 5-pathway AI dispatcher
│   ├── groqService.js           # Groq LLM inference service & title generator
│   ├── firebaseAdmin.js         # Firebase Admin SDK initializer
│   ├── documentService.js       # Document parser, BM25 chunker, & retrieval
│   ├── securityService.js       # Rate limiting, injection defense, & file safety
│   ├── imageSearchService.js    # Visual image search provider
│   ├── imageGenerationService.js# Generic image generation service facade
│   ├── imageProviders/
│   │   └── pollinationsProvider.js # Pollinations image provider adapter
│   ├── searchService.js         # Web search provider (Brave / SerpAPI)
│   ├── webSearchService.js      # Alias export for searchService
│   ├── supportService.js        # Server email submission & report ID generator
│   ├── emailService.js          # Alias export for supportService
│   ├── productKnowledge.js      # Structured internal product knowledge definition
│   └── productKnowledgeService.js# Alias export for productKnowledge
│
├── assets/
│   ├── logo.png                 # Official 3D glowing robot logo (PNG)
│   └── logo.jpg                 # Official 3D glowing robot logo (JPG)
│
├── test/
│   └── test_suite.js            # Automated Verification & Test Suite
│
├── index.html                   # Main chat application HTML UI
├── signin.html                  # Sign-in page
├── signup.html                  # Sign-up page
├── style.css                    # Main application CSS design system
├── auth.css                     # Authentication pages CSS
├── script.js                    # Frontend core application controller
├── auth.js                      # Frontend Firebase Auth manager
└── firestore-service.js         # Frontend Cloud Firestore CRUD manager
```

---

## Environment Configuration (`.env`)

Copy `.env.example` to `.env` and fill in your keys:

### Required Keys for Core Features

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server listening port | `3000` |
| `GROQ_API_KEY` | Groq Console API Key | `gsk_...` |
| `GROQ_MODEL` | Target Groq model | `qwen/qwen3.8-27b` |
| `FIREBASE_PROJECT_ID` | Firebase Project ID | `chatty-ai-80838` |

### Optional Keys for Advanced Features

| Variable | Feature Enabled | Provider / Console |
|----------|-----------------|--------------------|
| `SEARCH_API_KEY` | Real-time Web Search | [Brave Search API](https://api.search.brave.com/) |
| `SEARCH_PROVIDER` | Web search provider | `brave` or `serpapi` |
| `IMAGE_SEARCH_API_KEY` | Real Image Search | Brave Images / SerpApi / Unsplash |
| `POLLINATIONS_API_KEY` | AI Image Generation | [Pollinations](https://gen.pollinations.ai/) |
| `IMAGE_GEN_MODEL` | Image generation model | `black-forest-labs/flux.1-schnell` |
| `SMTP_HOST` | Live Support Email Delivery | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP Port | `587` |
| `SMTP_USER` | SMTP Username | `your-email@gmail.com` |
| `SMTP_PASS` | SMTP App Password | `your-app-password` |

> **Note:** When optional keys are omitted, Chatty AI gracefully informs the user without crashing or displaying fake data.

---

## Firebase Setup & Firestore Rules

1. Enable **Email/Password Authentication** in the Firebase Console.
2. Deploy the strict per-user UID isolation rules in `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Local Development & Testing

### Installation

```bash
cd "C:\Users\Akintayo Mofeoluwa\Desktop\Chatty AI"
npm install
```

### Start Local Server

```bash
npm start
```
App runs at: `http://localhost:3000`

### Run Automated Verification Test Suite

```bash
node test/test_suite.js
```

---

## Production Deployment

1. Set `NODE_ENV=production` on your hosting provider (Render, Railway, Heroku, GCP, AWS).
2. Set environment variables in your hosting platform dashboard.
3. Configure start command: `npm start` (which runs `node server.js`).
4. Ensure CORS and security headers are active (handled automatically by Express middleware in `server.js`).

---

## License & Branding

**Chatty AI**  
*Created by Akintayo Mofeoluwa Richard*  
Official Slogan: *"Chatty AI: Conversational. Clear. Connected."*
