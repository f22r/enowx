import { useEffect, useMemo, useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, Trash2, X, ChevronRight } from "lucide-react";
import { AppShell } from "./shell";
import { Tooltip } from "../components/Tooltip";
import { useDialog } from "../os/dialog";
import { requestsApi, type RequestRow } from "../lib/api";

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

export function RequestsApp() {
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [error, setError] = useState("");
  const [source, setSource] = useState("all");
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const dialog = useDialog();

  async function load() {
    try {
      setRows(await requestsApi.list(200));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
      setRows([]);
    }
  }

  // Poll so new requests (incl. warmups) appear without a manual refresh.
  useEffect(() => {
    let alive = true;
    const tick = () => requestsApi.list(200).then((r) => alive && setRows(r)).catch(() => {});
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  async function clearLogs() {
    const ok = await dialog.confirm({
      title: "Clear request logs?",
      message: "All request history will be deleted. This cannot be undone.",
      confirmLabel: "Clear",
      danger: true,
    });
    if (!ok) return;
    try {
      await requestsApi.clear();
      setRows([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to clear");
    }
  }

  const sources = Array.from(new Set((rows ?? []).map((r) => r.source))).sort();
  const shown = useMemo(
    () => (rows ?? []).filter((r) => source === "all" || r.source === source),
    [rows, source],
  );

  return (
    <AppShell title="Requests" subtitle="Served request history">
      <div className="flex h-full flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="flex-1 text-[11px] text-white/40">{shown.length} requests</span>
          {sources.length > 1 && (
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              title="Filter by source"
              className="h-8 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-xs text-white/80 focus:outline-none"
            >
              <option value="all" className="bg-[#15161c]">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s} className="bg-[#15161c]">{s}</option>
              ))}
            </select>
          )}
          <Tooltip label="Reload requests" place="bottom">
            <button onClick={load} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/10 hover:text-white">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip label="Clear all logs" place="bottom">
            <button
              onClick={clearLogs}
              disabled={(rows?.length ?? 0) === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/50 hover:bg-red-500/30 hover:text-red-200 disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>

        {error && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}

        <div className="min-h-0 flex-1 overflow-auto">
          {rows === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/40">
              No requests yet.
            </div>
          ) : (
            <div className="space-y-1.5">
              {shown.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="group flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                >
                  {r.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs text-white/85">{r.model}</span>
                      {r.source === "warmup" && (
                        <span className="shrink-0 rounded bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-orange-300 ring-1 ring-inset ring-orange-500/30">
                          warmup
                        </span>
                      )}
                      {r.proxy_used && (
                        <span className="hidden shrink-0 rounded bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-300 ring-1 ring-inset ring-cyan-500/30 sm:inline">
                          proxied
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/35">
                      <span className="capitalize">{r.provider}</span>
                      <span className="text-white/20">·</span>
                      <span className="truncate">{r.created_at}</span>
                    </div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-3 text-[10px] tabular-nums text-white/40 sm:flex">
                    <span title="tokens in/out">{compact(r.in_tokens)}/{compact(r.out_tokens)}</span>
                    <span title="latency">{r.latency_ms}ms</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/20 transition-colors group-hover:text-white/50" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && <DetailModal row={selected} onClose={() => setSelected(null)} />}
    </AppShell>
  );
}

// DetailModal shows the full metadata for one request — usage, latency, the
// proxy + account that served it, timing — but never the request or response
// body.
function DetailModal({ row, onClose }: { row: RequestRow; onClose: () => void }) {
  const ok = row.status === "success";
  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#11131a] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-white/90">{row.model}</span>
          <button onClick={onClose} className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-4 text-xs">
          <Field label="Status" value={row.status} valueClass={ok ? "text-emerald-300" : "text-red-300"} />
          <Field label="Source" value={row.source} />
          <Field label="Provider" value={row.provider} valueClass="capitalize" />
          <Field label="Account" value={row.account_label || "—"} />
          <Field label="Proxy" value={row.proxy_used || "direct"} valueClass={row.proxy_used ? "text-cyan-300" : "text-white/50"} />
          <Field label="Latency" value={`${row.latency_ms} ms`} />
          <Field label="Tokens in" value={row.in_tokens.toLocaleString()} />
          <Field label="Tokens out" value={row.out_tokens.toLocaleString()} />
          <Field label="Tokens total" value={(row.in_tokens + row.out_tokens).toLocaleString()} />
          <Field label="Request ID" value={`#${row.id}`} />
          <div className="col-span-2">
            <Field label="Time" value={row.created_at} />
          </div>
        </div>
        <div className="border-t border-white/5 px-4 py-2.5 text-[10px] text-white/30">
          Request &amp; response bodies aren't stored.
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, valueClass = "text-white/80" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-white/35">{label}</p>
      <p className={`truncate font-mono ${valueClass}`}>{value}</p>
    </div>
  );
}
