import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, ArrowRight, Loader2, BookmarkPlus, ChevronDown, Download, Upload, Search, Globe } from "lucide-react";
import { AppShell } from "./shell";
import { filterApi, type ContentFilter, type FilterTemplate, type CommunityTemplate } from "../lib/api";

// FiltersApp manages content-filter rules: a word is swapped before the request
// is sent to a provider (some providers block certain words) and restored in the
// reply. Named templates save/load whole sets of rules.
export function FiltersApp() {
  const [rows, setRows] = useState<ContentFilter[] | null>(null);
  const [pattern, setPattern] = useState("");
  const [replacement, setReplacement] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [templates, setTemplates] = useState<FilterTemplate[]>([]);
  const [tab, setTab] = useState<"local" | "community">("local");

  const load = () => filterApi.list().then((r) => setRows(r.filters ?? [])).catch(() => setRows([]));
  const loadTemplates = () => filterApi.templates().then((r) => setTemplates(r.templates ?? [])).catch(() => setTemplates([]));
  useEffect(() => { load(); loadTemplates(); }, []);

  const add = async () => {
    if (!pattern.trim()) { setErr("Enter a word/pattern to filter."); return; }
    setBusy(true); setErr("");
    try {
      // The server auto-detects regex from the pattern (use * / [ ] for wildcards).
      await filterApi.add({ pattern: pattern.trim(), replacement: replacement.trim(), is_regex: false, is_active: true });
      setPattern(""); setReplacement("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally { setBusy(false); }
  };

  const toggle = async (f: ContentFilter) => {
    await filterApi.update(f.id, { pattern: f.pattern, replacement: f.replacement, is_regex: f.is_regex, is_active: !f.is_active });
    load();
  };
  const remove = async (id: number) => { await filterApi.remove(id); load(); };

  return (
    <AppShell title="Filters" subtitle="Swap blocked words before sending, restore them in the reply">
      {/* Local / Community tabs. */}
      <div className="mb-3 flex gap-1 rounded-lg bg-white/[0.03] p-0.5 text-[11px]">
        <button onClick={() => setTab("local")} className={`flex-1 rounded-md px-2 py-1 font-medium transition-colors ${tab === "local" ? "bg-white/10 text-white" : "text-white/45 hover:text-white/70"}`}>My Filters</button>
        <button onClick={() => setTab("community")} className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 font-medium transition-colors ${tab === "community" ? "bg-white/10 text-white" : "text-white/45 hover:text-white/70"}`}><Globe className="h-3 w-3" /> Community</button>
      </div>

      {tab === "community" ? (
        <CommunitySection localCount={rows?.length ?? 0} onInstalled={load} />
      ) : (
      <>
      {/* Add — stacked Search / Replace with, plus templates. */}
      <div className="mb-2 flex items-start gap-1.5">
        <div className="flex-1 space-y-1.5">
          <input value={pattern} onChange={(e) => setPattern(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Search…" className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25" />
          <input value={replacement} onChange={(e) => setReplacement(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Replace with…" className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25" />
        </div>
        <button onClick={add} disabled={busy} title="Add rule" className="flex shrink-0 items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-black hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
        </button>
        <TemplatesMenu templates={templates} rows={rows ?? []} onChange={() => { load(); loadTemplates(); }} />
      </div>
      <p className="mb-2 text-[10px] text-white/30">Tip: use <code className="text-white/45">*</code> or <code className="text-white/45">[ ]</code> for wildcards — patterns with regex symbols are auto-detected.</p>
      {err && <div className="mb-2 text-[11px] text-red-300">{err}</div>}

      {/* Rules — dense list. */}
      {!rows ? (
        <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-white/40" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-center text-[11px] text-white/40">No filters yet.</div>
      ) : (
        <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
          {rows.map((f) => (
            <div key={f.id} className={`flex items-center gap-2 px-2.5 py-1.5 ${f.is_active ? "" : "opacity-45"}`}>
              <code className="truncate font-mono text-[11px] text-white/85">{f.pattern}</code>
              <ArrowRight className="h-3 w-3 shrink-0 text-white/25" />
              <code className="truncate font-mono text-[11px] text-emerald-300">{f.replacement || "(removed)"}</code>
              {f.is_regex && <span className="shrink-0 rounded bg-white/10 px-1 text-[8px] uppercase text-white/45">re</span>}
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <button onClick={() => toggle(f)} title={f.is_active ? "Disable" : "Enable"} className={`relative h-3.5 w-6 rounded-full transition-colors ${f.is_active ? "bg-emerald-500/80" : "bg-white/15"}`}>
                  <span className={`absolute top-0.5 left-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform ${f.is_active ? "translate-x-2.5" : ""}`} />
                </button>
                <button onClick={() => remove(f.id)} title="Delete" className="text-white/30 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </AppShell>
  );
}

// CommunitySection browses cloud templates, installs (merge to local), and publishes.
function CommunitySection({ localCount, onInstalled }: { localCount: number; onInstalled: () => void }) {
  const [items, setItems] = useState<CommunityTemplate[] | null>(null);
  const [q, setQ] = useState("");
  const [installing, setInstalling] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [pubOpen, setPubOpen] = useState(false);
  const [pubName, setPubName] = useState("");
  const [pubDesc, setPubDesc] = useState("");
  const [pubBusy, setPubBusy] = useState(false);

  const browse = (query = "") => filterApi.community(query).then((r) => setItems(r.templates ?? [])).catch(() => setItems([]));
  useEffect(() => { browse(); }, []);

  const install = async (t: CommunityTemplate) => {
    setInstalling(t.id); setMsg("");
    try {
      const r = await filterApi.install(t.id);
      setMsg(`Installed ${r.installed} rule${r.installed === 1 ? "" : "s"} from "${t.name}".`);
      onInstalled();
      browse(q);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "install failed");
    } finally { setInstalling(null); }
  };

  const publish = async () => {
    if (!pubName.trim()) return;
    setPubBusy(true); setMsg("");
    try {
      await filterApi.publish(pubName.trim(), pubDesc.trim());
      setPubOpen(false); setPubName(""); setPubDesc("");
      setMsg("Published to the community.");
      browse(q);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "publish failed");
    } finally { setPubBusy(false); }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/25" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && browse(q)} placeholder="Search community templates…" className="w-full rounded-md border border-white/10 bg-black/30 py-1.5 pl-7 pr-2 text-xs text-white outline-none focus:border-white/25" />
        </div>
        <button onClick={() => setPubOpen((v) => !v)} disabled={localCount === 0} title={localCount === 0 ? "Add filters first" : "Publish your current filters"} className="flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[11px] text-white/70 hover:text-white disabled:opacity-40">
          <Upload className="h-3.5 w-3.5" /> Publish
        </button>
      </div>

      {pubOpen && (
        <div className="mb-2 space-y-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-2">
          <div className="text-[10px] text-white/40">Publishing your {localCount} local filter{localCount === 1 ? "" : "s"} as a template.</div>
          <input value={pubName} onChange={(e) => setPubName(e.target.value)} placeholder="Template name" className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:border-white/25" />
          <input value={pubDesc} onChange={(e) => setPubDesc(e.target.value)} placeholder="Description (optional)" className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:border-white/25" />
          <button onClick={publish} disabled={pubBusy || !pubName.trim()} className="flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-[11px] font-medium text-black hover:opacity-90 disabled:opacity-50">
            {pubBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Publish
          </button>
        </div>
      )}
      {msg && <div className="mb-2 text-[11px] text-emerald-300/80">{msg}</div>}

      {!items ? (
        <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-white/40" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-center text-[11px] text-white/40">No community templates yet. Be the first to publish one.</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-white">{t.name}</div>
                {t.description && <div className="truncate text-[10px] text-white/40">{t.description}</div>}
                <div className="text-[10px] text-white/30">by {t.display_name || t.username} · {t.install_count} install{t.install_count === 1 ? "" : "s"}</div>
              </div>
              <button onClick={() => install(t)} disabled={installing === t.id} title="Install (merge into your filters)" className="flex shrink-0 items-center gap-1 rounded-md bg-white/10 px-2 py-1.5 text-[11px] text-white/80 hover:bg-white/20 disabled:opacity-50">
                {installing === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Install
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// TemplatesMenu saves the current set as a named template and loads/deletes saved ones.
function TemplatesMenu({ templates, rows, onChange }: { templates: FilterTemplate[]; rows: ContentFilter[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const save = async () => {
    if (!name.trim()) return;
    await filterApi.saveTemplate(name.trim());
    setName("");
    onChange();
  };
  const loadTpl = async (n: string) => { await filterApi.loadTemplate(n); setOpen(false); onChange(); };
  const del = async (n: string) => { await filterApi.removeTemplate(n); onChange(); };

  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((v) => !v)} title="Templates" className="flex items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-1.5 text-[10px] text-white/60 hover:text-white">
        <BookmarkPlus className="h-3.5 w-3.5" /><ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-white/10 bg-[#0e1016] p-1.5 shadow-2xl">
          <div className="mb-1 flex items-center gap-1">
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder="Save current as…" className="min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white outline-none focus:border-white/25" />
            <button onClick={save} disabled={!name.trim() || rows.length === 0} title="Save template" className="rounded bg-white/10 px-1.5 py-1 text-white/70 hover:bg-white/20 disabled:opacity-40"><BookmarkPlus className="h-3 w-3" /></button>
          </div>
          {templates.length === 0 ? (
            <div className="px-2 py-1.5 text-[10px] text-white/35">No templates saved.</div>
          ) : (
            <div className="max-h-56 space-y-0.5 overflow-auto">
              {templates.map((t) => (
                <div key={t.name} className="group flex items-center gap-1 rounded px-1.5 py-1 text-[11px] hover:bg-white/5">
                  <button onClick={() => loadTpl(t.name)} className="flex-1 truncate text-left text-white/80" title={`Load "${t.name}" (${t.rules.length} rules)`}>
                    {t.name} <span className="text-white/30">({t.rules.length})</span>
                  </button>
                  <button onClick={() => del(t.name)} title="Delete template" className="text-white/25 opacity-0 hover:text-red-300 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
