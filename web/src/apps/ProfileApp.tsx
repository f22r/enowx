import { useEffect, useRef, useState } from "react";
import { Loader2, LogOut, LogIn, ShieldCheck, Sparkles, Crown, Check } from "lucide-react";
import { subscriptionApi, type SubscriptionStatus, type CouponPreview } from "../lib/api";
import { AppShell } from "./shell";
import { Tooltip } from "../components/Tooltip";
import { useProfile } from "../os/useProfile";
import { ProfileEditor } from "./ProfileEditor";
import { ProfileCard } from "../components/ProfileCard";

// ProfileApp is the account surface: sign in with Discord to unlock features
// (sync runs automatically in the background once signed in). No server URL to
// configure — the cloud endpoint is built into enowx. Sync controls live in
// Settings → Cloud Sync.
export function ProfileApp() {
  const profile = useProfile();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, []);

  async function connect() {
    setError("");
    setBusy("Opening Discord…");
    try {
      const { authorize_url, state } = await profile.startLogin();
      window.open(authorize_url, "_blank", "noopener");
      setBusy("Waiting for Discord authorization…");
      poll.current = setInterval(async () => {
        try {
          const done = await profile.pollLogin(state);
          if (done) {
            if (poll.current) clearInterval(poll.current);
            setBusy("");
          }
        } catch {
          /* keep polling */
        }
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "couldn't reach the server");
      setBusy("");
    }
  }

  async function logout() {
    setBusy("Signing out…");
    try {
      await profile.logout();
    } finally {
      setBusy("");
    }
  }

  if (profile.loading) {
    return (
      <AppShell title="Profile" subtitle="Your enowx account">
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-white/40" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Profile" subtitle="Your enowx account">
      {error && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}

      {profile.loggedIn && profile.user ? (
        <div className="space-y-4">
          {/* Discord-style profile card with the Edit action in the banner corner. */}
          <ProfileCard p={profile.user} action={<ProfileEditor />} />

          {/* Subscription / upgrade */}
          <SubscriptionCard />

          {/* Sign out — full-width at the bottom, matching the card frame. */}
          <button
            onClick={logout}
            disabled={!!busy}
            title="Sign out of this device"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/30 to-violet-600/30">
            <ShieldCheck className="h-7 w-7 text-indigo-200" />
          </div>
          <h2 className="text-sm font-semibold text-white">Sign in to enowx</h2>
          <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-white/50">
            Connect your Discord account to sync across devices and unlock account features. enowx works fine without
            signing in — login just adds more.
          </p>
          <Tooltip label="Sign in with Discord" place="bottom">
            <button
              onClick={connect}
              disabled={!!busy}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#5865F2] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
              Connect Discord
            </button>
          </Tooltip>
          {busy && <p className="mt-2 text-[11px] text-white/45">{busy}</p>}
        </div>
      )}
    </AppShell>
  );
}

// SubscriptionCard shows Premium status + upgrade/renew, replacing the old
// cloud-sync note. Free users see an upgrade CTA; premium users see their expiry.
function SubscriptionCard() {
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [coupon, setCoupon] = useState("");
  const [preview, setPreview] = useState<CouponPreview | null>(null);
  const [checking, setChecking] = useState(false);

  const load = () => subscriptionApi.status().then(setSub).catch(() => setSub(null));
  useEffect(() => { load(); }, []);

  const applyCoupon = async () => {
    if (!coupon.trim()) { setPreview(null); return; }
    setChecking(true); setErr("");
    try {
      setPreview(await subscriptionApi.validateCoupon(coupon.trim()));
    } catch {
      setPreview(null);
    } finally { setChecking(false); }
  };

  const subscribe = async () => {
    setBusy(true); setErr("");
    try {
      const r = await subscriptionApi.subscribe(coupon.trim() || undefined);
      if (r.free) { await load(); return; } // fully-discounted → premium granted now
      if (r.pay_url) window.open(r.pay_url, "_blank", "noopener");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "could not start payment");
    } finally { setBusy(false); }
  };

  const idr = (n: number) => "Rp" + n.toLocaleString("id-ID");
  const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "";

  if (!sub) {
    return (
      <div className="flex justify-center rounded-xl border border-white/10 bg-white/[0.02] p-4"><Loader2 className="h-4 w-4 animate-spin text-white/30" /></div>
    );
  }

  if (sub.active) {
    return (
      <div className="rounded-xl border border-amber-400/25 bg-gradient-to-b from-amber-500/10 to-transparent p-3.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300"><Crown className="h-3.5 w-3.5" /> Premium</div>
        <p className="text-xs text-white/60">You have full access to cloud features.</p>
        {sub.premium_until && <p className="mt-1 text-[11px] text-white/40">Expires {fmtDate(sub.premium_until)}</p>}
        <button onClick={subscribe} disabled={busy} className="mt-3 flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crown className="h-3.5 w-3.5" />} Renew (+30 days)
        </button>
        {err && <p className="mt-1.5 text-[11px] text-red-300">{err}</p>}
      </div>
    );
  }

  const finalPrice = preview?.valid ? preview.final_price : sub.price;
  const isFree = preview?.valid && finalPrice <= 0;

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-b from-indigo-500/10 to-transparent p-3.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-300"><Sparkles className="h-3.5 w-3.5" /> Upgrade to Premium</div>
      <ul className="mb-3 space-y-1 text-xs text-white/60">
        <li className="flex items-center gap-1.5"><Check className="h-3 w-3 shrink-0 text-emerald-400" /> Full cloud sync (providers, accounts, keys, settings)</li>
        <li className="flex items-center gap-1.5"><Check className="h-3 w-3 shrink-0 text-emerald-400" /> More paid cloud features as they land</li>
      </ul>

      {/* Optional coupon. */}
      <div className="mb-2 flex items-center gap-1.5">
        <input
          value={coupon}
          onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setPreview(null); }}
          onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
          placeholder="Coupon code (optional)"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25"
        />
        <button onClick={applyCoupon} disabled={checking || !coupon.trim()} className="shrink-0 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] text-white/70 hover:bg-white/5 disabled:opacity-40">
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
        </button>
      </div>
      {preview && (
        <p className={`mb-2 text-[11px] ${preview.valid ? "text-emerald-300" : "text-red-300"}`}>
          {preview.valid
            ? (isFree ? "Coupon applied — Premium is free! 🎉" : `Coupon applied — ${idr(preview.discount)} off.`)
            : preview.message}
        </p>
      )}

      <button onClick={subscribe} disabled={busy || (!isFree && !sub.pay_enabled)} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crown className="h-3.5 w-3.5" />}
        {isFree ? "Claim Premium · Free" : (
          <>Subscribe · {preview?.valid && finalPrice !== sub.price ? (<><span className="line-through opacity-50">{idr(sub.price)}</span> {idr(finalPrice)}</>) : idr(sub.price)}/mo</>
        )}
      </button>
      {!sub.pay_enabled && !isFree && <p className="mt-1.5 text-[11px] text-white/35">Payment is not configured yet — use a coupon.</p>}
      {err && <p className="mt-1.5 text-[11px] text-red-300">{err}</p>}
    </div>
  );
}
