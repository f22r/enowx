import { useState } from "react";
import { Loader2, Check, Plus, X, Pencil } from "lucide-react";
import { Tooltip } from "../components/Tooltip";
import { useProfile } from "../os/useProfile";
import type { ProfileLink } from "../lib/api";

// Field limits mirror the server (it re-validates; this is just nicer UX).
const MAX_DISPLAY = 32;
const MAX_BIO = 190;
const MAX_LINKS = 5;

// ProfileEditor lets the signed-in user edit their profile (display name, bio,
// accent color, links). The server validates + sanitizes on save.
export function ProfileEditor() {
  const profile = useProfile();
  const u = profile.user;
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(u?.display_name ?? "");
  const [bio, setBio] = useState(u?.bio ?? "");
  const [accent, setAccent] = useState(u?.accent_color || "#6366f1");
  const [links, setLinks] = useState<ProfileLink[]>(u?.links ?? []);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!u) return null;

  function addLink() {
    if (links.length >= MAX_LINKS) return;
    setLinks([...links, { label: "", url: "" }]);
  }
  function setLink(i: number, patch: Partial<ProfileLink>) {
    setLinks(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }
  function removeLink(i: number) {
    setLinks(links.filter((_, j) => j !== i));
  }

  async function save() {
    setError("");
    setBusy(true);
    try {
      await profile.saveProfile({
        display_name: displayName.trim(),
        bio: bio.trim(),
        accent_color: accent,
        // Drop blank rows; the server keeps only valid http(s) links.
        links: links.filter((l) => l.url.trim()),
      });
      setDone(true);
      setTimeout(() => setDone(false), 1500);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "couldn't save");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white"
      >
        <Pencil className="h-3.5 w-3.5" /> Edit profile
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}

      <Field label="Display name" hint={`${displayName.length}/${MAX_DISPLAY}`}>
        <input
          value={displayName}
          maxLength={MAX_DISPLAY}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={u.username}
          className="w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25"
        />
      </Field>

      <Field label="Bio" hint={`${bio.length}/${MAX_BIO}`}>
        <textarea
          value={bio}
          maxLength={MAX_BIO}
          rows={2}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A short line about you"
          className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/25"
        />
      </Field>

      <Field label="Accent color">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-7 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
          />
          <span className="font-mono text-[11px] text-white/50">{accent}</span>
        </div>
      </Field>

      <Field label="Links" hint={`${links.length}/${MAX_LINKS}`}>
        <div className="space-y-1.5">
          {links.map((l, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={l.label}
                onChange={(e) => setLink(i, { label: e.target.value })}
                placeholder="Label"
                className="w-24 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white outline-none focus:border-white/25"
              />
              <input
                value={l.url}
                onChange={(e) => setLink(i, { url: e.target.value })}
                placeholder="https://…"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white outline-none focus:border-white/25"
              />
              <button onClick={() => removeLink(i)} className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {links.length < MAX_LINKS && (
            <button onClick={addLink} className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white">
              <Plus className="h-3 w-3" /> Add link
            </button>
          )}
        </div>
      </Field>

      <div className="flex items-center gap-2 pt-1">
        <Tooltip label="Save your profile" place="bottom">
          <button
            onClick={save}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : null}
            Save
          </button>
        </Tooltip>
        <button onClick={() => setOpen(false)} disabled={busy} className="rounded-lg px-3 py-1.5 text-xs text-white/50 hover:text-white disabled:opacity-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium text-white/50">{label}</span>
        {hint && <span className="text-[10px] text-white/30">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
