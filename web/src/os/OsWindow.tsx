import { useState } from "react";
import { motion, useDragControls } from "framer-motion";
import { X, Minus, Square } from "lucide-react";
import type { DesktopApp, OpenWindow } from "./types";

export function OsWindow({
  win,
  app,
  boundsRef,
  onClose,
  onFocus,
}: {
  win: OpenWindow;
  app: DesktopApp;
  boundsRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onFocus: () => void;
}) {
  const drag = useDragControls();
  const [max, setMax] = useState(false);
  const w = app.width ?? 760;
  const h = app.height ?? 540;

  const [pos] = useState(() => ({
    x: win.x >= 0 ? win.x : Math.max(8, Math.round((window.innerWidth - w) / 2)),
    y: win.y >= 0 ? win.y : Math.max(40, Math.round((window.innerHeight - h) / 2)),
  }));

  const full = max;
  return (
    <motion.div
      role="dialog"
      aria-label={app.label}
      onMouseDown={onFocus}
      drag={!full}
      dragControls={drag}
      dragListener={false}
      dragMomentum={false}
      dragConstraints={boundsRef}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.14 }}
      style={{ zIndex: win.z, ...(full ? {} : { left: pos.x, top: pos.y, width: w, height: h }) }}
      className={
        "absolute flex flex-col overflow-hidden text-white/90 bg-[var(--window-bg)] " +
        (full ? "inset-x-0 top-7 bottom-16 rounded-none" : "rounded-[var(--radius-window)] shadow-2xl border border-white/10")
      }
    >
      <div
        onPointerDown={(e) => !full && drag.start(e)}
        onDoubleClick={() => setMax((v) => !v)}
        className={"flex h-9 shrink-0 items-center gap-2 border-b border-white/5 bg-white/[0.02] px-3 " + (!full ? "cursor-grab active:cursor-grabbing" : "")}
      >
        <span className={"flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br text-white [&>svg]:!h-3 [&>svg]:!w-3 " + app.accent}>
          {app.icon}
        </span>
        <span className="truncate text-xs font-medium text-white/80">{app.label}</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setMax((v) => !v)} className="flex h-6 w-6 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white">
            <Square className="h-3 w-3" />
          </button>
          <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-md text-white/50 hover:bg-red-500/80 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">{app.render()}</div>
    </motion.div>
  );
}
