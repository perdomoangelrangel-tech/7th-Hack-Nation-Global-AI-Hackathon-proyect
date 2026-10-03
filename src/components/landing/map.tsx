/**
 * Transit-map primitives for the landing SVGs: stations, interchange hubs and halo labels.
 * Colors are always CSS tokens (var(--l-*), var(--ink), var(--canvas)). Labels use a canvas-colored
 * halo (paint-order: stroke) so they stay legible where a route passes behind them.
 */
import type { ReactNode } from "react";

export function Station({ x, y, color, r = 9, gap = false }: { x: number; y: number; color?: string; r?: number; gap?: boolean }) {
  if (gap) {
    return <circle cx={x} cy={y} r={r} fill="var(--canvas)" stroke="var(--gap)" strokeWidth={2.5} strokeDasharray="3 3" />;
  }
  return <circle cx={x} cy={y} r={r} fill={color ?? "var(--canvas)"} stroke="var(--ink)" strokeWidth={2.5} />;
}

/** Interchange: hollow ring, heavier stroke. */
export function Hub({ x, y, r = 18 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="var(--canvas)" stroke="var(--ink)" strokeWidth={5} />
      <circle cx={x} cy={y} r={r * 0.32} fill="var(--ink)" />
    </g>
  );
}

/** Buffer stop: the end of a line that goes nowhere. */
export function BufferStop({ x, y, vertical = false }: { x: number; y: number; vertical?: boolean }) {
  return vertical ? (
    <path d={`M${x - 12} ${y} H${x + 12}`} stroke="var(--ink)" strokeWidth={5} strokeLinecap="round" />
  ) : (
    <path d={`M${x} ${y - 12} V${y + 12}`} stroke="var(--ink)" strokeWidth={5} strokeLinecap="round" />
  );
}

type Anchor = "start" | "middle" | "end";

/**
 * Station plaque drawn as SVG text: one or more name lines (display face) and an optional code line (mono).
 * `y` is the baseline of the first name line.
 */
export function Label({
  x,
  y,
  anchor = "start",
  lines,
  code,
  size = 15,
  codeSize = 12,
  halo = "var(--canvas)",
  muted = false,
}: {
  x: number;
  y: number;
  anchor?: Anchor;
  lines: readonly string[];
  code?: ReactNode;
  size?: number;
  codeSize?: number;
  halo?: string;
  muted?: boolean;
}) {
  const lh = Math.round(size * 1.18);
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      stroke={halo}
      strokeWidth={5}
      strokeLinejoin="round"
      style={{ paintOrder: "stroke" }}
    >
      {lines.map((l, i) => (
        <tspan
          key={i}
          x={x}
          dy={i === 0 ? 0 : lh}
          className="font-display"
          fontWeight={800}
          fontSize={size}
          fill={muted ? "var(--ink-3)" : "var(--ink)"}
        >
          {l}
        </tspan>
      ))}
      {code ? (
        <tspan x={x} dy={Math.round(codeSize * 1.45)} className="font-mono" fontSize={codeSize} fill="var(--ink-2)">
          {code}
        </tspan>
      ) : null}
    </text>
  );
}
