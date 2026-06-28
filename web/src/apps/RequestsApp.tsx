import { useEffect, useMemo, useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, Trash2 } from "lucide-react";
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
        <div className="mb-3 flex items-center gap-2">
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
                <div key={r.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
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
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/35">
                      <span className="capitalize">{r.provider}</span>
                      <span className="text-white/20">·</span>
                      <span>{r.created_at}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-[10px] tabular-nums text-white/40">
                    <span title="tokens in/out">
                      {compact(r.in_tokens)}/{compact(r.out_tokens)}
                    </span>
                    <span title="latency">{r.latency_ms}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
