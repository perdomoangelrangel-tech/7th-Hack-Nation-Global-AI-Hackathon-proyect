import React from "react";
import { C, F, H, W } from "../theme";
import { edgeFade, eInOut, popAt, prog, SceneProps, useSceneTime } from "../lib/anim";
import { Panel } from "../components/Brand";
import { Route, Sign, Station } from "../components/Map";

export const STACK_NATURAL = 10;
export const STACK_SFX = [
  { name: "route-draw", at: 0.4 },
  { name: "station-chime", at: 1.0 },
];

const Y = 560;
const ITEMS = [
  { name: "Next.js + Vercel", sub: "web · /api/tools/*", color: C.ink },
  { name: "Supabase", sub: "Postgres · RLS · Edge Fn · pg_cron", color: C.treat },
  { name: "ElevenLabs", sub: "voice agents · sound", color: C.comm },
  { name: "OpenAI / Claude", sub: "drafts claims, never judges", color: C.lit },
  { name: "Lovable", sub: "researcher portal", color: C.trial },
];
const XS = [250, 605, 960, 1315, 1670];

/** The stack as one line, five stations. */
export const Stack: React.FC<SceneProps> = ({ dur }) => {
  const s = useSceneTime(STACK_NATURAL, dur);
  const p = prog(s, 0.4, 4.4, eInOut);
  const at = (x: number) => 0.4 + ((x - 160) / 1600) * 3.6;
  return (
    <Panel fade={edgeFade(s, STACK_NATURAL)}>
      <Sign text="Stack" appear={prog(s, 0, 0.5)} />
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <Route d={`M 160 ${Y} L 1760 ${Y}`} color={C.ink} progress={p} width={16} />
        {XS.map((x, i) => (
          <Station key={i} x={x} y={Y} color={ITEMS[i].color} r={30} ringWidth={7} scale={popAt(s, at(x))} />
        ))}
      </svg>
      {ITEMS.map((it, i) => {
        const a = prog(s, at(XS[i]) + 0.15, at(XS[i]) + 0.65);
        const above = i % 2 === 0;
        return (
          <div
            key={it.name}
            style={{
              position: "absolute",
              left: XS[i] - 250,
              width: 500,
              top: above ? undefined : Y + 62,
              bottom: above ? H - Y + 62 : undefined,
              textAlign: "center",
              opacity: a,
              transform: `translateY(${(1 - a) * (above ? -12 : 12)}px)`,
            }}
          >
            <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 46, letterSpacing: "-0.025em", color: C.ink }}>{it.name}</div>
            <div style={{ fontFamily: F.mono, fontSize: 21, color: C.ink3, marginTop: 6, lineHeight: 1.3 }}>{it.sub}</div>
          </div>
        );
      })}
    </Panel>
  );
};
