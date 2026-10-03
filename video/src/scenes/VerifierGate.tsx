import React from "react";
import { C, F } from "../theme";
import { edgeFade, eIn, eInOut, mix, prog, SceneProps, useSceneTime } from "../lib/anim";
import { Panel } from "../components/Brand";

export const GATE_NATURAL = 10;
export const GATE_SFX = [
  { name: "gate-verified", at: 1.6 },
  { name: "gate-verified", at: 3.0 },
  { name: "no-evidence", at: 4.5 },
  { name: "claim-drop", at: 4.9 },
  { name: "gate-verified", at: 6.1 },
];

const TRACK_Y = 720;
const GATE_X = 1000;
const SLOT_X = 1340;
const SLOTS = [200, 300, 400, 500];

type Claim = { text: string; chip: string; ok: boolean; color: string; t: number; slot: number };
const CLAIMS: Claim[] = [
  { text: "SCN1A causes Dravet", chip: "HGNC:10585", ok: true, color: C.gene, t: 0.5, slot: 0 },
  { text: "Febrile seizures", chip: "HP:0002373", ok: true, color: C.pheno, t: 1.9, slot: 1 },
  { text: "A diet cures it", chip: "evidence_id: none", ok: false, color: C.gap, t: 3.3, slot: 2 },
  { text: "Stiripentol", chip: "Open Targets", ok: true, color: C.treat, t: 5.0, slot: 3 },
];

const Card: React.FC<{ c: Claim; dashed?: boolean; style?: React.CSSProperties }> = ({ c, dashed, style }) => (
  <div
    style={{
      position: "absolute",
      width: 440,
      height: 84,
      boxSizing: "border-box",
      background: C.canvas,
      border: dashed ? `3px dashed ${C.gap}` : `2px solid ${C.rule}`,
      borderLeft: dashed ? `3px dashed ${C.gap}` : `10px solid ${c.color}`,
      borderRadius: 10,
      padding: "10px 18px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      ...style,
    }}
  >
    <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 30, color: dashed ? C.ink3 : C.ink, lineHeight: 1.05 }}>{c.text}</div>
    <div style={{ fontFamily: F.mono, fontSize: 19, color: c.ok ? C.tTreat : C.ink3, marginTop: 5 }}>
      {c.ok ? "✓ " : "∅ "}
      {c.chip}
    </div>
  </div>
);

/** Claims ride to a fare gate. With an evidence_id they pass; without one they drop. */
export const VerifierGate: React.FC<SceneProps> = ({ dur }) => {
  const s = useSceneTime(GATE_NATURAL, dur);

  // gate lamp + barrier state
  let lamp: string = C.canvas;
  let lampDashed = false;
  let arm = 0;
  for (const c of CLAIMS) {
    const at = c.t + 1.0;
    if (s >= at && s < at + 0.9) {
      lamp = c.ok ? C.treat : C.canvas;
      lampDashed = !c.ok;
    }
    if (c.ok) arm = Math.max(arm, prog(s, at + 0.05, at + 0.3) * (1 - prog(s, at + 0.8, at + 1.1)));
  }

  const head = prog(s, 0.1, 0.6);
  const noEv = prog(s, 5.3, 5.8);

  return (
    <Panel fade={edgeFade(s, GATE_NATURAL)}>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 120,
          fontFamily: F.display,
          fontWeight: 900,
          fontSize: 96,
          letterSpacing: "-0.035em",
          lineHeight: 0.95,
          color: C.ink,
          opacity: head,
          transform: `translateY(${(1 - head) * 20}px)`,
        }}
      >
        No source,
        <br />
        no station.
      </div>

      {/* track */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={-20} y1={TRACK_Y} x2={GATE_X + 120} y2={TRACK_Y} stroke={C.rule} strokeWidth={16} strokeLinecap="round" />
      </svg>

      {/* claims */}
      {CLAIMS.map((c, i) => {
        const approach = prog(s, c.t, c.t + 1.0, eInOut);
        if (approach <= 0) return null;
        const x0 = mix(approach, -480, GATE_X - 66 - 440);
        const after = prog(s, c.t + 1.25, c.t + 2.0, eInOut);
        if (c.ok) {
          const x = mix(after, x0, SLOT_X);
          const y = mix(after, TRACK_Y - 42, SLOTS[c.slot] - 42);
          return <Card key={i} c={c} style={{ left: x, top: y }} />;
        }
        const check = prog(s, c.t + 1.0, c.t + 1.3);
        const shake = check > 0 && check < 1 ? Math.sin(s * 70) * 6 : 0;
        const drop = prog(s, c.t + 1.6, c.t + 2.3, eIn);
        if (drop >= 1) return null;
        return (
          <Card
            key={i}
            c={c}
            dashed={check > 0.5}
            style={{
              left: x0 + shake,
              top: TRACK_Y - 42 + drop * 360,
              opacity: 1 - drop,
              transform: `rotate(${drop * 12}deg)`,
            }}
          />
        );
      })}

      {/* gate */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <rect x={GATE_X - 50} y={TRACK_Y - 110} width={26} height={220} rx={10} fill={C.ink} />
        <rect x={GATE_X + 24} y={TRACK_Y - 110} width={26} height={220} rx={10} fill={C.ink} />
        <g transform={`rotate(${-arm * 80} ${GATE_X - 37} ${TRACK_Y - 20})`}>
          <rect x={GATE_X - 37} y={TRACK_Y - 28} width={78} height={14} rx={7} fill={arm > 0 ? C.treat : C.gene} />
        </g>
        <circle
          cx={GATE_X}
          cy={TRACK_Y - 160}
          r={26}
          fill={lamp}
          stroke={lampDashed ? C.gap : C.ink}
          strokeWidth={6}
          strokeDasharray={lampDashed ? "9 7" : undefined}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: GATE_X,
          top: TRACK_Y + 140,
          transform: "translateX(-50%)",
          textAlign: "center",
          fontFamily: F.mono,
          fontSize: 24,
          color: C.ink2,
          whiteSpace: "nowrap",
        }}
      >
        evidence_id ?
      </div>

      {/* the spoken answer: what passed + what the agent says instead */}
      <div
        style={{
          position: "absolute",
          left: SLOT_X,
          top: SLOTS[0] - 92,
          fontFamily: F.mono,
          fontSize: 22,
          color: C.ink3,
          letterSpacing: "0.04em",
          opacity: prog(s, 1.6, 2.1),
        }}
      >
        SPOKEN ANSWER
      </div>
      <div
        style={{
          position: "absolute",
          left: SLOT_X,
          top: SLOTS[2] - 42,
          width: 440,
          height: 84,
          boxSizing: "border-box",
          border: `3px dashed ${C.gap}`,
          borderRadius: 10,
          background: C.canvas,
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
          opacity: noEv,
          transform: `translateY(${(1 - noEv) * 12}px)`,
          fontFamily: F.display,
          fontWeight: 800,
          fontSize: 28,
          color: C.ink,
        }}
      >
        No evidence in our sources.
      </div>

      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 72,
          fontFamily: F.mono,
          fontSize: 26,
          color: C.ink2,
          opacity: prog(s, 7.0, 7.6),
        }}
      >
        deterministic check · no LLM judging an LLM
      </div>
    </Panel>
  );
};
