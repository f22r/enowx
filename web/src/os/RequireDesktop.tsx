import { useEffect, useState } from "react";
import { Maximize, Monitor } from "lucide-react";

// enowx is a desktop, fullscreen-only experience. On a small/touch device, or
// when not in fullscreen, this gate covers the app with a black overlay asking
// the user to switch to a desktop browser and/or go fullscreen.
const MIN_WIDTH = 1024;

function isFullscreen(): boolean {
  // Native fullscreen, or a maximized/standalone window that fills the screen.
  if (document.fullscreenElement) return true;
  // Treat a window that already fills the display as "fullscreen enough" so
  // maximized desktop windows aren't nagged.
  const nearlyFull = window.innerHeight >= window.screen.availHeight - 2;
  return nearlyFull;
}

function isDesktop(): boolean {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const smallByWidth = window.innerWidth < MIN_WIDTH;
  return !coarse && !smallByWidth;
}

export function RequireDesktop({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(() => isDesktop() && isFullscreen());

  useEffect(() => {
    const check = () => setOk(isDesktop() && isFullscreen());
    window.addEventListener("resize", check);
    document.addEventListener("fullscreenchange", check);
    return () => {
      window.removeEventListener("resize", check);
      document.removeEventListener("fullscreenchange", check);
    };
  }, []);

  const desktop = isDesktop();

  return (
    <>
      {children}
      {!ok && (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center gap-6 bg-black px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            {desktop ? <Maximize className="h-7 w-7 text-white/70" /> : <Monitor className="h-7 w-7 text-white/70" />}
          </div>
          {desktop ? (
            <>
              <div className="space-y-1.5">
                <h1 className="text-lg font-semibold text-white">Fullscreen required</h1>
                <p className="max-w-sm text-sm text-white/50">enowx runs fullscreen. Enter fullscreen mode to continue.</p>
              </div>
              <button
                onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
                className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black hover:opacity-90"
              >
                <Maximize className="h-4 w-4" /> Enter fullscreen
              </button>
              <p className="text-[11px] text-white/30">or press F11</p>
            </>
          ) : (
            <div className="space-y-1.5">
              <h1 className="text-lg font-semibold text-white">Desktop only</h1>
              <p className="max-w-sm text-sm text-white/50">enowx is a desktop experience. Please open it on a computer with a larger screen.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
