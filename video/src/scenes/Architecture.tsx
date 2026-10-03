import React, { useMemo } from "react";
import { C, F, H, W } from "../theme";
import { edgeFade, eInOut, popAt, prog, reachTime, SceneProps, useSceneTime } from "../lib/anim";
import { fractionAt, pointAt, Pt, roundedPath } from "../lib/route";
import { Panel } from "../components/Brand";
import { Route, Sign, Station, Waveform } from "../components/Map";

export const ARCH_NATURAL = 24;
export const ARCH_SFX = [
  { name: "station-chime", at: 0.2 },
  { name: "route-draw", at: 2.6 },
  { name: "clock-tick", at: 5.0 },
  { name: "station-chime", at: 7.4 },
  { name: "data-pulse", at: 9.0 },
  { name: "gate-verified", at: 14.0 },
  { name: "voice-on", at: 15.6 },
  { name: "data-pulse", at: 17.0 },
];

const SOURCES = [
  { name: "Orphanet", color: C.ink },
  { name: "HPO", color: C.pheno },
  { name: "Monarch", color: C.pheno },
  { name: "ClinVar", color: C.gene },
  { name: "ClinicalTrials.gov", color: C.trial },
  { name: "Open Targets", color: C.treat },
  { name: "PubMed", color: C.lit },
];
const SX = 330;
const ING_X = 760;
const HUB: Pt = [1040, 540];
const LINE_END = 1860;
const yk = (k: number) => 540 + (k - 3) * 100;
const yb = (k: number) => 540 + (k - 3) * 18;

const STOPS = [
  { x: 1250, label: "/api/tools/*", sub: "read-only graph queries", place: "above" as const, mono: true },
  { x: 1435, label: "LLM draft", sub: "JSON claims + evidence_ids", place: "below" as const },
  { x: 1605, label: "Verifier", sub: "deterministic", place: "above" as const },
  { x: 1765, label: "Voice", sub: "ElevenLabs agents", place: "below" as const },
];

const Label: React.FC<{ x: number; y: number; title: string; sub?: string; appear: number; place: "above" | "below"; mono?: boolean; w?: number }> = ({
  x,
  y,
  title,
  sub,
  appear,
  place,
  mono,
  w = 300,
}) => (
  <div
    style={{
      position: "absolute",
      left: x - w / 2,
      width: w,
      top: place === "below" ? y : undefined,
      bottom: place === "above" ? H - y : undefined,
      textAlign: "center",
      opacity: appear,
      transform: `translateY(${(1 - appear) * (place === "above" ? -10 : 10)}px)`,
    }}
  >
    <div style={{ fontFamily: mono ? F.mono : F.display, fontWeight: mono ? 700 : 800, fontSize: mono ? 27 : 32, color: C.ink, letterSpacing: mono ? 0 : "-0.015em" }}>
      {title}
    </div>
    {sub && <div style={{ fontFamily: F.mono, fontSize: 19, color: C.ink3, marginTop: 4, lineHeight: 1.25 }}>{sub}</div>}
  </div>
);

