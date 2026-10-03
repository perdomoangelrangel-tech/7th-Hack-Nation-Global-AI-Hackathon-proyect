"use client";
/**
 * Maria's journey: disease → shared mechanism → reusable asset → collaborator → next step.
 * Progressive reveal: one summary line per question (ordered by mode), depth on click. Every card cites
 * edges; hovering lights them in the graph; the edge kind (observed / inferred) is always visible.
 * Data: GET /api/journey (Journey v2, action lane). The `j` prop (v1, from AtlasApp) renders the header instantly.
 */
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Journey } from "@/lib/atlas/store";
import { dict, type Dict, type Locale } from "@/lib/i18n";
import type { PersonaId } from "@/lib/agents/profiles";
import type { AssetCard, CollaboratorCard, JourneyV2, NoneFound, QuestionId, StepCard } from "@/lib/journey/build";
import { motionTokens, springs } from "@/lib/motion";
import { journeyCopy, type JourneyCopy } from "@/components/journey/copy";
import { KindBadge, weakestKind } from "@/components/journey/KindBadge";
import { isNoRoute, useJourney, useUrlParam } from "@/components/journey/useJourney";
import { TenXButton } from "@/components/journey/TenXButton";

interface Props {
  j: Journey; t: Dict;
  onInspect: (edgeId: string) => void;
  onHover: (nodes: string[], edges: string[]) => void;
  onFocusDisease: (id: string) => void;
  /** Optional until AtlasApp passes them (HANDOFF NEED(explorer)); falls back to the URL. */
  persona?: PersonaId; locale?: Locale;
}

const PERSONA_IDS = ["devon", "maria", "osei", "priya"] as const;
type Hoverable = (nodes: string[], edges: string[]) => Record<string, () => void>;

export function JourneyPanel({ j, t, onInspect, onHover, onFocusDisease, persona: pp, locale: lp }: Props) {
  const locale: Locale = lp ?? (t.q1 === dict.es.q1 ? "es" : "en");
  const persona = useUrlParam<PersonaId>("p", "maria", PERSONA_IDS, pp);
  const c = journeyCopy[locale];
  const { data, loading, error } = useJourney(j.disease.id, persona, locale);
  const v2 = data && !isNoRoute(data) ? data : null;
  const [open, setOpen] = useState<QuestionId | null>(null);
  const reduce = useReducedMotion();
  const leave = () => onHover([], []);
  const hoverable: Hoverable = (nodes, edges) => ({ onMouseEnter: () => onHover(nodes, edges), onMouseLeave: leave, onFocus: () => onHover(nodes, edges), onBlur: leave });
  const Q: Record<QuestionId, string> = { connections: t.q1, assets: t.q2, people: t.q3, next: t.q4 };

  const nodesFor = (q: QuestionId, x: JourneyV2): string[] => {
    const d = x.disease.id;
    if (q === "connections") return [d, ...x.connections.neighbors.map((n) => n.disease)];
    if (q === "assets") return [d, ...x.assets.own.slice(0, 3).map((a) => a.id), ...x.assets.reusable.slice(0, 3).map((a) => a.id)];
    if (q === "people") return [d, ...x.people.collaborators.slice(0, 5).map((p) => p.id)];
    return [d, ...x.next.steps.flatMap((s) => s.nodes)];
  };

  return (
    <div className="flex flex-col lg:min-h-0 lg:h-full">
      <header className="px-5 pt-5 pb-4 border-b border-line">
        <div className="flex items-center gap-2 flex-wrap">
          {j.cluster && <span className="chip" title={j.cluster.label_basis}><span className="w-2 h-2 rounded-full" style={{ background: j.cluster.color }} aria-hidden />{t.cluster}: {j.cluster.label}</span>}
          <span className="text-xs text-ink-3">{j.disease.canonical_id}</span>
        </div>
        <h2 className="serif text-2xl leading-tight text-brand-ink mt-2">{j.disease.full_name}</h2>
        {j.disease.definition && <p className="text-sm text-ink-2 mt-2 line-clamp-3">{j.disease.definition}</p>}
        {j.disease.variant_effect && (
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
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs uppercase tracking-widest text-ink-3">{c.your_route}</p>
          {v2 && <span className="text-[11px] text-ink-3">{c.route_hint}</span>}
        </div>

        {loading && <RouteSkeleton label={c.loading} />}
        {error && <p className="mt-3 text-sm text-ink-3">{c.error}</p>}

        {v2?.no_route && <NoneCard none={v2.no_route} c={c} badge={c.no_route_badge} coverage={v2.coverage} className="mt-3" />}

        {v2 && (
          <ol className="mt-3 space-y-2">
            {v2.order.map((q, i) => {
              const s = v2.summary[q];
              const isOpen = open === q;
              const hasCite = s.cite.edges.length > 0;
              return (
                <motion.li key={q} layout={!reduce} initial={{ opacity: 0, y: reduce ? 0 : motionTokens.distance.sm }} animate={{ opacity: 1, y: 0 }} transition={{ ...springs.gentle, delay: reduce ? 0 : i * 0.06 }}
                  className={`rounded-xl border bg-paper transition-colors ${isOpen ? "border-brand/60 shadow-sm" : "border-line hover:border-brand/40"}`}>
                  <button className="w-full text-left p-3.5 flex gap-3 items-start" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : q)} {...hoverable(nodesFor(q, v2), s.cite.edges)}>
                    <span className={`mt-0.5 w-6 h-6 rounded-full grid place-items-center text-xs font-semibold shrink-0 ${hasCite ? "bg-brand-deep text-white" : "bg-amber text-white"}`}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] uppercase tracking-wider text-ink-3">{Q[q]}</span>
                      <span className="block text-sm text-ink mt-0.5">{s.text}</span>
                      {hasCite && <span className="mt-1.5 flex flex-wrap items-center gap-2"><KindBadge kind={weakestKind(s.cite.kinds)} c={c} /><span className="text-[11px] text-ink-3">{s.cite.evidence.length} {c.evidence_records}</span></span>}
                    </span>
                    <span className={`text-ink-3 transition-transform ${isOpen ? "rotate-90" : ""}`} aria-hidden>›</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div key="depth" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduce ? 0 : motionTokens.duration.normal, ease: motionTokens.easing.smooth }} className="overflow-hidden">
                        <div className="px-3.5 pb-4 pt-1 border-t border-line">
                          {q === "connections" && <Connections x={v2} t={t} c={c} onInspect={onInspect} onFocusDisease={onFocusDisease} hoverable={hoverable} />}
                          {q === "assets" && <Assets x={v2} t={t} c={c} onInspect={onInspect} hoverable={hoverable} />}
                          {q === "people" && <People x={v2} t={t} c={c} onInspect={onInspect} hoverable={hoverable} />}
                          {q === "next" && <Next x={v2} c={c} onInspect={onInspect} hoverable={hoverable} />}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </ol>
        )}

        {v2 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <TenXButton journey={v2} locale={locale} />
          </div>
        )}
      </div>
      <p className="px-5 py-3 border-t border-line text-[11px] text-ink-3">{v2?.disclaimer ?? t.disclaimer}</p>
    </div>
  );
}

