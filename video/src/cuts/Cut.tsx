import React from "react";
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame, interpolate } from "remotion";
import { C, F, FPS } from "../theme";
import { SCENES, Cue } from "../scenes";
import { hasStatic, RecSlot, VoiceOver } from "../components/Media";
import type { CutDef, Item } from "./timeline";

export type CutProps = {
  /** Draft overlay: scene id, timecode and the VO line along the bottom. Render finals with guides=false. */
  guides: boolean;
  /** SFX master volume (0..1) */
  sfxVolume?: number;
};

type Placed = { item: Item; from: number; frames: number };

export function place(cut: CutDef): Placed[] {
  let from = 0;
  return cut.items.map((item) => {
    const frames = Math.round(item.sec * FPS);
    const p = { item, from, frames };
    from += frames;
    return p;
  });
}

const tc = (f: number) => {
  const s = Math.floor(f / FPS);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** A cue placed in the cut (frames), with an optional cut-off and fade for long beds. */
const CueAudio: React.FC<{ cue: Cue; from: number; stop?: number; master: number }> = ({ cue, from, stop, master }) => {
  const path = `sfx/${cue.name}.mp3`;
  if (!hasStatic(path)) return null;
  const len = stop !== undefined ? Math.max(1, stop - from) : undefined;
  const v = (cue.volume ?? 0.55) * master;
  return (
    <Sequence from={from} durationInFrames={len} layout="none" name={`sfx:${cue.name}`}>
      <Html5Audio
        src={staticFile(path)}
        volume={(f) => (len ? v * interpolate(f, [len - 12, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : v)}
      />
    </Sequence>
  );
};

const Guides: React.FC<{ cut: CutDef; placed: Placed[] }> = ({ cut, placed }) => {
  const frame = useCurrentFrame();
  const cur = placed.find((p) => frame >= p.from && frame < p.from + p.frames) ?? placed[placed.length - 1];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: "oklch(0.21 0.025 265 / 0.86)",
          color: C.onInk,
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: "12px 28px",
          minHeight: 64,
        }}
      >
        <div style={{ fontFamily: F.mono, fontSize: 20, opacity: 0.8, whiteSpace: "nowrap" }}>
          DRAFT · {cut.id} · {cur.item.id} · {tc(frame)} / {tc(placed[placed.length - 1].from + placed[placed.length - 1].frames)} · VO{" "}
          {hasStatic(`audio/vo-${cut.id}.mp3`) || hasStatic(`audio/vo-${cut.id}-${cur.item.id}.mp3`) ? "on" : "slot empty"}
        </div>
        <div style={{ fontFamily: F.body, fontSize: 24, lineHeight: 1.3 }}>
          <span style={{ fontFamily: F.mono, color: C.pheno, marginRight: 10 }}>VO ▸</span>
          {cur.item.vo}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Generic assembler: scenes + recording slots + VO + SFX, from a CutDef in timeline.ts. */
export const Cut: React.FC<CutProps & { cut: CutDef }> = ({ cut, guides, sfxVolume = 1 }) => {
  const placed = place(cut);
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      {placed.map(({ item, from, frames }) => (
        <Sequence key={item.id + from} from={from} durationInFrames={frames} premountFor={FPS} name={`${item.id} ${item.kind === "scene" ? item.scene : "REC"}`}>
          {item.kind === "scene" ? (
            React.createElement(SCENES[item.scene].component, { ...(item.props ?? {}), dur: frames })
          ) : (
            <RecSlot file={item.file} cue={item.cue} tag={item.tag} dur={frames} trimStart={item.trimStart} volume={item.volume} />
          )}
        </Sequence>
      ))}

      {/* AUDIO SLOTS — files are optional; anything missing is simply skipped */}
      <VoiceOver file={`vo-${cut.id}.mp3`} />
      {placed.map(({ item, from }) => (
        <VoiceOver key={`vo${item.id}${from}`} file={`vo-${cut.id}-${item.id}.mp3`} from={from} />
      ))}
      {hasStatic("audio/music.mp3") && <Html5Audio src={staticFile("audio/music.mp3")} volume={0.12} loop />}
      {placed.flatMap(({ item, from, frames }) => {
        if (item.kind === "scene") {
          const sc = SCENES[item.scene];
          const k = frames / (sc.natural * FPS);
          return sc.sfx.map((cue, i) => (
            <CueAudio
              key={`${item.id}${from}s${i}`}
              cue={cue}
              from={from + Math.round(cue.at * FPS * k)}
              stop={cue.until !== undefined ? from + Math.round(cue.until * FPS * k) : undefined}
              master={sfxVolume}
            />
          ));
        }
        return (item.sfx ?? []).map((cue, i) => (
          <CueAudio key={`${item.id}${from}r${i}`} cue={cue} from={from + Math.round(cue.at * FPS)} master={sfxVolume} />
        ));
      })}

      {guides && <Guides cut={cut} placed={placed} />}
    </AbsoluteFill>
  );
};
