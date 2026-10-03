import React, { useMemo } from "react";
import { C, F, H, W } from "../theme";
import { edgeFade, eInOut, mix, popAt, prog, reachTime, SceneProps, useSceneTime } from "../lib/anim";
import { fractionAt, Pt, roundedPath } from "../lib/route";
import { Panel } from "../components/Brand";
import { HubPill, Plaque, Route, Sign, Station } from "../components/Map";

export const CONNECTIONS_NATURAL = 17;
export const CONNECTIONS_SFX = [
  { name: "route-draw", at: 0.6 },
  { name: "station-chime", at: 1.3 },
  { name: "station-chime", at: 2.6 },
  { name: "route-draw", at: 5.4 },
  { name: "route-draw", at: 9.0 },
  { name: "station-chime", at: 10.3 },
];

/*
 * Real graph data (view disease_links, from the lead):
 * Angelman (ORPHA:72) ↔ Rett (ORPHA:778): 7 shared symptoms (HPO), 2 shared researchers (PubMed authors),
 *   3 studies already running across genetic syndromes (ClinicalTrials.gov):
 *   NCT06139172 WINGS (active, not recruiting) · NCT03836300 PIXI (enrolling by invitation) ·
 *   NCT03655223 Early Check (active, not recruiting).
 * Angelman ↔ CDKL5 deficiency (ORPHA:505652): 12 shared symptoms (strongest symptom overlap).
 */
const Y = 430;
const ANG: Pt = [330, Y];
const RETT: Pt = [1590, Y];
const CDKL5: Pt = [330, 830];
const TOPY = 210;
const TOP: Pt[] = [ANG, [550, TOPY], [1370, TOPY], RETT];
const STUDIES = [
  { x: 720, name: "WINGS", code: "NCT06139172", status: "active, not recruiting", place: "above" as const },
  { x: 960, name: "PIXI", code: "NCT03836300", status: "enrolling by invitation", place: "below" as const },
  { x: 1200, name: "Early Check", code: "NCT03655223", status: "active, not recruiting", place: "above" as const },
];
const SYM_X = [690, 737, 783, 830, 877, 923, 970];
const RES_X = [1120, 1200];
const MAIN_T: [number, number] = [0.6, 2.8];
const TOP_T: [number, number] = [5.4, 8.0];
const CDKL5_T: [number, number] = [9.0, 10.3];

