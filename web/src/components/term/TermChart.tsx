// Terminal-style chart primitives: monospace, green, block characters, ala btop.

const BLOCKS = ["", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

function blocksFor(value: number, max: number, height = 8): string[] {
  // Returns a stacked column of block chars filling `value/max` of `height` rows.
  const filled = max > 0 ? (value / max) * height : 0;
  const rows: string[] = [];
  for (let r = height; r >= 1; r--) {
    if (filled >= r) rows.push("█");
    else if (filled > r - 1) rows.push(BLOCKS[Math.round((filled - (r - 1)) * 8)]);
    else rows.push(" ");
  }
  return rows;
}

// TermBars renders a vertical block-bar chart (one column per value).
export function TermBars({
  values,
  height = 8,
  className = "text-emerald-400",
}: {
  values: number[];
  height?: number;
  className?: string;
}) {
  if (values.length === 0) {
    return <div className="font-mono text-[11px] text-emerald-400/30">no data</div>;
  }
  const max = Math.max(...values, 1);
  const cols = values.map((v) => blocksFor(v, max, height));

  // Render row by row so columns align.
  const rows: string[] = [];
  for (let r = 0; r < height; r++) {
    rows.push(cols.map((c) => c[r]).join(""));
  }
  return (
    <pre
      className={`overflow-hidden font-mono text-[10px] leading-[1.05] ${className}`}
      style={{ textShadow: "0 0 6px currentColor" }}
    >
      {rows.join("\n")}
    </pre>
  );
}

// TermGauge renders a horizontal [████░░░░] bar with a percent.
export function TermGauge({
  percent,
  width = 14,
  tone = "text-emerald-400",
  label,
}: {
  percent: number;
  width?: number;
  tone?: string;
  label?: string;
}) {
  const p = Math.max(0, Math.min(100, percent));
  const fill = Math.round((p / 100) * width);
  const bar = "█".repeat(fill) + "░".repeat(width - fill);
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      {label && <span className="w-16 shrink-0 text-white/50">{label}</span>}
      <span className={tone} style={{ textShadow: "0 0 6px currentColor" }}>
        [{bar}]
      </span>
      <span className="tabular-nums text-white/70">{p}%</span>
    </div>
  );
}

// TermBarRow renders a labeled horizontal bar (for shares/distributions).
export function TermBarRow({
  label,
  value,
  max,
  suffix,
  width = 16,
  tone = "text-emerald-400",
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  width?: number;
  tone?: string;
}) {
  const fill = max > 0 ? Math.round((value / max) * width) : 0;
  const bar = "█".repeat(fill) + "░".repeat(Math.max(0, width - fill));
  return (
    <div className="flex items-center gap-2 font-mono text-[11px]">
      <span className="w-24 shrink-0 truncate text-white/60">{label}</span>
      <span className={tone} style={{ textShadow: "0 0 6px currentColor" }}>
        {bar}
      </span>
      <span className="ml-auto shrink-0 tabular-nums text-white/50">{suffix ?? value}</span>
    </div>
  );
}
