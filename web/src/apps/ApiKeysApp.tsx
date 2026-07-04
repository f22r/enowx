import { useState } from "react";
import { Plus, Copy, Check, Trash2, RefreshCw, X } from "lucide-react";
import { AppShell } from "./shell";
import { Tooltip } from "../components/Tooltip";
import { useDialog } from "../os/dialog";
import { useKeys } from "../os/useKeys";
import { copyText } from "../os/clipboard";
import { type ApiKey, type NewApiKey } from "../lib/api";

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

export function ApiKeysApp() {
  const { keys, reload, add, remove } = useKeys();
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const dialog = useDialog();

  const onDelete = async (k: ApiKey) => {
    const ok = await dialog.confirm({
      title: "Delete API key?",
      message: `${k.label || k.secret.slice(0, 12)} will stop working immediately.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) {
      try {
        await remove(k.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed to delete");
      }
    }
  };

  return (
    <AppShell title="API Keys" subtitle="Gateway keys, limits & usage">
      <div className="flex h-full flex-col">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex-1 text-[11px] text-white/40">{keys?.length ?? 0} keys</span>
          <button
            onClick={() => setCreating(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-medium text-black hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> New key
          </button>
          <Tooltip label="Reload keys" place="bottom">
            <button onClick={reload} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/10 hover:text-white">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>

        {error && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}

        <div className="min-h-0 flex-1 overflow-auto">
          {keys === null ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/40">
              No keys yet. Create one to require auth on /v1 and /anthropic.
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <KeyCard key={k.id} k={k} onDelete={() => onDelete(k)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreate={async (payload) => {
            await add(payload);
            setCreating(false);
          }}
        />
      )}
    </AppShell>
  );
}

function KeyCard({ k, onDelete }: { k: ApiKey; onDelete: () => void }) {
  const [copied, setCopied] = useState(false);
  const masked = `${k.secret.slice(0, 10)}…${k.secret.slice(-4)}`;
  const pct = k.token_limit > 0 ? Math.min(100, Math.round((k.tokens_used / k.token_limit) * 100)) : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-medium text-white">{k.label || "Untitled key"}</span>
        {!k.enabled && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase text-white/45 ring-1 ring-inset ring-white/15">disabled</span>}
        {k.expires_at && <span className="text-[10px] text-white/35">exp {k.expires_at}</span>}
        <div className="ml-auto flex items-center gap-1">
          <Tooltip label="Copy key">
            <button
              onClick={() => {
                copyText(k.secret);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </Tooltip>
          <Tooltip label="Delete key">
            <button onClick={onDelete} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/55 hover:bg-red-500/30 hover:text-red-200">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      <p className="mt-1 truncate font-mono text-[11px] text-white/55">{masked}</p>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/40">
        <span>concurrent: {k.max_concurrent > 0 ? k.max_concurrent : "∞"}</span>
        <span>tokens: {compact(k.tokens_used)} / {k.token_limit > 0 ? compact(k.token_limit) : "∞"}</span>
      </div>
      {k.token_limit > 0 && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: NewApiKey) => Promise<void> }) {
  const [label, setLabel] = useState("");
  const [tokenLimit, setTokenLimit] = useState("");
  const [maxConcurrent, setMaxConcurrent] = useState("");
  const [expiresDays, setExpiresDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setSaving(true);
    setErr("");
    try {
      await onCreate({
        label: label.trim() || undefined,
        token_limit: Number(tokenLimit) || 0,
        max_concurrent: Number(maxConcurrent) || 0,
        expires_in_days: Number(expiresDays) || 0,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed to create");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#11131a] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <p className="text-sm font-semibold text-white">New API key</p>
          <button onClick={onClose} className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <Field label="Label">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. my app" className={inputCls} />
          </Field>
          <Field label="Token limit (0 = unlimited)">
            <input value={tokenLimit} onChange={(e) => setTokenLimit(e.target.value)} inputMode="numeric" placeholder="0" className={inputCls} />
          </Field>
          <Field label="Max concurrent (0 = unlimited)">
            <input value={maxConcurrent} onChange={(e) => setMaxConcurrent(e.target.value)} inputMode="numeric" placeholder="0" className={inputCls} />
          </Field>
          <Field label="Expires in days (0 = never)">
            <input value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} inputMode="numeric" placeholder="0" className={inputCls} />
          </Field>
          {err && <p className="text-[11px] text-red-300">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/5 px-4 py-3">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-white px-4 py-1.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50">
            {saving ? "Creating..." : "Create key"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/25 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-white/50">{label}</span>
      {children}
    </label>
  );
}
