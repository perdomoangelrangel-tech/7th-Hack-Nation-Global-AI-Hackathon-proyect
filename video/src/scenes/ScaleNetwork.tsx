import React from "react";
import { random } from "remotion";
import { C, F, H, W } from "../theme";
import { edgeFade, eInOut, mix, popAt, prog, SceneProps, useSceneTime } from "../lib/anim";
import { roundedPath } from "../lib/route";
import { Panel } from "../components/Brand";
import { HubPill, Route, SourceNote, Station } from "../components/Map";

export const SCALE_NATURAL = 10;
export const SCALE_SFX = [
  { name: "station-chime", at: 0.3 },
  { name: "zoom-swell", at: 2.8 },
];

const CX = 960;
const CY = 540;
const G = 160; // world grid
const END_SCALE = 0.085;
const BANDS = 12;
const COLORS = [C.gene, C.pheno, C.treat, C.trial, C.comm, C.lit];

type Net = { lines: { band: number; color: number; d: string }[]; dots: { band: number; color: number; d: string }[]; gaps: { band: number; d: string }[] };

const NET: Net = (() => {
  const nx = Math.ceil(W / END_SCALE / G / 2) + 1;
  const ny = Math.ceil(H / END_SCALE / G / 2) + 1;
  const maxR = Math.hypot(nx, ny);
  const kept = new Map<string, number>(); // key -> color idx
  const key = (i: number, j: number) => `${i},${j}`;
  const inHole = (i: number, j: number) => Math.abs(i * G) < 820 && Math.abs(j * G) < 330;
  for (let i = -nx; i <= nx; i++)
    for (let j = -ny; j <= ny; j++) {
      if (inHole(i, j)) continue;
      if (random(`k${i}:${j}`) < 0.5) kept.set(key(i, j), Math.floor(random(`c${i}:${j}`) * COLORS.length));
    }
  const lineBuf = new Map<string, string[]>();
  const dotBuf = new Map<string, string[]>();
  const gapBuf = new Map<number, string[]>();
  const bandOf = (i: number, j: number) => Math.min(BANDS - 1, Math.floor((Math.hypot(i, j * 1.6) / (maxR * 1.05)) * BANDS));
  const push = (m: Map<string, string[]>, k: string, v: string) => {
    const a = m.get(k);
    if (a) a.push(v);
    else m.set(k, [v]);
  };
  for (const [k, c] of kept) {
    const [i, j] = k.split(",").map(Number);
    const x = CX + i * G;
    const y = CY + j * G;
    const band = bandOf(i, j);
    const nbrs: [number, number, number][] = [
      [i + 1, j, 0.7],
      [i, j + 1, 0.3],
      [i + 1, j + 1, 0.16],
      [i + 1, j - 1, 0.16],
    ];
    let first = -1;
    for (const [a, b, pr] of nbrs) {
      if (!kept.has(key(a, b))) continue;
      if (random(`e${i}:${j}:${a}:${b}`) > pr) continue;
      const seg = `M${x} ${y}L${CX + a * G} ${CY + b * G}`;
      if (random(`g${i}:${j}:${a}:${b}`) < 0.06) {
        const arr = gapBuf.get(band) ?? [];
        arr.push(seg);
        gapBuf.set(band, arr);
        continue;
      }
      const col = random(`ec${i}:${j}:${a}:${b}`) < 0.7 ? c : Math.floor(random(`ed${i}:${j}`) * COLORS.length);
      if (first < 0) first = col;
      push(lineBuf, `${band}|${col}`, seg);
    }
    const r = 26;
    push(dotBuf, `${band}|${first < 0 ? c : first}`, `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`);
  }
  const split = (m: Map<string, string[]>) =>
    [...m.entries()].map(([k, v]) => {
      const [band, color] = k.split("|").map(Number);
      return { band, color, d: v.join("") };
    });
  return {
    lines: split(lineBuf),
    dots: split(dotBuf),
    gaps: [...gapBuf.entries()].map(([band, v]) => ({ band, d: v.join("") })),
  };
})();

const DISEASES = [
  { name: "Dravet", code: "ORPHA:33069", x: 700, y: 430 },
  { name: "Rett", code: "ORPHA:778", x: 1220, y: 430 },
  { name: "CDKL5", code: "ORPHA:505652", x: 470, y: 650 },
  { name: "Angelman", code: "ORPHA:72", x: 960, y: 650 },
  { name: "CLN2", code: "ORPHA:228349", x: 1450, y: 650 },
];

const fmt = (n: number) => n.toLocaleString("en-US");

