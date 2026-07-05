import { useSyncExternalStore } from "react";

// The UI layout mode:
// - "classic": the original two-dock layout (Workspace left, Apps right, apps in
//   a docked side panel). The default; unchanged.
// - "focus": the app dock is a horizontal bar at the bottom; opening an app takes
//   over full view, covering the Workspace + widget board.
export type LayoutMode = "classic" | "focus";

const KEY = "enx.layout-mode";

function read(): LayoutMode {
  return localStorage.getItem(KEY) === "focus" ? "focus" : "classic";
}

// A tiny shared store so every component (Settings toggle + Desktop shell) sees
// the same value and re-renders together — plain usePersisted is per-instance,
// so a toggle in Settings wouldn't switch the Desktop until reload.
const listeners = new Set<() => void>();
let current: LayoutMode = read();

export function setLayoutMode(mode: LayoutMode) {
  if (mode === current) return;
  current = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore quota */
  }
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// useLayoutMode returns [mode, setMode] and re-renders every caller on change.
export function useLayoutMode(): readonly [LayoutMode, (m: LayoutMode) => void] {
  const mode = useSyncExternalStore(subscribe, () => current);
  return [mode, setLayoutMode] as const;
}
