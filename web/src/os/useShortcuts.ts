import { useEffect, useRef, useState } from "react";

// Leader-key shortcuts that never collide with the browser. Tap a modifier
// (Ctrl or Alt, left OR right) by itself to enter "leader mode"; then press a
// plain key (no modifier) to run an action — so the browser never sees a
// shortcut. Esc or any timeout cancels. Holding the modifier with another key
// (e.g. Ctrl+T) is left to the browser.
//
// keymap: plain lowercase key -> action id. Returns whether leader mode is on
// (for an on-screen hint).
export function useShortcuts(run: (action: string) => void): boolean {
  const [leader, setLeader] = useState(false);
  const armed = useRef(false); // a modifier went down with nothing else yet
  const timer = useRef<number | null>(null);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    const isLeaderMod = (e: KeyboardEvent) => e.key === "Control" || e.key === "Alt";

    const clearTimer = () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
    const enter = () => {
      setLeader(true);
      clearTimer();
      timer.current = window.setTimeout(() => setLeader(false), 2000);
    };
    const exit = () => {
      setLeader(false);
      clearTimer();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Modifier pressed: arm it as a potential leader (only if pressed alone).
      if (isLeaderMod(e)) {
        armed.current = !leader; // pressing mod while already in leader = ignore
        return;
      }

      // Pressing another key while a modifier is held cancels the leader arm —
      // that's a real browser chord, leave it alone.
      if (e.ctrlKey || e.altKey || e.metaKey) {
        armed.current = false;
        if (!leader) return;
      }

      if (!leader) return;

      // In leader mode: a plain key triggers an action (or Esc cancels).
      if (e.key === "Escape") {
        exit();
        return;
      }
      const k = e.key.toLowerCase();
      e.preventDefault();
      exit();
      runRef.current(k);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      // Releasing the modifier with nothing pressed in between = enter leader.
      if (isLeaderMod(e) && armed.current) {
        armed.current = false;
        if (leader) exit();
        else enter();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      clearTimer();
    };
  }, [leader]);

  return leader;
}
