import React, { useId } from "react";
import { C, F, S } from "../theme";
import { pathLength } from "../lib/route";

/** SVG route. `progress` 0..1 draws it from the start. Dashed = research gap / no evidence. */
export const Route: React.FC<{
  d: string;
  color: string;
  progress?: number;
  dashed?: boolean;
  width?: number;
  opacity?: number;
  dash?: string;
}> = ({ d, color, progress = 1, dashed = false, width = S.route, opacity = 1, dash }) => {
  const id = useId().replace(/:/g, "");
  const L = pathLength(d);
  if (progress <= 0) return null;
  if (!dashed) {
    return (
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${L} ${L}`}
        strokeDashoffset={L * (1 - progress)}
        opacity={opacity}
      />
    );
  }
  return (
    <g opacity={opacity}>
      <mask id={`m${id}`} maskUnits="userSpaceOnUse">
        <path
          d={d}
          fill="none"
          stroke="#fff"
          strokeWidth={width + 8}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${L} ${L}`}
          strokeDashoffset={L * (1 - progress)}
        />
      </mask>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width * 0.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash ?? `${width * 0.2} ${width * 1.5}`}
        mask={`url(#m${id})`}
      />
    </g>
  );
};

/** Round station marker. `hollow` = gap (dashed ring, no fill). `scale` animates the pop. */
export const Station: React.FC<{
  x: number;
  y: number;
  color: string;
  r?: number;
  scale?: number;
  hollow?: boolean;
  ring?: string;
  ringWidth?: number;
  opacity?: number;
}> = ({ x, y, color, r = S.station, scale = 1, hollow = false, ring = C.ink, ringWidth = S.ring, opacity = 1 }) => {
  if (scale <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <circle
        r={r}
        fill={hollow ? C.canvas : color}
        stroke={hollow ? C.gap : ring}
        strokeWidth={ringWidth}
        strokeDasharray={hollow ? `${r * 0.36} ${r * 0.28}` : undefined}
      />
    </g>
  );
};

/** Interchange pill (disease hub): white capsule, ink ring, name + mono code inside. */
export const HubPill: React.FC<{
  x: number;
  y: number;
  name: string;
  code: string;
  w?: number;
  h?: number;
  scale?: number;
  fontSize?: number;
}> = ({ x, y, name, code, w = 360, h = 104, scale = 1, fontSize = 36 }) => {
  if (scale <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        borderRadius: h / 2,
        background: C.canvas,
        border: `${S.ring + 2}px solid ${C.ink}`,
        transform: `scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        gap: 2,
      }}
    >
      <div style={{ fontFamily: F.display, fontWeight: 800, fontSize, letterSpacing: "-0.02em", color: C.ink, lineHeight: 1 }}>
        {name}
      </div>
      <div style={{ fontFamily: F.mono, fontSize: fontSize * 0.56, color: C.ink3, lineHeight: 1.2 }}>{code}</div>
    </div>
  );
};

/**
 * Plaque: station label in signage style. name + mono code + source.
 * Positioned by anchor point (station) and placement.
 */
export const Plaque: React.FC<{
  x: number;
  y: number;
  name: string;
  code?: string;
  source?: string;
  place?: "above" | "below" | "left" | "right";
  appear?: number;
  accent?: string;
  gap?: boolean;
  size?: number;
  maxWidth?: number;
  off?: number;
}> = ({ x, y, name, code, source, place = "below", appear = 1, accent, gap = false, size = 30, maxWidth = 520, off = 34 }) => {
  if (appear <= 0.001) return null;
  const style: React.CSSProperties = {
    position: "absolute",
    padding: "10px 16px 10px",
    background: C.canvas,
    border: gap ? `2.5px dashed ${C.gap}` : `2px solid ${C.rule}`,
    borderLeft: accent ? `8px solid ${accent}` : undefined,
    borderRadius: 8,
    maxWidth,
    whiteSpace: "nowrap",
    opacity: appear,
    boxSizing: "border-box",
  };
  const t = (1 - appear) * 14;
  if (place === "below") Object.assign(style, { left: x, top: y + off, transform: `translate(-50%, ${t}px)` });
  if (place === "above") Object.assign(style, { left: x, top: y - off, transform: `translate(-50%, calc(-100% - ${t}px))` });
  if (place === "right") Object.assign(style, { left: x + off, top: y, transform: `translate(${t}px, -50%)` });
  if (place === "left") Object.assign(style, { left: x - off, top: y, transform: `translate(calc(-100% - ${t}px), -50%)` });
  return (
    <div style={style}>
      <div
        style={{
          fontFamily: F.display,
          fontWeight: 750,
          fontSize: size,
          letterSpacing: "-0.015em",
          color: gap ? C.ink3 : C.ink,
          lineHeight: 1.1,
        }}
      >
        {name}
      </div>
      {(code || source) && (
        <div style={{ fontFamily: F.mono, fontSize: size * 0.6, color: C.ink3, marginTop: 4, lineHeight: 1.2 }}>
          {[code, source].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
};

/** Small ink signage label (top-left corner of a scene). */
export const Sign: React.FC<{ text: string; appear?: number; x?: number; y?: number }> = ({ text, appear = 1, x = 72, y = 64 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      background: C.ink,
      color: C.onInk,
      fontFamily: F.display,
      fontWeight: 800,
      fontSize: 30,
      letterSpacing: "-0.01em",
      padding: "8px 18px 6px",
      borderRadius: 8,
      opacity: appear,
      transform: `translateY(${(1 - appear) * -10}px)`,
    }}
  >
    {text}
  </div>
);

/** Source line in small type (every number on screen carries one). */
export const SourceNote: React.FC<{ text: string; style?: React.CSSProperties; appear?: number }> = ({ text, style, appear = 1 }) => (
  <div style={{ fontFamily: F.mono, fontSize: 20, color: C.ink3, letterSpacing: "0.01em", opacity: appear, ...style }}>
    {text}
  </div>
);

/** Voice waveform (bars) — deterministic, frame-driven. */
export const Waveform: React.FC<{ s: number; color: string; bars?: number; h?: number; active?: number }> = ({
  s,
  color,
  bars = 14,
  h = 56,
  active = 1,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, height: h }}>
    {Array.from({ length: bars }).map((_, i) => {
      const v = 0.25 + 0.75 * Math.abs(Math.sin(s * 7.3 + i * 1.7) * Math.cos(s * 3.1 + i * 0.6));
      return (
        <div
          key={i}
          style={{ width: 7, height: Math.max(6, h * (0.15 + 0.85 * v * active)), background: color, borderRadius: 4 }}
        />
      );
    })}
  </div>
);
