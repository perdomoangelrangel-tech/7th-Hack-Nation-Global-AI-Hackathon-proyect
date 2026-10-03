import React, { useMemo } from "react";
import { C, F, H, W } from "../theme";
import { edgeFade, eInOut, mix, popAt, prog, reachTime, SceneProps, useSceneTime } from "../lib/anim";
import { fractionAt, roundedPath } from "../lib/route";
import { DRAVET_LINES, HUB, LEGEND } from "../lib/dravet";
import { Panel } from "../components/Brand";
import { HubPill, Plaque, Route, Station } from "../components/Map";

export const MAPBUILD_NATURAL = 12;
export const MAPBUILD_SFX = [
  { name: "station-chime", at: 0.2 },
  { name: "route-draw", at: 0.8 },
  { name: "route-draw", at: 3.0 },
  { name: "station-chime", at: 3.5 },
  { name: "route-draw", at: 5.0 },
  { name: "no-evidence", at: 8.0 },
];

export const Legend: React.FC<{ appear: number; y?: number }> = ({ appear, y = 1000 }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: y,
      display: "flex",
      justifyContent: "center",
      gap: 34,
      opacity: appear,
      transform: `translateY(${(1 - appear) * 12}px)`,
    }}
  >
    {LEGEND.map((l) => (
      <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <svg width={44} height={14} viewBox="0 0 44 14">
          <line
            x1={4}
            y1={7}
            x2={40}
            y2={7}
            stroke={l.color}
            strokeWidth={l.dashed ? 6 : 9}
            strokeLinecap="round"
            strokeDasharray={l.dashed ? "2 9" : undefined}
          />
        </svg>
        <span style={{ fontFamily: F.body, fontSize: 22, color: C.ink2 }}>{l.label}</span>
      </div>
    ))}
  </div>
);

/** Dravet syndrome as a transit map, drawn station by station. */
export const MapBuild: React.FC<SceneProps & { hold?: boolean }> = ({ dur }) => {
  const s = useSceneTime(MAPBUILD_NATURAL, dur);
  const lines = useMemo(
    () =>
      DRAVET_LINES.map((l) => {
        const d = roundedPath(l.pts, 54);
        return { ...l, d, tr: l.stations.map((st) => reachTime(l.t[0], l.t[1], Math.min(0.985, fractionAt(d, st.at)))) };
      }),
    [],
  );
  const hub = popAt(s, 0.2, 0.5);
  const zoom = mix(prog(s, 0, MAPBUILD_NATURAL, (x) => x), 1, 1.035);

  return (
    <Panel fade={edgeFade(s, MAPBUILD_NATURAL)}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: `${HUB[0]}px ${HUB[1]}px` }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          {lines.map((l) => {
            const p = prog(s, l.t[0], l.t[1], eInOut);
            return <Route key={l.key} d={l.d} color={l.color} dashed={l.dashed} progress={p} />;
          })}
          {lines.map((l) => {
            return l.stations.map((st, i) => (
              <Station
                key={`${l.key}${i}`}
                x={st.at[0]}
                y={st.at[1]}
                color={l.color}
                hollow={l.dashed}
                r={l.dashed ? 20 : 17}
                scale={popAt(s, l.tr[i])}
              />
            ));
          })}
        </svg>
        {lines.map((l) => {
          return l.stations.map((st, i) => (
            <Plaque
              key={`${l.key}p${i}`}
              x={st.at[0]}
              y={st.at[1]}
              name={st.name}
              code={st.code}
              source={st.source}
              place={st.place}
              gap={l.dashed}
              size={l.key === "pheno" ? 27 : 29}
              appear={prog(s, l.tr[i] + 0.12, l.tr[i] + 0.6)}
            />
          ));
        })}
        <HubPill x={HUB[0]} y={HUB[1]} name="Dravet syndrome" code="ORPHA:33069" scale={hub} w={384} />
      </div>
      <Legend appear={prog(s, 8.3, 9.0)} y={1010} />
      <div
        style={{
          position: "absolute",
          right: 56,
          top: 44,
          fontFamily: F.mono,
          fontSize: 20,
          color: C.ink3,
          opacity: prog(s, 8.6, 9.2),
        }}
      >
        sample view · live data in the app
      </div>
    </Panel>
  );
};
