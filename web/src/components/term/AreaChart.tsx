import { useId } from "react";

export interface ChartPoint {
  label: string; // x-axis label (time or date)
  value: number;
}

// AreaChart draws a Grafana-style area: bright green line, dark-green gradient
// fill, Y ticks, and X labels.
export function AreaChart({
  points,
  height = 220,
  unit = "",
}: {
  points: ChartPoint[];
  height?: number;
  unit?: string;
}) {
  const gid = useId();
  const W = 1000;
  const H = height;
  const padL = 38;
  const padB = 18;
  const padT = 8;
  const plotW = W - padL;
  const plotH = H - padB - padT;

  const values = points.map((p) => p.value);
  const max = niceMax(Math.max(...values, 1));

  const n = points.length;
  const x = (i: number) => padL + (n <= 1 ? plotW : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const area = n > 0 ? `${padL},${padT + plotH} ${line} ${x(n - 1)},${padT + plotH}` : "";

  const yTicks = 5;
  const xTicks = Math.min(6, Math.max(1, n - 1));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(34 197 94)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="rgb(34 197 94)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const gy = padT + (i / yTicks) * plotH;
        const val = Math.round(max * (1 - i / yTicks));
        return (
          <g key={`y${i}`}>
            <line x1={padL} y1={gy} x2={W} y2={gy} stroke="rgb(255 255 255 / 0.06)" strokeWidth="1" />
            <text x={padL - 4} y={gy + 3} textAnchor="end" className="fill-white/35" fontSize="9" fontFamily="monospace">
              {compactNum(val)}
            </text>
          </g>
        );
      })}

      {n > 1 &&
        Array.from({ length: xTicks + 1 }, (_, i) => {
          const idx = Math.round((i / xTicks) * (n - 1));
          const gx = x(idx);
          return (
            <g key={`x${i}`}>
              <line x1={gx} y1={padT} x2={gx} y2={padT + plotH} stroke="rgb(255 255 255 / 0.05)" strokeWidth="1" />
              <text x={gx} y={H - 5} textAnchor="middle" className="fill-white/30" fontSize="9" fontFamily="monospace">
                {points[idx]?.label ?? ""}
              </text>
            </g>
          );
        })}

      {area && <polygon points={area} fill={`url(#fill-${gid})`} />}
      {n > 1 && (
        <polyline
          points={line}
          fill="none"
          stroke="rgb(74 222 128)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          style={{ filter: "drop-shadow(0 0 3px rgb(74 222 128 / 0.7))" }}
        />
      )}
      {n === 1 && (
        <circle cx={x(0)} cy={y(values[0])} r="2.5" fill="rgb(74 222 128)" />
      )}

      {unit && (
        <text x={padL} y={padT + 2} className="fill-white/40" fontSize="9" fontFamily="monospace">
          ↑ {unit}
        </text>
      )}
    </svg>
  );
}

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