/** Angelman meets Rett at three running studies (+ symptoms and researchers), and CDKL5 at 12 shared symptoms. */
export const Connections: React.FC<SceneProps> = ({ dur }) => {
  const s = useSceneTime(CONNECTIONS_NATURAL, dur);
  const topD = useMemo(() => roundedPath(TOP, 60), []);
  const symT = useMemo(() => SYM_X.map((x) => reachTime(TOP_T[0], TOP_T[1], fractionAt(topD, [x, TOPY]))), [topD]);
  const resT = useMemo(() => RES_X.map((x) => reachTime(TOP_T[0], TOP_T[1], fractionAt(topD, [x, TOPY]))), [topD]);
  const studyT = STUDIES.map((st) => reachTime(MAIN_T[0], MAIN_T[1], (st.x - ANG[0]) / (RETT[0] - ANG[0])));
  const zoom = mix(prog(s, 0, CONNECTIONS_NATURAL, (x) => x), 1, 1.03);
  const cdkSt = reachTime(CDKL5_T[0], CDKL5_T[1], 0.5);
  // PIXI is the next step: pulse it near the end
  const pulse = prog(s, 12.0, 13.4, (x) => x);

  return (
    <Panel fade={edgeFade(s, CONNECTIONS_NATURAL)}>
      <Sign text="Connections" appear={prog(s, 0, 0.5)} />
      <div style={{ position: "absolute", inset: 0, transform: `translateY(30px) scale(${zoom})`, transformOrigin: "960px 470px" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          <Route d={topD} color={C.ink} progress={prog(s, TOP_T[0], TOP_T[1], eInOut)} width={12} />
          <Route d={`M ${ANG[0]} ${Y} L ${RETT[0]} ${Y}`} color={C.trial} progress={prog(s, MAIN_T[0], MAIN_T[1], eInOut)} width={16} />
          <Route d={`M ${ANG[0]} ${Y} L ${CDKL5[0]} ${CDKL5[1]}`} color={C.pheno} progress={prog(s, CDKL5_T[0], CDKL5_T[1], eInOut)} width={16} />
          {SYM_X.map((x, i) => (
            <Station key={`s${i}`} x={x} y={TOPY} color={C.pheno} r={13} ringWidth={4.5} scale={popAt(s, symT[i])} />
          ))}
          {RES_X.map((x, i) => (
            <Station key={`r${i}`} x={x} y={TOPY} color={C.comm} r={15} ringWidth={4.5} scale={popAt(s, resT[i])} />
          ))}
          {STUDIES.map((st, i) => (
            <Station key={st.name} x={st.x} y={Y} color={C.trial} r={20} ringWidth={5.5} scale={popAt(s, studyT[i])} />
          ))}
          {pulse > 0 && pulse < 1 && <circle cx={960} cy={Y} r={20 + pulse * 46} fill="none" stroke={C.trial} strokeWidth={5} opacity={1 - pulse} />}
          <Station x={330} y={630} color={C.pheno} r={26} ringWidth={6} scale={popAt(s, cdkSt)} />
        </svg>

        {STUDIES.map((st, i) => (
          <Plaque
            key={st.name}
            x={st.x}
            y={Y}
            name={st.name}
            code={st.code}
            source={st.status}
            place={st.place}
            off={36}
            accent={C.trial}
            size={30}
            appear={prog(s, studyT[i] + 0.2, studyT[i] + 0.6)}
          />
        ))}
        <Plaque x={830} y={TOPY} name="7 shared symptoms" source="HPO" place="above" off={30} size={28} appear={prog(s, symT[6] + 0.2, symT[6] + 0.6)} />
        <Plaque x={1160} y={TOPY} name="2 shared researchers" source="PubMed authors" place="above" off={30} size={28} appear={prog(s, resT[1] + 0.2, resT[1] + 0.6)} />
        <Plaque x={330} y={630} name="12 shared symptoms" code="HPO" source="strongest overlap" place="right" off={40} accent={C.pheno} size={32} appear={prog(s, cdkSt + 0.2, cdkSt + 0.6)} />

        <div
          style={{
            position: "absolute",
            left: 1200,
            top: 650,
            transform: `translateX(-50%) translateY(${(1 - prog(s, 3.2, 3.7)) * 12}px)`,
            opacity: prog(s, 3.2, 3.7),
            background: C.ink,
            color: C.onInk,
            fontFamily: F.display,
            fontWeight: 800,
            fontSize: 34,
            letterSpacing: "-0.01em",
            padding: "12px 22px 8px",
            borderRadius: 10,
            whiteSpace: "nowrap",
          }}
        >
          Useful work already exists
          <div style={{ fontFamily: F.mono, fontWeight: 400, fontSize: 19, color: C.gap, marginTop: 4, letterSpacing: 0 }}>
            3 studies across genetic syndromes · ClinicalTrials.gov
          </div>
        </div>

        <HubPill x={ANG[0]} y={Y} name="Angelman syndrome" code="ORPHA:72" w={360} h={92} fontSize={32} scale={popAt(s, 0.15, 0.45)} />
        <HubPill x={RETT[0]} y={Y} name="Rett syndrome" code="ORPHA:778" w={320} h={92} fontSize={32} scale={popAt(s, MAIN_T[1] - 0.1, 0.45)} />
        <HubPill x={CDKL5[0]} y={CDKL5[1]} name="CDKL5 deficiency" code="ORPHA:505652" w={350} h={92} fontSize={32} scale={popAt(s, CDKL5_T[1] - 0.1, 0.45)} />
      </div>
    </Panel>
  );
};
