import { useEffect, useState } from "react";
import { keysApi, type ApiKey, type NewApiKey } from "../lib/api";

// Shared API-keys store: a single source of truth so every view (widget +
// ApiKeysApp) stays in sync. Mutations reload once and notify all subscribers.
let cache: ApiKey[] | null = null;
const listeners = new Set<(keys: ApiKey[] | null) => void>();

function emit() {
  listeners.forEach((l) => l(cache));
}

export async function reloadKeys() {
  try {
    cache = await keysApi.list();
  } catch {
    cache = cache ?? [];
  }
  emit();
}

export function useKeys() {
  const [keys, setKeys] = useState<ApiKey[] | null>(cache);

  useEffect(() => {
    listeners.add(setKeys);
    if (cache === null) reloadKeys();
    else setKeys(cache);
    return () => {
      listeners.delete(setKeys);
    };
  }, []);

  return {
    keys,
    reload: reloadKeys,
    add: async (k: NewApiKey) => {
      const res = await keysApi.add(k);
      await reloadKeys();
      return res;
    },
    remove: async (id: number) => {
      await keysApi.remove(id);
      await reloadKeys();
    },
  };
}
