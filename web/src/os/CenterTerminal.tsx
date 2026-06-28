import { useState } from "react";
import { Plus, X, SquareTerminal } from "lucide-react";
import type { useTerminals } from "./useTerminals";

// CenterTerminal renders the center tab strip + the host div the active
// terminal is portaled into. Tabs can be dragged onto a dock to move a session
// out to the side; dropping a dock terminal here brings it back.
export function CenterTerminal({
  term,
  setHost,
}: {
  term: ReturnType<typeof useTerminals>;
  setHost: (el: HTMLElement | null) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const centerTerms = term.terms.filter((t) => t.location === "center");

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-stretch rounded-t-2xl border border-b-0 border-emerald-500/20 bg-black/40"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("text/term-id")) e.preventDefault();
        }}
        onDrop={(e) => {
          const id = e.dataTransfer.getData("text/term-id");
          if (id) {
            e.preventDefault();
            term.moveTo(Number(id), "center");
          }
        }}
      >
        <div className="term-tabs flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto p-1">
          {centerTerms.map((tab) => {
            const isActive = tab.id === term.activeCenter;
            return (
              <div
                key={tab.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/term-id", String(tab.id));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => term.setActiveCenter(tab.id)}
                onDoubleClick={() => setEditing(tab.id)}
                title={tab.title}
                className={`group flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-inset ring-emerald-500/30"
                    : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"
                }`}
              >
                <SquareTerminal className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-emerald-400" : "text-white/30"}`} />
                {editing === tab.id ? (
                  <input
                    autoFocus
                    defaultValue={tab.title}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      term.rename(tab.id, e.target.value);
                      setEditing(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        term.rename(tab.id, (e.target as HTMLInputElement).value);
                        setEditing(null);
                      } else if (e.key === "Escape") {
                        setEditing(null);
                      }
                    }}
                    className="w-24 bg-transparent font-mono text-xs text-white outline-none"
                  />
                ) : (
                  <span className="max-w-[120px] truncate font-mono">{tab.title}</span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    term.close(tab.id);
                  }}
                  className={`-mr-0.5 rounded p-0.5 text-white/30 hover:bg-red-500/40 hover:text-white ${
                    isActive ? "opacity-60" : "opacity-0 group-hover:opacity-60"
                  } hover:!opacity-100`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
        <button
          onClick={term.add}
          title="New terminal"
          className="flex shrink-0 items-center border-l border-white/5 px-2.5 text-white/40 transition-colors hover:bg-white/[0.05] hover:text-emerald-300"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Terminal instances are portaled into this host by TerminalLayer. */}
      <div ref={setHost} className="relative min-h-0 flex-1 overflow-hidden rounded-b-2xl border border-emerald-500/20 bg-[#0b0c10] shadow-xl" />
    </div>
  );
}
