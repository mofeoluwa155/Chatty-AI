/**
 * Chatty AI — Internal Product Knowledge Definition
 * Created by Akintayo Mofeoluwa Richard
 *
 * Provides a structured, authoritative definition of the Chatty AI application,
 * its interface components, navigation paths, supported features, settings,
 * security guardrails, and support systems.
 */

const PRODUCT_KNOWLEDGE = {
    application: {
        name: "Chatty AI",
        version: "1.0.0",
        creator: "Akintayo Mofeoluwa Richard",
        officialLogo: "3D Glowing Cyan and Blue Robot Character (assets/logo.png)",
        purpose: "A modular, intelligent, conversational general-purpose AI assistant.",
        officialSlogan: "Chatty AI: Conversational. Clear. Connected.",
        taglines: [
            "The AI that speaks your language.",
            "More than data. Real dialogue.",
            "Chatty AI: Where conversations come alive.",
            "Your digital sounding board."
        ],
        corePrinciples: [
            "Be useful without pretending.",
            "Mistakes can happen, so double-check."
        ]
    },

    mainInterface: {
        sidebar: {
            location: "Left side of the screen (collapsible on mobile devices).",
            newChatButton: "Top button in sidebar ('New Chat' or Ctrl+N) to start a fresh conversation.",
            searchBar: "Search input box in sidebar to filter and search past conversations.",
            conversationHistory: "Scrollable list of previous chats loaded dynamically from Cloud Firestore.",
            conversationActions: "Hover or click actions on each chat item to rename or delete conversations.",
            profileMenu: "Located at the bottom of the sidebar displaying user avatar, name, and email. Clicking opens the profile dropdown with Settings, Theme toggle, Report an Issue, and Sign Out."
        },
        workspaceHeader: {
            modelBadge: "Top bar showing 'Chatty AI' and current active provider/model badge ('Groq AI').",
            settingsButton: "Gear icon in the top-right header to quickly open the Settings modal.",
            clearChatButton: "Trash icon in top header to clear current chat messages from the view."
        },
        chatContainer: {
            welcomeScreen: "Clean welcome screen displayed when no messages exist, with official robot logo, personalized time-based greeting ('Good morning/afternoon/evening, [Name]'), and starter prompt cards.",
            messagesStream: "Scrollable conversation stream displaying user messages and formatted AI responses with markdown rendering, syntax-highlighted code blocks, copy buttons, and source accordions."
        },
        messageComposer: {
            inputBox: "Auto-expanding textarea at the bottom for typing messages (Enter to send, Shift+Enter for new lines).",
            documentUploadButton: "Paperclip / document icon on the left of composer to attach PDF, DOCX, TXT, CSV, JSON, MD, PNG, JPG, or WEBP files up to 10MB.",
            voiceToTextButton: "Microphone icon in the composer to record speech via browser Web Speech API. Speech is converted to text directly in the input box for manual editing before sending.",
            sendButton: "Send arrow icon to submit the current message."
        }
    },

    settings: {
        location: "Accessible via the gear icon in the top header, or via the user profile menu at the bottom of the sidebar, or by clicking 'Settings'.",
        tabs: {
            appearance: "Customize theme (Dark / Neon Navy, Light, OLED Black).",
            chatPreferences: "Configure Enter key behavior (Enter to send vs. new line), auto-scroll preferences.",
            aiPersonality: "Choose communication tone: Informative (Clear & Structured), Casual, Professional, Playful, Creative, Direct, Encouraging, Calm. Also includes Custom Instructions textarea.",
            responseAndExplanation: "Set explanation detail level (Balanced, Concise, Detailed / Step-by-Step) and toggle Reasoning Snapshot.",
            voice: "Configure voice typing preferences, recognition language, and microphone permissions.",
            privacyAndSecurity: "Inspect authentication status, data isolation policies, rate limiting, and zero third-party token exposure.",
            account: "View authenticated Firebase email, display name, account status, and sign out.",
            supportAndIssueReporting: "Dedicated 'Report an Issue' / 'Ask a Problem' system to report bugs, broken features, UI problems, login issues, search problems, document problems, image problems, voice-to-text problems, or performance issues. Submits directly to the server which emails chattyai119@gmail.com."
        }
    },

    aiFeatures: {
        normalChat: "High-speed text generation powered by Groq (Qwen 3.8 27B) adhering strictly to double-checking facts, math, and code.",
        webSearch: "Intelligent query classification for real-time information (news, weather, events) using Brave Search / SerpAPI with strict prompt-injection defanging and grounded citations.",
        imageSearch: "Detects image search requests (e.g. 'show me pictures of...') using Brave Images, SerpApi Google Images, or Unsplash, returning visual photo cards.",
        imageGeneration: "Creates high-quality images via Pollinations AI (black-forest-labs/flux.1-schnell) with responsive prompt enhancement.",
        documentAnalysis: "Multi-format document parsing (PDF, DOCX, TXT, CSV, JSON, MD) with BM25 chunk retrieval and grounded citations.",
        conversationMemory: "Preserves conversation history within each active session and persists conversations per-user in Cloud Firestore.",
        reasoningSnapshot: "Optional one-line logical summary explaining the approach taken for complex queries."
    },

    supportAndReporting: {
        howToReport: "Open Settings (gear icon in header or profile menu at bottom of sidebar) → Select 'Report an Issue' (or click 'Report an Issue' in the profile menu) → Fill in Subject and Problem description → Submit. The authenticated email is automatically attached.",
        reportDestination: "chattyai119@gmail.com",
        reportIdFormat: "CHAT-YYYYMMDD-XXXXXX (e.g., CHAT-20260928-AB12CD)",
        categories: [
            "Bug / Broken Feature",
            "UI / Display Problem",
            "Login / Authentication Issue",
            "Web Search Problem",
            "Document Analysis Problem",
            "Image Generation / Search Problem",
            "Voice-to-Text Problem",
            "Performance / Latency Issue",
            "Other Question / Feedback"
        ]
    }
};

/**
 * Returns a concise, formatted markdown summary of product knowledge for inclusion in the AI system persona.
 */
function getProductKnowledgePrompt() {
    return `
CHATTY AI INTERFACE & PRODUCT KNOWLEDGE:
- You know your own interface and capabilities precisely. Never hallucinate nonexistent buttons or settings.
- Location of Settings: Gear icon in top-right header, or Profile Menu at the bottom of the sidebar.
- How to Report an Issue / Ask a Problem: Direct the user to Settings -> Support -> "Report an Issue" (or via the profile menu). Explain that the issue is submitted directly to the support team with a unique Report ID.
- How to change AI Personality: Direct the user to Settings -> AI Personality tab.
- How to use Voice-to-Text: Direct the user to the microphone icon in the message composer at the bottom.
- How to find past chats: Direct the user to the left sidebar conversation history or use the search bar in the sidebar.
- How to analyze documents: Direct the user to click the paperclip / document attachment button in the composer (supports PDF, DOCX, TXT, CSV, JSON, MD up to 10MB).
- Web Search capability: Explain that you automatically search the web for current facts, news, and real-time data when appropriate.
- Image Generation capability: Explain that you can generate high-quality AI images upon request.
- Privacy & Secrets: Never attempt to reveal backend API keys, database secrets, or private server tokens.
`;
}

module.exports = {
    PRODUCT_KNOWLEDGE,
    getProductKnowledgePrompt
};
