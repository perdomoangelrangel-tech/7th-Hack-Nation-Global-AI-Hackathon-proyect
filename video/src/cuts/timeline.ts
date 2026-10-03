import { C } from "../theme";
import type { Cue } from "../scenes";

/**
 * THE EDIT LIST. Change durations (sec), VO lines, recording files and trims here;
 * the four cuts (Pitch60, Pitch120, Tech60, Tech120) rebuild themselves.
 * Scenes are speed-scaled to fit `sec`, so any duration works (keep ≥ 40% of natural for legibility).
 * Keep SCRIPTS.md in sync with these lines.
 */

export type SceneItem = {
  id: string;
  kind: "scene";
  scene: string;
  props?: Record<string, unknown>;
  sec: number;
  vo: string;
};
export type RecItem = {
  id: string;
  kind: "rec";
  /** file under video/public/rec/ */
  file: string;
  /** what to record (shown on the placeholder) */
  cue: string;
  tag?: { text: string; color: string };
  sec: number;
  /** seconds to skip at the start of the recording */
  trimStart?: number;
  /** volume of the recording's own audio (agent voice!) */
  volume?: number;
  vo: string;
  /** SFX cues in real seconds from the start of this item */
  sfx?: Cue[];
};
export type Item = SceneItem | RecItem;
export type CutDef = { id: string; title: string; items: Item[] };

const REC = {
  treatments: {
    file: "atlas-family-treatments.mp4",
    cue: "/atlas → Dravet → Family Guide (voice): “What treatments exist?” → sourced answer",
    tag: { text: "Family Guide", color: C.treat },
  },
  diet: {
    file: "atlas-diet-no-evidence.mp4",
    cue: "Same chat: “Can a special diet cure it?” → “There is no evidence in our sources for that.”",
    tag: { text: "Verifier at work", color: C.gap },
  },
  research: {
    file: "atlas-research-gaps.mp4",
    cue: "Switch to Research → Dravet gaps (dashed lines) + researcher community",
    tag: { text: "Research Analyst", color: C.comm },
  },
  landing: {
    file: "landing-scroll.mp4",
    cue: "Landing: slow scroll, the route draws itself",
  },
  tools: {
    file: "api-tools-treatments.mp4",
    cue: "Browser: /api/tools/treatments?q=Dravet → data + evidence[] (source, url, retrieved_at)",
    tag: { text: "/api/tools/treatments", color: C.ink },
  },
  tests: {
    file: "verifier-tests.mp4",
    cue: "Terminal: npm test → verifier tests green (claims without evidence dropped)",
    tag: { text: "verifier.test.ts", color: C.ink },
  },
  portal: {
    file: "research-portal.mp4",
    cue: "Lovable researcher portal: Dravet evidence + gaps",
    tag: { text: "Researcher portal (Lovable)", color: C.trial },
  },
};
const whoosh: Cue[] = [{ name: "route-draw", at: 0 }];

export const PITCH_120: CutDef = {
  id: "pitch120",
  title: "Pitch · 2 min",
  items: [
    { id: "p01", kind: "scene", scene: "OdysseyRoute", sec: 18, vo: "For families facing a rare disease, the road to a diagnosis looks like this. Doctor after doctor, test after test: four point seven years on average. Then the news: ninety-five percent of rare diseases have no approved treatment. Three hundred million people live this." },
    { id: "p02", kind: "scene", scene: "TitleCard", sec: 4, vo: "This is Nedamex. Rare disease, mapped." },
    { id: "p03", kind: "scene", scene: "MapBuild", sec: 12, vo: "We turned seven open medical databases into one evidence map: genes, symptoms, treatments, trials, research, and the people who can help. Every station has a source." },
    { id: "p04", kind: "rec", ...REC.treatments, sec: 16, sfx: whoosh, vo: "Pick a disease. Ask in your own words. (let the Family Guide answer)" },
    { id: "p05", kind: "scene", scene: "AskAnswer", sec: 10, vo: "Each answer is built from stations on the map. If a claim has no source, it never reaches your ears." },
    { id: "p06", kind: "rec", ...REC.diet, sec: 10, sfx: whoosh, vo: "Now the hard question. (let the agent say: no evidence in our sources)" },
    { id: "p07", kind: "scene", scene: "VerifierGate", sec: 8, vo: "That's our verifier. Code, not another AI. No evidence ID, no sentence." },
    { id: "p08", kind: "rec", ...REC.research, sec: 10, sfx: whoosh, vo: "Researchers switch lines and see the gaps: where evidence is missing, and who is working on it." },
    { id: "p09", kind: "scene", scene: "RidersAndFares", sec: 14, vo: "Families ride free, always. Clinics, patient groups and pharma pay for the professional lines, because over eighty percent of rare-disease trials are delayed by recruitment." },
    { id: "p10", kind: "scene", scene: "ScaleNetwork", sec: 9, vo: "We map five diseases today. The same pipeline scales to more than five thousand." },
    { id: "p11", kind: "rec", ...REC.landing, sec: 4, vo: "And it's live." },
    { id: "p12", kind: "scene", scene: "EndCard", sec: 5, vo: "Nedamex. Every answer traced to its source." },
  ],
};

