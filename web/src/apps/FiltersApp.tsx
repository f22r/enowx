import { useEffect, useState } from "react";
import { Plus, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { AppShell } from "./shell";
import { filterApi, type ContentFilter } from "../lib/api";

// FiltersApp manages content-filter rules: a word is swapped before the request
// is sent to a provider (some providers block certain words) and restored in the
// reply, so the user still sees the original.
export function FiltersApp() {
  const [rows, setRows] = useState<ContentFilter[] | null>(null);
  const [pattern, setPattern] = useState("");
  const [replacement, setReplacement] = useState("");
  const [regex, setRegex] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => filterApi.list().then((r) => setRows(r.filters ?? [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!pattern.trim()) { setErr("Enter a word/pattern to filter."); return; }
    setBusy(true); setErr("");
    try {
      await filterApi.add({ pattern: pattern.trim(), replacement: replacement.trim(), is_regex: regex, is_active: true });
      setPattern(""); setReplacement(""); setRegex(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (f: ContentFilter, key: "is_active" | "is_regex") => {
    await filterApi.update(f.id, { pattern: f.pattern, replacement: f.replacement, is_regex: f.is_regex, is_active: f.is_active, [key]: !f[key] });
    load();
  };
  const remove = async (id: number) => { await filterApi.remove(id); load(); };

  return (
    <AppShell title="Filters" subtitle="Swap blocked words before sending, restore them in the reply">
      <p className="mb-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-white/50">
        Some providers block certain words (brand names, etc.). Each rule replaces the word in your
        <span className="text-white/70"> request</span> before it's sent, and restores it in the
        <span className="text-white/70"> reply</span> — so the model never sees the blocked word, but you still do.
      </p>

      {/* Add rule */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="word / pattern" className="min-w-[8rem] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/25" />
        <ArrowRight className="h-4 w-4 shrink-0 text-white/30" />
        <input value={replacement} onChange={(e) => setReplacement(e.target.value)} placeholder="replacement" className="min-w-[8rem] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/25" />
        <label className="flex shrink-0 items-center gap-1 text-[11px] text-white/50">
          <input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} className="accent-indigo-500" /> regex
        </label>
        <button onClick={add} disabled={busy} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
        </button>
      </div>
      {err && <div className="mb-3 text-xs text-red-300">{err}</div>}

      {/* Rules */}
      {!rows ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-xs text-white/40">No filters yet.</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((f) => (
            <div key={f.id} className={`flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 ${f.is_active ? "" : "opacity-50"}`}>
              <code className="font-mono text-xs text-white/85">{f.pattern}</code>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/30" />
              <code className="font-mono text-xs text-emerald-300">{f.replacement || "(removed)"}</code>
              {f.is_regex && <span className="rounded bg-white/10 px-1 text-[9px] uppercase text-white/50">regex</span>}
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => toggle(f, "is_active")} title={f.is_active ? "Disable" : "Enable"} className={`relative h-4 w-7 rounded-full transition-colors ${f.is_active ? "bg-emerald-500/80" : "bg-white/15"}`}>
                  <span className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform ${f.is_active ? "translate-x-3" : ""}`} />
                </button>
                <button onClick={() => remove(f.id)} className="rounded-lg border border-white/10 p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-200"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
