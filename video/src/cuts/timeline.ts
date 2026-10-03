import { C } from "../theme";
import type { Cue } from "../scenes";
import type { Caption } from "../components/Captions";

/**
 * THE EDIT LIST. Hack-Nation limits: every video ≤ 60 s.
 * Change durations (sec), VO/caption lines, recording files and trims here; the cuts rebuild themselves.
 * Scenes speed-scale to fit `sec` (keep ≥ 40% of natural length). Captions are generated from `vo`
 * (split by sentence, timed by word count) unless `captions` is given. Keep SCRIPTS.md in sync.
 */

type Base = {
  id: string;
  sec: number;
  /** spoken line; also the burned-in caption source. Text in (parentheses) is a stage direction, not captioned. */
  vo: string;
  /** explicit captions (seconds from the start of this item) — overrides auto captions */
  captions?: Caption[];
  /** small source note shown top-right while this item plays */
  note?: string;
};
export type SceneItem = Base & { kind: "scene"; scene: string; props?: Record<string, unknown> };
export type RecItem = Base & {
  kind: "rec";
  /** file under video/public/rec/ */
  file: string;
  /** what to record (shown on the placeholder) */
  cue: string;
  tag?: { text: string; color: string };
  /** seconds to skip at the start of the recording */
  trimStart?: number;
  /** volume of the recording's own audio (agent voice!) */
  volume?: number;
  /** SFX cues in real seconds from the start of this item */
  sfx?: Cue[];
  fullBleed?: boolean;
  /** placeholder header (default SCREEN RECORDING) */
  label?: string;
  hint?: string;
  lowerThird?: { name: string; role: string; color: string; at?: number; until?: number };
};
export type Item = SceneItem | RecItem;
export type CutDef = {
  id: string;
  title: string;
  items: Item[];
  /** burn captions in (judges may watch muted) */
  captioned: boolean;
  /** shrink framed content so captions never cover it (1 = off) */
  safeScale: number;
  /** one continuous recording (public/rec/<file>) that, if present, replaces all rec items of this cut */
  continuousRec?: string;
};

const whoosh: Cue[] = [{ name: "route-draw", at: 0 }];

/* ───────────────────────── DEMO · 60 s ───────────────────────── */
export const DEMO_60: CutDef = {
  id: "demo60",
  title: "Demo · 60 s (Maria's journey · Angelman)",
  captioned: true,
  safeScale: 0.86,
  items: [
    {
      id: "d01",
      kind: "scene",
      scene: "Hook",
      sec: 6,
      vo: "Maria's daughter has Angelman syndrome. No approved treatment in our sources.",
    },
    {
      id: "d02",
      kind: "rec",
      file: "demo-atlas-angelman.mp4",
      cue: "/atlas?d=ORPHA:72 → Angelman map draws → hover a station: plaque with source + date",
      tag: { text: "Angelman on the map", color: C.ink },
      sec: 10,
      sfx: whoosh,
      vo: "On the Nedamex map, her disease connects to genes, symptoms, trials and families. Every station has a source.",
    },
    {
      id: "d03",
      kind: "scene",
      scene: "Connections",
      sec: 17,
      vo: "Connections finds neighbors. Rett syndrome shares seven symptoms, two researchers, and three studies already running across genetic syndromes: useful work that already exists. CDKL5 shares twelve symptoms, the strongest overlap.",
    },
    {
      id: "d04",
      kind: "rec",
      file: "demo-voice-diet.mp4",
      cue: "Family Guide (voice) on Angelman: “Can a special diet cure it?” → “There is no evidence in our sources for that…”",
      tag: { text: "Family Guide (voice)", color: C.treat },
      sec: 10,
      sfx: whoosh,
      vo: "Maria asks the Family Guide: can a special diet cure it? (agent answers)",
      captions: [
        { at: 0.2, until: 2.2, text: "Maria asks the Family Guide…" },
        { at: 2.2, until: 4.6, who: "Maria", whoColor: C.comm, text: "“Can a special diet cure it?”" },
        { at: 4.8, until: 9.8, who: "Family Guide", whoColor: C.treat, text: "“There is no evidence in our sources for that…”" },
      ],
    },
    {
      id: "d05",
      kind: "scene",
      scene: "NextStep",
      sec: 12,
      vo: "Next step: ask the PIXI team if Angelman families can join, and invite the two shared researchers to a joint call. Still to validate: do shared symptoms share a mechanism?",
    },
    { id: "d06", kind: "scene", scene: "EndCard", sec: 5, vo: "Nedamex. Every answer traced to its source." },
  ],
};

