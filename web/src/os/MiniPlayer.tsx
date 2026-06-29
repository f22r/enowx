import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Music2, Loader2 } from "lucide-react";
import { Tooltip } from "../components/Tooltip";
import { useMusic, toggle, next, prev, seek, setVolume, currentTrack, clearQueue, fmtTime } from "./musicBus";

// Floating mini player. Lives at the desktop root (not inside any app), so it
// stays visible and keeps playing as the user switches views or opens apps.
// Renders nothing until a track is loaded.
export function MiniPlayer() {
  const m = useMusic();
  const track = currentTrack();
  if (!track) return null;

  const pct = m.duration > 0 ? (m.position / m.duration) * 100 : 0;

  return (
    <div className="pointer-events-auto fixed bottom-5 left-1/2 z-[9000] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2">
      <div className="overflow-hidden rounded-2xl border border-white/12 bg-[var(--window-bg)]/90 shadow-2xl backdrop-blur-xl">
        {/* Seek bar */}
        <div
          className="group relative h-1 w-full cursor-pointer bg-white/10"
          onClick={(e) => {
            if (m.duration <= 0) return;
            const r = e.currentTarget.getBoundingClientRect();
            seek(((e.clientX - r.left) / r.width) * m.duration);
          }}
        >
          <div className="h-full bg-emerald-400/80" style={{ width: `${pct}%` }} />
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300 opacity-0 transition-opacity group-hover:opacity-100"
            style={{ left: `${pct}%` }}
          />
        </div>

        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-white/5">
            {track.thumbnail ? (
              <img src={track.thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <Music2 className="absolute inset-0 m-auto h-4 w-4 text-white/30" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-white/90">{track.title}</div>
            <div className="truncate text-[10px] text-white/40">{track.artist || "—"}</div>
          </div>

          <span className="hidden shrink-0 font-mono text-[10px] text-white/35 sm:inline">
            {fmtTime(m.position)} / {fmtTime(m.duration)}
          </span>

          <div className="flex shrink-0 items-center gap-0.5">
            <Tooltip label="Previous" place="top">
              <button onClick={prev} className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
                <SkipBack className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip label={m.playing ? "Pause" : "Play"} place="top">
              <button
                onClick={toggle}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              >
                {m.loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : m.playing ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
            </Tooltip>
            <Tooltip label="Next" place="top">
              <button onClick={next} className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
                <SkipForward className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>

          <div className="hidden items-center gap-1 sm:flex">
            <Tooltip label={m.volume === 0 ? "Unmute" : "Mute"} place="top">
              <button
                onClick={() => setVolume(m.volume === 0 ? 1 : 0)}
                className="rounded-md p-1.5 text-white/55 hover:bg-white/10 hover:text-white"
              >
                {m.volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
            </Tooltip>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={m.volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-1 w-14 cursor-pointer accent-emerald-400"
              aria-label="Volume"
            />
          </div>

          <Tooltip label="Close player (clears queue)" place="top">
            <button onClick={clearQueue} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-red-300">
              <X className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
