import { useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { buildApps } from "../apps";
import { Dock } from "./Dock";
import { OsWindow } from "./OsWindow";
import { TopBar } from "./TopBar";
import { Widgets } from "./Widgets";
import { useWindows } from "./useWindows";

export function Desktop() {
  const { windows, open, close, focus, openIds } = useWindows();
  const bounds = useRef<HTMLDivElement>(null);
  const apps = buildApps();

  return (
    <div className="wallpaper fixed inset-0 select-none overflow-hidden">
      <div ref={bounds} className="pointer-events-none absolute inset-x-0 top-7 bottom-20" />
      <div className="pointer-events-none absolute inset-x-0 top-7 bottom-20">
        <Widgets onOpen={open} />
      </div>
      <TopBar />
      <AnimatePresence>
        {windows.map((win) => {
          const app = apps.find((a) => a.id === win.appId);
          if (!app) return null;
          return (
            <OsWindow
              key={win.id}
              win={win}
              app={app}
              boundsRef={bounds}
              onClose={() => close(win.id)}
              onFocus={() => focus(win.id)}
            />
          );
        })}
      </AnimatePresence>
      <Dock apps={apps} openIds={openIds} onOpen={open} />
    </div>
  );
}
