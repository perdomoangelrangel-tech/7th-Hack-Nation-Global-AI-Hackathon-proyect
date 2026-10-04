"use client";
/**
 * Maria's route, one question at a time (UX_WAVE4 S2/S4): a 1→4 stepper with Back/Next and ●●○○ progress,
 * then "Your route is ready" with co-create at the end. Every answer opens its evidence; opening a step
 * lights its edges in the graph. Raw similarity scores never appear here (Strong/Possible/Weak lead instead).
 * Data: GET /api/journey (Journey v2, action lane). The `j` prop (v1, from AtlasApp) renders the header instantly.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Microscope, ChevronLeft, ChevronRight, CircleCheck, CircleDot, Dna, FastForward, FilePlus2, Footprints, GitCompareArrows, Handshake, Info, Lightbulb, ListChecks, Recycle, Share2, Users, Waypoints, type LucideIcon } from "lucide-react";
import type { Journey } from "@/lib/atlas/store";
import { dict, type Dict, type Locale } from "@/lib/i18n";
import type { PersonaId } from "@/lib/agents/profiles";
import type { AssetCard, CollaboratorCard, JourneyV2, NoneFound, QuestionId, StepCard } from "@/lib/journey/build";
import { motionTokens, springs } from "@/lib/motion";
import { journeyCopy, type JourneyCopy } from "@/components/journey/copy";
import { KindBadge, RecommendationBadge, StrengthBadge, weakestKind } from "@/components/journey/KindBadge";
import { isNoRoute, useJourney, useUrlParam } from "@/components/journey/useJourney";
import { TenXButton } from "@/components/journey/TenXButton";
import { openCoCreate } from "@/components/journey/events";
import { Partners } from "@/components/cocreate/Partners";
import { PanelHeader, PanelState } from "@/components/ui/PanelHeader";
import { PatientView } from "@/components/journey/PatientView";

interface Props {
  j: Journey; t: Dict;
  onInspect: (edgeId: string) => void;
  onHover: (nodes: string[], edges: string[]) => void;
  onFocusDisease: (id: string) => void;
  persona?: PersonaId; locale?: Locale;
}

const PERSONA_IDS = ["devon", "maria", "osei", "priya"] as const;
type Hoverable = (nodes: string[], edges: string[]) => Record<string, () => void>;
export const STEP_ICON: Record<QuestionId, LucideIcon> = { connections: GitCompareArrows, assets: Recycle, people: Handshake, next: Footprints };
const DONE = 4;

/** Step index from `?step=` (1–4 or "done"); a new disease always starts at step 1. */
let lastDisease: string | null = null;
function initialStep(disease: string): number {
  if (typeof window === "undefined") return 0;
  const fresh = lastDisease !== null && lastDisease !== disease;
  lastDisease = disease;
  if (fresh) return 0;
  const s = new URLSearchParams(window.location.search).get("step");
  if (s === "done") return DONE;
  const n = Number(s);
  return n >= 1 && n <= 4 ? n - 1 : 0;
}

