import React from "react";
import { C, F, H, W } from "../theme";
import { edgeFade, eInOut, popAt, prog, SceneProps, useSceneTime } from "../lib/anim";
import { Panel } from "../components/Brand";
import { Route, Sign, Station } from "../components/Map";

export const STACK_NATURAL = 12;
export const STACK_SFX = [
  { name: "route-draw", at: 0.4 },
  { name: "station-chime", at: 1.0 },
  { name: "route-draw", at: 5.0 },
];

const Y = 520;
type Item = { name: string; sub: string; color: string };
const TOOLS: Item[] = [
  { name: "Supabase", sub: "Postgres · Edge Fn · pg_cron", color: C.treat },
  { name: "Next.js + Vercel", sub: "web · /api/tools/*", color: C.ink },
  { name: "OpenAI", sub: "drafts claims only", color: C.lit },
  { name: "ElevenLabs", sub: "voice agents", color: C.comm },
  { name: "Lovable", sub: "researcher portal", color: C.trial },
  { name: "Claude Code", sub: "subagents per lane", color: C.gene },
];
const NEXT: Item[] = [
  { name: "Mechanism clustering", sub: "next", color: C.gap },
  { name: "5,000+ diseases", sub: "monogenic", color: C.gap },
];
const XS = [230, 450, 670, 890, 1110, 1330];
const NX = [1550, 1745];

/** Key tools as one solid line, then the dashed extension: what's next. */
export const Stack: React.FC<SceneProps> = ({ dur }) => {
  const s = useSceneTime(STACK_NATURAL, dur);
  const p = prog(s, 0.4, 4.4, eInOut);
  const q = prog(s, 5.0, 6.6, eInOut);
  const at = (x: number) => 0.4 + ((x - 150) / 1280) * 4.0;
  const nat = (i: number) => 5.0 + (i + 0.6) * 0.7;
  const label = (it: Item, x: number, i: number, a: number, hollow = false) => {
    const above = i % 2 === 0;
    return (
      <div
        key={it.name}
        style={{
          position: "absolute",
          left: x - 200,
          width: 400,
          top: above ? undefined : Y + 56,
          bottom: above ? H - Y + 56 : undefined,
          textAlign: "center",
          opacity: a,
          transform: `translateY(${(1 - a) * (above ? -12 : 12)}px)`,
        }}
      >
        <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 42, letterSpacing: "-0.025em", color: hollow ? C.ink3 : C.ink, lineHeight: 1.05 }}>
          {it.name}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 21, color: C.ink3, marginTop: 6 }}>{it.sub}</div>
      </div>
    );
  };
  return (
    <Panel fade={edgeFade(s, STACK_NATURAL)}>
      <Sign text="Key tools" appear={prog(s, 0, 0.5)} />
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <Route d={`M 150 ${Y} L 1430 ${Y}`} color={C.ink} progress={p} width={16} />
        <Route d={`M 1430 ${Y} L 1850 ${Y}`} color={C.gap} dashed progress={q} width={16} />
        {XS.map((x, i) => (
          <Station key={i} x={x} y={Y} color={TOOLS[i].color} r={28} ringWidth={7} scale={popAt(s, at(x))} />
        ))}
        {NX.map((x, i) => (
          <Station key={`n${i}`} x={x} y={Y} color={C.canvas} hollow r={26} ringWidth={6} scale={popAt(s, nat(i))} />
        ))}
      </svg>
      {TOOLS.map((it, i) => label(it, XS[i], i, prog(s, at(XS[i]) + 0.15, at(XS[i]) + 0.6)))}
      {NEXT.map((it, i) => label(it, NX[i], i, prog(s, nat(i) + 0.15, nat(i) + 0.6), true))}
    </Panel>
  );
};
