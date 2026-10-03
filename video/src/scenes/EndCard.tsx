import React from "react";
import { C, F } from "../theme";
import { edgeFade, eInOut, prog, SceneProps, useSceneTime } from "../lib/anim";
import { LogoMark, MapBackdrop, Panel, Wordmark } from "../components/Brand";

export const END_NATURAL = 6;
export const END_SFX = [{ name: "logo-sting", at: 0.2 }];

/** Logo + tagline + URL. */
export const EndCard: React.FC<SceneProps & { url?: string }> = ({ dur, url = "nedamex.vercel.app" }) => {
  const s = useSceneTime(END_NATURAL, dur);
  const t = prog(s, 0.1, 1.2, eInOut) * 1.3;
  const a = prog(s, 0.8, 1.4);
  const b = prog(s, 1.3, 1.9);
  const c = prog(s, 1.9, 2.5);
  return (
    <Panel fade={edgeFade(s, END_NATURAL, 0.25, 0.5)}>
      <MapBackdrop p={prog(s, 0, 2.5)} opacity={0.09} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <LogoMark size={150} t={t} />
          <div style={{ opacity: a }}>
            <Wordmark size={128} />
          </div>
        </div>
        <div
          style={{
            fontFamily: F.display,
            fontWeight: 900,
            fontSize: 96,
            letterSpacing: "-0.035em",
            color: C.ink,
            marginTop: 54,
            opacity: b,
            transform: `translateY(${(1 - b) * 16}px)`,
          }}
        >
          Rare disease, mapped.
        </div>
        <div style={{ fontFamily: F.body, fontSize: 46, color: C.ink2, marginTop: 14, opacity: b }}>Every answer traced to its source.</div>
        <div
          style={{
            marginTop: 56,
            background: C.ink,
            color: C.onInk,
            fontFamily: F.mono,
            fontWeight: 700,
            fontSize: 40,
            padding: "16px 34px 12px",
            borderRadius: 999,
            opacity: c,
            transform: `translateY(${(1 - c) * 12}px)`,
          }}
        >
          {url}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 40,
          textAlign: "center",
          fontFamily: F.mono,
          fontSize: 20,
          color: C.ink3,
          opacity: c,
        }}
      >
        Hack-Nation 7 · Challenge 5 · Buffalo Initiative × OpenAI
      </div>
    </Panel>
  );
};
