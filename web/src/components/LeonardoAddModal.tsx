import { useState } from "react";
import { X } from "lucide-react";
import { ProviderIcon } from "./ProviderIcon";
import { accountsApi, leonardoApi, type Provider } from "../lib/api";

type Tab = "cookie" | "manual";
const TABS: { id: Tab; label: string }[] = [
  { id: "cookie", label: "From Cookie" },
  { id: "manual", label: "Manual" },
];

export function LeonardoAddModal({ provider, onClose, onSaved }: { provider: Provider; onClose: () => void; onSaved: () => void }) {
  const [tab, setTab] = useState<Tab>("cookie");
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[85%] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11131a] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
          <ProviderIcon icon={provider.icon} label={provider.label} size={32} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Add Leonardo account</p>
            <p className="text-[11px] text-white/40">Image generation. Stored locally.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-1 border-b border-white/5 px-3 py-2">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-md px-2.5 py-1 text-xs transition-colors ${tab === t.id ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"}`}>{t.label}</button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {tab === "cookie" ? <CookieTab onSaved={onSaved} /> : <ManualTab onSaved={onSaved} />}
        </div>
      </div>
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{msg}</div>;
}

function Primary({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return <button onClick={onClick} disabled={disabled} className="w-full rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50">{children}</button>;
}

function CookieTab({ onSaved }: { onSaved: () => void }) {
  const [cookie, setCookie] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      await leonardoApi.fromCookie(cookie.trim());
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">
        Log in at app.leonardo.ai, open DevTools → Network → any request to <span className="font-mono">app.leonardo.ai</span>, and copy the full <span className="font-mono">Cookie</span> request header. enowx fetches your session token from it automatically.
      </p>
      <textarea value={cookie} onChange={(e) => setCookie(e.target.value)} spellCheck={false} placeholder="__Secure-next-auth.session-token=…; other=…" className="h-32 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-white placeholder:text-white/25 focus:border-white/25 focus:outline-none" />
      <Err msg={err} />
      <Primary onClick={submit} disabled={busy || !cookie.trim()}>{busy ? "Fetching session…" : "Add account"}</Primary>
    </div>
  );
}

function ManualTab({ onSaved }: { onSaved: () => void }) {
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      await accountsApi.add({ provider: "leonardo", creds: { access_token: token.trim() } });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">
        Paste a Leonardo access token (JWT). Get it from <span className="font-mono">app.leonardo.ai/api/auth/get-session</span> → the <span className="font-mono">accessToken</span> field.
      </p>
      <textarea value={token} onChange={(e) => setToken(e.target.value)} spellCheck={false} placeholder="eyJ…" className="h-28 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-white placeholder:text-white/25 focus:border-white/25 focus:outline-none" />
      <Err msg={err} />
      <Primary onClick={submit} disabled={busy || !token.trim()}>{busy ? "Saving…" : "Add account"}</Primary>
    </div>
  );
}
