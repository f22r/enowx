import { useEffect, useState, type ReactNode } from "react";
import { Boxes, Activity, Plug, Server, Copy, Check, CircleDot } from "lucide-react";
import {
  accountsApi,
  requestsApi,
  settingsApi,
  type Account,
  type RequestSummary,
  type Settings,
} from "../lib/api";
import type { AppId } from "./types";

const fmt = (n: number) => new Intl.NumberFormat().format(n);

function uptime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

export function Widgets({ onOpen }: { onOpen: (id: AppId) => void }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [summary, setSummary] = useState<RequestSummary | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [healthy, setHealthy] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () => {
      accountsApi.list().then((a) => alive && setAccounts(a)).catch(() => alive && setAccounts([]));
      requestsApi.summary().then((s) => alive && setSummary(s)).catch(() => {});
      settingsApi.get().then((s) => alive && setSettings(s)).catch(() => {});
      fetch("/health").then((r) => alive && setHealthy(r.ok)).catch(() => alive && setHealthy(false));
    };
    load();
    const id = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="pointer-events-auto h-full w-full overflow-auto px-5 py-5">
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        <PoolWidget accounts={accounts} onOpen={onOpen} />
        <EndpointsWidget />
        <RequestsWidget summary={summary} onOpen={onOpen} />
        <GatewayWidget settings={settings} healthy={healthy} onOpen={onOpen} />
      </div>
    </div>
  );
}

function Widget({
  icon,
  title,
  onOpen,
  children,
}: {
  icon: ReactNode;
  title: string;
  onOpen?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onOpen}
      disabled={!onOpen}
      className={`glass flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left shadow-xl transition-colors ${
        onOpen ? "hover:bg-white/[0.07]" : "cursor-default"
      }`}
    >
      <div className="mb-3 flex items-center gap-2 text-white/70">
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
      </div>
      {children}
    </button>
  );
}

function statusTone(status: string) {
  switch (status) {
    case "active":
      return "text-emerald-300";
    case "exhausted":
      return "text-amber-300";
    case "banned":
      return "text-red-300";
    default:
      return "text-white/50";
  }
}

function PoolWidget({ accounts, onOpen }: { accounts: Account[] | null; onOpen: (id: AppId) => void }) {
  const byProvider: Record<string, Record<string, number>> = {};
  let total = 0;
  let active = 0;
  for (const a of accounts ?? []) {
    byProvider[a.provider] ??= {};
    byProvider[a.provider][a.status] = (byProvider[a.provider][a.status] ?? 0) + 1;
    total++;
    if (a.status === "active") active++;
  }
  const providers = Object.keys(byProvider);

  return (
    <Widget icon={<Boxes />} title="Pool health" onOpen={() => onOpen("accounts")}>
      {accounts === null ? (
        <Loading />
      ) : total === 0 ? (
        <p className="text-sm text-white/40">No accounts yet. Add one in Providers.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {providers.map((p) => (
              <div key={p} className="flex items-center justify-between text-xs">
                <span className="text-white/70">{p}</span>
                <span className="flex gap-2 tabular-nums">
                  {Object.entries(byProvider[p]).map(([st, n]) => (
                    <span key={st} className={statusTone(st)}>
                      {n} {st}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-white/10 pt-2 text-[11px] text-white/40">
            {total} accounts · {active} active
          </div>
        </>
      )}
    </Widget>
  );
}

function EndpointsWidget() {
  const base = `${window.location.origin}/v1`;
  const anthropic = `${window.location.origin}/v1/messages`;
  return (
    <Widget icon={<Plug />} title="Endpoints">
      <div className="space-y-2">
        <CopyRow label="OpenAI base URL" value={base} />
        <CopyRow label="Anthropic messages" value={anthropic} />
      </div>
    </Widget>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="group flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5"
    >
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
        <p className="truncate font-mono text-xs text-white/80">{value}</p>
      </div>
      <span className="ml-2 shrink-0 text-white/40 group-hover:text-white/70">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
      </span>
    </div>
  );
}

function RequestsWidget({
  summary,
  onOpen,
}: {
  summary: RequestSummary | null;
  onOpen: (id: AppId) => void;
}) {
  const okRate = summary && summary.total > 0 ? Math.round((summary.ok / summary.total) * 100) : 0;
  return (
    <Widget icon={<Activity />} title="Requests today" onOpen={() => onOpen("requests")}>
      {summary === null ? (
        <Loading />
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-white">{fmt(summary.total)}</span>
            <span className="text-xs text-white/50">requests</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Mini label="OK" value={`${okRate}%`} tone="text-emerald-300" />
            <Mini label="Errors" value={fmt(summary.errors)} tone={summary.errors ? "text-red-300" : "text-white/70"} />
            <Mini label="Avg" value={`${summary.avg_ms}ms`} />
          </div>
        </>
      )}
    </Widget>
  );
}

function GatewayWidget({
  settings,
  healthy,
  onOpen,
}: {
  settings: Settings | null;
  healthy: boolean;
  onOpen: (id: AppId) => void;
}) {
  return (
    <Widget icon={<Server />} title="Gateway" onOpen={() => onOpen("settings")}>
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-white">enx {settings?.version ?? "—"}</span>
        <span className={`flex items-center gap-1 text-xs ${healthy ? "text-emerald-300" : "text-red-300"}`}>
          <CircleDot className="h-3 w-3" /> {healthy ? "healthy" : "down"}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-xs text-white/60">
        <Line k="Port" v={settings ? String(settings.port) : "—"} />
        <Line k="Uptime" v={settings ? uptime(settings.uptime_sec) : "—"} />
        <Line k="Runtime" v={settings?.runtime_dir ?? "—"} mono />
      </div>
    </Widget>
  );
}

function Mini({ label, value, tone = "text-white/80" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-black/20 py-1.5">
      <p className={`text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
    </div>
  );
}

function Line({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/40">{k}</span>
      <span className={`truncate ${mono ? "font-mono" : ""} text-white/70`}>{v}</span>
    </div>
  );
}

function Loading() {
  return <div className="h-12 animate-pulse rounded-lg bg-white/5" />;
}
