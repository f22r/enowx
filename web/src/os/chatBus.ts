import { useEffect, useState } from "react";
import { chatApi, type ChatMessage } from "../lib/api";

// chatBus is the shared community-chat store: it loads history, holds the live
// message list, and keeps a single SSE connection (/api/chat/stream) open so new
// messages arrive in realtime. Module-level so every Chat view shares one feed.
let messages: ChatMessage[] = [];
let loaded = false;
let loading = false;
let es: EventSource | null = null;
let connected = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

async function loadHistory() {
  if (loaded || loading) return;
  loading = true;
  try {
    const r = await chatApi.list();
    // Server returns newest-first; show oldest-first.
    messages = (r.messages ?? []).slice().reverse();
    loaded = true;
  } catch {
    /* leave empty; user can retry by reopening */
  } finally {
    loading = false;
    emit();
  }
}

function ensureStream() {
  if (es) return;
  es = new EventSource("/api/chat/stream");
  es.onopen = () => {
    connected = true;
    emit();
  };
  es.onerror = () => {
    connected = false;
    emit();
    // EventSource auto-reconnects; nothing else to do.
  };
  es.onmessage = (e) => {
    try {
      const ev = JSON.parse(e.data) as { event: string; data: ChatMessage };
      if (ev.event === "chat_message" && ev.data) {
        // De-dupe (our own sent message may also arrive via broadcast).
        if (!messages.some((m) => m.id === ev.data.id)) {
          messages = [...messages, ev.data];
          emit();
        }
      }
    } catch {
      /* ignore malformed frames */
    }
  };
}

export async function sendChat(content: string) {
  const msg = await chatApi.send(content);
  // Optimistically append (broadcast de-dupes by id).
  if (msg && !messages.some((m) => m.id === msg.id)) {
    messages = [...messages, msg];
    emit();
  }
}

export interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  connected: boolean;
}

export function useChat(): ChatState {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    loadHistory();
    ensureStream();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { messages, loading, connected };
}
