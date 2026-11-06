/**
 * lib/chat-store.ts
 *
 * localStorage-backed chat session store.
 * ChatGPT-style: named sessions, pins, timestamps, search, auto-title.
 */
"use client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  intent?: string;
  chunksUsed?: number;
  modelUsed?: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface Citation {
  title: string;
  section: string;
  page: number;
  sourceId: string;
  sourceType: string;
  excerpt?: string;
  confidence?: string;
  source_id?: string;
  source_type?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  language: string;
}

const STORAGE_KEY = "dgms-chat-sessions";
const ACTIVE_KEY = "dgms-active-session";
const MAX_SESSIONS = 50;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function autoTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New Chat";
  const text = firstUser.content.trim();
  return text.length > 42 ? text.slice(0, 42) + "…" : text;
}

function loadAll(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatSession[];
  } catch {
    return [];
  }
}

function saveAll(sessions: ChatSession[]): void {
  try {
    // Keep only the last MAX_SESSIONS
    const trimmed = sessions.slice(0, MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full — silently fail
  }
}

export const ChatStore = {
  listSessions(): ChatSession[] {
    return loadAll().sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  },

  createSession(language = "hi"): ChatSession {
    const session: ChatSession = {
      id: generateId(),
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
      language,
    };
    const all = loadAll();
    all.unshift(session);
    saveAll(all);
    localStorage.setItem(ACTIVE_KEY, session.id);
    return session;
  },

  loadSession(id: string): ChatSession | null {
    return loadAll().find((s) => s.id === id) ?? null;
  },

  saveSession(session: ChatSession): void {
    const all = loadAll();
    const idx = all.findIndex((s) => s.id === session.id);
    const updated = { ...session, updatedAt: Date.now() };
    if (session.messages.length > 0) {
      updated.title = autoTitle(session.messages);
    }
    if (idx >= 0) {
      all[idx] = updated;
    } else {
      all.unshift(updated);
    }
    saveAll(all);
  },

  deleteSession(id: string): void {
    const all = loadAll().filter((s) => s.id !== id);
    saveAll(all);
    if (localStorage.getItem(ACTIVE_KEY) === id) {
      localStorage.removeItem(ACTIVE_KEY);
    }
  },

  renameSession(id: string, title: string): void {
    const all = loadAll();
    const idx = all.findIndex((s) => s.id === id);
    if (idx >= 0) {
      all[idx].title = title.trim() || "Untitled";
      saveAll(all);
    }
  },

  pinSession(id: string, pinned: boolean): void {
    const all = loadAll();
    const idx = all.findIndex((s) => s.id === id);
    if (idx >= 0) {
      all[idx].pinned = pinned;
      saveAll(all);
    }
  },

  searchSessions(query: string): ChatSession[] {
    const q = query.toLowerCase().trim();
    if (!q) return ChatStore.listSessions();
    return loadAll().filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  },

  getActiveSessionId(): string | null {
    return localStorage.getItem(ACTIVE_KEY);
  },

  setActiveSessionId(id: string): void {
    localStorage.setItem(ACTIVE_KEY, id);
  },

  addMessage(sessionId: string, message: Omit<ChatMessage, "id" | "timestamp">): ChatMessage {
    const msg: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: Date.now(),
    };
    const all = loadAll();
    const idx = all.findIndex((s) => s.id === sessionId);
    if (idx >= 0) {
      all[idx].messages.push(msg);
      all[idx].updatedAt = Date.now();
      if (all[idx].messages.length === 1 && msg.role === "user") {
        all[idx].title = autoTitle(all[idx].messages);
      }
      saveAll(all);
    }
    return msg;
  },

  updateLastMessage(sessionId: string, updates: Partial<ChatMessage>): void {
    const all = loadAll();
    const idx = all.findIndex((s) => s.id === sessionId);
    if (idx >= 0 && all[idx].messages.length > 0) {
      const lastIdx = all[idx].messages.length - 1;
      all[idx].messages[lastIdx] = { ...all[idx].messages[lastIdx], ...updates };
      saveAll(all);
    }
  },

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  },
};
