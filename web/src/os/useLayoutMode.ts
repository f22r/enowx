import { usePersisted } from "./usePersisted";

// The UI layout mode:
// - "classic": the original two-dock layout (Workspace left, Apps right, apps in
//   a docked side panel). The default; unchanged.
// - "focus": the app dock is a horizontal bar at the bottom; opening an app takes
//   over full view, covering the Workspace + widget board.
export type LayoutMode = "classic" | "focus";

export function useLayoutMode() {
  return usePersisted<LayoutMode>("layout-mode", "classic");
}
