import { useEffect, useState } from "react";
import { tunnelApi, type TunnelStatus } from "../lib/api";

// Shared tunnel store: one source of truth so the Tunnel app (and any widget)
// stays in sync. Mutations refresh status and notify subscribers.
let cache: TunnelStatus | null = null;
const listeners = new Set<(s: TunnelStatus | null) => void>();

function emit() {
  listeners.forEach((l) => l(cache));
}

export async function refreshTunnel() {
  try {
    cache = await tunnelApi.status();
  } catch {
    cache = cache ?? null;
  }
  emit();
}

// Login event stream callbacks.
export interface LoginHandlers {
  onMessage?: (line: string) => void;
  onAuthUrl?: (url: string) => void;
}

// startLogin consumes the SSE login stream. Resolves true once logged in.
export async function startLogin(h: LoginHandlers): Promise<boolean> {
  const res = await fetch(tunnelApi.loginUrl(), { method: "POST" });
  if (!res.ok || !res.body) {
    // The guard (no API key) returns JSON, not a stream.
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "login failed to start");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let ok = false;

  // SSE frames are separated by a blank line; each has `event:` + `data:`.
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      let payload: Record<string, unknown> = {};
      try {
        payload = data ? JSON.parse(data) : {};
      } catch {
        /* ignore */
      }
      if (event === "auth_url") h.onAuthUrl?.(String(payload.url ?? ""));
      else if (event === "progress") h.onMessage?.(String(payload.message ?? ""));
      else if (event === "error") throw new Error(String(payload.error ?? "login failed"));
      else if (event === "done") ok = true;
    }
  }
  await refreshTunnel();
  return ok;
}

export function useTunnel() {
  const [status, setStatus] = useState<TunnelStatus | null>(cache);
  useEffect(() => {
    listeners.add(setStatus);
    if (cache === null) refreshTunnel();
    else setStatus(cache);
    return () => {
      listeners.delete(setStatus);
    };
  }, []);

  return {
    status,
    refresh: refreshTunnel,
    enableQuick: async () => {
      const s = await tunnelApi.enableQuick();
      cache = s;
      emit();
      return s;
    },
    disable: async () => {
      const s = await tunnelApi.disable();
      cache = s;
      emit();
      return s;
    },
    named: async (hostname: string) => {
      const s = await tunnelApi.named(hostname);
      cache = s;
      emit();
      return s;
    },
    startLogin,
  };
}
