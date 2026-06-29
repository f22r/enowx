import { useEffect, useState } from "react";
import { musicApi, type Track } from "../lib/api";

// Module-level cache for the Discover feed so switching tabs (or reopening the
// Music app) shows the last feed instantly instead of refetching every time.
// The feed is only refetched on first load or an explicit Shuffle.
let cache: Track[] | null = null;
let loading = false;
let error = "";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export async function loadDiscover(force = false) {
  if (loading) return;
  if (cache !== null && !force) return; // already have a feed; keep it
  loading = true;
  error = "";
  emit();
  try {
    cache = await musicApi.discover();
  } catch (e) {
    error = e instanceof Error ? e.message : "failed to load";
    if (cache === null) cache = [];
  } finally {
    loading = false;
    emit();
  }
}

export function useDiscover() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    if (cache === null) loadDiscover();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { tracks: cache, loading, error, shuffle: () => loadDiscover(true) };
}
