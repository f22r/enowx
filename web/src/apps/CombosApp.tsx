import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, ChevronUp, ChevronDown, Layers, Loader2 } from "lucide-react";
import { AppShell } from "./shell";
import { combosApi, accountsApi, type ComboItem, type ProviderModel } from "../lib/api";

const STRATEGY_LABEL: Record<number, string> = { 0: "Failover", 1: "Round-robin" };

/* Failover tries targets in list order until one succeeds; round-robin
   rotates only the starting target on each request, not per-request
   distribution — a distinction the backend enforces and this UI can't show. */
export function CombosApp() {
  const [combos, setCombos] = useState<ComboItem[] | null>(null);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [editing, setEditing] = useState<ComboItem | "new" | null>(null);

  const load = () => combosApi.list().then((r) => setCombos(r.combos)).catch(() => setCombos([]));
  useEffect(() => {
    load();
    accountsApi.allModels().then((r) => setModels((r.models ?? []).filter((m) => m.type === "chat"))).catch(() => {});
  }, []);

  const remove = async (id: number) => {
    await combosApi.del(id).catch(() => {});
    load();
  };

  return (
    <AppShell title="Combos" subtitle="Multi-model failover / round-robin">
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] text-white/40">
            <Layers className="h-3 w-3" /> {combos?.length ?? 0} combos
          </span>
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> New combo
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/10">
          {combos === null ? (
            <div className="p-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-white/30" /></div>
          ) : combos.length === 0 ? (
            <div className="p-6 text-center text-xs text-white/40">No combos yet. Create one to route a name across multiple models.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {combos.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 px-3 py-2 text-xs">
                  <span className="min-w-0 flex-1 truncate font-mono text-white/80">{c.name}</span>
                  <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase text-white/50">
                    {STRATEGY_LABEL[c.strategy] ?? "Failover"}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {c.targets.map((t, i) => (
                      <span key={i} className="rounded bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[9px] text-indigo-300">{t}</span>
                    ))}
                  </div>
                  <button onClick={() => setEditing(c)} title="Edit" className="shrink-0 rounded p-1 text-white/40 hover:bg-white/10 hover:text-white">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(c.id)} title="Delete" className="shrink-0 rounded p-1 text-white/40 hover:bg-red-500/30 hover:text-red-200">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing !== null && (
        <ComboModal
          combo={editing === "new" ? null : editing}
          models={models}
          onClose={() => setEditing(null)}
          onDone={load}
        />
      )}
    </AppShell>
  );
}

function ComboModal({
  combo,
  models,
  onClose,
  onDone,
}: {
  combo: ComboItem | null;
  models: ProviderModel[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(combo?.name ?? "");
  const [strategy, setStrategy] = useState(combo?.strategy ?? 0);
  const [targets, setTargets] = useState<string[]>(combo?.targets ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const available = models.filter((m) => !targets.includes(m.model_id));

  const move = (i: number, dir: -1 | 1) => {
    const next = [...targets];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setTargets(next);
  };

  const submit = async () => {
    if (!name.trim() || targets.length === 0 || saving) return;
    setSaving(true);
    setError("");
    try {
      if (combo) {
        await combosApi.update(combo.id, name.trim(), targets, strategy);
      } else {
        await combosApi.create(name.trim(), targets, strategy);
      }
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#11131a] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <p className="text-sm font-semibold text-white">{combo ? "Edit combo" : "New combo"}</p>
          <button onClick={onClose} className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="e.g. myclaude"
            className="w-full rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5 font-mono text-xs text-white/80 outline-none focus:border-white/25"
          />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/50">Strategy</span>
            {([0, 1] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                className={`rounded-md px-2 py-0.5 text-[11px] ${strategy === s ? "bg-white/15 text-white" : "text-white/45 hover:bg-white/5"}`}
              >
                {STRATEGY_LABEL[s]}
              </button>
            ))}
          </div>

          <div>
            <span className="text-[11px] text-white/50">Models ({targets.length})</span>
            <div className="mt-1 space-y-1">
              {targets.map((t, i) => (
                <div key={t} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2 py-1">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/80">{t}</span>
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-0.5 text-white/40 hover:text-white disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === targets.length - 1} className="rounded p-0.5 text-white/40 hover:text-white disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                  <button onClick={() => setTargets(targets.filter((x) => x !== t))} className="rounded p-0.5 text-white/40 hover:text-red-300"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
            {available.length > 0 && (
              <select
                value=""
                onChange={(e) => e.target.value && setTargets([...targets, e.target.value])}
                className="mt-1.5 w-full rounded-lg border border-dashed border-white/15 bg-transparent px-2 py-1 text-[11px] text-white/50 outline-none"
              >
                <option value="">+ Add a model…</option>
                {available.map((m) => <option key={m.model_id} value={m.model_id}>{m.model_id}</option>)}
              </select>
            )}
          </div>

          {error && <p className="text-[10px] text-red-300">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/5 px-4 py-3">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-white/50 hover:bg-white/5 hover:text-white">Cancel</button>
          <button
            onClick={submit}
            disabled={saving || !name.trim() || targets.length === 0}
            className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black hover:opacity-90 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
