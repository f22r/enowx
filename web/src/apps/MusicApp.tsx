import { useRef, useState } from "react";
import { Search, Play, Pause, Plus, Trash2, ListX, Loader2, Music2 } from "lucide-react";
import { AppShell, Empty } from "./shell";
import { Tooltip } from "../components/Tooltip";
import { musicApi, type Track } from "../lib/api";
import {
  useMusic,
  play,
  enqueue,
  removeFromQueue,
  clearQueue,
  toggle,
  currentTrack,
} from "../os/musicBus";

export function MusicApp() {
  const m = useMusic();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Track[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const reqId = useRef(0);
  const current = currentTrack();

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const query = q.trim();
    if (!query) return;
    const id = ++reqId.current;
    setSearching(true);
    setError("");
    try {
      const r = await musicApi.search(query);
      if (id === reqId.current) setResults(r);
    } catch (err) {
      if (id === reqId.current) {
        setError(err instanceof Error ? err.message : "search failed");
        setResults([]);
      }
    } finally {
      if (id === reqId.current) setSearching(false);
    }
  }

  return (
    <AppShell title="Music" subtitle="Search and play tracks from YouTube Music">
      <form onSubmit={search} className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search songs, artists…"
            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-8 pr-3 text-xs text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none"
          />
        </div>
        <Tooltip label="Search" place="bottom">
          <button
            type="submit"
            disabled={searching}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-50"
          >
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Search
          </button>
        </Tooltip>
      </form>

      {error && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}

      {/* Now playing / queue */}
      {m.queue.length > 0 && (
        <section className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Queue · {m.queue.length}</h2>
            <Tooltip label="Clear the queue" place="bottom">
              <button onClick={clearQueue} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-white/50 hover:bg-white/10 hover:text-white/80">
                <ListX className="h-3 w-3" /> Clear
              </button>
            </Tooltip>
          </div>
          <div className="space-y-1">
            {m.queue.map((t) => {
              const isCurrent = current?.id === t.id;
              return (
                <Row
                  key={t.id}
                  track={t}
                  active={isCurrent}
                  playing={isCurrent && m.playing}
                  onPlay={() => (isCurrent ? toggle() : play(t))}
                  trailing={
                    <Tooltip label="Remove from queue" place="left">
                      <button onClick={() => removeFromQueue(t.id)} className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-red-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Search results */}
      <section>
        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">Results</h2>
        {results === null ? (
          <Empty message="Search for a song to get started." />
        ) : results.length === 0 ? (
          <Empty message="No results." />
        ) : (
          <div className="space-y-1">
            {results.map((t) => {
              const inQueue = m.queue.some((x) => x.id === t.id);
              const isCurrent = current?.id === t.id;
              return (
                <Row
                  key={t.id}
                  track={t}
                  active={isCurrent}
                  playing={isCurrent && m.playing}
                  onPlay={() => (isCurrent ? toggle() : play(t))}
                  trailing={
                    <Tooltip label={inQueue ? "Already in queue" : "Add to queue"} place="left">
                      <button
                        onClick={() => enqueue(t)}
                        disabled={inQueue}
                        className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/80 disabled:opacity-30"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  }
                />
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function Row({
  track,
  active,
  playing,
  onPlay,
  trailing,
}: {
  track: Track;
  active: boolean;
  playing: boolean;
  onPlay: () => void;
  trailing: React.ReactNode;
}) {
  return (
    <div
      className={`group flex items-center gap-2.5 rounded-lg border px-2 py-1.5 ${
        active ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
      }`}
    >
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-white/5">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Music2 className="absolute inset-0 m-auto h-4 w-4 text-white/30" />
        )}
        <button
          onClick={onPlay}
          className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 data-[on=true]:opacity-100"
          data-on={active}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
        </button>
      </div>
      <button onClick={onPlay} className="min-w-0 flex-1 text-left">
        <div className={`truncate text-xs font-medium ${active ? "text-emerald-200" : "text-white/85"}`}>{track.title}</div>
        <div className="truncate text-[11px] text-white/40">
          {track.artist}
          {track.album ? ` · ${track.album}` : ""}
        </div>
      </button>
      {track.duration && <span className="shrink-0 font-mono text-[10px] text-white/35">{track.duration}</span>}
      {trailing}
    </div>
  );
}
