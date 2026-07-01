import { forwardRef, useRef, type ForwardedRef } from "react";
import { Fragment } from "react";

// MENTION_RE mirrors the server's mention pattern.
const MENTION_RE = /(@[A-Za-z0-9_.]{2,32})/g;

// MentionInput is a single-line text input that highlights @mentions in real
// time while typing. It layers a mirror div (with colored @tokens) behind a
// transparent input; the two stay in sync (same font/padding), so the caret and
// text sit exactly over the highlighted backdrop.
export const MentionInput = forwardRef(function MentionInput(
  {
    value,
    onChange,
    onKeyDown,
    onPaste,
    onScroll,
    placeholder,
    maxLength,
    className = "",
  }: {
    value: string;
    onChange: (v: string) => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    onPaste?: (e: React.ClipboardEvent) => void;
    onScroll?: () => void;
    placeholder?: string;
    maxLength?: number;
    className?: string;
  },
  ref: ForwardedRef<HTMLInputElement>,
) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Keep the backdrop scrolled with the input for long text.
  const syncScroll = (el: HTMLInputElement) => {
    if (backdropRef.current) backdropRef.current.scrollLeft = el.scrollLeft;
  };

  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  let k = 0;
  while ((m = MENTION_RE.exec(value)) !== null) {
    if (m.index > last) parts.push(<Fragment key={`t${k}`}>{value.slice(last, m.index)}</Fragment>);
    parts.push(<span key={`m${k}`} className="rounded bg-indigo-500/25 text-indigo-200">{m[0]}</span>);
    last = m.index + m[0].length;
    k++;
  }
  parts.push(<Fragment key="tail">{value.slice(last)}</Fragment>);

  return (
    <div className="relative w-full">
      {/* Highlight backdrop (same box model as the input). */}
      <div
        ref={backdropRef}
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre text-transparent ${className}`}
      >
        {parts}
      </div>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onScroll={(e) => { syncScroll(e.currentTarget); onScroll?.(); }}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`relative w-full bg-transparent ${className}`}
      />
    </div>
  );
});
