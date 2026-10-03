import React from "react";
import { AbsoluteFill, getStaticFiles, Html5Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { C, F, FPS } from "../theme";
import { prog } from "../lib/anim";

/** True when a file exists under video/public (Studio picks up new files live). */
export function hasStatic(name: string) {
  try {
    return getStaticFiles().some((f) => f.name === name);
  } catch {
    return false;
  }
}

/**
 * SCREEN RECORDING slot. If public/rec/<file> exists it plays inside a framed screen;
 * otherwise a clearly labelled placeholder tells the team exactly what to record.
 */
export const RecSlot: React.FC<{
  file: string;
  cue: string;
  tag?: { text: string; color: string };
  dur: number;
  /** seconds to skip at the start of the recording */
  trimStart?: number;
  volume?: number;
}> = ({ file, cue, tag, dur, trimStart = 0, volume = 1 }) => {
  const frame = useCurrentFrame();
  const path = `rec/${file}`;
  const exists = hasStatic(path);
  const s = frame / FPS;
  const fade = Math.min(prog(frame, 0, 8), 1 - prog(frame, dur - 8, dur));
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      <AbsoluteFill style={{ opacity: fade }}>
        <div
          style={{
            position: "absolute",
            left: 64,
            top: 48,
            right: 64,
            bottom: 48,
            borderRadius: 18,
            border: exists ? `3px solid ${C.ink}` : `4px dashed ${C.gap}`,
            overflow: "hidden",
            background: exists ? C.ink : C.panel,
          }}
        >
          {exists ? (
            <OffthreadVideo
              src={staticFile(path)}
              trimBefore={Math.round(trimStart * FPS)}
              volume={volume}
              style={{ width: "100%", height: "100%", objectFit: "contain", background: C.canvas }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 26,
                padding: 80,
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <svg width={44} height={44} viewBox="0 0 44 44">
                  <circle cx={22} cy={22} r={16} fill={(Math.floor(s * 2) % 2 === 0) ? C.gene : C.canvas} stroke={C.ink} strokeWidth={5} />
                </svg>
                <span style={{ fontFamily: F.mono, fontSize: 34, fontWeight: 700, color: C.ink, letterSpacing: "0.06em" }}>
                  SCREEN RECORDING
                </span>
              </div>
              <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 54, color: C.ink, maxWidth: 1400, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
                {cue}
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 26, color: C.ink3 }}>
                drop file → video/public/{path} · {(dur / FPS).toFixed(1)} s
              </div>
            </div>
          )}
        </div>
        {tag && (
          <div
            style={{
              position: "absolute",
              left: 104,
              bottom: 84,
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: C.canvas,
              border: `2px solid ${C.rule}`,
              borderLeft: `10px solid ${tag.color}`,
              borderRadius: 8,
              padding: "10px 18px 8px",
              fontFamily: F.display,
              fontWeight: 800,
              fontSize: 30,
              color: C.ink,
              opacity: prog(s, 0.3, 0.8),
            }}
          >
            {tag.text}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** SFX cue: plays public/sfx/<name>.mp3 at `from` frames if the file exists. */
export const Sfx: React.FC<{ name: string; from: number; volume?: number }> = ({ name, from, volume = 0.6 }) => {
  const path = `sfx/${name}.mp3`;
  if (!hasStatic(path)) return null;
  return (
    <Sequence from={from} layout="none" name={`sfx:${name}`}>
      <Html5Audio src={staticFile(path)} volume={volume} />
    </Sequence>
  );
};

/** Voice-over: plays public/audio/<file> from `from` if it exists. */
export const VoiceOver: React.FC<{ file: string; from?: number; volume?: number }> = ({ file, from = 0, volume = 1 }) => {
  const path = `audio/${file}`;
  if (!hasStatic(path)) return null;
  return (
    <Sequence from={from} layout="none" name={`vo:${file}`}>
      <Html5Audio src={staticFile(path)} volume={volume} />
    </Sequence>
  );
};
