import React from "react";
import { AbsoluteFill, Html5Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, interpolate } from "remotion";
import { C, F, FPS } from "../theme";
import { SCENES, Cue } from "../scenes";
import { hasStatic, RecSlot, VoiceOver } from "../components/Media";
import { autoCaptions, Captions, LowerThird } from "../components/Captions";
import type { CutDef, Item } from "./timeline";

export type CutProps = {
  /** Draft overlay (top strip): cut, item id, timecode, VO slot status. Render finals with guides=false. */
  guides: boolean;
  /** Burned-in captions (default on for every cut). */
  captions?: boolean;
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
  const end = placed[placed.length - 1].from + placed[placed.length - 1].frames;
  const vo = hasStatic(`audio/vo-${cut.id}.mp3`) || hasStatic(`audio/vo-${cut.id}-${cur.item.id}.mp3`);
  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        top: 12,
        background: "oklch(0.21 0.025 265 / 0.8)",
        color: C.onInk,
        fontFamily: F.mono,
        fontSize: 18,
        padding: "5px 12px 3px",
        borderRadius: 6,
        pointerEvents: "none",
      }}
    >
      DRAFT · {cut.id} · {cur.item.id} · {tc(frame)} / {tc(end)} · VO {vo ? "on" : "slot empty"}
    </div>
  );
};

const Note: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      right: 40,
      top: 52,
      background: "oklch(0.985 0.003 250 / 0.92)",
      color: C.ink2,
      fontFamily: F.mono,
      fontSize: 20,
      padding: "6px 12px 4px",
      borderRadius: 6,
    }}
  >
    {text}
  </div>
);

/** Generic assembler: scenes + recording slots + captions + lower thirds + VO + SFX, from a CutDef in timeline.ts. */
export const Cut: React.FC<CutProps & { cut: CutDef }> = ({ cut, guides, captions = true, sfxVolume = 1 }) => {
  const placed = place(cut);
  const recs = placed.filter((p) => p.item.kind === "rec");
  const continuous = cut.continuousRec && hasStatic(`rec/${cut.continuousRec}`) && recs.length > 0;
  const recFrom = recs.length ? recs[0].from : 0;
  const recFrames = recs.reduce((a, p) => a + p.frames, 0);
  const showCaps = cut.captioned && captions;

  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      {continuous && (
        <Sequence from={recFrom} durationInFrames={recFrames} name={`REC ${cut.continuousRec}`}>
          <OffthreadVideo src={staticFile(`rec/${cut.continuousRec}`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Sequence>
      )}
      {placed.map(({ item, from, frames }) => {
        const full = item.kind === "rec" && item.fullBleed;
        const scale = full ? 1 : cut.safeScale;
        const caps = item.captions ?? autoCaptions(item.vo, item.sec);
        let body: React.ReactNode = null;
        if (item.kind === "scene") body = React.createElement(SCENES[item.scene].component, { ...(item.props ?? {}), dur: frames });
        else if (!continuous)
          body = (
            <RecSlot
              file={item.file}
              cue={item.cue}
              tag={item.tag}
              dur={frames}
              trimStart={item.trimStart}
              volume={item.volume}
              fullBleed={item.fullBleed}
              label={item.label}
              hint={item.hint}
            />
          );
        return (
          <Sequence key={item.id + from} from={from} durationInFrames={frames} premountFor={FPS} name={`${item.id} ${item.kind === "scene" ? item.scene : "REC"}`}>
            {body && (
              <AbsoluteFill style={scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: "50% 12%" } : undefined}>{body}</AbsoluteFill>
            )}
            {item.kind === "rec" && item.lowerThird && (
              <LowerThird
                name={item.lowerThird.name}
                role={item.lowerThird.role}
                color={item.lowerThird.color}
                at={item.lowerThird.at ?? 0.4}
                until={item.lowerThird.until ?? 6}
              />
            )}
            {item.note && <Note text={item.note} />}
            {showCaps && <Captions caps={caps} />}
          </Sequence>
        );
      })}

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