/** 5 demo diseases → zoom out → 5,000+ monogenic diseases with the same ingestion. */
export const ScaleNetwork: React.FC<SceneProps & { tech?: boolean }> = ({ dur, tech = false }) => {
  const s = useSceneTime(SCALE_NATURAL, dur);
  const z = prog(s, 2.8, 7.6, eInOut);
  const scale = Math.exp(mix(z, 0, Math.log(END_SCALE)));
  const reveal = prog(s, 2.9, 7.4, (x) => x) * BANDS;
  const count = s < 2.8 ? 5 : Math.round(mix(prog(s, 2.8, 7.6, eInOut), 5, 5000));
  const bandA = (b: number) => Math.min(1, Math.max(0, reveal - b));
  const clusterLines = [
    { d: roundedPath([[470, 650], [690, 430], [1240, 430], [1460, 650]], 60), c: C.comm },
    { d: "M 470 650 L 1450 650", c: C.trial },
    { d: roundedPath([[700, 430], [700, 300], [1220, 300], [1220, 430]], 50), c: C.gene },
  ];

  return (
    <Panel fade={edgeFade(s, SCALE_NATURAL)}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${scale})`, transformOrigin: `${CX}px ${CY}px` }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {NET.lines.map((l, i) => (
            <path key={`l${i}`} d={l.d} stroke={COLORS[l.color]} strokeWidth={30} strokeLinecap="round" fill="none" opacity={bandA(l.band)} />
          ))}
          {NET.gaps.map((g, i) => (
            <path key={`g${i}`} d={g.d} stroke={C.gap} strokeWidth={22} strokeLinecap="round" strokeDasharray="4 40" fill="none" opacity={bandA(g.band)} />
          ))}
          {NET.dots.map((dt, i) => (
            <path key={`d${i}`} d={dt.d} fill={COLORS[dt.color]} stroke={C.ink} strokeWidth={10} opacity={bandA(dt.band)} />
          ))}
          {clusterLines.map((l, i) => (
            <Route key={i} d={l.d} color={l.c} progress={prog(s, 0.3 + i * 0.3, 1.6 + i * 0.3, eInOut)} width={16} />
          ))}
          {[700, 1220].map((x, i) => (
            <Station key={i} x={x} y={300} color={C.gene} scale={popAt(s, 1.5 + i * 0.2)} r={16} />
          ))}
        </svg>
        {DISEASES.map((d, i) => (
          <HubPill key={d.name} x={d.x} y={d.y} name={d.name} code={d.code} w={250} h={86} fontSize={30} scale={popAt(s, 0.15 + i * 0.15, 0.45)} />
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 72,
          top: 60,
          background: C.canvas,
          border: `2px solid ${C.rule}`,
          borderRadius: 14,
          padding: "22px 34px 22px",
          opacity: prog(s, 0.4, 0.9),
        }}
      >
        <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 120, lineHeight: 1, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
          {fmt(count)}
          {s >= 7.6 ? "+" : ""}
        </div>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 38, color: C.ink2, marginTop: 10 }}>
          {s < 2.8 ? "demo diseases" : "monogenic diseases"}
        </div>
        <SourceNote text="Orphadata classification" appear={prog(s, 7.6, 8.2)} style={{ marginTop: 8 }} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 72,
          bottom: 64,
          background: C.ink,
          color: C.onInk,
          fontFamily: F.display,
          fontWeight: 900,
          fontSize: 64,
          letterSpacing: "-0.03em",
          padding: "16px 32px 10px",
          borderRadius: 12,
          opacity: prog(s, 7.8, 8.4),
          transform: `translateY(${(1 - prog(s, 7.8, 8.4)) * 16}px)`,
        }}
      >
        Same ingestion.
      </div>

      {/* "you are here": the 5 demo diseases inside the big network */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, opacity: prog(s, 7.4, 8.0) }}>
        <circle cx={CX} cy={CY} r={mix(prog(s, 7.4, 8.2), 140, 96)} fill="none" stroke={C.ink} strokeWidth={5} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: CX + 110,
          top: CY - 130,
          background: C.ink,
          color: C.onInk,
          fontFamily: F.mono,
          fontWeight: 700,
          fontSize: 24,
          padding: "6px 12px 4px",
          borderRadius: 6,
          opacity: prog(s, 7.8, 8.3),
        }}
      >
        5 today
      </div>

      {tech && (
        <div style={{ position: "absolute", right: 72, bottom: 64, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
          {["Postgres → ~10M edges", "queued ingestion · SKIP LOCKED", "multi-tenant · RLS"].map((t, i) => (
            <div
              key={t}
              style={{
                background: C.canvas,
                border: `2px solid ${C.ink}`,
                borderRadius: 8,
                fontFamily: F.mono,
                fontSize: 26,
                color: C.ink,
                padding: "8px 16px 6px",
                opacity: prog(s, 8.0 + i * 0.3, 8.5 + i * 0.3),
              }}
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
};
