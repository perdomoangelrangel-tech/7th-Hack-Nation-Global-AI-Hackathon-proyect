import React, { useMemo } from "react";
import { C, F, H, W } from "../theme";
import { edgeFade, eInOut, mix, prog, SceneProps, useSceneTime } from "../lib/anim";
import { fractionAt, pointAt, Pt, roundedPath } from "../lib/route";
import { Panel, backOut } from "../components/Brand";
import { Plaque, Route, SourceNote, Station } from "../components/Map";

export const ODYSSEY_NATURAL = 18;
export const ODYSSEY_SFX = [
  { name: "hospital-ambience", at: 0, until: 9.2, volume: 0.35 },
  { name: "clock-tick", at: 0.8 },
  { name: "station-chime", at: 8.4 },
  { name: "calm-transition", at: 8.8, volume: 0.4 },
  { name: "number-thud", at: 9.6 },
  { name: "number-thud", at: 11.6 },
  { name: "number-thud", at: 13.6 },
];

// The lost route: loops, back-tracks and crosses itself (45° bends only).
const PTS: Pt[] = [
  [140, 900], [460, 900], [640, 720], [640, 420], [820, 240], [1100, 240], [1240, 380], [1240, 620],
  [1080, 780], [820, 780], [560, 520], [560, 300], [700, 160], [1400, 160], [1560, 320], [1560, 700],
  [1400, 540], [1000, 540], [900, 640], [900, 960], [1600, 960], [1760, 800],
];
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const VISITS: Pt[] = [
  mid(PTS[2], PTS[3]), mid(PTS[4], PTS[5]), mid(PTS[6], PTS[7]), mid(PTS[8], PTS[9]), mid(PTS[10], PTS[11]),
  mid(PTS[12], PTS[13]), mid(PTS[14], PTS[15]), mid(PTS[16], PTS[17]), mid(PTS[18], PTS[19]), mid(PTS[19], PTS[20]),
];

const STATS = [
  { big: "4.7", unit: "years", line: "to a confirmed diagnosis", src: "EURORDIS Rare Barometer · 10,453 patients", color: C.pheno, dashed: false },
  { big: "95%", unit: "", line: "have no approved treatment", src: "Buffalo Initiative", color: C.treat, dashed: true },
  { big: "300M+", unit: "", line: "people with a rare disease", src: "Buffalo Initiative", color: C.comm, dashed: false },
];

export const OdysseyRoute: React.FC<SceneProps> = ({ dur }) => {
  const s = useSceneTime(ODYSSEY_NATURAL, dur);
  const d = useMemo(() => roundedPath(PTS, 48), []);
  const visitF = useMemo(() => VISITS.map((v) => fractionAt(d, v)), [d]);

  const routeP = prog(s, 0.6, 8.2, eInOut);
  const tip = pointAt(d, routeP);
  const years = 4.7 * routeP;
  const endPop = backOut(prog(s, 8.2, 8.7, (x) => x));
  const phaseB = prog(s, 9.0, 9.8);
  const routeOpacity = mix(phaseB, 1, 0.1);
  const counter = 1 - phaseB;

  return (
    <Panel fade={edgeFade(s, ODYSSEY_NATURAL)}>
      {/* the route */}
      <div style={{ position: "absolute", inset: 0, opacity: routeOpacity, transform: `scale(${mix(phaseB, 1, 0.94)})` }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          <Route d={d} color={C.lit} progress={routeP} width={12} />
          {VISITS.map((v, i) => (
            <Station key={i} x={v[0]} y={v[1]} color={C.canvas} r={13} ringWidth={4.5} scale={backOut(Math.min(1, Math.max(0, (routeP - visitF[i]) / 0.03)))} />
          ))}
          <Station x={PTS[0][0]} y={PTS[0][1]} color={C.pheno} r={22} scale={backOut(prog(s, 0.2, 0.7, (x) => x))} />
          <Station x={PTS[PTS.length - 1][0]} y={PTS[PTS.length - 1][1]} color={C.treat} r={24} scale={endPop} />
          {routeP > 0.002 && routeP < 0.999 && (
            <g transform={`translate(${tip.x} ${tip.y})`}>
              <circle r={15} fill={C.ink} stroke={C.canvas} strokeWidth={5} />
            </g>
          )}
        </svg>
        <Plaque x={PTS[0][0]} y={PTS[0][1]} name="First symptoms" place="above" appear={prog(s, 0.4, 1.0)} accent={C.pheno} size={28} />
        <Plaque x={PTS[PTS.length - 1][0]} y={PTS[PTS.length - 1][1]} name="Diagnosis" place="above" appear={prog(s, 8.4, 8.9)} accent={C.treat} size={28} />
      </div>

      {/* year counter */}
      {counter > 0.01 && (
        <div style={{ position: "absolute", left: 96, top: 64, opacity: counter * prog(s, 0.5, 1.0) }}>
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 132, color: C.ink, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {years.toFixed(1)}
          </div>
          <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 40, color: C.ink2, marginTop: 6 }}>years</div>
        </div>
      )}

      {/* three sourced numbers */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", justifyContent: "center", gap: 70 }}>
        {STATS.map((st, i) => {
          const a = prog(s, 9.5 + i * 2, 10.3 + i * 2);
          const bar = prog(s, 9.4 + i * 2, 10.4 + i * 2, eInOut);
          return (
            <div key={i} style={{ width: 520, opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>
              <svg width={520} height={40} viewBox="0 0 520 40" style={{ overflow: "visible" }}>
                <Route d="M 20 20 L 500 20" color={st.color} progress={bar} dashed={st.dashed} width={14} />
                <Station x={20} y={20} color={st.dashed ? C.canvas : st.color} hollow={st.dashed} scale={a} r={16} />
              </svg>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 30 }}>
                <span style={{ fontFamily: F.display, fontWeight: 900, fontSize: 168, letterSpacing: "-0.04em", color: C.ink, lineHeight: 0.9 }}>
                  {st.big}
                </span>
                {st.unit && <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 56, color: C.ink }}>{st.unit}</span>}
              </div>
              <div style={{ fontFamily: F.body, fontSize: 40, color: C.ink2, marginTop: 18, lineHeight: 1.2 }}>{st.line}</div>
              <SourceNote text={st.src} style={{ marginTop: 18 }} />
            </div>
          );
        })}
      </div>
    </Panel>
  );
};