/* ------------------------------ sections ------------------------------ */

function Connections({ x, t, c, onInspect, onFocusDisease, hoverable }: { x: JourneyV2; t: Dict; c: JourneyCopy; onInspect: (e: string) => void; onFocusDisease: (d: string) => void; hoverable: Hoverable }) {
  return (
    <div className="space-y-3 mt-3">
      {x.persona === "priya" && <UnmetNeed x={x} c={c} onFocusDisease={onFocusDisease} />}
      {x.connections.none && <NoneCard none={x.connections.none} c={c} />}
      {x.connections.neighbors.map((n) => (
        <article key={n.disease} className="rounded-lg border border-line p-3" {...hoverable([x.disease.id, n.disease], n.cite.edges)}>
          <div className="flex items-start justify-between gap-3">
            <button className="text-left font-medium text-sm hover:underline" onClick={() => onFocusDisease(n.disease)}>{n.name}</button>
            <span className="text-xs text-ink-3 shrink-0 tabular-nums">{t.similarity} {n.score.toFixed(2)}</span>
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
      {x.connections.counterexamples.map((ce) => (
        <article key={ce.disease} className="rounded-lg border border-dashed border-amber/60 bg-amber-soft/30 p-3" {...hoverable([x.disease.id, ce.disease], ce.cite.edges)}>
          <p className="text-[11px] uppercase tracking-wider text-amber">{t.counterexample}</p>
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
    <div className="mt-2 rounded-md bg-amber-soft/40 px-2.5 py-1.5">
      <p className="text-[11px] uppercase tracking-wider text-amber">{c.needs_review}</p>
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

function RouteSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-3 space-y-2" aria-busy="true" aria-label={label}>
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl border border-line bg-paper-2 animate-pulse" />)}
    </div>
  );
}
