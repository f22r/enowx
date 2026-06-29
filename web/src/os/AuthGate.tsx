import { useEffect, useState, type ReactNode } from "react";
import { Lock, Loader2, ShieldCheck } from "lucide-react";
import { authApi, type AuthStatus } from "../lib/api";

// AuthGate decides what to show before the desktop:
//   • password not set        → Setup screen (create the dashboard password)
//   • set, but not authorized → Login screen (remote access needs a session)
//   • authorized              → the desktop
// Localhost is authorized without logging in, so local use stays frictionless.
export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [failed, setFailed] = useState(false);

  async function load() {
    try {
      setStatus(await authApi.status());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (failed) {
    // If status can't be fetched, don't lock the user out of a local instance.
    return <>{children}</>;
  }
  if (!status) {
    return (
      <Screen>
        <Loader2 className="h-5 w-5 animate-spin text-white/50" />
      </Screen>
    );
  }
  if (status.authorized) return <>{children}</>;
  if (!status.password_set) return <Setup onDone={load} />;
  return <Login onDone={load} />;
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="wallpaper fixed inset-0 flex items-center justify-center">
      <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-[var(--window-bg)]/90 p-6 shadow-2xl backdrop-blur-xl">
        {children}
      </div>
    </div>
  );
}

function Setup({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return setErr("Password must be at least 6 characters.");
    if (pw !== pw2) return setErr("Passwords don't match.");
    setBusy(true);
    setErr("");
    try {
      await authApi.setup(pw);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "setup failed");
      setBusy(false);
    }
  }

  return (
    <Screen>
      <form onSubmit={submit}>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-300" />
          <h1 className="text-sm font-semibold text-white">Set a dashboard password</h1>
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-white/50">
          This protects the dashboard — including the terminal and file browser — when you access it remotely
          (e.g. through a tunnel). You can change it later in Settings.
        </p>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="New password"
          className={inputCls}
        />
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="Confirm password"
          className={`mt-2 ${inputCls}`}
        />
        {err && <p className="mt-2 text-[11px] text-red-300">{err}</p>}
        <button type="submit" disabled={busy} className={btnCls}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Set password
        </button>
      </form>
    </Screen>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await authApi.login(pw);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "login failed");
      setBusy(false);
    }
  }

  return (
    <Screen>
      <form onSubmit={submit}>
        <div className="mb-3 flex items-center gap-2">
          <Lock className="h-5 w-5 text-white/70" />
          <h1 className="text-sm font-semibold text-white">enowx</h1>
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-white/50">Enter the dashboard password to continue.</p>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          className={inputCls}
        />
        {err && <p className="mt-2 text-[11px] text-red-300">{err}</p>}
        <button type="submit" disabled={busy} className={btnCls}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Log in
        </button>
      </form>
    </Screen>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/25 focus:outline-none";
const btnCls =
  "mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50";
