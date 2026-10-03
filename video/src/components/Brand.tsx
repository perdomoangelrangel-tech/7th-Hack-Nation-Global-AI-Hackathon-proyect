import React from "react";
import { AbsoluteFill } from "remotion";
import { C, F, H, W } from "../theme";
import { mix, prog } from "../lib/anim";
import { roundedPath } from "../lib/route";
import { Route } from "./Map";

/**
 * Nedamex mark (replica of src/components/brand/Logo.tsx): the N drawn as a route with four
 * stations; the last one is hollow and dashed — a gap we refuse to fill with guesses.
 * `draw` (0..1) animates the route; stations pop as the route reaches them.
 */
export const backOut = (t: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return t <= 0 ? 0 : t >= 1 ? 1 : 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** t in [0, 1.3]: 0..1 draws the N, stations pop as it passes them (the hollow one last). */
export const LogoMark: React.FC<{ size?: number; t?: number }> = ({ size = 48, t = 1.3 }) => {
  const draw = Math.min(1, Math.max(0, t));
  const d = "M12 37 V11 L37 36 V11";
  // cumulative fractions along the N: 0, 26/86.36, 61.36/86.36, 1
  const stops = [
    { x: 12, y: 37, f: 0, fill: C.gene },
    { x: 12, y: 11, f: 0.301, fill: C.pheno },
    { x: 37, y: 36, f: 0.71, fill: C.treat },
    { x: 37, y: 11, f: 0.995, fill: "hollow" },
  ];
  const L = 86.36;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ overflow: "visible" }}>
      <path
        d={d}
        fill="none"
        stroke={C.ink}
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${L} ${L}`}
        strokeDashoffset={L * (1 - draw)}
      />
      {stops.map((st, i) => {
        const sc = backOut(Math.min(1, Math.max(0, (t - st.f) / 0.28)));
        if (sc <= 0) return null;
        return (
          <g key={i} transform={`translate(${st.x} ${st.y}) scale(${sc})`}>
            <circle
              r={5}
              fill={st.fill === "hollow" ? C.canvas : st.fill}
              stroke={C.ink}
              strokeWidth={2.5}
              strokeDasharray={st.fill === "hollow" ? "3 2.4" : undefined}
            />
          </g>
        );
      })}
    </svg>
  );
};

export const Wordmark: React.FC<{ size?: number; color?: string }> = ({ size = 120, color = C.ink }) => (
  <span
    style={{
      fontFamily: F.display,
      fontWeight: 800,
      fontSize: size,
      letterSpacing: "-0.035em",
      lineHeight: 1,
      color,
      textTransform: "lowercase",
    }}
  >
    nedamex
  </span>
);

/**
 * Faint transit lines across the panel (map texture). Drawn in with `p` (0..1).
 */
export const MapBackdrop: React.FC<{ p?: number; opacity?: number }> = ({ p = 1, opacity = 0.14 }) => {
  const lines: { pts: [number, number][]; c: string; dashed?: boolean }[] = [
    { pts: [[-80, 200], [420, 200], [700, 480], [1260, 480], [1460, 280], [2000, 280]], c: C.gene },
    { pts: [[-80, 880], [360, 880], [640, 600], [1180, 600], [1500, 920], [2000, 920]], c: C.treat },
    { pts: [[260, -60], [260, 300], [520, 560], [520, 1140]], c: C.pheno },
    { pts: [[1660, -60], [1660, 380], [1400, 640], [1400, 1140]], c: C.trial },
    { pts: [[-80, 540], [180, 540], [420, 780], [960, 780], [1220, 1040], [1300, 1140]], c: C.comm },
    { pts: [[1040, -60], [1040, 120], [1240, 120], [1500, -60]], c: C.lit },
    { pts: [[1700, 1140], [1860, 980], [2000, 980]], c: C.gap, dashed: true },
  ];
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }} viewBox={`0 0 ${W} ${H}`}>
      {lines.map((l, i) => (
        <Route
          key={i}
          d={roundedPath(l.pts, 60)}
          color={l.c}
          dashed={l.dashed}
          width={16}
          progress={prog(p, i * 0.06, 0.6 + i * 0.06)}
          opacity={opacity}
        />
      ))}
    </svg>
  );
};

/** Scene background + global fade envelope. */
export const Panel: React.FC<{ children: React.ReactNode; fade?: number; style?: React.CSSProperties }> = ({ children, fade = 1, style }) => (
  <AbsoluteFill style={{ background: C.canvas, overflow: "hidden" }}>
    <AbsoluteFill style={{ opacity: fade, ...style }}>{children}</AbsoluteFill>
  </AbsoluteFill>
);

export { mix };