export const PITCH_60: CutDef = {
  id: "pitch60",
  title: "Pitch · 60 s",
  items: [
    { id: "p01", kind: "scene", scene: "OdysseyRoute", sec: 11, vo: "For families facing a rare disease, a diagnosis takes four point seven years on average. And ninety-five percent of these diseases have no approved treatment." },
    { id: "p02", kind: "scene", scene: "TitleCard", sec: 3, vo: "This is Nedamex." },
    { id: "p03", kind: "scene", scene: "MapBuild", sec: 7, vo: "Seven open databases, one evidence map. Every station has a source." },
    { id: "p04", kind: "rec", ...REC.treatments, sec: 10, sfx: whoosh, vo: "Pick a disease and just ask. (agent answers)" },
    { id: "p06", kind: "rec", ...REC.diet, sec: 8, sfx: whoosh, vo: "No source? It says so. (agent: no evidence)" },
    { id: "p09", kind: "scene", scene: "RidersAndFares", sec: 9, vo: "Families ride free. Clinics, patient groups and pharma pay for the professional lines." },
    { id: "p10", kind: "scene", scene: "ScaleNetwork", sec: 6, vo: "Five diseases today. Five thousand plus with the same pipeline." },
    { id: "p12", kind: "scene", scene: "EndCard", sec: 6, vo: "Nedamex. Every answer traced to its source." },
  ],
};

export const TECH_120: CutDef = {
  id: "tech120",
  title: "Tech · 2 min",
  items: [
    { id: "t01", kind: "scene", scene: "TitleCard", props: { line: "Under the map." }, sec: 4, vo: "Here's what's under the map." },
    { id: "t02", kind: "scene", scene: "Architecture", sec: 28, vo: "Seven open sources: Orphanet, HPO, Monarch, ClinVar, ClinicalTrials.gov, Open Targets and PubMed. A Supabase Edge Function ingests them, and pg_cron runs it every day. Everything lands in one evidence graph in Postgres. When you ask, the voice agent calls read-only tools, the LLM drafts JSON claims with evidence IDs, and a deterministic verifier decides what gets spoken." },
    { id: "t03", kind: "scene", scene: "DataModel", sec: 16, vo: "The graph is three tables: entities, edges and evidence. Edges are born pending, and a database trigger only lets them go active once evidence exists. No edge without evidence, enforced by Postgres, not by a prompt." },
    { id: "t04", kind: "rec", ...REC.tools, sec: 14, sfx: whoosh, vo: "Here's a tool call. Treatments for Dravet come back as data plus evidence: source, external ID, URL and retrieval date." },
    { id: "t05", kind: "scene", scene: "VerifierGate", sec: 14, vo: "The verifier is plain code. Every claim must cite an evidence ID returned in this turn. Anything else is dropped and replaced with: there is no evidence in our sources for that. No LLM judging an LLM." },
    { id: "t06", kind: "rec", ...REC.tests, sec: 10, sfx: whoosh, vo: "And it's tested: claims without evidence, or with invented IDs, never pass." },
    { id: "t07", kind: "scene", scene: "ScaleNetwork", props: { tech: true }, sec: 12, vo: "To scale, the seed list becomes Orphadata's classification: five thousand plus monogenic diseases. Ingestion is queued, Postgres carries about ten million edges, and row-level security makes it multi-tenant." },
    { id: "t08", kind: "scene", scene: "Stack", sec: 10, vo: "The stack: Next.js on Vercel, Supabase, ElevenLabs voice agents, OpenAI or Claude for drafting only, and a Lovable portal for researchers." },
    { id: "t09", kind: "rec", ...REC.portal, sec: 6, sfx: whoosh, vo: "Same graph, same rules, everywhere." },
    { id: "t10", kind: "scene", scene: "EndCard", sec: 6, vo: "Nedamex. Every answer traced to its source." },
  ],
};

export const TECH_60: CutDef = {
  id: "tech60",
  title: "Tech · 60 s",
  items: [
    { id: "t01", kind: "scene", scene: "TitleCard", props: { line: "Under the map." }, sec: 3, vo: "Under the map." },
    { id: "t02", kind: "scene", scene: "Architecture", sec: 16, vo: "Seven open sources flow through a daily Supabase Edge Function into one evidence graph. Voice agents call read-only tools, the LLM drafts claims with evidence IDs, and a deterministic verifier decides what's spoken." },
    { id: "t03", kind: "scene", scene: "DataModel", sec: 8, vo: "Edges stay pending until evidence exists. A Postgres trigger enforces it." },
    { id: "t05", kind: "scene", scene: "VerifierGate", sec: 9, vo: "No evidence ID, no sentence. Plain code, no LLM judging an LLM." },
    { id: "t04", kind: "rec", ...REC.tools, sec: 8, sfx: whoosh, vo: "Every tool returns data plus its evidence." },
    { id: "t07", kind: "scene", scene: "ScaleNetwork", props: { tech: true }, sec: 7, vo: "Same pipeline, five thousand plus diseases, multi-tenant from day one." },
    { id: "t08", kind: "scene", scene: "Stack", sec: 5, vo: "Next.js, Supabase, ElevenLabs, OpenAI or Claude, Lovable." },
    { id: "t10", kind: "scene", scene: "EndCard", sec: 4, vo: "Nedamex." },
  ],
};

export const CUTS: CutDef[] = [PITCH_60, PITCH_120, TECH_60, TECH_120];

export const cutFrames = (c: CutDef, fps: number) => c.items.reduce((a, i) => a + Math.round(i.sec * fps), 0);
