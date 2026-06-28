import { useEffect, useState } from "react";
import { Folder, FileText, ArrowUp, Home } from "lucide-react";
import { AppShell } from "./shell";
import { filesApi, type DirListing } from "../lib/api";
import { openFile, fileKind } from "../os/openFileBus";

const fmtSize = (n: number) =>
  n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : n >= 1 << 10 ? `${(n / (1 << 10)).toFixed(1)} KB` : `${n} B`;

function join(dir: string, name: string) {
  return dir.endsWith("/") ? dir + name : dir + "/" + name;
}

export function FilesApp() {
  const [dir, setDir] = useState<DirListing | null>(null);
  const [path, setPath] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    filesApi
      .list(path)
      .then((d) => {
        if (!alive) return;
        setDir(d);
        setError("");
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "failed to read"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path]);

  return (
    <AppShell title="Files" subtitle={dir?.path ?? "Local file browser"}>
      <div className="flex h-full flex-col">
        <div className="mb-3 flex items-center gap-1.5">
          <IconBtn onClick={() => setPath(dir?.home)} title="Home">
            <Home className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn onClick={() => dir?.parent && setPath(dir.parent)} title="Up" disabled={!dir?.parent}>
            <ArrowUp className="h-3.5 w-3.5" />
          </IconBtn>
          <div className="ml-1 min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 font-mono text-[11px] text-white/60">
            {dir?.path ?? "…"}
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
        )}

        {loading ? (
          <div className="h-40 animate-pulse rounded-lg bg-white/5" />
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10">
            {dir?.entries.length === 0 ? (
              <div className="p-6 text-center text-xs text-white/40">Empty folder</div>
            ) : (
              <div className="h-full divide-y divide-white/5 overflow-auto">
                {dir?.entries.map((e) => {
                  const full = join(dir.path, e.name);
                  return (
                    <button
                      key={e.name}
                      onDoubleClick={() => (e.is_dir ? setPath(full) : openFile({ path: full, name: e.name, kind: fileKind(e.name) }))}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.04]"
                    >
                      {e.is_dir ? (
                        <Folder className="h-4 w-4 shrink-0 text-sky-300/80" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-white/40" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-white/80">{e.name}</span>
                      {!e.is_dir && <span className="shrink-0 tabular-nums text-white/30">{fmtSize(e.size)}</span>}
                      <span className="hidden shrink-0 text-white/25 sm:inline">{e.mod}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function IconBtn({
  onClick,
  title,
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}
