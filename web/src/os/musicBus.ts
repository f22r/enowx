import { useEffect, useState } from "react";
import { musicApi, type Track } from "../lib/api";

// Shared music player state. A single module-level <audio> element owns
// playback so it keeps playing when the user switches center views or opens
// other apps — React just reflects the store. Queue / current / volume persist
// to localStorage so the player survives a reload (see AGENTS.md persistence +
// "shared data stays in sync across views").

const LS = "enx.music";

export interface MusicState {
  queue: Track[];
  index: number; // -1 = nothing loaded
  playing: boolean;
  position: number; // seconds
  duration: number; // seconds
  volume: number; // 0..1
  loading: boolean;
  error: string;
}

interface Persisted {
  queue: Track[];
  index: number;
  volume: number;
}

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>;
      return {
        queue: Array.isArray(p.queue) ? p.queue : [],
        index: typeof p.index === "number" ? p.index : -1,
        volume: typeof p.volume === "number" ? p.volume : 1,
      };
    }
  } catch {
    // ignore
  }
  return { queue: [], index: -1, volume: 1 };
}

const persisted = loadPersisted();

let state: MusicState = {
  queue: persisted.queue,
  index: -1, // don't auto-resume playback; user re-plays the loaded track
  playing: false,
  position: 0,
  duration: 0,
  volume: persisted.volume,
  loading: false,
  error: "",
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function set(patch: Partial<MusicState>) {
  state = { ...state, ...patch };
  emit();
}
function savePersisted() {
  try {
    const p: Persisted = { queue: state.queue, index: state.index, volume: state.volume };
    localStorage.setItem(LS, JSON.stringify(p));
  } catch {
    // ignore
  }
}

// The one audio element. Created lazily so SSR/build never touches it.
let audio: HTMLAudioElement | null = null;
function getAudio(): HTMLAudioElement {
  if (audio) return audio;
  const a = new Audio();
  a.preload = "auto";
  a.volume = state.volume;
  a.addEventListener("timeupdate", () => set({ position: a.currentTime }));
  a.addEventListener("durationchange", () => set({ duration: isFinite(a.duration) ? a.duration : 0 }));
  a.addEventListener("loadedmetadata", () => set({ duration: isFinite(a.duration) ? a.duration : 0 }));
  a.addEventListener("playing", () => set({ playing: true, loading: false }));
  a.addEventListener("pause", () => set({ playing: false }));
  a.addEventListener("waiting", () => set({ loading: true }));
  a.addEventListener("canplay", () => set({ loading: false }));
  a.addEventListener("ended", () => next());
  a.addEventListener("error", () => set({ error: "playback failed", loading: false, playing: false }));
  audio = a;
  return a;
}

function loadIndex(i: number, autoplay: boolean) {
  const track = state.queue[i];
  if (!track) return;
  const a = getAudio();
  set({ index: i, error: "", position: 0, duration: 0, loading: true });
  savePersisted();
  a.src = musicApi.streamUrl(track.id);
  a.load();
  if (autoplay) {
    a.play().catch(() => set({ loading: false }));
  }
}

// ---- public actions ----

export function play(track: Track) {
  // If already in the queue, jump to it; otherwise append and play.
  const existing = state.queue.findIndex((t) => t.id === track.id);
  if (existing >= 0) {
    loadIndex(existing, true);
    return;
  }
  set({ queue: [...state.queue, track] });
  loadIndex(state.queue.length - 1, true);
}

export function playQueue(tracks: Track[], startAt = 0) {
  set({ queue: tracks });
  loadIndex(startAt, true);
}

export function enqueue(track: Track) {
  if (state.queue.some((t) => t.id === track.id)) return;
  set({ queue: [...state.queue, track] });
  savePersisted();
  if (state.index < 0) loadIndex(state.queue.length - 1, false);
}

export function removeFromQueue(id: string) {
  const i = state.queue.findIndex((t) => t.id === id);
  if (i < 0) return;
  const queue = state.queue.filter((t) => t.id !== id);
  let index = state.index;
  if (i < index) index -= 1;
  else if (i === index) index = Math.min(index, queue.length - 1);
  set({ queue, index });
  savePersisted();
}

export function clearQueue() {
  const a = getAudio();
  a.pause();
  a.removeAttribute("src");
  a.load();
  set({ queue: [], index: -1, playing: false, position: 0, duration: 0 });
  savePersisted();
}

export function toggle() {
  const a = getAudio();
  if (state.index < 0) {
    if (state.queue.length) loadIndex(0, true);
    return;
  }
  if (a.paused) a.play().catch(() => {});
  else a.pause();
}

export function next() {
  if (state.index + 1 < state.queue.length) loadIndex(state.index + 1, true);
  else set({ playing: false });
}

export function prev() {
  const a = getAudio();
  // Restart the track if we're more than 3s in; otherwise go to the previous.
  if (a.currentTime > 3 || state.index <= 0) {
    a.currentTime = 0;
    return;
  }
  loadIndex(state.index - 1, true);
}

export function seek(seconds: number) {
  const a = getAudio();
  a.currentTime = seconds;
  set({ position: seconds });
}

export function setVolume(v: number) {
  const vol = Math.max(0, Math.min(1, v));
  getAudio().volume = vol;
  set({ volume: vol });
  savePersisted();
}

export function getState(): MusicState {
  return state;
}

export function useMusic(): MusicState {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

export function currentTrack(): Track | null {
  return state.queue[state.index] ?? null;
}

export function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export { musicApi };
export type { Track };
