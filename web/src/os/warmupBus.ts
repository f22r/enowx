// Cross-app warmup state: AccountsApp marks accounts as warming so the Warmup
// Logs app can show a live "warming up" card — even if it is opened mid-warmup
// (the active set is module-level, not tied to a component's lifetime).
export interface ActiveWarmup {
  accountId: number;
  provider: string;
  label: string;
}

const active = new Map<number, ActiveWarmup>();
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function startWarmup(w: ActiveWarmup) {
  active.set(w.accountId, w);
  notify();
}

export function finishWarmup(accountId: number) {
  active.delete(accountId);
  notify();
}

export function activeWarmups(): ActiveWarmup[] {
  return [...active.values()];
}

// Subscribe to any change in the active warmup set. Returns an unsubscribe fn.
export function onWarmupChange(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
