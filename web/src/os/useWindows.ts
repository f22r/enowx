import { useCallback, useState } from "react";
import type { AppId, OpenWindow } from "./types";

let seq = 0;

export function useWindows() {
  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const [zTop, setZTop] = useState(10);

  const open = useCallback((appId: AppId) => {
    setWindows((prev) => {
      const existing = prev.find((w) => w.appId === appId);
      const topZ = prev.length ? Math.max(...prev.map((w) => w.z)) : 0;
      if (existing) {
        // Toggle: topmost → close; else bring to front.
        if (existing.z === topZ) return prev.filter((w) => w.id !== existing.id);
        const z = zTop + 1;
        setZTop(z);
        return prev.map((w) => (w.id === existing.id ? { ...w, z } : w));
      }
      const z = zTop + 1;
      setZTop(z);
      return [...prev, { id: `win-${++seq}`, appId, x: -1, y: -1, z }];
    });
  }, [zTop]);

  const close = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const focus = useCallback((id: string) => {
    setWindows((prev) => {
      const z = zTop + 1;
      setZTop(z);
      return prev.map((w) => (w.id === id ? { ...w, z } : w));
    });
  }, [zTop]);

  return { windows, open, close, focus, openIds: windows.map((w) => w.appId) };
}
