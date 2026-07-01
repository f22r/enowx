import { useEffect, useState } from "react";
import { musicApi, type Playlist, type Track, type PlaylistExport } from "../lib/api";

// Shared playlists store: one source of truth so every view (MusicApp tabs,
// any future widget) stays in sync. Mutations reload once and notify all
// subscribers (see AGENTS.md "shared data stays in sync across views").
let cache: Playlist[] | null = null;
const listeners = new Set<(p: Playlist[] | null) => void>();

function emit() {
  listeners.forEach((l) => l(cache));
}

export async function reloadPlaylists() {
  try {
    cache = await musicApi.playlists();
  } catch {
    cache = cache ?? [];
  }
  emit();
}

// mergePlaylist adds a shared playlist to the user's library: if they already
// have a playlist with the same name, the tracks are merged into it (skipping
// duplicates); otherwise a new playlist is created. Returns {id, added}.
export async function mergePlaylist(name: string, tracks: Track[]): Promise<{ id: number; added: number }> {
  const lists = cache ?? (await musicApi.playlists().catch(() => [] as Playlist[]));
  let target = lists.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!target) {
    const { id } = await musicApi.createPlaylist(name);
    target = { id, name, description: "", share_code: "", count: 0, tracks: [], created_at: "" };
  }
  const have = new Set((target.tracks ?? []).map((t) => t.id));
  let added = 0;
  for (const t of tracks) {
    if (have.has(t.id)) continue;
    await musicApi.addTrack(target.id, t);
    have.add(t.id);
    added++;
  }
  await reloadPlaylists();
  return { id: target.id, added };
}

export function usedPlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[] | null>(cache);
  useEffect(() => {
    listeners.add(setPlaylists);
    if (cache === null) reloadPlaylists();
    else setPlaylists(cache);
    return () => {
      listeners.delete(setPlaylists);
    };
  }, []);

  return {
    playlists,
    reload: reloadPlaylists,
    create: async (name: string, description = "") => {
      const res = await musicApi.createPlaylist(name, description);
      await reloadPlaylists();
      return res;
    },
    remove: async (id: number) => {
      await musicApi.deletePlaylist(id);
      await reloadPlaylists();
    },
    addTrack: async (id: number, t: Track) => {
      await musicApi.addTrack(id, t);
      await reloadPlaylists();
    },
    removeTrack: async (id: number, videoId: string) => {
      await musicApi.removeTrack(id, videoId);
      await reloadPlaylists();
    },
    importPlaylist: async (data: PlaylistExport) => {
      const res = await musicApi.importPlaylist(data);
      await reloadPlaylists();
      return res;
    },
  };
}
