import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { FileText, Image as ImageIcon, X } from "lucide-react";
import { filesApi } from "../lib/api";
import { onOpenFile, type OpenFileRequest } from "./openFileBus";

interface OpenDoc {
  id: number;
  path: string;
  name: string;
  kind: "text" | "image";
  content?: string;
  loading: boolean;
  error?: string;
}

const langByExt: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  go: "go", py: "python", rs: "rust", java: "java", c: "c", h: "c", cpp: "cpp",
  cs: "csharp", rb: "ruby", php: "php", sh: "shell", bash: "shell", zsh: "shell",
  json: "json", yaml: "yaml", yml: "yaml", toml: "ini", ini: "ini",
  md: "markdown", html: "html", css: "css", scss: "scss", sql: "sql",
  xml: "xml", dockerfile: "dockerfile",
};

function langFor(name: string): string {
  if (name.toLowerCase() === "dockerfile") return "dockerfile";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return langByExt[ext] ?? "plaintext";
}

// EditorView is the center "Editor": tabbed file previews. Text opens in Monaco,
// images render inline. Driven by the openFile bus.
export function EditorView() {
  const seq = useRef(1);
  const [docs, setDocs] = useState<OpenDoc[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    return onOpenFile((req: OpenFileRequest) => {
      setDocs((prev) => {
        const existing = prev.find((d) => d.path === req.path);
        if (existing) {
          setActiveId(existing.id);
          return prev;
        }
        const id = seq.current++;
        setActiveId(id);
        const doc: OpenDoc = { id, path: req.path, name: req.name, kind: req.kind, loading: req.kind === "text" };
        if (req.kind === "text") {
          filesApi
            .read(req.path)
            .then((f) =>
              setDocs((cur) =>
                cur.map((d) =>
                  d.id === id ? { ...d, loading: false, content: f.binary ? "" : f.content, error: f.binary ? "Binary file" : undefined } : d,
                ),
              ),
            )
            .catch((e) =>
              setDocs((cur) => cur.map((d) => (d.id === id ? { ...d, loading: false, error: e instanceof Error ? e.message : "failed" } : d))),
            );
        }
        return [...prev, doc];
      });
    });
  }, []);

  const close = (id: number) => {
    setDocs((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (id === activeId) setActiveId(next.length ? next[next.length - 1].id : null);
      return next;
    });
  };

  const active = docs.find((d) => d.id === activeId);

  if (docs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-[#0b0c10] text-sm text-white/35">
        Open a file from Files to view it here.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-stretch rounded-t-2xl border border-b-0 border-white/10 bg-black/40">
        <div className="term-tabs flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto p-1">
          {docs.map((d) => {
            const isActive = d.id === activeId;
            return (
              <div
                key={d.id}
                onClick={() => setActiveId(d.id)}
                title={d.path}
                className={`group flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                  isActive ? "bg-white/10 text-white ring-1 ring-inset ring-white/15" : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"
                }`}
              >
                {d.kind === "image" ? <ImageIcon className="h-3.5 w-3.5 shrink-0 text-white/40" /> : <FileText className="h-3.5 w-3.5 shrink-0 text-white/40" />}
                <span className="max-w-[140px] truncate font-mono">{d.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    close(d.id);
                  }}
                  className={`-mr-0.5 rounded p-0.5 text-white/30 hover:bg-red-500/40 hover:text-white ${isActive ? "opacity-60" : "opacity-0 group-hover:opacity-60"} hover:!opacity-100`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-b-2xl border border-white/10 bg-[#0b0c10]">
        {active?.kind === "image" ? (
          <div className="flex h-full items-center justify-center overflow-auto p-4">
            <img src={`/api/files/raw?path=${encodeURIComponent(active.path)}`} alt={active.name} className="max-h-full max-w-full object-contain" />
          </div>
        ) : active?.loading ? (
          <div className="flex h-full items-center justify-center text-xs text-white/40">Loading…</div>
        ) : active?.error ? (
          <div className="flex h-full items-center justify-center text-xs text-white/40">{active.error}</div>
        ) : active ? (
          <Editor
            key={active.id}
            height="100%"
            theme="vs-dark"
            language={langFor(active.name)}
            value={active.content ?? ""}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
