import { useCallback, useState } from "react";
import type { AppId, Side } from "./types";

const KEY = "enx.app-sides";

// useSides tracks which edge each app lives on, persisted to localStorage. It
// guarantees at least one app stays on each side (a move that would empty a
// side is rejected).
export function useSides(defaults: Record<AppId, Side>) {
  const [sides, setSides] = useState<Record<AppId, Side>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Record<AppId, Side>>;
      return { ...defaults, ...saved };
    } catch {
      return defaults;
    }
  });

  const move = useCallback((id: AppId, to: Side) => {
    setSides((prev) => {
      if (prev[id] === to) return prev;
      // Don't empty the source side.
      const remaining = Object.entries(prev).filter(([k, v]) => k !== id && v === prev[id]);
      if (remaining.length === 0) return prev;
      const next = { ...prev, [id]: to };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // ignore quota/availability errors
      }
      return next;
    });
  }, []);

  return { sides, move };
}
