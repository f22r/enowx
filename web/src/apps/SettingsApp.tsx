import { useEffect, useState } from "react";
import { Lock, LogOut, Loader2, Check } from "lucide-react";
import { AppShell } from "./shell";
import { Tooltip } from "../components/Tooltip";
import { useDialog } from "../os/dialog";
import { authApi, settingsApi, type AuthStatus, type Settings } from "../lib/api";

export function SettingsApp() {
  const [info, setInfo] = useState<Settings | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);

  async function loadAuth() {
    try {
      setAuth(await authApi.status());
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    settingsApi.get().then(setInfo).catch(() => {});
    loadAuth();
  }, []);

  return (
    <AppShell title="Settings" subtitle="Gateway info & dashboard security">
      <Section title="Dashboard password">
        <PasswordCard auth={auth} reload={loadAuth} />
      </Section>

      <Section title="Gateway">
        <div className="space-y-1 text-[11px]">
          <Row k="Version" v={info ? `enx ${info.version}` : "…"} />
          <Row k="Address" v={info ? `${info.host}:${info.port}` : "…"} />
          <Row k="Runtime dir" v={info?.runtime_dir ?? "…"} mono />
        </div>
      </Section>
    </AppShell>
  );
}

function PasswordCard({ auth, reload }: { auth: AuthStatus | null; reload: () => void }) {
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!auth) return <div className="h-10 animate-pulse rounded-lg bg-white/5" />;

  async function setOrChange() {
    const fields = auth!.password_set
      ? [
          { name: "current", label: "Current password", type: "password" as const },
          { name: "next", label: "New password", type: "password" as const },
        ]
      : [{ name: "next", label: "New password", type: "password" as const }];
    const res = await dialog.form({
      title: auth!.password_set ? "Change password" : "Set password",
      message: "Protects remote access to the dashboard, terminal, and files.",
      fields,
      confirmLabel: "Save",
    });
    if (!res) return;
    if ((res.next ?? "").length < 6) {
      await dialog.alert({ title: "Too short", message: "Password must be at least 6 characters." });
      return;
    }
    setBusy(true);
    try {
      if (auth!.password_set) await authApi.change(res.current ?? "", res.next);
      else await authApi.setup(res.next);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
      reload();
    } catch (e) {
      await dialog.alert({ title: "Failed", message: e instanceof Error ? e.message : "could not save" });
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const ok = await dialog.confirm({ title: "Log out?", message: "You'll need the password to access remotely again.", confirmLabel: "Log out" });
    if (!ok) return;
    await authApi.logout();
    // Reload so a remote session returns to the login screen.
    location.reload();
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
      <p className="text-[11px] leading-relaxed text-white/55">
        {auth.password_set
          ? "A dashboard password is set. Localhost is trusted without it; remote access requires logging in."
          : "No password yet. Set one to allow remote access to the dashboard, terminal, and files."}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Tooltip label={auth.password_set ? "Change the password" : "Set a password"} place="bottom">
          <button
            onClick={setOrChange}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Lock className="h-3.5 w-3.5" />}
            {auth.password_set ? "Change password" : "Set password"}
          </button>
        </Tooltip>
        {auth.password_set && auth.logged_in && (
          <Tooltip label="End this session" place="bottom">
            <button onClick={logout} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white">
              <LogOut className="h-3.5 w-3.5" /> Log out
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">{title}</h2>
      {children}
    </section>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5">
      <span className="text-white/40">{k}</span>
      <span className={`truncate ${mono ? "font-mono" : ""} text-white/70`}>{v}</span>
    </div>
  );
}
