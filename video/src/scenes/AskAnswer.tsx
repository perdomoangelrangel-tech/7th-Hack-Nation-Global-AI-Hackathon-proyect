import React, { useMemo } from "react";
import { C, F, H, W } from "../theme";
import { edgeFade, eIn, eInOut, mix, popAt, prog, reachTime, SceneProps, useSceneTime } from "../lib/anim";
import { fractionAt, Pt, roundedPath } from "../lib/route";
import { Panel } from "../components/Brand";
import { HubPill, Route, Station, Waveform } from "../components/Map";

export const ASK_NATURAL = 12;
export const ASK_SFX = [
  { name: "voice-on", at: 0.4 },
  { name: "route-draw", at: 2.0 },
  { name: "station-chime", at: 2.6 },
  { name: "voice-on", at: 5.7 },
  { name: "route-draw", at: 7.0 },
  { name: "no-evidence", at: 8.2 },
  { name: "claim-drop", at: 8.8 },
];

const HUBP: Pt = [400, 620];
const TREAT: Pt[] = [HUBP, [600, 420], [1840, 420]];
const TREAT_ST: { at: Pt; name: string }[] = [
  { at: [880, 420], name: "Stiripentol" },
  { at: [1220, 420], name: "Cannabidiol" },
  { at: [1560, 420], name: "Fenfluramine" },
];
const DIET: Pt[] = [HUBP, [600, 820], [1100, 820]];

const Chip: React.FC<{ ok: boolean; text: string }> = ({ ok, text }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontFamily: F.mono,
      fontSize: 19,
      color: ok ? C.tTreat : C.ink3,
      background: C.panel,
      borderRadius: 6,
      padding: "4px 10px 2px",
      marginTop: 8,
    }}
  >
    <span style={{ fontWeight: 700 }}>{ok ? "✓" : "∅"}</span>
    {text}
  </span>
);

const Question: React.FC<{ s: number; at: number; until: number; text: string }> = ({ s, at, until, text }) => {
  const a = Math.min(prog(s, at, at + 0.4), 1 - prog(s, until - 0.3, until));
  if (a <= 0.001) return null;
  const typed = Math.round(prog(s, at + 0.25, at + 1.3, (x) => x) * text.length);
  const talking = prog(s, at, at + 0.2) * (1 - prog(s, at + 1.3, at + 1.6));
  return (
    <div
      style={{
        position: "absolute",
        left: 120,
        top: 96,
        display: "flex",
        alignItems: "center",
        gap: 28,
        opacity: a,
        transform: `translateY(${(1 - a) * -16}px)`,
      }}
    >
      <svg width={64} height={64} viewBox="0 0 64 64">
        <circle cx={32} cy={32} r={25} fill={C.treat} stroke={C.ink} strokeWidth={5} />
      </svg>
      <Waveform s={s} color={C.treat} bars={9} h={64} active={talking} />
      <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 64, letterSpacing: "-0.02em", color: C.ink }}>
        “{text.slice(0, typed)}
        <span style={{ opacity: typed >= text.length ? 1 : 0 }}>”</span>
      </div>
    </div>
  );
};

/** Ask in your own voice → sourced stations. A claim without a source turns dashed and drops. */
export const AskAnswer: React.FC<SceneProps> = ({ dur }) => {
  const s = useSceneTime(ASK_NATURAL, dur);
  const treatD = useMemo(() => roundedPath(TREAT, 54), []);
  const dietD = useMemo(() => roundedPath(DIET, 54), []);
  const treatT = useMemo(() => TREAT_ST.map((st) => reachTime(2.0, 3.8, fractionAt(treatD, st.at))), [treatD]);

  const hub = popAt(s, 0.15, 0.5);
  const treatP = prog(s, 2.0, 3.8, eInOut);
  const dietP = prog(s, 7.0, 7.9, eInOut);
  const verdict = prog(s, 8.2, 8.6); // solid draft → dashed gap
  const drop = prog(s, 8.8, 9.7, eIn);
  const noEv = prog(s, 9.4, 10.0);

  return (
    <Panel fade={edgeFade(s, ASK_NATURAL)}>
      <Question s={s} at={0.35} until={5.6} text="What treatments exist?" />
      <Question s={s} at={5.7} until={ASK_NATURAL + 1} text="Can a diet cure it?" />

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <Route d={treatD} color={C.treat} progress={treatP} />
        {TREAT_ST.map((st, i) => (
          <Station key={i} x={st.at[0]} y={st.at[1]} color={C.treat} scale={popAt(s, treatT[i])} />
        ))}
        {/* drafted claim: solid ink while drafting, dashed gap once the verifier finds no evidence_id */}
        <Route d={dietD} color={C.ink3} progress={dietP} opacity={1 - verdict} />
        <Route d={dietD} color={C.gap} progress={dietP} dashed opacity={verdict} />
        <Station x={1100} y={820} color={C.ink3} scale={popAt(s, 7.85)} hollow={verdict > 0.5} r={19} />
      </svg>

      {TREAT_ST.map((st, i) => {
        const a = prog(s, treatT[i] + 0.15, treatT[i] + 0.65);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: st.at[0],
              top: st.at[1] + 36,
              transform: `translate(-50%, ${(1 - a) * 14}px)`,
              opacity: a,
              background: C.canvas,
              border: `2px solid ${C.rule}`,
              borderRadius: 8,
              padding: "10px 16px 10px",
              textAlign: "left",
            }}
          >
            <div style={{ fontFamily: F.display, fontWeight: 750, fontSize: 32, color: C.ink, lineHeight: 1.1 }}>{st.name}</div>
            <Chip ok text="Open Targets" />
          </div>
        );
      })}

      {/* the drafted claim that has no source */}
      {s > 7.6 && drop < 1 && (
        <div
          style={{
            position: "absolute",
            left: 1140,
            top: 820,
            transform: `translate(0, -50%) translateY(${drop * 260}px) rotate(${drop * 6}deg)`,
            opacity: prog(s, 7.8, 8.1) * (1 - drop),
            background: C.canvas,
            border: verdict > 0.5 ? `2.5px dashed ${C.gap}` : `2px solid ${C.rule}`,
            borderRadius: 8,
            padding: "10px 16px 10px",
          }}
        >
          <div style={{ fontFamily: F.display, fontWeight: 750, fontSize: 32, color: mix(verdict, 0, 1) > 0.5 ? C.ink3 : C.ink, lineHeight: 1.1 }}>
            Diet cures Dravet
          </div>
          <Chip ok={false} text="evidence_id: none" />
        </div>
      )}

      {/* what the agent actually says */}
      <div
        style={{
          position: "absolute",
          left: 1140,
          top: 820,
          display: "flex",
          alignItems: "center",
          gap: 22,
          opacity: noEv,
          transform: `translateY(-50%) translateY(${(1 - noEv) * 16}px)`,
          background: C.canvas,
          border: `3px dashed ${C.gap}`,
          borderRadius: 12,
          padding: "22px 30px 18px",
        }}
      >
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 48, color: C.ink, letterSpacing: "-0.02em" }}>
          No evidence in our sources.
        </div>
      </div>

      <HubPill x={HUBP[0]} y={HUBP[1]} name="Dravet syndrome" code="ORPHA:33069" scale={hub} w={384} />

      <div
        style={{
          position: "absolute",
          right: 64,
          bottom: 44,
          fontFamily: F.mono,
          fontSize: 20,
          color: C.ink3,
          opacity: prog(s, 3.6, 4.2),
        }}
      >
        Not medical advice · sample view
      </div>
    </Panel>
  );
};
