import { useEffect, useRef, useState } from "react";
import { Play, Square, Trash2, Plus, X, ScrollText, ExternalLink, Puzzle, AlertTriangle, RefreshCw } from "lucide-react";
import { AppShell, Empty } from "./shell";
import { Tooltip } from "../components/Tooltip";
import { useDialog } from "../os/dialog";
import { pluginsApi, type PluginManifest, type PluginRuntime } from "../lib/api";

const RUNTIMES = [
  { id: "python", label: "Python" },
  { id: "node", label: "Node.js" },
  { id: "go", label: "Go" },
  { id: "static", label: "Static (HTML/JS)" },
];

export function PluginsApp() {
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [runtimes, setRuntimes] = useState<PluginRuntime[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<PluginManifest | null>(null);
  const dialog = useDialog();

  const load = async () => {
    try {
      const r = await pluginsApi.list();
      setPlugins(r.plugins ?? []);
      setRuntimes(r.runtimes ?? []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
    }
  };
  useEffect(() => {
    load();
  }, []);

  const runtimeOk = (id: string) => id === "static" || runtimes.find((r) => r.id === id)?.available;

  const act = async (fn: () => Promise<unknown>, id: string) => {
    setBusy(id);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "action failed");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (p: PluginManifest) => {
    const ok = await dialog.confirm({ title: "Delete plugin?", message: `${p.name} and its folder will be removed. This cannot be undone.`, confirmLabel: "Delete", danger: true });
    if (ok) act(() => pluginsApi.remove(p.id), p.id);
  };

  return (
    <AppShell title="Plugins" subtitle="Build and run your own apps & automations">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black hover:opacity-90">
          <Plus className="h-3.5 w-3.5" /> New plugin
        </button>
        <button onClick={load} title="Refresh" className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:bg-white/5 hover:text-white"><RefreshCw className="h-3.5 w-3.5" /></button>
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-white/40">
          {runtimes.map((r) => (
            <span key={r.id} className={`rounded px-1.5 py-0.5 ${r.available ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-white/30"}`} title={r.version || (r.available ? "" : "not installed")}>
              {r.id}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200/90">
        <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0" />
        Plugins run on your machine with full access. Only run plugins you trust.
      </div>

      {error && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}

      {plugins.length === 0 ? (
        <Empty message="No plugins yet. Create one to get a starter you can edit in ~/.enowx/plugins." />
      ) : (
        <div className="space-y-2">
          {plugins.map((p) => (
            <div key={p.id} className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/60"><Puzzle className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-white">{p.name}</span>
                  <span className="rounded bg-white/10 px-1 text-[9px] uppercase text-white/50">{p.runtime}</span>
                  {p.running && <span className="rounded bg-emerald-500/20 px-1 text-[9px] text-emerald-300">running</span>}
                  {!runtimeOk(p.runtime) && <span className="rounded bg-red-500/20 px-1 text-[9px] text-red-300">{p.runtime} missing</span>}
                </div>
                <div className="mt-0.5 truncate font-mono text-[10px] text-white/35">{p.id} · {p.error || p.description || p.entry}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Tooltip label="Open">
                  <button onClick={() => setOpenFor(p)} disabled={p.runtime !== "static" && !p.running} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-40"><ExternalLink className="h-3.5 w-3.5" /></button>
                </Tooltip>
                {p.runtime !== "static" && (p.running ? (
                  <Tooltip label="Stop"><button onClick={() => act(() => pluginsApi.stop(p.id), p.id)} disabled={busy === p.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-40"><Square className="h-3.5 w-3.5" /></button></Tooltip>
                ) : (
                  <Tooltip label="Start"><button onClick={() => act(() => pluginsApi.start(p.id), p.id)} disabled={busy === p.id || !runtimeOk(p.runtime)} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-40"><Play className="h-3.5 w-3.5" /></button></Tooltip>
                ))}
                <Tooltip label="Logs"><button onClick={() => setLogsFor(p.id)} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/55 hover:bg-white/10 hover:text-white"><ScrollText className="h-3.5 w-3.5" /></button></Tooltip>
                <Tooltip label="Delete"><button onClick={() => remove(p)} disabled={busy === p.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/55 hover:bg-red-500/30 hover:text-red-200 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button></Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <CreateModal runtimes={runtimes} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
      {logsFor && <LogsModal id={logsFor} onClose={() => setLogsFor(null)} />}
      {openFor && <PluginWindow plugin={openFor} onClose={() => setOpenFor(null)} />}
    </AppShell>
  );
}

function CreateModal({ runtimes, onClose, onCreated }: { runtimes: PluginRuntime[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [runtime, setRuntime] = useState("python");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  const available = (r: string) => r === "static" || runtimes.find((x) => x.id === r)?.available;

  const submit = async () => {
    if (!id) { setErr("Enter a name"); return; }
    setErr("");
    setBusy(true);
    try {
      await pluginsApi.create(id, name.trim(), runtime);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#11131a] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">New plugin</p>
          <button onClick={onClose} className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <label className="mb-1 block text-[11px] text-white/50">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="My Plugin" className="mb-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/25" />
        {id && <p className="mb-3 font-mono text-[10px] text-white/35">id: {id}</p>}
        <label className="mb-1 block text-[11px] text-white/50">Runtime</label>
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {RUNTIMES.map((r) => (
            <button key={r.id} onClick={() => setRuntime(r.id)} disabled={!available(r.id)} className={`rounded-lg border px-2.5 py-1.5 text-xs disabled:opacity-40 ${runtime === r.id ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-white/60 hover:bg-white/5"}`}>
              {r.label}{!available(r.id) && r.id !== "static" ? " (missing)" : ""}
            </button>
          ))}
        </div>
        {err && <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</div>}
        <button onClick={submit} disabled={busy || !id} className="w-full rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50">{busy ? "Creating…" : "Create plugin"}</button>
      </div>
    </div>
  );
}

function LogsModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    const poll = () => pluginsApi.logs(id).then((r) => setLines(r.lines ?? [])).catch(() => {});
    poll();
    timer.current = window.setInterval(poll, 1500);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [id]);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-[70%] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#11131a] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <p className="text-sm font-semibold text-white">Logs · <span className="font-mono text-white/50">{id}</span></p>
          <button onClick={onClose} className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-white/70">{lines.length ? lines.join("\n") : "No output yet. Start the plugin to see logs."}</pre>
      </div>
    </div>
  );
}

function PluginWindow({ plugin, onClose }: { plugin: PluginManifest; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#11131a] px-3 py-2">
        <Puzzle className="h-4 w-4 text-white/60" />
        <span className="text-sm font-medium text-white">{plugin.name}</span>
        <button onClick={onClose} className="ml-auto rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <iframe
        title={plugin.name}
        src={`/plugins/${plugin.id}/`}
        className="min-h-0 flex-1 bg-white"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
      />
    </div>
  );
}
