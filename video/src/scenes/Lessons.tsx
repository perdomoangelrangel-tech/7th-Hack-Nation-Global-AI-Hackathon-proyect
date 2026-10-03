import React from "react";
import { C, F } from "../theme";
import { edgeFade, eInOut, popAt, prog, SceneProps, useSceneTime } from "../lib/anim";
import { Panel } from "../components/Brand";
import { Sign } from "../components/Map";

export const LESSONS_NATURAL = 16;
export const LESSONS_SFX = [
  { name: "no-evidence", at: 0.5 },
  ...[1.5, 3.7, 5.9, 8.1, 10.3, 12.5].map((at) => ({ name: "station-chime", at })),
];

/** What didn't work → what we did. Dashed (broken) segment turns into a solid line. */
const ROWS = [
  { src: "Open Targets", problem: "knownDrugs removed mid-hackathon", fix: "drugAndClinicalCandidates", mono: true },
  { src: "Open Targets", problem: "missed an FDA approval (ganaxolone, CDKL5)", fix: "FDA added as a curated source" },
  { src: "Orphanet", problem: "no genes for some diseases", fix: "Monarch fallback" },
  { src: "ClinicalTrials.gov", problem: "returned other diseases' trials", fix: "disease-name filter" },
  { src: "ORPHA code", problem: "CLN8 used instead of CLN2", fix: "caught in validation" },
  { src: "dev sandbox", problem: "no internet to the sources", fix: "ingestion inside Supabase" },
];
const TOP = 160;
const STEP = 128;
const X1 = 1000; // broken segment start
const X2 = 1180; // fix station

export const Lessons: React.FC<SceneProps> = ({ dur }) => {
  const s = useSceneTime(LESSONS_NATURAL, dur);
  const at = (i: number) => 0.5 + i * 2.2;
  return (
    <Panel fade={edgeFade(s, LESSONS_NATURAL)}>
      <Sign text="What didn't work" appear={prog(s, 0, 0.5)} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {ROWS.map((r, i) => {
          const y = TOP + i * STEP + 34;
          const draw = prog(s, at(i) + 0.3, at(i) + 0.9, eInOut);
          const fixed = prog(s, at(i) + 1.0, at(i) + 1.4);
          const L = X2 - X1;
          return (
            <g key={i}>
              {/* broken (dashed) then repaired (solid) */}
              <line x1={X1} y1={y} x2={X1 + L * draw} y2={y} stroke={C.gap} strokeWidth={10} strokeLinecap="round" strokeDasharray="2 14" opacity={1 - fixed} />
              <line x1={X1} y1={y} x2={X2} y2={y} stroke={C.treat} strokeWidth={14} strokeLinecap="round" opacity={fixed} />
              <g transform={`translate(${X1} ${y}) scale(${popAt(s, at(i))})`}>
                <circle r={17} fill={C.canvas} stroke={C.gap} strokeWidth={5} strokeDasharray="6 5" />
              </g>
              <g transform={`translate(${X2} ${y}) scale(${popAt(s, at(i) + 1.0)})`}>
                <circle r={19} fill={C.treat} stroke={C.ink} strokeWidth={5} />
              </g>
            </g>
          );
        })}
      </svg>
      {ROWS.map((r, i) => {
        const y = TOP + i * STEP;
        const a = prog(s, at(i), at(i) + 0.4);
        const b = prog(s, at(i) + 1.1, at(i) + 1.5);
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", right: 1920 - X1 + 40, top: y, width: 820, textAlign: "right", opacity: a }}>
              <div style={{ fontFamily: F.mono, fontSize: 21, color: C.ink3 }}>{r.src}</div>
              <div style={{ fontFamily: F.display, fontWeight: 750, fontSize: 38, color: C.ink2, letterSpacing: "-0.01em", marginTop: 2 }}>{r.problem}</div>
            </div>
            <div style={{ position: "absolute", left: X2 + 40, top: y + 16, opacity: b, transform: `translateX(${(1 - b) * 16}px)` }}>
              <div
                style={{
                  fontFamily: r.mono ? F.mono : F.display,
                  fontWeight: r.mono ? 700 : 850,
                  fontSize: r.mono ? 34 : 40,
                  color: C.ink,
                  letterSpacing: r.mono ? 0 : "-0.02em",
                }}
              >
                {r.fix}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </Panel>
  );
};
