import { AnimatePresence } from "framer-motion";
import { buildApps } from "../apps";
import { SideDock } from "./SideDock";
import { SidePanel } from "./SidePanel";
import { TopBar } from "./TopBar";
import { Widgets } from "./Widgets";
import { usePanels } from "./usePanels";
import { useSides } from "./useSides";
import type { AppId, Side } from "./types";

export function Desktop() {
  const apps = buildApps();
  const { active, toggle, close } = usePanels();

  const defaults = Object.fromEntries(apps.map((a) => [a.id, a.side])) as Record<AppId, Side>;
  const { sides, move } = useSides(defaults);

  const sideOf = (id: AppId): Side => sides[id] ?? "left";
  const appsOn = (side: Side) => apps.filter((a) => sideOf(a.id) === side);
  const find = (id: AppId | null) => apps.find((a) => a.id === id);

  const renderPanel = (side: Side) => {
    const id = active[side];
    const app = find(id);
    // Only render the panel on the side the app currently lives on.
    return app && id && sideOf(id) === side ? (
      <SidePanel side={side} app={app} onClose={() => close(side)} />
    ) : null;
  };

  return (
    <div className="wallpaper fixed inset-0 select-none overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-7 bottom-3">
        <Widgets onOpen={(id) => toggle(sideOf(id), id)} />
      </div>

      <TopBar />

      <SideDock side="left" apps={appsOn("left")} activeId={active.left} onOpen={toggle} onDropApp={(id) => move(id, "left")} />
      <SideDock side="right" apps={appsOn("right")} activeId={active.right} onOpen={toggle} onDropApp={(id) => move(id, "right")} />

      <AnimatePresence>{renderPanel("left")}</AnimatePresence>
      <AnimatePresence>{renderPanel("right")}</AnimatePresence>
    </div>
  );
}
