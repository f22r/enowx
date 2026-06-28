// Cross-app signal: AccountsApp emits when a warmup starts/finishes so the
// Warmup Logs app can show a live "warming up" card and refresh immediately.
export interface WarmupEvent {
  type: "start" | "done";
  accountId: number;
  provider: string;
  label: string;
}

type Listener = (e: WarmupEvent) => void;
const listeners = new Set<Listener>();

export function emitWarmup(e: WarmupEvent) {
  listeners.forEach((l) => l(e));
}

export function onWarmup(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
