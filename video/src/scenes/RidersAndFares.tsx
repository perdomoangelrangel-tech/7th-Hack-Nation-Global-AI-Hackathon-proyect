import React from "react";
import { C, F, H, W } from "../theme";
import { edgeFade, eInOut, mix, popAt, prog, SceneProps, useSceneTime } from "../lib/anim";
import { Panel } from "../components/Brand";
import { Route, SourceNote, Station } from "../components/Map";

export const FARES_NATURAL = 14;
export const FARES_SFX = [
  { name: "route-draw", at: 0.4 },
  { name: "station-chime", at: 2.4 },
  { name: "split-flap", at: 7.2 },
];

const RIDERS = [
  { name: "Families", agent: "Family Guide · free", color: C.treat, note: "Free, always", src: "" },
  { name: "Clinicians", agent: "Clinical Analyst", color: C.trial, note: "HPO, ClinVar, PubMed", src: "" },
  { name: "Research", agent: "Research Analyst", color: C.comm, note: ">80% of trials delayed", src: "recruitment · Emmes 2024" },
];
const LY = [300, 470, 640];

const FARES = [
  { who: "Families", price: "FREE", color: C.treat },
  { who: "Patient orgs", price: "US$100–500/MO", color: C.comm },
  { who: "Clinics", price: "US$200/SPECIALIST/MO", color: C.trial },
  { who: "Pharma & CROs", price: "US$50–250K/PROGRAM/YR", color: C.comm },
];
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$/–";

const Flap: React.FC<{ text: string; s: number; at: number }> = ({ text, s, at }) => (
  <div style={{ display: "flex", gap: 4 }}>
    {text.split("").map((ch, j) => {
      const settle = at + 0.12 + j * 0.045;
      const done = s >= settle;
      const spin = Math.floor(s * 24 + j * 7) % GLYPHS.length;
      const shown = s < at ? " " : done ? ch : GLYPHS[spin];
      return (
        <div
          key={j}
          style={{
            width: 32,
            height: 52,
            borderRadius: 5,
            background: C.ink2,
            color: done ? C.pheno : C.onInk,
            fontFamily: F.mono,
            fontWeight: 700,
            fontSize: 31,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {shown}
          <div style={{ position: "absolute", left: 0, right: 0, top: 25, height: 2, background: C.ink }} />
        </div>
      );
    })}
  </div>
);

/** Three riders on three lines, then the fare board (pricing hypothesis). */
export const RidersAndFares: React.FC<SceneProps> = ({ dur }) => {
  const s = useSceneTime(FARES_NATURAL, dur);
  const lift = prog(s, 6.0, 7.0, eInOut);
  const board = prog(s, 6.6, 7.4);

  return (
    <Panel fade={edgeFade(s, FARES_NATURAL)}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateY(${mix(lift, 0, -200)}px) scale(${mix(lift, 1, 0.72)})`,
          transformOrigin: "960px 300px",
        }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          {RIDERS.map((r, i) => {
            const p = prog(s, 0.4 + i * 0.5, 2.6 + i * 0.5, eInOut);
            return (
              <g key={r.name}>
                <Route d={`M 200 ${LY[i]} L 1840 ${LY[i]}`} color={r.color} progress={p} width={18} />
                <Station x={200} y={LY[i]} color={r.color} r={28} ringWidth={7} scale={popAt(s, 0.3 + i * 0.5)} />
                {[760, 1060, 1360].map((x, k) => (
                  <Station key={k} x={x} y={LY[i]} color={C.canvas} r={15} scale={popAt(s, 0.4 + i * 0.5 + ((x - 200) / 1640) * 2.2)} />
                ))}
              </g>
            );
          })}
        </svg>
        {RIDERS.map((r, i) => {
          const a = prog(s, 0.6 + i * 0.5, 1.2 + i * 0.5);
          const n = prog(s, 2.6 + i * 0.5, 3.2 + i * 0.5);
          return (
            <React.Fragment key={r.name}>
              <div style={{ position: "absolute", left: 250, top: LY[i] - 92, opacity: a, display: "flex", alignItems: "baseline", gap: 22 }}>
                <span style={{ fontFamily: F.display, fontWeight: 900, fontSize: 60, letterSpacing: "-0.03em", color: C.ink }}>{r.name}</span>
                <span style={{ fontFamily: F.mono, fontSize: 24, color: C.ink3 }}>{r.agent}</span>
              </div>
              <div
                style={{
                  position: "absolute",
                  right: 80,
                  top: LY[i] - 34,
                  transform: `translateY(-100%) translateY(${(1 - n) * 10}px)`,
                  opacity: n,
                  textAlign: "right",
                  background: C.canvas,
                  border: `2px solid ${C.rule}`,
                  borderRight: `8px solid ${r.color}`,
                  borderRadius: 8,
                  padding: "8px 16px 8px",
                }}
              >
                <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 30, color: C.ink }}>{r.note}</div>
                {r.src && <div style={{ fontFamily: F.mono, fontSize: 18, color: C.ink3, marginTop: 2 }}>{r.src}</div>}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* fare board */}
      {board > 0 && (
        <div
          style={{
            position: "absolute",
            left: 170,
            right: 170,
            top: 420,
            background: C.ink,
            borderRadius: 18,
            padding: "26px 44px 30px",
            opacity: board,
            transform: `translateY(${(1 - board) * 60}px)`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.mono, fontSize: 22, color: C.gap, letterSpacing: "0.08em" }}>
            <span>FARES</span>
            <span>PRICING HYPOTHESIS</span>
          </div>
          {FARES.map((f, i) => (
            <div
              key={f.who}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 0",
                borderTop: i === 0 ? "none" : `1.5px solid ${C.ink2}`,
                marginTop: i === 0 ? 14 : 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <svg width={34} height={34} viewBox="0 0 34 34">
                  <circle cx={17} cy={17} r={12} fill={f.color} stroke={C.onInk} strokeWidth={4} />
                </svg>
                <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 42, color: C.onInk, letterSpacing: "-0.015em" }}>{f.who}</span>
              </div>
              <Flap text={f.price} s={s} at={7.2 + i * 0.45} />
            </div>
          ))}
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, display: "flex", justifyContent: "center", gap: 64 }}>
        <SourceNote appear={prog(s, 10.0, 10.6)} text="US$600k–8M lost per day of trial delay · Emmes 2024" />
        <SourceNote appear={prog(s, 10.3, 10.9)} text="~1,000 patient orgs in 74 countries · EURORDIS" />
      </div>
    </Panel>
  );
};
