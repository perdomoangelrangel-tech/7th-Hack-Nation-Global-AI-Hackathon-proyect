import React from "react";
import { C, F } from "../theme";
import { edgeFade, eInOut, popAt, prog, SceneProps, useSceneTime } from "../lib/anim";
import { Panel } from "../components/Brand";

export const NEXTSTEP_NATURAL = 11;
export const NEXTSTEP_SFX = [
  { name: "station-chime", at: 1.0 },
  { name: "station-chime", at: 2.3 },
  { name: "no-evidence", at: 3.6 },
];

const ROWS = [
  { title: "Ask the PIXI team", sub: "NCT03836300 · enrolling by invitation · can Angelman families join?", color: C.trial, hollow: false },
  { title: "Invite the 2 shared researchers", sub: "Angelman ↔ Rett · joint call", color: C.comm, hollow: false },
  { title: "To validate", sub: "do shared symptoms share a mechanism? · expert review", color: C.gap, hollow: true },
];
const ROW_H = 150;

/** "Next stop" board: the justified next step for the family, plus what still needs proof. */
export const NextStep: React.FC<SceneProps> = ({ dur }) => {
  const s = useSceneTime(NEXTSTEP_NATURAL, dur);
  const board = prog(s, 0.1, 0.6);
  const rowAt = (i: number) => 1.0 + i * 1.3;
  const spine = prog(s, 0.9, rowAt(2) + 0.2, eInOut);
  return (
    <Panel fade={edgeFade(s, NEXTSTEP_NATURAL)}>
      <div
        style={{
          position: "absolute",
          left: 190,
          right: 190,
          top: 150,
          background: C.ink,
          borderRadius: 20,
          padding: "30px 56px 40px",
          opacity: board,
          transform: `translateY(${(1 - board) * 30}px)`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.mono, fontSize: 24, color: C.gap, letterSpacing: "0.08em" }}>
          <span>NEXT STEP</span>
          <span>ANGELMAN · MARIA'S FAMILY</span>
        </div>
        <div style={{ position: "relative", marginTop: 26 }}>
          {/* the spine: a route joining the three stops */}
          <svg width={60} height={ROW_H * 3} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <line x1={30} y1={ROW_H / 2} x2={30} y2={ROW_H / 2 + ROW_H * 1 * Math.min(1, spine * 2)} stroke={C.trial} strokeWidth={12} strokeLinecap="round" />
            {spine > 0.5 && (
              <line
                x1={30}
                y1={ROW_H * 1.5}
                x2={30}
                y2={ROW_H * 1.5 + ROW_H * (spine - 0.5) * 2}
                stroke={C.gap}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray="2 14"
              />
            )}
            {ROWS.map((r, i) => {
              const sc = popAt(s, rowAt(i));
              if (sc <= 0) return null;
              return (
                <g key={i} transform={`translate(30 ${ROW_H * i + ROW_H / 2}) scale(${sc})`}>
                  <circle
                    r={22}
                    fill={r.hollow ? C.ink : r.color}
                    stroke={r.hollow ? C.gap : C.onInk}
                    strokeWidth={6}
                    strokeDasharray={r.hollow ? "8 6" : undefined}
                  />
                </g>
              );
            })}
          </svg>
          {ROWS.map((r, i) => {
            const a = prog(s, rowAt(i) + 0.1, rowAt(i) + 0.6);
            return (
              <div
                key={r.title}
                style={{
                  height: ROW_H,
                  marginLeft: 100,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  opacity: a,
                  transform: `translateX(${(1 - a) * 24}px)`,
                  borderTop: i === 0 ? "none" : `1.5px solid ${C.ink2}`,
                }}
              >
                <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 56, letterSpacing: "-0.02em", color: C.onInk, lineHeight: 1.05 }}>
                  {r.title}
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 25, color: r.hollow ? C.gap : C.pheno, marginTop: 10 }}>{r.sub}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 880,
          textAlign: "center",
          fontFamily: F.mono,
          fontSize: 24,
          color: C.ink2,
          opacity: prog(s, 4.2, 4.8),
        }}
      >
        Not medical advice · take it to your care team
      </div>
    </Panel>
  );
};
