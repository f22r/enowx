import { useEffect, useState } from "react";
import type { Notification } from "../lib/api";

// notifNav is a tiny global bus that carries a "navigate to this notification's
// context" request. Desktop subscribes and dispatches (it owns setView/openApp);
// this decouples the click handler from the desktop's view state.
let pending: Notification | null = null;
const listeners = new Set<() => void>();

export function navigateToNotif(n: Notification) {
  pending = n;
  listeners.forEach((l) => l());
}

export function consumeNotifNav(): Notification | null {
  const n = pending;
  pending = null;
  return n;
}

export function useNotifNav(): number {
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const l = () => setBump((v) => v + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return bump;
}
