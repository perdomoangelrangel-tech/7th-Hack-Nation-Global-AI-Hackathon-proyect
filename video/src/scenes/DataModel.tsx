import React from "react";
import { C, F, H, W } from "../theme";
import { edgeFade, eInOut, mix, popAt, prog, SceneProps, useSceneTime } from "../lib/anim";
import { Panel } from "../components/Brand";
import { HubPill, Route, Sign, Station } from "../components/Map";

export const DATA_NATURAL = 14;
export const DATA_SFX = [
  { name: "station-chime", at: 0.9 },
  { name: "route-draw", at: 4.2 },
  { name: "gate-verified", at: 5.8 },
  { name: "route-draw", at: 7.4 },
  { name: "no-evidence", at: 9.0 },
];

const TABLES = [
  { x: 380, name: "entities", fields: "type · canonical_id · name", fill: C.canvas },
  { x: 960, name: "edges", fields: "from · to · relation · status", fill: C.ink },
  { x: 1540, name: "evidence", fields: "source · external_id · url · date", fill: C.treat },
];
const TY = 330;
const RY = 790;

const Tag: React.FC<{ x: number; y: number; appear: number; children: React.ReactNode; ink?: boolean; dashed?: boolean }> = ({
  x,
  y,
  appear,
  children,
  ink,
  dashed,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `translate(-50%, ${(1 - appear) * 10}px)`,
      opacity: appear,
      fontFamily: F.mono,
      fontSize: 21,
      whiteSpace: "nowrap",
      padding: "7px 14px 5px",
      borderRadius: 6,
      background: ink ? C.ink : C.canvas,
      color: ink ? C.onInk : C.ink2,
      border: dashed ? `2.5px dashed ${C.gap}` : ink ? "none" : `2px solid ${C.rule}`,
    }}
  >
    {children}
  </div>
);

/** entities · edges · evidence, and the trigger that keeps an edge pending until evidence exists. */
export const DataModel: React.FC<SceneProps> = ({ dur }) => {
  const s = useSceneTime(DATA_NATURAL, dur);
  const head = prog(s, 0.1, 0.7);
  const schemaP = prog(s, 0.8, 2.6, eInOut);

  const e1 = prog(s, 4.2, 5.2, eInOut);
  const ev1 = prog(s, 5.5, 6.0);
  const active1 = prog(s, 6.1, 6.5);
  const e2 = prog(s, 7.4, 8.4, eInOut);
  const block = prog(s, 9.0, 9.4);
  const shake = block > 0 && block < 1 ? Math.sin(s * 80) * 5 : 0;

  return (
    <Panel fade={edgeFade(s, DATA_NATURAL)}>
      <Sign text="Data model" appear={prog(s, 0, 0.5)} />
      <div
        style={{
          position: "absolute",
          right: 96,
          top: 60,
          fontFamily: F.display,
          fontWeight: 900,
          fontSize: 64,
          letterSpacing: "-0.03em",
          color: C.ink,
          opacity: head,
        }}
      >
        No edge without evidence.
      </div>

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <Route d={`M ${TABLES[0].x} ${TY} L ${TABLES[2].x} ${TY}`} color={C.ink} progress={schemaP} width={12} />
        {TABLES.map((t, i) => (
          <Station key={t.name} x={t.x} y={TY} color={t.fill} r={34} ringWidth={8} scale={popAt(s, 0.8 + i * 0.8, 0.45)} />
        ))}
        {/* row: SCN1A —causes→ Dravet */}
        <Route d={`M 400 ${RY} L 790 ${RY}`} color={C.gap} dashed progress={e1} opacity={1 - active1} />
        <Route d={`M 400 ${RY} L 790 ${RY}`} color={C.gene} progress={active1 > 0 ? 1 : 0} opacity={active1} />
        {/* row: Diet —cures?→ Dravet (never becomes active) */}
        <g transform={`translate(${shake} 0)`}>
          <Route d={`M 1130 ${RY} L 1520 ${RY}`} color={C.gap} dashed progress={e2} opacity={mix(block, 1, 0.55)} />
        </g>
        <Station x={380} y={RY} color={C.gene} r={22} scale={popAt(s, 3.4)} />
        <Station x={1540} y={RY} color={C.canvas} r={22} scale={popAt(s, 3.7)} />
        {/* evidence row attached to edge 1 */}
        {ev1 > 0 && (
          <g opacity={ev1}>
            <line x1={595} y1={RY + 12} x2={595} y2={RY + 70} stroke={C.treat} strokeWidth={6} strokeLinecap="round" />
            <circle cx={595} cy={RY + 80} r={14} fill={C.treat} stroke={C.ink} strokeWidth={5} />
          </g>
        )}
      </svg>

      {TABLES.map((t, i) => (
        <div
          key={t.name}
          style={{
            position: "absolute",
            left: t.x,
            top: TY + 60,
            transform: "translateX(-50%)",
            textAlign: "center",
            opacity: prog(s, 1.0 + i * 0.8, 1.5 + i * 0.8),
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 38, color: C.ink }}>{t.name}</div>
          <div style={{ fontFamily: F.mono, fontSize: 21, color: C.ink3, marginTop: 6 }}>{t.fields}</div>
        </div>
      ))}
      <Tag x={670} y={TY - 80} appear={prog(s, 2.0, 2.5)}>from · to</Tag>
      <Tag x={1250} y={TY - 80} appear={prog(s, 2.6, 3.1)}>≥ 1 per edge</Tag>

      {/* demo row labels */}
      <div style={{ position: "absolute", left: 380, top: RY - 80, transform: "translateX(-50%)", opacity: prog(s, 3.5, 3.9), textAlign: "center" }}>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 32, color: C.ink }}>SCN1A</div>
      </div>
      <div style={{ position: "absolute", left: 1540, top: RY - 80, transform: "translateX(-50%)", opacity: prog(s, 3.8, 4.2), textAlign: "center" }}>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 32, color: C.ink }}>Diet</div>
      </div>
      <HubPill x={960} y={RY} name="Dravet" code="ORPHA:33069" w={300} h={96} fontSize={34} scale={popAt(s, 3.55)} />

      <Tag x={595} y={RY - 72} appear={prog(s, 4.6, 5.0)}>causes</Tag>
      <Tag x={595} y={RY + 104} appear={ev1}>ClinVar · Orphanet</Tag>
      <Tag x={595} y={RY + 158} appear={active1} ink>
        status: active ✓
      </Tag>

      <Tag x={1325} y={RY - 72} appear={prog(s, 7.8, 8.2)} dashed>
        cures?
      </Tag>
      <Tag x={1325} y={RY + 40} appear={prog(s, 8.4, 8.8)}>status: pending</Tag>
      <Tag x={1325} y={RY + 100} appear={block} ink>
        trigger: blocked · no evidence
      </Tag>
    </Panel>
  );
};
