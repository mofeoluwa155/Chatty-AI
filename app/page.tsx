"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Role = "user" | "assistant";
type Mode = "general" | "learning" | "coding" | "maths" | "writing";
type EngineStatus = "checking" | "online" | "offline";
type Message = { id: string; role: Role; content: string };
type Conversation = { id: string; title: string; messages: Message[]; updatedAt: number };

const STORAGE_KEY = "chatty-ai-unified-brain-v2";
const MODE_LABELS: Record<Mode, string> = {
  general: "General",
  learning: "Learning",
  coding: "Coding",
  maths: "Maths",
  writing: "Writing",
};

const SUGGESTIONS = [
  { icon: "∑", title: "Solve a maths problem", prompt: "Calculate 18 × (7 + 3) and show the working." },
  { icon: "✦", title: "Learn a biology topic", prompt: "Explain photosynthesis in simple terms." },
  { icon: "⌘", title: "Explore computing", prompt: "What is the difference between RAM and ROM?" },
  { icon: "◈", title: "Meet Chatty Core", prompt: "Hi Chatty. What can you do?" },
];

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2);
}

function displayDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

function Icon({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("general");
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("checking");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Conversation[];
        if (Array.isArray(parsed)) {
          setConversations(parsed);
          setActiveId(parsed[0]?.id ?? null);
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/chat", { method: "GET", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Core health check failed");
        const data = await response.json() as { status?: string; engine?: string };
        if (data.status === "ready" && data.engine === "Chatty Core") setEngineStatus("online");
        else setEngineStatus("offline");
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === "AbortError")) setEngineStatus("offline");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      setNotice("This browser could not save more chat history. You can still chat in this tab.");
    }
  }, [conversations, hydrated]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeId);
  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, messages[messages.length - 1]?.content, activeId]);

  function startNewChat() {
    if (isLoading) abortRef.current?.abort();
    const id = createId();
    setConversations((current) => [
      { id, title: "New conversation", messages: [], updatedAt: Date.now() },
      ...current,
    ]);
    setActiveId(id);
    setDraft("");
    setNotice("");
    setSidebarOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 60);
  }

  function removeConversation(id: string) {
    const remaining = conversations.filter((conversation) => conversation.id !== id);
    setConversations(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id ?? null);
  }

  function updateAssistantMessage(conversationId: string, messageId: string, content: string) {
    setConversations((current) => current.map((conversation) => {
      if (conversation.id !== conversationId) return conversation;
      return {
        ...conversation,
        updatedAt: Date.now(),
        messages: conversation.messages.map((message) =>
          message.id === messageId ? { ...message, content } : message
        ),
      };
    }));
  }

  async function sendMessage(rawText: string) {
    const text = rawText.trim();
    if (!text || isLoading) return;

    const conversationId = activeId ?? createId();
    const existing = conversations.find((conversation) => conversation.id === conversationId);
    const history = existing?.messages ?? [];
    const userMessage: Message = { id: createId(), role: "user", content: text };
    const assistantMessage: Message = { id: createId(), role: "assistant", content: "" };
    const nextMessages = [...history, userMessage, assistantMessage];
    const requestMessages = [...history, userMessage].slice(-30);

    setActiveId(conversationId);
    setDraft("");
    setNotice("");
    setConversations((current) => {
      const exists = current.some((conversation) => conversation.id === conversationId);
      const updated: Conversation = {
        id: conversationId,
        title: existing?.title === "New conversation" || !existing
          ? text.slice(0, 46) + (text.length > 46 ? "…" : "")
          : existing.title,
        messages: nextMessages,
        updatedAt: Date.now(),
      };
      return exists
        ? [updated, ...current.filter((conversation) => conversation.id !== conversationId)]
        : [updated, ...current];
    });

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: requestMessages.map(({ role, content }) => ({ role, content })),
          mode,
        }),
      });

      if (!response.ok) {
        let message = "The assistant could not complete that request. Please try again.";
        try {
          const data = await response.json() as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // Keep the safe fallback message.
        }
        updateAssistantMessage(conversationId, assistantMessage.id, message);
        return;
      }

      const data = await response.json() as { answer?: string; error?: string };
      const answer = typeof data.answer === "string" ? data.answer : "";
      updateAssistantMessage(
        conversationId,
        assistantMessage.id,
        answer || data.error || "Chatty Core returned an empty response. Please try again.",
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        updateAssistantMessage(conversationId, assistantMessage.id, "Response stopped.");
      } else {
        updateAssistantMessage(conversationId, assistantMessage.id, "A connection error occurred. Check your connection and try again.");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  }

  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setNotice("Clipboard access is not available in this browser.");
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <main className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={"sidebar" + (sidebarOpen ? " sidebar-open" : "")}>
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></div>
          <div className="brand-copy">
            <strong>chatty<span>ai</span></strong>
            <small>CORE BRAIN</small>
          </div>
          <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}>
            <Icon><path d="m6 6 12 12M18 6 6 18" /></Icon>
          </button>
        </div>

        <button className="new-chat-button" onClick={startNewChat}>
          <Icon><path d="M12 5v14M5 12h14" /></Icon>
          <span>New conversation</span>
          <kbd>⌘ K</kbd>
        </button>

        <div className="sidebar-section">
          <div className="section-label">YOUR SPACE</div>
          <button className="nav-row active" onClick={() => setActiveId(conversations[0]?.id ?? null)}>
            <Icon><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8 9h8M8 13h5" /></Icon>
            <span>All conversations</span>
          </button>
        </div>

        <div className="history-heading">
          <span>RECENT</span>
          <span className="history-count">{conversations.length || ""}</span>
        </div>
        <div className="history-list">
          {conversations.filter((conversation) => conversation.messages.length > 0).slice(0, 25).map((conversation) => (
            <div className={"history-item" + (conversation.id === activeId ? " selected" : "")} key={conversation.id}>
              <button className="history-select" onClick={() => { setActiveId(conversation.id); setSidebarOpen(false); }}>
                <span className="history-dot" />
                <span className="history-title">{conversation.title}</span>
                <span className="history-date">{displayDate(conversation.updatedAt)}</span>
              </button>
              <button className="history-delete" aria-label={"Delete " + conversation.title} onClick={() => removeConversation(conversation.id)}>
                <Icon size={15}><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6" /></Icon>
              </button>
            </div>
          ))}
          {conversations.every((conversation) => conversation.messages.length === 0) && (
            <p className="empty-history">Your conversations will appear here.</p>
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="local-card">
            <div className="local-icon"><Icon size={17}><path d="M12 3 5 6v5c0 4.5 3 8.1 7 10 4-1.9 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></Icon></div>
            <div>
              <strong>Private by design</strong>
              <small>Chat history stays in this browser.</small>
            </div>
          </div>
          <div className="profile-row">
            <div className="profile-avatar">C</div>
            <div className="profile-copy"><strong>Chatty AI</strong><small>Personal assistant</small></div>
            <span className="online-indicator" title="Interface ready" />
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
              <Icon><path d="M4 6h16M4 12h16M4 18h16" /></Icon>
            </button>
            <div className="breadcrumb">
              <span>Workspace</span><span className="crumb-divider">/</span><strong>{hasMessages ? activeConversation?.title ?? "Conversation" : "New conversation"}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <div className="model-control" role="status" aria-live="polite">
              <span className={"model-orb " + engineStatus} />
              <span>CHATTY CORE</span>
              <small className="engine-state">{engineStatus === "online" ? "ONLINE" : engineStatus === "offline" ? "OFFLINE" : "CHECKING"}</small>
            </div>
            <div className="topbar-divider" />
            <button className="new-chat-top" onClick={startNewChat}>
              <Icon size={16}><path d="M12 5v14M5 12h14" /></Icon>
              <span>New chat</span>
            </button>
          </div>
        </header>

        <div className="conversation-wrap">
          {!hasMessages ? (
            <div className="welcome-screen">
              <div className="welcome-eyebrow"><span className="eyebrow-line" /> YOUR INDEPENDENT AI ASSISTANT <span className="eyebrow-line" /></div>
              <div className="welcome-mark">
                <div className="welcome-glow" />
                <div className="welcome-logo"><span /><span /><span /><span /></div>
              </div>
              <h1>What can I help<br /><em>you with today?</em></h1>
              <p className="welcome-subtitle">Ask a question, work through a problem, or explore a subject. Chatty Core uses its own programmed reasoning and searchable knowledge.</p>

              <div className="suggestion-grid">
                {SUGGESTIONS.map((suggestion) => (
                  <button className="suggestion-card" key={suggestion.title} onClick={() => void sendMessage(suggestion.prompt)}>
                    <span className="suggestion-icon">{suggestion.icon}</span>
                    <span className="suggestion-title">{suggestion.title}</span>
                    <span className="suggestion-arrow">↗</span>
                  </button>
                ))}
              </div>
              <div className="welcome-caption"><span className={"status-pulse " + engineStatus} /> {engineStatus === "online" ? "CORE ENGINE ONLINE" : engineStatus === "offline" ? "CORE ENGINE UNAVAILABLE" : "CONNECTING TO CORE ENGINE"}</div>
            </div>
          ) : (
            <div className="message-list">
              <div className="conversation-heading">
                <span className="conversation-tag">CONVERSATION</span>
                <span className="conversation-date">{activeConversation ? new Date(activeConversation.updatedAt).toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" }) : ""}</span>
              </div>
              {messages.map((message, index) => (
                <article className={"message-row " + message.role} key={message.id}>
                  <div className={"message-avatar " + message.role}>
                    {message.role === "assistant" ? <div className="mini-mark"><span /><span /><span /><span /></div> : "U"}
                  </div>
                  <div className="message-body">
                    <div className="message-meta">
                      <strong>{message.role === "assistant" ? "Chatty AI" : "You"}</strong>
                    </div>
                    {message.role === "assistant" ? (
                      message.content ? (
                        <div className="markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="thinking-indicator"><span /><span /><span /><small>Thinking through it</small></div>
                      )
                    ) : (
                      <div className="user-content">{message.content}</div>
                    )}
                    {message.role === "assistant" && message.content && (
                      <div className="message-actions">
                        <button onClick={() => void copyMessage(message)} aria-label="Copy response">
                          <Icon size={14}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></Icon>
                          {copiedId === message.id ? "Copied" : "Copy"}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="composer-area">
          {notice && <div className="notice-line">{notice}</div>}
          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Chatty AI…"
              rows={1}
              maxLength={12000}
              aria-label="Write a message"
              disabled={!hydrated}
            />
            <div className="composer-toolbar">
              <div className="composer-tools">
                <label className="mode-select">
                  <Icon size={15}><path d="M4 5h16M4 12h10M4 19h7" /></Icon>
                  <select aria-label="Conversation mode" value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
                    {Object.entries(MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label} mode</option>)}
                  </select>
                  <Icon size={13}><path d="m7 10 5 5 5-5" /></Icon>
                </label>
              </div>
              <div className="composer-submit-wrap">
                <span className="enter-hint">↵ to send</span>
                {isLoading ? (
                  <button className="send-button stop-button" type="button" onClick={() => abortRef.current?.abort()} aria-label="Stop generating">
                    <Icon size={17}><rect x="6" y="6" width="12" height="12" rx="2" /></Icon>
                  </button>
                ) : (
                  <button className="send-button" type="submit" disabled={!draft.trim() || !hydrated} aria-label="Send message">
                    <Icon size={18}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>
                  </button>
                )}
              </div>
            </div>
          </form>
          <div className="composer-disclaimer">
            <span>Chatty AI can make mistakes. Verify important information.</span>
            <span>Independent code · no hosted language model API</span>
          </div>
        </div>
      </section>
    </main>
  );
}
