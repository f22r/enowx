import { useEffect, useState } from "react";

// marketplaceNav is a tiny global store for "open the Marketplace at this rekber
// thread". A notification click calls openMarketplaceThread(id); Desktop switches
// to the marketplace view and MarketplaceApp consumes the pending thread id.
let pending: number | null = null;
const listeners = new Set<() => void>();

export function openMarketplaceThread(threadId: number) {
  pending = threadId;
  listeners.forEach((l) => l());
}

// consumeMarketplaceThread returns the pending thread id once, then clears it.
export function consumeMarketplaceThread(): number | null {
  const id = pending;
  pending = null;
  return id;
}

// useMarketplaceNav notifies subscribers when a thread is requested. Returns a
// bump counter so consumers can react (then call consumeMarketplaceThread).
export function useMarketplaceNav(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const l = () => setN((v) => v + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return n;
}

export function hasPendingThread(): boolean {
  return pending !== null;
}
