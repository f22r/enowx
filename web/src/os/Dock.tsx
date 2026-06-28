import type { AppId, DesktopApp } from "./types";

export function Dock({
  apps,
  openIds,
  onOpen,
}: {
  apps: DesktopApp[];
  openIds: AppId[];
  onOpen: (id: AppId) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[9000] flex justify-center">
      <div className="glass pointer-events-auto flex items-end gap-2 rounded-2xl border border-white/10 bg-[var(--dock-bg)] px-2 py-2 shadow-2xl">
        {apps.map((app) => (
          <button
            key={app.id}
            title={app.label}
            onClick={() => onOpen(app.id)}
            className="group relative flex flex-col items-center"
          >
            <span className="absolute -top-7 whitespace-nowrap rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-medium text-white opacity-0 ring-1 ring-white/10 transition-opacity group-hover:opacity-100">
              {app.label}
            </span>
            <span className={"flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md [&>svg]:!h-5 [&>svg]:!w-5 " + app.accent}>
              {app.icon}
            </span>
            <span className={"absolute -bottom-1 h-1 w-1 rounded-full transition-opacity " + (openIds.includes(app.id) ? "bg-white/90 opacity-100" : "opacity-0")} />
          </button>
        ))}
      </div>
    </div>
  );
}
