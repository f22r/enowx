import { usePersisted } from "./usePersisted";
import type { AppId } from "./types";

// Which apps are HIDDEN from the Focus-mode bottom dock (by id). Everything not
// listed is shown. Persisted per-browser. The left Workspace dock is unaffected —
// it always shows all its apps.
export function useFocusDockHidden() {
  return usePersisted<AppId[]>("focus-dock-hidden", []);
}
