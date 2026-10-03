import React from "react";
import { C, F, H, W } from "../theme";
import { edgeFade, eInOut, popAt, prog, SceneProps, useSceneTime } from "../lib/anim";
import { Panel } from "../components/Brand";
import { HubPill, Plaque, Route, Station } from "../components/Map";

export const HOOK_NATURAL = 6;
export const HOOK_SFX = [
  { name: "station-chime", at: 0.2 },
  { name: "route-draw", at: 0.5 },
  { name: "route-draw", at: 2.0 },
  { name: "no-evidence", at: 3.4 },
];

const Y = 520;

/** Maria's family → Angelman syndrome → a dashed treatment line to a hollow station (none approved in our sources). */
export const Hook: React.FC<SceneProps> = ({ dur }) => {
  const s = useSceneTime(HOOK_NATURAL, dur);
  return (
    <Panel fade={edgeFade(s, HOOK_NATURAL)}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <Route d={`M 330 ${Y} L 820 ${Y}`} color={C.comm} progress={prog(s, 0.4, 1.2, eInOut)} width={16} />
        <Route d={`M 960 ${Y} L 1560 ${Y}`} color={C.treat} dashed progress={prog(s, 2.0, 3.3, eInOut)} width={16} />
        <Station x={330} y={Y} color={C.comm} r={26} ringWidth={6} scale={popAt(s, 0.15)} />
        <Station x={1560} y={Y} color={C.canvas} hollow r={30} ringWidth={6} scale={popAt(s, 3.3)} />
      </svg>
      <Plaque x={330} y={Y} name="Maria's family" source="illustrative family" place="above" appear={prog(s, 0.3, 0.8)} accent={C.comm} size={40} off={48} />
      <HubPill x={900} y={Y} name="Angelman syndrome" code="ORPHA:72" w={480} h={118} fontSize={44} scale={popAt(s, 1.0, 0.45)} />
      <Plaque
        x={1560}
        y={Y}
        name="Approved treatment"
        code="none in our sources"
        place="below"
        gap
        appear={prog(s, 3.5, 4.0)}
        size={40}
        off={52}
      />
      <div
        style={{
          position: "absolute",
          left: 1560,
          top: Y + 200,
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          textAlign: "center",
          lineHeight: 1.4,
          fontFamily: F.mono,
          fontSize: 22,
          color: C.ink3,
          opacity: prog(s, 4.2, 4.8),
        }}
      >
        investigational only (ClinicalTrials.gov)
        <br />
        GTX-102 phase 3 · MVX-220 phase 2
      </div>
      <div
        style={{
          position: "absolute",
          right: 72,
          top: 56,
          fontFamily: F.mono,
          fontSize: 22,
          color: C.ink3,
          opacity: prog(s, 1.0, 1.6),
        }}
      >
        illustrative family · real data
      </div>
    </Panel>
  );
};
