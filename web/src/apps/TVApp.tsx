import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Search, Tv, Loader2, X, SignalHigh } from "lucide-react";

// TVApp is a live-TV browser. The enx gateway loads the iptv-org catalog and
// probes every channel in the background (sports first), so this only ever shows
// channels confirmed ONLINE — no dead links, no client-side probing. Playback
// tries direct first and falls back to the gateway proxy on CORS.

interface Channel {
  id: string;
  name: string;
  logo: string;
  country: string;
  categories: string[];
  url: string;
  quality: string | null;
  ua: string | null;
  ref: string | null;
  source: "iptv" | "events";
  group?: string;
}

// proxied builds the gateway proxy URL for a stream (CORS fallback).
function proxied(url: string, ua?: string | null, ref?: string | null) {
  const q = new URLSearchParams({ url });
  if (ua) q.set("ua", ua);
  if (ref) q.set("ref", ref);
  return `/api/tv/proxy?${q.toString()}`;
}

export function TVApp() {
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [loading, setLoading] = useState(true); // backend still probing
  const [progress, setProgress] = useState({ checked: 0, total: 0 });
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [tab, setTab] = useState<"live" | "channels">("channels");
  const [tabTouched, setTabTouched] = useState(false);
  const [playing, setPlaying] = useState<Channel | null>(null);

  // Poll the gateway for the online channel list; it fills in as probing
  // proceeds, so results appear live and stop polling once the first pass is done.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await fetch("/api/tv/channels");
        const d = (await r.json()).data ?? {};
        if (!alive) return;
        setChannels((d.channels ?? []).map((c: Channel) => ({ ...c })));
        setLoading(!!d.loading);
        setProgress({ checked: d.checked ?? 0, total: d.total ?? 0 });
        if (d.loading) timer = setTimeout(tick, 4000); // keep polling while probing
      } catch {
        if (alive) { setError("Couldn't load channels."); }
      }
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  const cats = useMemo(() => {
    if (!channels) return [];
    const c = new Set<string>();
    for (const ch of channels) ch.categories.forEach((x) => c.add(x));
    // Put sports first (World Cup), then the rest alphabetical.
    const all = [...c].sort();
    return ["all", "sports", ...all.filter((x) => x !== "sports")];
  }, [channels]);

  const liveCount = useMemo(() => (channels ?? []).filter((c) => c.source === "events").length, [channels]);

  // Prefer the Live-matches tab automatically when live fixtures are available
  // (unless the user picked a tab). When none are online (source down), stay on
  // Channels so the app is never empty.
  useEffect(() => {
    if (!tabTouched && liveCount > 0) setTab("live");
  }, [liveCount, tabTouched]);

  const filtered = useMemo(() => {
    if (!channels) return [];
    const query = q.trim().toLowerCase();
    return channels.filter((ch) => {
      // Tab: live matches (events) vs 24/7 channels.
      if (tab === "live" && ch.source !== "events") return false;
      if (tab === "channels" && ch.source !== "iptv") return false;
      if (tab === "channels" && cat !== "all" && !ch.categories.includes(cat)) return false;
      if (query && !ch.name.toLowerCase().includes(query) && !(ch.group ?? "").toLowerCase().includes(query) && !ch.country.toLowerCase().includes(query)) return false;
      return true;
    }).slice(0, 600); // cap the rendered grid
  }, [channels, q, cat, tab]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {playing && <Player channel={playing} onClose={() => setPlaying(null)} />}

      {/* Live matches (fixtures) vs 24/7 channels. */}
      <div className="flex rounded-xl border border-white/10 bg-white/[0.02] p-0.5 text-xs">
        <button onClick={() => { setTab("live"); setTabTouched(true); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ${tab === "live" ? "bg-emerald-500/15 text-emerald-200" : "text-white/50 hover:text-white/80"}`}>
          <SignalHigh className="h-3.5 w-3.5" /> Live matches{liveCount > 0 ? ` (${liveCount})` : ""}
        </button>
        <button onClick={() => { setTab("channels"); setTabTouched(true); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ${tab === "channels" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"}`}>
          <Tv className="h-3.5 w-3.5" /> Channels
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <Search className="h-4 w-4 text-white/30" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "live" ? "Search matches (e.g. soccer, madrid, ligue)…" : "Search channels or country (e.g. bein, sports, ID)…"}
            className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
        {tab === "channels" && (
          <select value={cat} onChange={(e) => setCat(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#15161c] px-3 py-2 text-sm text-white/80 outline-none">
            {cats.map((c) => <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>)}
          </select>
        )}
      </div>

      {error ? (
        <div className="flex flex-1 items-center justify-center text-sm text-white/40">{error}</div>
      ) : channels === null || (channels.length === 0 && loading) ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-white/40">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Finding channels that are online…</span>
          {progress.total > 0 && (
            <span className="text-[11px] text-white/30">checked {progress.checked.toLocaleString()} / {progress.total.toLocaleString()} (sports first)</span>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-[11px] text-white/35">
            <span>{filtered.length}{filtered.length >= 600 ? "+" : ""} shown · {channels.length.toLocaleString()} online</span>
            {loading && (
              <span className="flex items-center gap-1 text-emerald-300/60">
                <Loader2 className="h-3 w-3 animate-spin" /> still checking {progress.checked.toLocaleString()}/{progress.total.toLocaleString()}…
              </span>
            )}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 overflow-auto">
            {filtered.map((ch) => <ChannelCard key={ch.id} ch={ch} onPlay={() => setPlaying(ch)} />)}
            {filtered.length === 0 && (
              <div className="col-span-full py-10 text-center text-sm text-white/35">
                {tab === "live" && liveCount === 0
                  ? "No live matches available right now (the events source may be down). Try the Channels tab."
                  : "No channels match."}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ChannelCard({ ch, onPlay }: { ch: Channel; onPlay: () => void }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <button
      onClick={onPlay}
      className="group flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center transition-colors hover:border-emerald-500/30 hover:bg-white/[0.05]"
    >
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-black/30">
        {ch.logo && imgOk ? (
          <img src={ch.logo} alt="" className="max-h-full max-w-full object-contain" onError={() => setImgOk(false)} />
        ) : (
          <Tv className="h-6 w-6 text-white/30" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-white/85">{ch.name}</p>
        <p className="truncate text-[10px] text-white/35">
          {ch.source === "events" ? (ch.group ?? "Live") : `${ch.country}${ch.quality ? ` · ${ch.quality}` : ""}`}
        </p>
      </div>
    </button>
  );
}

function Player({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "playing" | "error">("loading");
  const [usingProxy, setUsingProxy] = useState(false);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    let hls: Hls | null = null;
    let cancelled = false;

    // Attach a source (direct or proxied). On a fatal error while direct, retry
    // once through the gateway proxy (CORS fallback).
    const attach = (viaProxy: boolean) => {
      const src = viaProxy ? proxied(channel.url, channel.ua, channel.ref) : channel.url;
      setUsingProxy(viaProxy);
      if (hls) { hls.destroy(); hls = null; }

      if (el.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari: native HLS.
        el.src = src;
        el.play().then(() => !cancelled && setStatus("playing")).catch(() => {
          if (!viaProxy) attach(true); else setStatus("error");
        });
        return;
      }
      if (!Hls.isSupported()) { setStatus("error"); return; }
      hls = new Hls({ maxBufferLength: 20 });
      hls.loadSource(src);
      hls.attachMedia(el);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        el.play().then(() => !cancelled && setStatus("playing")).catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal || cancelled) return;
        if (!viaProxy) attach(true); // fall back to the proxy once
        else setStatus("error");
      });
    };

    setStatus("loading");
    // Event streams (DaddyLive) need forwarded Referer/User-Agent + usually block
    // CORS, so go straight through the proxy; 24/7 channels try direct first.
    attach(channel.source === "events");
    return () => { cancelled = true; if (hls) hls.destroy(); };
  }, [channel]);

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-white/10 bg-[#0d0e12] px-4 py-2.5">
          <SignalHigh className="h-4 w-4 text-emerald-400" />
          <span className="flex-1 truncate text-sm font-medium text-white">{channel.name}</span>
          <span className="text-[10px] text-white/35">{channel.country}{usingProxy ? " · proxied" : ""}</span>
          <button onClick={onClose} className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="relative aspect-video bg-black">
          <video ref={video} controls autoPlay playsInline className="h-full w-full" />
          {status === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/50">
              <Loader2 className="h-5 w-5 animate-spin" /> Tuning in…
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-sm text-white/50">
              <p>This channel isn't playable right now.</p>
              <p className="text-[11px] text-white/30">The stream may be offline or geo-blocked.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