/** Sources → ingestion → evidence graph → tools → LLM draft → verifier → voice, as one transit line. */
export const Architecture: React.FC<SceneProps> = ({ dur }) => {
  const s = useSceneTime(ARCH_NATURAL, dur);
  const bundles = useMemo(
    () =>
      SOURCES.map((src, k) => {
        const y = yk(k);
        const b = yb(k);
        const dx = Math.abs(y - b);
        const pts: Pt[] = [[SX, y], [420, y], [420 + dx, b], [HUB[0], b]];
        const d = k === 3 ? `M ${SX} ${y} L ${HUB[0]} ${b}` : roundedPath(pts, 40);
        return { ...src, k, d, y, ingF: fractionAt(d, [ING_X, b]) };
      }),
    [],
  );
  const mainD = `M ${HUB[0]} ${HUB[1]} L ${LINE_END} ${HUB[1]}`;

  const bundleP = prog(s, 2.6, 7.4, eInOut);
  const ingT = reachTime(2.6, 7.4, bundles[3].ingF);
  const mainP = prog(s, 9.0, 16.0, (x) => x);
  const stopT = STOPS.map((st) => 9.0 + 7.0 * ((st.x - HUB[0]) / (LINE_END - HUB[0])));
  const hubPop = popAt(s, 7.3, 0.5);
  const json = "{ claim, evidence_ids: [\"HP:0002373\"] }";
  const typed = Math.round(prog(s, stopT[1] + 0.2, stopT[1] + 1.5, (x) => x) * json.length);

  // pulses (data flowing) after the build
  const pulses: { x: number; y: number; c: string }[] = [];
  for (let rep = 0; rep < 3; rep++) {
    const t0 = 17 + rep * 2.2;
    const pin = prog(s, t0, t0 + 1.0, eInOut);
    const pout = prog(s, t0 + 1.0, t0 + 2.0, eInOut);
    if (pin > 0 && pin < 1) {
      for (const b of bundles) {
        const pt = pointAt(b.d, pin);
        pulses.push({ x: pt.x, y: pt.y, c: b.color });
      }
    }
    if (pout > 0 && pout < 1) pulses.push({ x: HUB[0] + (LINE_END - HUB[0]) * pout, y: HUB[1], c: C.ink });
  }

  const cronAngle = prog(s, 5.0, 8.0, (x) => x) * 720;

  return (
    <Panel fade={edgeFade(s, ARCH_NATURAL)}>
      <Sign text="Architecture" appear={prog(s, 0, 0.5)} />
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        {bundles.map((b) => (
          <Route key={b.k} d={b.d} color={b.color} progress={bundleP} width={11} />
        ))}
        <Route d={mainD} color={C.ink} progress={mainP} width={16} />
        {bundles.map((b) => (
          <Station key={b.k} x={SX} y={b.y} color={b.color} r={16} scale={popAt(s, 0.2 + b.k * 0.3)} />
        ))}
        {/* ingest interchange (vertical pill across the bundle) */}
        <g transform={`translate(${ING_X} 540) scale(${popAt(s, ingT - 0.1, 0.45)})`}>
          <rect x={-30} y={-90} width={60} height={180} rx={30} fill={C.canvas} stroke={C.ink} strokeWidth={7} />
        </g>
        {/* graph hub */}
        <g transform={`translate(${HUB[0]} ${HUB[1]}) scale(${hubPop})`}>
          <circle r={96} fill={C.canvas} stroke={C.ink} strokeWidth={9} />
          <line x1={-40} y1={22} x2={0} y2={-30} stroke={C.ink} strokeWidth={6} />
          <line x1={0} y1={-30} x2={42} y2={20} stroke={C.ink} strokeWidth={6} />
          <line x1={-40} y1={22} x2={42} y2={20} stroke={C.gap} strokeWidth={5} strokeDasharray="2 9" strokeLinecap="round" />
          <circle cx={-40} cy={22} r={15} fill={C.gene} stroke={C.ink} strokeWidth={5} />
          <circle cx={0} cy={-30} r={15} fill={C.pheno} stroke={C.ink} strokeWidth={5} />
          <circle cx={42} cy={20} r={15} fill={C.treat} stroke={C.ink} strokeWidth={5} />
        </g>
        {/* stops on the answer line */}
        {STOPS.map((st, i) =>
          i === 2 ? (
            <g key={i} transform={`translate(${st.x} ${HUB[1]}) scale(${popAt(s, stopT[i])})`}>
              <rect x={-36} y={-44} width={20} height={88} rx={8} fill={C.ink} />
              <rect x={16} y={-44} width={20} height={88} rx={8} fill={C.ink} />
              <circle cx={0} cy={-70} r={14} fill={C.treat} stroke={C.ink} strokeWidth={5} />
            </g>
          ) : (
            <Station key={i} x={st.x} y={HUB[1]} color={i === 3 ? C.treat : i === 1 ? C.lit : C.canvas} r={20} scale={popAt(s, stopT[i])} />
          ),
        )}
        {pulses.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={9} fill={C.canvas} stroke={p.c} strokeWidth={5} />
        ))}
      </svg>

      {/* source labels */}
      {bundles.map((b) => (
        <div
          key={b.k}
          style={{
            position: "absolute",
            right: W - SX + 34,
            top: b.y,
            transform: "translateY(-50%)",
            fontFamily: F.display,
            fontWeight: 750,
            fontSize: 29,
            color: C.ink,
            whiteSpace: "nowrap",
            opacity: prog(s, 0.3 + b.k * 0.3, 0.8 + b.k * 0.3),
          }}
        >
          {b.name}
        </div>
      ))}

      <Label x={ING_X} y={430} place="above" title="Ingest" appear={prog(s, ingT, ingT + 0.5)} w={260} />
      <div
        style={{
          position: "absolute",
          left: ING_X - 150,
          width: 300,
          top: 650,
          textAlign: "center",
          opacity: prog(s, ingT + 0.3, ingT + 0.8),
        }}
      >
        <svg width={44} height={44} viewBox="-22 -22 44 44">
          <circle r={18} fill={C.canvas} stroke={C.ink} strokeWidth={4} />
          <line x1={0} y1={0} x2={0} y2={-12} stroke={C.ink} strokeWidth={4} strokeLinecap="round" transform={`rotate(${cronAngle})`} />
          <line x1={0} y1={0} x2={8} y2={0} stroke={C.ink} strokeWidth={4} strokeLinecap="round" transform={`rotate(${cronAngle / 12})`} />
        </svg>
        <div style={{ fontFamily: F.mono, fontSize: 19, color: C.ink3, marginTop: 6, lineHeight: 1.3 }}>
          Supabase Edge Function
          <br />
          pg_cron · daily
        </div>
      </div>

      <Label x={HUB[0]} y={420} place="above" title="Evidence graph" sub="Postgres" appear={prog(s, 7.6, 8.1)} w={360} />
      <div
        style={{
          position: "absolute",
          left: HUB[0] + 20,
          top: 790,
          transform: `translateX(-50%) translateY(${(1 - prog(s, 8.0, 8.5)) * 10}px)`,
          textAlign: "center",
          opacity: prog(s, 8.0, 8.5),
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ fontFamily: F.mono, fontSize: 20, color: C.ink3 }}>entities · edges · evidence</div>
        <div
          style={{
            marginTop: 12,
            display: "inline-block",
            background: C.ink,
            color: C.onInk,
            fontFamily: F.mono,
            fontSize: 20,
            padding: "7px 14px 5px",
            borderRadius: 6,
          }}
        >
          trigger: no edge without evidence
        </div>
      </div>

      {STOPS.map((st, i) => (
        <Label
          key={i}
          x={st.x}
          y={st.place === "above" ? HUB[1] - (i === 2 ? 100 : 40) : HUB[1] + 40}
          place={st.place}
          title={st.label}
          sub={st.sub}
          mono={st.mono}
          appear={prog(s, stopT[i] + 0.1, stopT[i] + 0.6)}
          w={250}
        />
      ))}

      {/* drafted JSON above the LLM stop */}
      <div
        style={{
          position: "absolute",
          left: STOPS[1].x,
          top: 300,
          transform: "translateX(-50%)",
          background: C.ink,
          color: C.onInk,
          fontFamily: F.mono,
          fontSize: 21,
          padding: "12px 18px 10px",
          borderRadius: 8,
          whiteSpace: "pre",
          opacity: prog(s, stopT[1] + 0.2, stopT[1] + 0.4),
        }}
      >
        {json.slice(0, typed)}
        <span style={{ opacity: Math.floor(s * 3) % 2 ? 1 : 0 }}>▍</span>
      </div>

      {/* voice waveform at the end of the line */}
      <div
        style={{
          position: "absolute",
          left: STOPS[3].x - 40,
          top: HUB[1] - 150,
          opacity: prog(s, stopT[3] + 0.2, stopT[3] + 0.6),
        }}
      >
        <Waveform s={s} color={C.treat} bars={8} h={60} active={prog(s, stopT[3] + 0.3, stopT[3] + 0.8)} />
      </div>
    </Panel>
  );
};