export function JourneyPanel({ j, t, onInspect, onHover, onFocusDisease, persona: pp, locale: lp }: Props) {
  const locale: Locale = lp ?? (t.q1 === dict.es.q1 ? "es" : "en");
  const persona = useUrlParam<PersonaId>("p", "maria", PERSONA_IDS, pp);
  // Mode variants (UX_WAVE4 S2): Patient = four plain cards · Researcher = tabs · Family & Pharma = the 1→4 stepper.
  const mode = persona === "devon" ? "patient" : persona === "osei" ? "researcher" : "route";
  const c = journeyCopy[locale];
  const { data, loading, error, retry } = useJourney(j.disease.id, persona, locale);
  const v2 = data && !isNoRoute(data) ? data : null;
  const [step, setStep] = useState(() => initialStep(j.disease.id));
  const [depth, setDepth] = useState(false);
  const reduce = useReducedMotion();
  const leave = () => onHover([], []);
  const hoverable: Hoverable = (nodes, edges) => ({ onMouseEnter: () => onHover(nodes, edges), onMouseLeave: leave, onFocus: () => onHover(nodes, edges), onBlur: leave });
  const Q: Record<QuestionId, string> = { connections: t.q1, assets: t.q2, people: t.q3, next: t.q4 };

  const nodesFor = useCallback((q: QuestionId, x: JourneyV2): string[] => {
    const d = x.disease.id;
    if (q === "connections") return [d, ...x.connections.neighbors.map((n) => n.disease)];
    if (q === "assets") return [d, ...x.assets.own.slice(0, 3).map((a) => a.id), ...x.assets.reusable.slice(0, 3).map((a) => a.id)];
    if (q === "people") return [d, ...x.people.collaborators.slice(0, 5).map((p) => p.id)];
    return [d, ...x.next.steps.flatMap((s) => s.nodes)];
  }, []);

  // The URL is the state (?step=…), and "the map responds": opening a step lights its cited edges.
  const announce = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (mode !== "route") return;
    const u = new URL(window.location.href);
    u.searchParams.set("step", step === DONE ? "done" : String(step + 1));
    window.history.replaceState(null, "", u.toString());
    if (!v2) return;
    if (step < DONE) { const q = v2.order[step]; onHover(nodesFor(q, v2), v2.summary[q].cite.edges); if (announce.current) announce.current.textContent = c.announce(step + 1, 4, Q[q]); }
    else { onHover([], []); if (announce.current) announce.current.textContent = c.ready; }
    // onHover/Q/c change identity every render; the step and the data are what matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, v2, mode]);

  const go = useCallback((n: number) => { setDepth(false); setStep(Math.max(0, Math.min(DONE, n))); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.altKey || e.metaKey || e.ctrlKey || document.querySelector("dialog[open]") || (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) return;
      if (mode !== "route") return;
      if (e.key === "ArrowRight") go(step + 1);
      if (e.key === "ArrowLeft") go(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, step, mode]);

  const groups = v2?.people.collaborators.filter((p) => p.kind === "patient_org" && p.diseases.some((d) => d.id === j.disease.id)).length ?? 0;
  const showVariant = persona === "osei" || persona === "priya";
  const nextRecords = v2 ? new Set(v2.next.steps.flatMap((s) => s.cite.evidence)).size : 0;

  return (
    <div className="flex flex-col lg:min-h-0 lg:h-full">
      <header className="px-5 pt-5 pb-4 border-b border-line">
        <div className="flex items-start gap-2">
          <CircleDot size={18} className="mt-1.5 shrink-0" style={{ color: j.cluster?.color ?? "var(--brand)" }} aria-hidden />
          <h2 className="serif text-xl leading-snug text-brand-ink flex-1">{j.disease.full_name}</h2>
          <span className="text-[11px] text-ink-3 mt-1.5 shrink-0">{j.disease.canonical_id}</span>
        </div>
        {j.disease.definition && mode !== "patient" && <p className="text-sm text-ink-2 mt-2 line-clamp-2" title={j.disease.definition}>{j.disease.definition}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {j.disease.variant_effect && <span className="chip"><Dna size={13} aria-hidden />{j.disease.variant_effect.gene}</span>}
          {j.cluster && <span className="chip" title={j.cluster.label_basis}><Waypoints size={13} aria-hidden />{j.cluster.label}</span>}
          {v2 && <span className="chip"><Users size={13} aria-hidden />{c.groups(groups)}</span>}
        </div>
        {showVariant && j.disease.variant_effect && (
          <button className="mt-3 w-full text-left group text-xs" onClick={() => onInspect(j.disease.variant_effect!.edge)}>
            <span className="text-ink-3">{t.variant_effect} · {j.disease.variant_effect.gene}</span>
            <span className="mt-1 h-1.5 rounded-full overflow-hidden flex bg-paper-2" aria-hidden>
              <span className="bg-brand-deep" style={{ width: `${j.disease.variant_effect.lof_fraction * 100}%` }} />
              <span className="bg-brand" style={{ width: `${j.disease.variant_effect.missense_fraction * 100}%` }} />
            </span>
            <span className="mt-1 block text-ink-2 group-hover:underline">{Math.round(j.disease.variant_effect.lof_fraction * 100)}% truncating · {Math.round(j.disease.variant_effect.missense_fraction * 100)}% missense · n={j.disease.variant_effect.n} (ClinVar)</span>
          </button>
        )}
      </header>

      <div className="lg:flex-1 lg:overflow-y-auto px-5 py-4">
        <PanelHeader icon={mode === "patient" ? Info : mode === "researcher" ? Microscope : Footprints} level={3} id="route-h"
          title={mode === "patient" ? c.patient_title : mode === "researcher" ? c.research_title : c.your_route}
          subtitle={mode === "patient" ? c.patient_sub : mode === "researcher" ? c.research_sub : c.route_sub}
          info={mode === "patient" ? c.patient_info : c.route_info}
          actions={mode === "route" ? (
            <span className="flex items-center gap-2">
              <span className="flex gap-1" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className={`w-2 h-2 rounded-full ${i < step || step === DONE ? "bg-brand-deep" : i === step ? "bg-brand" : "bg-line"}`} />)}</span>
              <span className="text-[11px] text-ink-3 tabular-nums">{step === DONE ? c.step_of(4, 4) : c.step_of(step + 1, 4)}</span>
            </span>
          ) : undefined} />
        <p ref={announce} className="sr-only" aria-live="polite" />

        {(loading || error) && <PanelState status={error ? "error" : "loading"} onRetry={retry} skeleton={4} className="mt-3" />}
        {v2?.no_route && <NoneCard none={v2.no_route} c={c} badge={c.no_route_badge} coverage={v2.coverage} className="mt-3" />}

        {v2 && mode === "patient" && <PatientView x={v2} locale={locale} onInspect={onInspect} onHover={onHover} />}
        {v2 && mode === "researcher" && <ResearcherView x={v2} t={t} c={c} locale={locale} onInspect={onInspect} onFocusDisease={onFocusDisease} hoverable={hoverable} />}
        {v2 && mode === "route" && step === DONE && <RouteReady x={v2} c={c} Q={Q} locale={locale} onInspect={onInspect} hoverable={hoverable} onReview={() => go(0)} reduce={!!reduce} />}

        {v2 && mode === "route" && step < DONE && (
          <>
            <ol className="mt-3 space-y-2">
              {v2.order.map((q, i) => {
                const s = v2.summary[q];
                const Icon = STEP_ICON[q];
                const state = i < step ? "done" : i === step ? "current" : "todo";
                const hasCite = s.cite.edges.length > 0;
                return (
                  <li key={q} className={`rounded-xl border bg-paper transition-colors ${state === "current" ? "border-brand/60 shadow-sm" : "border-line"}`}>
                    <button className="w-full text-left px-3.5 py-3 flex gap-3 items-start" aria-current={state === "current" ? "step" : undefined} onClick={() => go(i)} {...hoverable(nodesFor(q, v2), s.cite.edges)}>
                      <span className={`mt-0.5 w-6 h-6 rounded-full grid place-items-center text-xs font-semibold shrink-0 ${state === "done" ? "bg-brand-deep text-white" : state === "current" ? (hasCite ? "bg-brand text-white" : "bg-amber text-white") : "border border-line text-ink-3"}`}>
                        {state === "done" ? <CircleCheck size={14} aria-hidden /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-3"><Icon size={13} aria-hidden />{Q[q]}</span>
                        {state !== "todo" && <span className={`block mt-0.5 ${state === "current" ? "text-sm text-ink" : "text-xs text-ink-2 line-clamp-1"}`}>{s.text}</span>}
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {state === "current" && (
                        <motion.div key="cur" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduce ? 0.12 : motionTokens.duration.normal, ease: motionTokens.easing.smooth }} className="overflow-hidden">
                          <div className="px-3.5 pb-3.5 pl-[3.25rem]">
                            <div className="flex flex-wrap items-center gap-2">
                              {q === "next" ? (hasCite && <RecommendationBadge records={nextRecords} c={c} />) : hasCite && <KindBadge kind={weakestKind(s.cite.kinds)} c={c} />}
                              {q === "connections" && v2.connections.neighbors[0] && <StrengthBadge {...v2.connections.neighbors[0].strength} />}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                              {hasCite && <button onClick={() => onInspect(s.cite.edges[0])} className="font-medium text-brand-deep hover:underline">{c.see_evidence} →</button>}
                              <button onClick={() => setDepth((x) => !x)} aria-expanded={depth} className="text-ink-2 hover:underline">{depth ? c.less : c.more}</button>
                            </div>
                            {depth && (
                              <div className="mt-1 border-t border-line">
                                {q === "connections" && <Connections x={v2} t={t} c={c} onInspect={onInspect} onFocusDisease={onFocusDisease} hoverable={hoverable} />}
                                {q === "assets" && <Assets x={v2} t={t} c={c} onInspect={onInspect} hoverable={hoverable} />}
                                {q === "people" && <People x={v2} t={t} c={c} onInspect={onInspect} hoverable={hoverable} />}
                                {q === "next" && <Next x={v2} c={c} onInspect={onInspect} hoverable={hoverable} />}
                              </div>
                            )}
                            {q === "people" && <Partners persona={persona} locale={locale} disease={v2.disease.id} journey={v2} defaultOpen onPropose={(d) => openCoCreate("collaboration", d)} />}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ol>
            <div className="mt-3 flex items-center justify-between">
              <button onClick={() => go(step - 1)} disabled={step === 0} className="inline-flex items-center gap-1 rounded-full border border-line px-3.5 py-2 text-sm text-ink-2 hover:bg-paper-2 disabled:opacity-40 min-h-10"><ChevronLeft size={16} aria-hidden />{c.back}</button>
              <button onClick={() => go(step + 1)} className="inline-flex items-center gap-1 rounded-full bg-brand-deep px-4 py-2 text-sm font-semibold text-white hover:bg-brand-ink min-h-10">{step === 3 ? c.finish : c.next}<ChevronRight size={16} aria-hidden /></button>
            </div>
          </>
        )}
      </div>
      <p className="px-5 py-3 border-t border-line text-[11px] text-ink-3 flex gap-1.5 items-start"><Info size={13} className="shrink-0 mt-px" aria-hidden /><span>{v2?.disclaimer ?? t.disclaimer}</span></p>
    </div>
  );
}

/* ------------------------------ S4 · your route is ready ------------------------------ */

function RouteReady({ x, c, Q, locale, onInspect, hoverable, onReview, reduce }: { x: JourneyV2; c: JourneyCopy; Q: Record<QuestionId, string>; locale: Locale; onInspect: (e: string) => void; hoverable: Hoverable; onReview: () => void; reduce: boolean }) {
  const [copied, setCopied] = useState(false);
  const share = () => {
    const u = new URL(window.location.href); u.searchParams.set("step", "done");
    void navigator.clipboard?.writeText(u.toString()).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2500); });
  };
  const plan = `/plan?d=${encodeURIComponent(x.disease.id)}&p=${x.persona}&l=${locale}`;
  return (
    <motion.section initial={{ opacity: 0, y: reduce ? 0 : motionTokens.distance.sm }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0.12 } : springs.gentle}
      className="mt-3 rounded-2xl border border-brand/50 bg-brand-mist p-4" aria-labelledby="route-ready">
      <div className="flex items-center gap-2">
        <motion.span initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springs.snappy}><CircleCheck size={22} className="text-brand-deep" aria-hidden /></motion.span>
        <h3 id="route-ready" className="serif text-xl text-brand-ink">{c.ready}</h3>
      </div>
      <p className="text-xs text-ink-3 mt-0.5">{c.ready_sub}</p>
      <ol className="mt-3 space-y-1.5">
        {(["connections", "assets", "people", "next"] as const).map((q) => {
          const s = x.summary[q]; const Icon = STEP_ICON[q];
          return (
            <li key={q}>
              <button onClick={() => s.cite.edges[0] && onInspect(s.cite.edges[0])} disabled={!s.cite.edges.length} {...hoverable([], s.cite.edges)} title={Q[q]}
                className="w-full text-left flex gap-2.5 items-start rounded-lg px-2 py-1.5 hover:bg-paper disabled:cursor-default">
                <Icon size={16} className="mt-0.5 shrink-0 text-brand-deep" aria-hidden />
                <span className="text-sm text-ink">{s.text}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 grid gap-2">
        <button onClick={() => openCoCreate("collaboration")} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-ink min-h-10"><Handshake size={16} aria-hidden />{c.propose_collab}</button>
        <div className="grid grid-cols-2 gap-2">
          <a href={plan} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-paper px-3 py-2 text-sm text-ink-2 hover:bg-paper-2 min-h-10"><ListChecks size={15} aria-hidden />{c.save_plan}</a>
          <button onClick={share} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-paper px-3 py-2 text-sm text-ink-2 hover:bg-paper-2 min-h-10"><Share2 size={15} aria-hidden />{copied ? c.copied : c.share}</button>
        </div>
        <TenXButton journey={x} locale={locale} icon={<FastForward size={15} aria-hidden />} full />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <button onClick={() => openCoCreate("hypothesis")} className="inline-flex items-center gap-1 text-brand-deep hover:underline"><Lightbulb size={13} aria-hidden />{c.propose_hyp}</button>
        <button onClick={() => openCoCreate("evidence")} className="inline-flex items-center gap-1 text-brand-deep hover:underline"><FilePlus2 size={13} aria-hidden />{c.add_evidence}</button>
        <button onClick={onReview} className="ml-auto text-ink-3 hover:underline">{c.review_steps}</button>
      </div>
    </motion.section>
  );
}

/* ------------------------------ sections ------------------------------ */

function Connections({ x, t, c, onInspect, onFocusDisease, hoverable, only }: { x: JourneyV2; t: Dict; c: JourneyCopy; onInspect: (e: string) => void; onFocusDisease: (d: string) => void; hoverable: Hoverable; only?: "neighbors" | "counter" }) {
  return (
    <div className="space-y-3 mt-3">
      {x.persona === "priya" && !only && <UnmetNeed x={x} c={c} onFocusDisease={onFocusDisease} />}
      {x.connections.none && <NoneCard none={x.connections.none} c={c} />}
      {only !== "counter" && x.connections.neighbors.map((n) => (
        <article key={n.disease} className="rounded-lg border border-line p-3" {...hoverable([x.disease.id, n.disease], n.cite.edges)}>
          <div className="flex items-start justify-between gap-3">
            <button className="text-left font-medium text-sm hover:underline" onClick={() => onFocusDisease(n.disease)}>{n.name}</button>
            <StrengthBadge {...n.strength} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2"><KindBadge kind="inferred" c={c} /><span className="text-[11px] text-ink-3">{n.same_cluster ? t.same_cluster : t.other_cluster}</span></p>
          {n.shared.phenotypes.length > 0 && <Facet label={t.shared_symptoms} items={n.shared.phenotypes.slice(0, 5).map((p) => p.name)} />}
          {n.shared.pathways.length > 0 && <Facet label={t.shared_pathways} items={n.shared.pathways.slice(0, 3).map((p) => p.name)} />}
          {n.shared.genes.length > 0 && <Facet label={t.shared_genes} items={n.shared.genes} />}
          <p className="text-sm text-ink-2 mt-2"><span className="text-[11px] uppercase tracking-wider text-ink-3 mr-1">{c.strategy}</span>{n.strategy}</p>
          <Review items={n.needs_review} c={c} />
          <button onClick={() => onInspect(n.edge)} className="mt-2 text-xs text-brand-deep font-medium hover:underline">{t.why_connected} →</button>
        </article>
      ))}
      {only !== "neighbors" && x.connections.counterexamples.length === 0 && only === "counter" && <p className="text-sm text-ink-3">{t.none_found}</p>}
      {only !== "neighbors" && x.connections.counterexamples.map((ce) => (
        <article key={ce.disease} className="rounded-lg border border-dashed border-brand-deep/40 bg-brand-mist p-3" {...hoverable([x.disease.id, ce.disease], ce.cite.edges)}>
          <p className="text-[11px] uppercase tracking-wider text-brand-deep">{t.counterexample}</p>
          <button className="mt-1 font-medium text-sm hover:underline text-left" onClick={() => onFocusDisease(ce.disease)}>{ce.name}</button>
          <p className="text-sm text-ink-2 mt-1">{ce.why}</p>
          {ce.cite.edges[0] && <button onClick={() => onInspect(ce.cite.edges[0])} className="mt-1 text-xs text-brand-deep hover:underline">{t.inspect} →</button>}
        </article>
      ))}
    </div>
  );
}

function UnmetNeed({ x, c, onFocusDisease }: { x: JourneyV2; c: JourneyCopy; onFocusDisease: (d: string) => void }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-sm font-medium">{c.unmet_need}</p>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full text-xs">
          <thead><tr className="text-ink-3 text-left">{c.unmet_cols.map((h) => <th key={h} className="font-normal pb-1 pr-2">{h}</th>)}</tr></thead>
          <tbody>
            {x.unmet_need.map((r) => (
              <tr key={r.disease} className="border-t border-line">
                <td className="py-1 pr-2"><button className="hover:underline text-left" onClick={() => onFocusDisease(r.disease)}>{r.name}</button></td>
                <td className={`py-1 pr-2 tabular-nums ${r.approved === 0 ? "text-amber font-medium" : ""}`}>{r.approved}</td>
                <td className="py-1 pr-2 tabular-nums">{r.active_trials}</td>
                <td className="py-1">{r.patient_org ? c.yes : c.no}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Assets({ x, t, c, onInspect, hoverable }: { x: JourneyV2; t: Dict; c: JourneyCopy; onInspect: (e: string) => void; hoverable: Hoverable }) {
  return (
    <div className="space-y-4 mt-3">
      {x.assets.none && <NoneCard none={x.assets.none} c={c} />}
      <AssetList title={t.own_assets} items={x.assets.own} t={t} c={c} onInspect={onInspect} hoverable={hoverable} />
      <AssetList title={t.reusable_assets} items={x.assets.reusable} t={t} c={c} onInspect={onInspect} hoverable={hoverable} />
      <div>
        <p className="text-sm font-medium">{t.treatments}</p>
        {x.assets.treatments.length === 0 && <p className="text-sm text-ink-3 mt-1">{t.none_found}</p>}
        <ul className="mt-1 space-y-1">
          {x.assets.treatments.map((tr) => (
            <li key={tr.id}><button onClick={() => onInspect(tr.cite.edges[0])} {...hoverable([tr.id, x.disease.id], tr.cite.edges)} className="w-full text-left flex items-center gap-2 text-sm hover:bg-paper-2 rounded-lg px-2 py-1">
              <span className="flex-1 truncate">{tr.name}</span>
              {tr.approved ? <span className="chip !py-0 !text-[11px] !border-brand-deep text-brand-deep">{t.approved}</span> : <span className="text-[11px] text-ink-3">{tr.stage.replace(/_/g, " ").toLowerCase()}</span>}
            </button></li>
          ))}
        </ul>
        {x.assets.neighbor_approved.length > 0 && (
          <div className="mt-2 rounded-lg border border-dashed border-line p-3">
            <p className="text-xs text-ink-3">{t.approved_neighbor}</p>
            {x.assets.neighbor_approved.map((tr) => <button key={tr.id + tr.disease} onClick={() => onInspect(tr.cite.edges[0])} {...hoverable([tr.id, tr.disease, x.disease.id], tr.cite.edges)} className="block text-sm mt-1 hover:underline text-left">{tr.name} · <span className="text-ink-3">{tr.disease_name}{tr.mechanism ? ` · ${tr.mechanism}` : ""}</span></button>)}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetList({ title, items, t, c, onInspect, hoverable }: { title: string; items: AssetCard[]; t: Dict; c: JourneyCopy; onInspect: (e: string) => void; hoverable: Hoverable }) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      {items.length === 0 && <p className="text-sm text-ink-3 mt-1">{t.none_found}</p>}
      <ul className="mt-2 space-y-2">
        {items.map((a) => (
          <li key={a.id + a.disease} className="rounded-lg border border-line p-3" {...hoverable([a.id, a.disease, ...a.shared_with.map((s) => s.id)], a.cite.edges)}>
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-3">
              <span className={`w-1.5 h-1.5 rounded-full ${a.active ? "bg-brand" : "bg-ink-3/40"}`} aria-hidden />{t.kinds[a.kind] ?? a.kind} · {a.status.replace(/_/g, " ").toLowerCase()}
            </p>
            <p className="text-sm mt-1 line-clamp-2">{a.title}</p>
            <p className="text-[11px] text-ink-3 mt-0.5">{a.nct}{a.sponsor ? ` · ${a.sponsor}` : ""}{a.enrollment ? ` · ${c.enrollment} ${a.enrollment}` : ""}{a.countries.length ? ` · ${a.countries.slice(0, 3).join(", ")}` : ""}</p>
            {a.shared_with.length > 0 && <p className="text-xs text-brand-deep mt-1">{t.shared_asset} {a.shared_with.map((s) => s.name).join(", ")}</p>}
            {!a.own && a.what_differs.length > 0 && <p className="text-xs text-ink-2 mt-1"><span className="text-ink-3">{c.what_differs}: </span>{a.what_differs.join(" ")}</p>}
            <Review items={a.needs_review} c={c} />
            <span className="mt-1.5 flex gap-3 text-xs">
              <button onClick={() => onInspect(a.cite.edges[0])} className="text-brand-deep hover:underline">{t.inspect} →</button>
              {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-ink-3 hover:underline">{t.open_source} ↗</a>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function People({ x, t, c, onInspect, hoverable }: { x: JourneyV2; t: Dict; c: JourneyCopy; onInspect: (e: string) => void; hoverable: Hoverable }) {
  return (
    <ul className="space-y-2 mt-3">
      {x.people.none && <li><NoneCard none={x.people.none} c={c} /></li>}
      {x.people.collaborators.map((p: CollaboratorCard) => (
        <li key={p.id} className="rounded-lg border border-line p-3" {...hoverable([p.id, ...p.diseases.map((d) => d.id)], p.cite.edges)}>
          <p className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm">{p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.name}</a> : p.name}</span>
            <span className="text-[11px] uppercase tracking-wider text-ink-3 shrink-0">{t.collab_kinds[p.kind] ?? p.kind}</span>
          </p>
          {p.institution && <p className="text-xs text-ink-3 mt-0.5">{p.institution}</p>}
          <p className="text-xs text-ink-2 mt-1">{p.why}</p>
          {p.bridges && <p className="mt-1"><span className="chip !py-0 !text-[11px] !border-brand text-brand-deep">{c.bridges}</span></p>}
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-ink-3">{c.proof} ({p.cite.edges.length})</summary>
            <ul className="mt-1 space-y-1">
              {p.proof.map((pr) => (
                <li key={pr.edge} className="flex gap-2 items-start">
                  <button onClick={() => onInspect(pr.edge)} className="text-left text-ink-2 hover:underline flex-1">{pr.label}</button>
                  {pr.url && <a href={pr.url} target="_blank" rel="noopener noreferrer" className="text-ink-3 hover:underline shrink-0" aria-label={`${t.open_source}: ${pr.label}`}>↗</a>}
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}

function Next({ x, c, onInspect, hoverable }: { x: JourneyV2; c: JourneyCopy; onInspect: (e: string) => void; hoverable: Hoverable }) {
  return (
    <div className="space-y-4 mt-3">
      {x.next.none && <NoneCard none={x.next.none} c={c} />}
      {x.next.steps.length > 0 && <p className="text-[11px] uppercase tracking-wider text-ink-3">{c.this_week}</p>}
      <StepList steps={x.next.steps} c={c} onInspect={onInspect} hoverable={hoverable} />
      {x.next.later.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-ink-3">{c.later} ({x.next.later.length})</summary>
          <div className="mt-2"><StepList steps={x.next.later} c={c} onInspect={onInspect} hoverable={hoverable} offset={x.next.steps.length} /></div>
        </details>
      )}
      {x.gaps.length > 0 && (
        <ul className="space-y-2">
          {x.gaps.map((g) => <li key={g.kind} className="no-evidence rounded-r-lg px-3 py-2"><p className="text-sm">{g.title}</p><p className="text-xs text-ink-2 mt-0.5">{g.what_would_change_it}</p></li>)}
        </ul>
      )}
      <Coverage x={x} c={c} />
    </div>
  );
}

function StepList({ steps, c, onInspect, hoverable, offset = 0 }: { steps: StepCard[]; c: JourneyCopy; onInspect: (e: string) => void; hoverable: Hoverable; offset?: number }) {
  return (
    <ol className="relative border-l border-line ml-2 space-y-4">
      {steps.map((s, i) => (
        <li key={s.id} className="pl-5 relative" {...hoverable(s.nodes, s.cite.edges)}>
          <span className="absolute -left-[10px] top-0 w-5 h-5 rounded-full grid place-items-center text-[10px] font-semibold bg-brand-deep text-white">{offset + i + 1}</span>
          <p className="flex flex-wrap items-center gap-2"><span className="chip !py-0 !text-[11px]">{c.owner[s.owner]}</span>{s.needs_review && <KindBadge kind="inferred" c={c} />}</p>
          <p className="font-medium text-sm mt-1">{s.title}</p>
          <p className="text-sm text-ink-2 mt-0.5">{s.detail}</p>
          <button onClick={() => onInspect(s.cite.edges[0])} className="mt-1 text-xs text-brand-deep hover:underline">{c.proof}: {s.cite.edges.length} · {s.cite.evidence.length} {c.evidence_records} →</button>
        </li>
      ))}
    </ol>
  );
}

function Coverage({ x, c }: { x: JourneyV2; c: JourneyCopy }) {
  return (
    <details className="rounded-lg border border-line p-3 text-sm">
      <summary className="cursor-pointer font-medium">{c.checked}</summary>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-2">
        {Object.entries(x.coverage.counts).map(([k, v]) => <li key={k} className="flex justify-between gap-2"><span className="text-ink-3">{k.replace(/_/g, " ")}</span><span className="tabular-nums">{v}</span></li>)}
      </ul>
      <ul className="mt-2 text-[11px] text-ink-3 space-y-0.5">
        {x.coverage.sources.map((s) => <li key={s.id} className="flex justify-between gap-2"><span>{s.name}</span><span className="tabular-nums">{s.evidence_for_disease}</span></li>)}
      </ul>
    </details>
  );
}

/* ------------------------------ atoms ------------------------------ */

function Facet({ label, items }: { label: string; items: string[] }) {
  return <div className="mt-2"><p className="text-[11px] text-ink-3">{label}</p><p className="text-sm text-ink-2">{items.join(" · ")}</p></div>;
}

function Review({ items, c }: { items: string[]; c: JourneyCopy }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 rounded-md border border-dashed border-brand-deep/40 bg-brand-mist px-2.5 py-1.5">
      <p className="text-[11px] uppercase tracking-wider text-brand-deep">{c.needs_review}</p>
      <ul className="text-xs text-ink-2 mt-0.5 space-y-0.5">{items.map((r) => <li key={r}>{r}</li>)}</ul>
    </div>
  );
}

export function NoneCard({ none, c, badge, coverage, className = "" }: { none: NoneFound; c: JourneyCopy; badge?: string; coverage?: JourneyV2["coverage"]; className?: string }) {
  return (
    <div className={`no-evidence rounded-r-lg px-3 py-3 ${className}`} role="status">
      {badge && <p className="text-[11px] uppercase tracking-wider text-amber">{badge}</p>}
      <p className="text-sm font-medium">{none.title}</p>
      <p className="text-xs text-ink-2 mt-1">{none.detail}</p>
      <p className="text-[11px] uppercase tracking-wider text-ink-3 mt-2">{c.missing_evidence}</p>
      <ul className="text-xs text-ink-2 list-disc pl-4 mt-0.5 space-y-0.5">{none.missing_evidence.map((m) => <li key={m}>{m}</li>)}</ul>
      <p className="text-[11px] uppercase tracking-wider text-ink-3 mt-2">{c.next_question}</p>
      <p className="text-xs text-ink mt-0.5">{none.next_question}</p>
      {coverage && <p className="text-[11px] text-ink-3 mt-2">{c.checked}: {coverage.sources.map((s) => s.name).join(" · ")}</p>}
    </div>
  );
}

/* ------------------------------ Researcher mode: tabs ------------------------------ */

const R_TABS = ["mechanism", "similar", "counter", "gaps", "people"] as const;
type RTab = (typeof R_TABS)[number];
const R_LABEL: Record<Locale, Record<RTab, string>> = {
  en: { mechanism: "Mechanism", similar: "Similar diseases", counter: "Counterexamples", gaps: "Evidence gaps", people: "People" },
  es: { mechanism: "Mecanismo", similar: "Enfermedades similares", counter: "Contraejemplos", gaps: "Huecos de evidencia", people: "Personas" },
};

function ResearcherView({ x, t, c, locale, onInspect, onFocusDisease, hoverable }: { x: JourneyV2; t: Dict; c: JourneyCopy; locale: Locale; onInspect: (e: string) => void; onFocusDisease: (d: string) => void; hoverable: Hoverable }) {
  const [tab, setTab] = useState<RTab>("mechanism");
  const L = R_LABEL[locale];
  const m = x.mechanism;
  const count: Partial<Record<RTab, number>> = { similar: x.connections.neighbors.length, counter: x.connections.counterexamples.length, gaps: x.gaps.length, people: x.people.collaborators.length };
  return (
    <div className="mt-3">
      <div role="tablist" aria-label={c.your_route} className="flex gap-1 overflow-x-auto border-b border-line -mx-1 px-1">
        {R_TABS.map((k) => (
          <button key={k} role="tab" id={`rt-${k}`} aria-selected={tab === k} aria-controls={`rp-${k}`} onClick={() => setTab(k)}
            className={`whitespace-nowrap px-2.5 pb-2 pt-1 text-sm border-b-2 -mb-px min-h-10 ${tab === k ? "border-brand-deep text-ink font-medium" : "border-transparent text-ink-3 hover:text-ink-2"}`}>
            {L[k]}{count[k] !== undefined && <span className="ml-1 text-[11px] text-ink-3">{count[k]}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`rp-${tab}`} aria-labelledby={`rt-${tab}`}>
        {tab === "mechanism" && (
          <div className="mt-3 space-y-3 text-sm">
            {m.gene ? (
              <div className="rounded-lg border border-line p-3" {...hoverable([m.gene.id, x.disease.id], [m.gene.edge])}>
                <p className="flex items-center gap-2"><Dna size={15} className="text-brand-deep" aria-hidden /><span className="font-medium">{m.gene.symbol}</span><span className="text-ink-3">→ {x.disease.name}</span><KindBadge kind="observed" c={c} /></p>
                {m.variant_effect && (
                  <div className="mt-2 text-xs">
                    <span className="mt-1 h-1.5 rounded-full overflow-hidden flex bg-paper-2" aria-hidden>
                      <span className="bg-brand-deep" style={{ width: `${m.variant_effect.lof_fraction * 100}%` }} />
                      <span className="bg-brand" style={{ width: `${m.variant_effect.missense_fraction * 100}%` }} />
                    </span>
                    <p className="mt-1 text-ink-2">{Math.round(m.variant_effect.lof_fraction * 100)}% truncating · {Math.round(m.variant_effect.missense_fraction * 100)}% missense · n={m.variant_effect.n} (ClinVar){m.variant_call ? ` — ${m.variant_call}` : ""}</p>
                  </div>
                )}
                <button onClick={() => onInspect(m.gene!.edge)} className="mt-2 text-xs font-medium text-brand-deep hover:underline">{c.see_evidence} →</button>
              </div>
            ) : <p className="text-ink-3">{t.none_found}</p>}
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-3">Reactome</p>
              {m.pathways.length === 0 && <p className="text-ink-3 mt-1">{t.none_found}</p>}
              <ul className="mt-1 space-y-1">
                {m.pathways.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => onInspect(p.edge)} {...hoverable([p.id, ...(m.gene ? [m.gene.id] : []), ...p.shared_with.map((s) => s.id)], [p.edge])} className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-paper-2">
                      <span className="flex items-center gap-1.5"><Waypoints size={13} className="text-ink-3 shrink-0" aria-hidden /><span className="text-ink">{p.name}</span></span>
                      {p.shared_with.length > 0 && <span className="block pl-5 text-xs text-brand-deep">{locale === "es" ? "también en" : "also in"} {p.shared_with.map((s) => s.name).join(", ")}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {m.cluster_basis && <p className="text-xs text-ink-3">{t.cluster}: {m.cluster_basis}</p>}
          </div>
        )}
        {tab === "similar" && <Connections x={x} t={t} c={c} onInspect={onInspect} onFocusDisease={onFocusDisease} hoverable={hoverable} only="neighbors" />}
        {tab === "counter" && <Connections x={x} t={t} c={c} onInspect={onInspect} onFocusDisease={onFocusDisease} hoverable={hoverable} only="counter" />}
        {tab === "gaps" && (
          <div className="mt-3 space-y-3">
            {x.no_route && <NoneCard none={x.no_route} c={c} />}
            {x.gaps.length === 0 && !x.no_route && <p className="text-sm text-ink-3">{t.none_found}</p>}
            <ul className="space-y-2">{x.gaps.map((g) => <li key={g.kind} className="no-evidence rounded-r-lg px-3 py-2"><p className="text-sm">{g.title}</p><p className="text-xs text-ink-2 mt-0.5">{g.what_would_change_it}</p></li>)}</ul>
            <Coverage x={x} c={c} />
          </div>
        )}
        {tab === "people" && (
          <>
            <People x={{ ...x, people: { ...x.people, collaborators: [...x.people.collaborators].sort((a, b) => Number(b.kind === "investigator") - Number(a.kind === "investigator")) } }} t={t} c={c} onInspect={onInspect} hoverable={hoverable} />
            <Partners persona={x.persona} locale={locale} disease={x.disease.id} journey={x} onPropose={(d) => openCoCreate("collaboration", d)} />
          </>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <TenXButton journey={x} locale={locale} />
        <button onClick={() => openCoCreate("hypothesis")} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm text-ink-2 hover:bg-paper-2"><Lightbulb size={14} aria-hidden />{c.propose_hyp}</button>
      </div>
    </div>
  );
}
