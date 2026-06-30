import { useMemo, useState } from "react";
import { Search } from "lucide-react";

// A curated, dependency-free emoji set grouped by category, each with keywords
// for search. Not the full Unicode set — a practical, fast picker.
const EMOJI: { group: string; items: { e: string; k: string }[] }[] = [
  {
    group: "Smileys",
    items: [
      { e: "😀", k: "grin happy" }, { e: "😁", k: "grin happy" }, { e: "😂", k: "laugh cry joy" },
      { e: "🤣", k: "rofl laugh" }, { e: "😊", k: "smile blush" }, { e: "😍", k: "love heart eyes" },
      { e: "😎", k: "cool sunglasses" }, { e: "🤔", k: "think hmm" }, { e: "😅", k: "sweat nervous" },
      { e: "😭", k: "cry sad sob" }, { e: "😢", k: "cry sad tear" }, { e: "😡", k: "angry mad" },
      { e: "🥳", k: "party celebrate" }, { e: "😴", k: "sleep tired" }, { e: "🤯", k: "mind blown" },
      { e: "😳", k: "flushed shock" }, { e: "🥺", k: "pleading puppy" }, { e: "😏", k: "smirk" },
      { e: "🙃", k: "upside down silly" }, { e: "😬", k: "grimace awkward" },
    ],
  },
  {
    group: "Gestures",
    items: [
      { e: "👍", k: "thumbs up like yes" }, { e: "👎", k: "thumbs down no dislike" }, { e: "👏", k: "clap applause" },
      { e: "🙏", k: "pray thanks please" }, { e: "🤝", k: "handshake deal" }, { e: "💪", k: "muscle strong" },
      { e: "🫶", k: "heart hands love" }, { e: "👀", k: "eyes look watching" }, { e: "🤌", k: "pinch chef" },
      { e: "✌️", k: "peace victory" }, { e: "🤟", k: "love you rock" }, { e: "👋", k: "wave hi bye" },
    ],
  },
  {
    group: "Hearts & symbols",
    items: [
      { e: "❤️", k: "heart love red" }, { e: "🧡", k: "heart orange" }, { e: "💛", k: "heart yellow" },
      { e: "💚", k: "heart green" }, { e: "💙", k: "heart blue" }, { e: "💜", k: "heart purple" },
      { e: "🖤", k: "heart black" }, { e: "💔", k: "broken heart" }, { e: "✨", k: "sparkles shiny" },
      { e: "🔥", k: "fire lit hot" }, { e: "⭐", k: "star" }, { e: "🎉", k: "tada party celebrate" },
      { e: "💯", k: "hundred perfect" }, { e: "✅", k: "check yes done" }, { e: "❌", k: "cross no wrong" },
      { e: "💀", k: "skull dead lol" },
    ],
  },
  {
    group: "Objects & food",
    items: [
      { e: "🎶", k: "music notes" }, { e: "🚀", k: "rocket launch" }, { e: "💎", k: "gem diamond" },
      { e: "🏆", k: "trophy win" }, { e: "🎮", k: "game controller" }, { e: "☕", k: "coffee" },
      { e: "🍕", k: "pizza food" }, { e: "🍻", k: "beer cheers" }, { e: "🎁", k: "gift present" },
      { e: "💡", k: "idea light bulb" },
    ],
  },
];

// EmojiPicker shows a searchable, categorized grid. onPick fires with the emoji.
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return EMOJI;
    return EMOJI.map((g) => ({ group: g.group, items: g.items.filter((it) => it.k.includes(query) || it.e === query) })).filter(
      (g) => g.items.length > 0,
    );
  }, [q]);

  return (
    <div className="w-64 rounded-xl border border-white/10 bg-[#16181f] p-2 shadow-2xl">
      <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2">
        <Search className="h-3.5 w-3.5 text-white/30" />
        <input
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search emoji"
          className="w-full bg-transparent py-1.5 text-xs text-white outline-none placeholder:text-white/30"
        />
      </div>
      <div className="max-h-56 overflow-auto pr-0.5">
        {groups.map((g) => (
          <div key={g.group} className="mb-2">
            <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-white/30">{g.group}</div>
            <div className="grid grid-cols-8 gap-0.5">
              {g.items.map((it) => (
                <button
                  key={it.e}
                  onClick={() => onPick(it.e)}
                  title={it.k}
                  className="flex h-7 w-7 items-center justify-center rounded text-lg hover:bg-white/10"
                >
                  {it.e}
                </button>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && <div className="px-1 py-3 text-center text-[11px] text-white/40">No matches</div>}
      </div>
    </div>
  );
}
