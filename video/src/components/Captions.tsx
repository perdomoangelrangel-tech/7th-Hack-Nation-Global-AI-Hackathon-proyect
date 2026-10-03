import React from "react";
import { useCurrentFrame } from "remotion";
import { C, F, FPS } from "../theme";

/** One burned-in caption. Times are seconds from the start of the item it belongs to. */
export type Caption = { text: string; at?: number; until?: number; who?: string; whoColor?: string };

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Split a VO line into readable caption chunks (≤ ~12 words) and time them by word count. */
export function autoCaptions(vo: string, sec: number, start = 0.2, end = 0.25): Caption[] {
  const clean = vo.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?…])\s+/);
  const chunks: string[] = [];
  for (const s of sentences) {
    if (words(s) <= 13) {
      chunks.push(s);
      continue;
    }
    // split long sentences at commas/colons/semicolons, greedily up to ~11 words
    const parts = s.split(/(?<=[,:;])\s+/);
    let cur = "";
    for (const p of parts) {
      if (cur && words(cur) + words(p) > 11) {
        chunks.push(cur);
        cur = p;
      } else cur = cur ? `${cur} ${p}` : p;
    }
    if (cur) chunks.push(cur);
  }
  const total = chunks.reduce((a, c) => a + words(c), 0);
  const span = Math.max(0.5, sec - start - end);
  let t = start;
  return chunks.map((text) => {
    const d = (words(text) / total) * span;
    const cap = { text, at: t, until: t + d };
    t += d;
    return cap;
  });
}

/** Renders the active caption for the current (item-local) frame. */
export const Captions: React.FC<{ caps: Caption[]; bottom?: number }> = ({ caps, bottom = 30 }) => {
  const frame = useCurrentFrame();
  const s = frame / FPS;
  const cur = caps.find((c) => s >= (c.at ?? 0) && s < (c.until ?? Infinity));
  if (!cur) return null;
  const a = Math.min(1, (s - (cur.at ?? 0)) * 8, ((cur.until ?? 1e9) - s) * 8);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          maxWidth: 1600,
          background: "oklch(0.21 0.025 265 / 0.93)",
          color: C.onInk,
          borderRadius: 12,
          padding: "12px 28px 12px",
          fontFamily: F.body,
          fontWeight: 600,
          fontSize: 40,
          lineHeight: 1.25,
          textAlign: "center",
          opacity: a,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        {cur.who && (
          <span
            style={{
              fontFamily: F.mono,
              fontWeight: 700,
              fontSize: 24,
              color: C.ink,
              background: cur.whoColor ?? C.pheno,
              borderRadius: 6,
              padding: "4px 10px 2px",
              whiteSpace: "nowrap",
            }}
          >
            {cur.who}
          </span>
        )}
        <span>{cur.text}</span>
      </div>
    </div>
  );
};

/** Name / role lower third (team video). */
export const LowerThird: React.FC<{ name: string; role: string; color: string; at: number; until: number }> = ({ name, role, color, at, until }) => {
  const frame = useCurrentFrame();
  const s = frame / FPS;
  if (s < at || s > until) return null;
  const a = Math.min(1, (s - at) * 4, (until - s) * 4);
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        bottom: 170,
        display: "flex",
        alignItems: "stretch",
        opacity: a,
        transform: `translateX(${(1 - a) * -30}px)`,
      }}
    >
      <div style={{ width: 14, background: color, borderRadius: "8px 0 0 8px" }} />
      <div style={{ background: C.canvas, padding: "14px 26px 12px", borderRadius: "0 8px 8px 0", border: `2px solid ${C.rule}`, borderLeft: "none" }}>
        <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 48, letterSpacing: "-0.02em", color: C.ink, lineHeight: 1.05 }}>{name}</div>
        <div style={{ fontFamily: F.mono, fontSize: 24, color: C.ink2, marginTop: 6 }}>{role}</div>
      </div>
    </div>
  );
};