/* ───────────────────────── TECH · 60 s ───────────────────────── */
export const TECH_60: CutDef = {
  id: "tech60",
  title: "Tech · 60 s (how we built it)",
  captioned: true,
  safeScale: 0.86,
  items: [
    {
      id: "t01",
      kind: "scene",
      scene: "Architecture",
      sec: 13,
      vo: "Seven open sources feed a Supabase Edge Function on pg_cron, which builds an evidence graph in Postgres. A trigger blocks any edge without evidence; a disease_links view connects diseases.",
    },
    {
      id: "t02",
      kind: "scene",
      scene: "VerifierGate",
      sec: 9,
      vo: "To answer, OpenAI drafts JSON claims with evidence IDs. A deterministic verifier drops anything unsourced, and ElevenLabs agents speak the rest.",
    },
    {
      id: "t03",
      kind: "rec",
      file: "research-portal.mp4",
      cue: "Lovable researcher portal on the same graph: Angelman ↔ Rett evidence + gaps",
      tag: { text: "Researcher portal (Lovable)", color: C.trial },
      sec: 6,
      sfx: whoosh,
      vo: "Researchers get a Lovable portal on the same graph.",
    },
    {
      id: "t04",
      kind: "scene",
      scene: "Lessons",
      sec: 18,
      vo: "What broke: Open Targets dropped knownDrugs and missed an FDA approval; we migrated and added FDA as a source. Orphanet missed genes; Monarch fills in. Trials leaked other diseases; we filter by name. Validation caught a wrong ORPHA code. No sandbox internet, so ingestion runs in Supabase.",
    },
    {
      id: "t05",
      kind: "scene",
      scene: "Stack",
      sec: 11,
      vo: "Key tools: Supabase, Next.js on Vercel, OpenAI, ElevenLabs, Lovable and Claude Code subagents. Next: clustering by mechanism, and five thousand monogenic diseases.",
    },
    { id: "t06", kind: "scene", scene: "EndCard", sec: 3, vo: "Nedamex." },
  ],
};

/* ───────────────────────── TEAM · 60 s ─────────────────────────
 * Fill the [placeholders] with real names / majors / roles before rendering.
 * Drop ONE edited clip at public/rec/team.mp4 (55 s, starts at 0:02), or three clips team-1/2/3.mp4.
 * If your clip timing differs, change the three `sec` values (they must add up to 55).
 */
export const TEAM_60: CutDef = {
  id: "team60",
  title: "Team · 60 s",
  captioned: true,
  safeScale: 1,
  continuousRec: "team.mp4",
  items: [
    { id: "tm0", kind: "scene", scene: "TitleCard", props: { line: "The team behind the map." }, sec: 2, vo: "" },
    {
      id: "tm1",
      kind: "rec",
      file: "team-1.mp4",
      cue: "Person 1 — intro + why (≈18 s)",
      label: "TEAM CLIP",
      hint: "or one edited clip for all three people → video/public/rec/team.mp4",
      fullBleed: true,
      sec: 18.3,
      lowerThird: { name: "[Name]", role: "[major] · Tecnológico de Monterrey", color: C.treat },
      note: "4.7 years to a confirmed diagnosis · EURORDIS Rare Barometer",
      vo: "Hi, I'm [Name], [major] at Tecnológico de Monterrey, Mexico. Families with a rare disease wait almost five years for a confirmed diagnosis, and researchers lose weeks searching separate databases. We're the NEDAMEX team, and we want to give them that time back.",
    },
    {
      id: "tm2",
      kind: "rec",
      file: "team-2.mp4",
      cue: "Person 2 — what we built (≈18 s)",
      label: "TEAM CLIP",
      hint: "or one edited clip for all three people → video/public/rec/team.mp4",
      fullBleed: true,
      sec: 18.3,
      lowerThird: { name: "[Name]", role: "built [the evidence graph / the voice agents]", color: C.trial },
      vo: "I'm [Name], I built [the evidence graph / the voice agents]. NEDAMEX connects genes, symptoms, treatments, trials and patient groups from seven verified databases. You can ask by text or voice and see the source behind every answer. If there isn't enough evidence, it says so.",
    },
    {
      id: "tm3",
      kind: "rec",
      file: "team-3.mp4",
      cue: "Person 3 — business + ask (≈18 s)",
      label: "TEAM CLIP",
      hint: "or one edited clip for all three people → video/public/rec/team.mp4",
      fullBleed: true,
      sec: 18.4,
      lowerThird: { name: "[Name]", role: "leads [product and business]", color: C.comm },
      vo: "I'm [Name], I lead [product and business]. Families use it for free; hospitals, biotech companies and research institutions pay for licenses. With this prize we'll cover more diseases and test it with research teams. We're looking for partners for that next step.",
    },
    { id: "tm4", kind: "scene", scene: "EndCard", sec: 3, vo: "" },
  ],
};

export const CUTS: CutDef[] = [DEMO_60, TECH_60, TEAM_60];

export const cutFrames = (c: CutDef, fps: number) => c.items.reduce((a, i) => a + Math.round(i.sec * fps), 0);
