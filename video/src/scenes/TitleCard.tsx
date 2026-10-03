import React from "react";
import { C, F } from "../theme";
import { edgeFade, eInOut, mix, prog, SceneProps, useSceneTime } from "../lib/anim";
import { LogoMark, MapBackdrop, Panel, Wordmark } from "../components/Brand";

export const TITLE_NATURAL = 5;
export const TITLE_SFX = [
  { name: "route-draw", at: 0.2 },
  { name: "station-chime", at: 1.3 },
];

/** Logo mark draws itself, wordmark arrives, one line under it. ≤ 6 words. */
export const TitleCard: React.FC<SceneProps & { line?: string; sub?: string }> = ({
  dur,
  line = "Rare disease, mapped.",
  sub,
}) => {
  const s = useSceneTime(TITLE_NATURAL, dur);
  const t = prog(s, 0.2, 1.6, eInOut) * 1.3;
  const word = prog(s, 1.1, 1.9);
  const tag = prog(s, 1.8, 2.6);
  const subP = prog(s, 2.3, 3.1);
  return (
    <Panel fade={edgeFade(s, TITLE_NATURAL)}>
      <MapBackdrop p={prog(s, 0, 3.5)} opacity={0.1} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          transform: `scale(${mix(prog(s, 0, TITLE_NATURAL, (x) => x), 1, 1.03)})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
          <LogoMark size={220} t={t} />
          <div style={{ opacity: word, transform: `translateX(${(1 - word) * -30}px)` }}>
            <Wordmark size={190} />
          </div>
        </div>
        <div
          style={{
            fontFamily: F.display,
            fontWeight: 800,
            fontSize: 88,
            letterSpacing: "-0.025em",
            color: C.ink,
            opacity: tag,
            transform: `translateY(${(1 - tag) * 20}px)`,
          }}
        >
          {line}
        </div>
        {sub && (
          <div style={{ fontFamily: F.body, fontSize: 40, color: C.ink2, opacity: subP, marginTop: -16 }}>{sub}</div>
        )}
      </div>
    </Panel>
  );
};
