"use client";
/**
 * El recorrido de Maria en cuatro pasos (las tres preguntas del reto + la acción).
 * Resumen primero, profundidad al hacer clic: cada elemento ilumina su parte del grafo y abre su evidencia.
 */
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Journey } from "@/lib/atlas/store";
import type { Dict } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";

type Tab = "connections" | "assets" | "people" | "next";
interface Props {
  j: Journey; t: Dict;
  onInspect: (edgeId: string) => void;
  onHover: (nodes: string[], edges: string[]) => void;
  onFocusDisease: (id: string) => void;
}

export function JourneyPanel({ j, t, onInspect, onHover, onFocusDisease }: Props) {
  const [tab, setTab] = useState<Tab>("connections");
  const reduce = useReducedMotion();
  const TABS: { id: Tab; label: string; q: string; n: number }[] = [
    { id: "connections", label: t.tab_connections, q: t.q1, n: j.shares.length },
    { id: "assets", label: t.tab_assets, q: t.q2, n: j.assets.own.length + j.assets.reusable.length },
    { id: "people", label: t.tab_people, q: t.q3, n: j.collaborators.length },
    { id: "next", label: t.tab_next, q: t.q4, n: j.steps.length },
  ];
  const leave = () => onHover([], []);
  const hoverable = (nodes: string[], edges: string[]) => ({ onMouseEnter: () => onHover(nodes, edges), onMouseLeave: leave, onFocus: () => onHover(nodes, edges), onBlur: leave });
  const enter = { initial: { opacity: 0, y: reduce ? 0 : motionTokens.distance.sm }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="flex flex-col lg:min-h-0 lg:h-full">
      {/* Encabezado: resumen de la enfermedad */}
      <header className="px-5 pt-5 pb-4 border-b border-line">
        <div className="flex items-center gap-2 flex-wrap">
          {j.cluster && <span className="chip" title={j.cluster.label_basis}><span className="w-2 h-2 rounded-full" style={{ background: j.cluster.color }} aria-hidden />{t.cluster}: {j.cluster.label}</span>}
          <span className="text-xs text-ink-3">{j.disease.canonical_id}</span>
        </div>
        <h2 className="serif text-2xl leading-tight text-navy mt-2">{j.disease.full_name}</h2>
        {j.disease.definition && <p className="text-sm text-ink-2 mt-2 line-clamp-3">{j.disease.definition}</p>}
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-ink-3">{t.centrality}</p>
            <div className="mt-1 h-1.5 rounded-full bg-paper-2 overflow-hidden" aria-label={`${t.centrality} ${j.disease.centrality}/100`}>
              <motion.div className="h-full bg-teal origin-left" initial={{ scaleX: 0 }} animate={{ scaleX: j.disease.centrality / 100 }} transition={springs.gentle} />
            </div>
            <p className="mt-1 text-ink-2">{j.disease.centrality}/100</p>
          </div>
          {j.disease.variant_effect && (
            <button className="text-left group" onClick={() => onInspect(j.disease.variant_effect!.edge)} title={j.disease.variant_effect.call}>
              <p className="text-ink-3">{t.variant_effect} · {j.disease.variant_effect.gene}</p>
              <div className="mt-1 h-1.5 rounded-full overflow-hidden flex" aria-hidden>
                <span className="bg-navy-2" style={{ width: `${j.disease.variant_effect.lof_fraction * 100}%` }} />
                <span className="bg-amber" style={{ width: `${j.disease.variant_effect.missense_fraction * 100}%` }} />
                <span className="flex-1 bg-paper-2" />
              </div>
              <p className="mt-1 text-ink-2 group-hover:underline">{Math.round(j.disease.variant_effect.lof_fraction * 100)}% trunc · {Math.round(j.disease.variant_effect.missense_fraction * 100)}% missense · n={j.disease.variant_effect.n}</p>
            </button>
          )}
        </div>
      </header>

      {/* Pestañas */}
      <nav className="px-3 pt-3 flex gap-1 border-b border-line overflow-x-auto" role="tablist">
        {TABS.map((x, i) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}
            className={`relative px-3 pb-2.5 pt-1 text-sm whitespace-nowrap ${tab === x.id ? "text-ink font-medium" : "text-ink-3 hover:text-ink-2"}`}>
            <span className="text-[10px] text-ink-3 mr-1">{i + 1}</span>{x.label}
            <span className="ml-1 text-[11px] text-ink-3">{x.n}</span>
            {tab === x.id && <motion.span layoutId="tab-underline" className="absolute left-2 right-2 -bottom-px h-0.5 bg-teal rounded-full" transition={springs.snappy} />}
          </button>
        ))}
      </nav>

      <div className="lg:flex-1 lg:overflow-y-auto px-5 py-4">
        <AnimatePresence mode="wait">
          <motion.section key={tab} {...enter} exit={{ opacity: 0 }} transition={{ duration: motionTokens.duration.fast, ease: motionTokens.easing.smooth }}>
            <p className="text-xs uppercase tracking-widest text-ink-3 mb-3">{TABS.find((x) => x.id === tab)!.q}</p>

            {tab === "connections" && (
              <div className="space-y-3">
                {j.honest_gap && <GapCard title={j.honest_gap.title} body={`${j.honest_gap.detail} ${j.honest_gap.next_question}`} />}
                {j.shares.map((s, i) => (
                  <motion.article key={s.disease} {...enter} transition={{ ...springs.gentle, delay: reduce ? 0 : i * 0.06 }}
                    className="rounded-xl border border-line bg-paper p-4 hover:border-teal/50 transition-colors" {...hoverable([j.disease.id, s.disease], [s.edge])}>
                    <div className="flex items-start justify-between gap-3">
                      <button className="text-left font-medium hover:underline" onClick={() => onFocusDisease(s.disease)}>{s.name}</button>
                      <span className="text-xs text-ink-3 shrink-0 tabular-nums">{t.similarity} {s.score.toFixed(2)}</span>
                    </div>
                    <p className="text-xs mt-1 flex gap-2 flex-wrap">
                      <span className="chip !text-[11px] !py-0.5" style={{ borderStyle: "dashed", borderColor: "#ca8a04" }}>{t.status.inferred}</span>
                      <span className="text-ink-3 self-center">{s.same_cluster ? t.same_cluster : t.other_cluster}</span>
                    </p>
                    <Facet label={t.shared_symptoms} items={s.explanation.shared_phenotypes.slice(0, 5).map((p) => `${p.name}`)} />
                    {s.explanation.shared_pathways.length > 0 && <Facet label={t.shared_pathways} items={s.explanation.shared_pathways.slice(0, 3).map((p) => p.name)} />}
                    {s.explanation.shared_genes.length > 0 && <Facet label={t.shared_genes} items={s.explanation.shared_genes} />}
                    {s.variant_effect.other && <p className="text-xs text-ink-2 mt-2">{t.variant_effect}: {s.variant_effect.other.gene} {Math.round(s.variant_effect.other.lof_fraction * 100)}% trunc · {Math.round(s.variant_effect.other.missense_fraction * 100)}% missense</p>}
                    <button onClick={() => onInspect(s.edge)} className="mt-3 text-xs text-teal font-medium hover:underline">{t.why_connected} →</button>
                  </motion.article>
                ))}
                {j.counterexamples.map((c) => (
                  <div key={c.other} className="rounded-xl border border-dashed border-amber/60 bg-amber-soft/40 p-4" {...hoverable([j.disease.id, c.other], [])}>
                    <p className="text-xs uppercase tracking-widest text-amber">{t.counterexample}</p>
                    <button className="mt-1 font-medium hover:underline text-left" onClick={() => onFocusDisease(c.other)}>{c.other_name}</button>
                    <p className="text-sm text-ink-2 mt-1">{c.shared_phenotypes.join(", ")}</p>
                    <p className="text-xs text-ink-3 mt-1">{c.why}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === "assets" && (
              <div className="space-y-5">
                <AssetList title={t.own_assets} items={j.assets.own} t={t} onInspect={onInspect} hoverable={hoverable} />
                <AssetList title={t.reusable_assets} items={j.assets.reusable} t={t} onInspect={onInspect} hoverable={hoverable} />
                <div>
                  <p className="text-sm font-medium">{t.treatments}</p>
                  {j.assets.treatments.length === 0 && <p className="text-sm text-ink-3 mt-1">{t.none_found}</p>}
                  <ul className="mt-2 space-y-1.5">
                    {j.assets.treatments.map((x) => (
                      <li key={x.id}><button onClick={() => onInspect(x.edge)} {...hoverable([x.id, j.disease.id], [x.edge])} className="w-full text-left flex items-center gap-2 text-sm hover:bg-paper-2 rounded-lg px-2 py-1">
                        <span className="flex-1 truncate">{x.name}</span>
                        {x.approved ? <span className="chip !py-0 !text-[11px] !border-teal text-teal">{t.approved}</span> : <span className="text-[11px] text-ink-3">{x.stage.replace(/_/g, " ").toLowerCase()}</span>}
                        {x.stopped && <span className="text-[11px] text-amber" title="stopped trial">⚠</span>}
                      </button></li>
                    ))}
                  </ul>
                  {j.assets.neighbor_approved.length > 0 && (
                    <div className="mt-3 rounded-lg border border-dashed border-line p-3">
                      <p className="text-xs text-ink-3">{t.approved_neighbor}</p>
                      {j.assets.neighbor_approved.map((x) => <button key={x.id + x.disease} onClick={() => onInspect(x.edge)} className="block text-sm mt-1 hover:underline text-left">{x.name} · <span className="text-ink-3">{x.disease_name}</span></button>)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "people" && (
              <ul className="space-y-2">
                {j.collaborators.length === 0 && <p className="text-sm text-ink-3">{t.none_found}</p>}
                {j.collaborators.map((c, i) => (
                  <motion.li key={c.id} {...enter} transition={{ ...springs.gentle, delay: reduce ? 0 : i * 0.04 }}>
                    <button onClick={() => onInspect(c.edges[0])} {...hoverable([c.id, ...c.diseases], c.edges)} className="w-full text-left rounded-xl border border-line bg-paper p-3 hover:border-teal/50 transition-colors">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{c.name}</span>
                        <span className="text-[11px] uppercase tracking-wider text-ink-3 shrink-0">{t.collab_kinds[c.kind]}</span>
                      </span>
                      {c.institution && <span className="block text-xs text-ink-3 mt-0.5">{c.institution}</span>}
                      <span className="block text-xs text-ink-2 mt-1">{c.why}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}

            {tab === "next" && (
              <div className="space-y-4">
                <ol className="relative border-l border-line ml-2 space-y-4">
                  {j.steps.map((s, i) => (
                    <motion.li key={s.id} {...enter} transition={{ ...springs.gentle, delay: reduce ? 0 : i * 0.07 }} className="pl-5 relative" {...hoverable(s.nodes, s.evidence_edges)}>
                      <span className={`absolute -left-[9px] top-0.5 w-[17px] h-[17px] rounded-full grid place-items-center text-[10px] font-semibold ${s.kind === "fill_gap" ? "bg-amber text-white" : "bg-teal text-white"}`}>{i + 1}</span>
                      <p className="font-medium text-sm">{s.title}</p>
                      <p className="text-sm text-ink-2 mt-1">{s.detail}</p>
                      {s.evidence_edges[0] && <button onClick={() => onInspect(s.evidence_edges[0])} className="mt-1 text-xs text-teal hover:underline">{t.inspect} →</button>}
                    </motion.li>
                  ))}
                </ol>
                {j.gaps.length > 0 && (
                  <div>
                    <p className="text-sm font-medium">{t.gaps}</p>
                    <ul className="mt-2 space-y-2">{j.gaps.map((g) => <li key={g.kind}><GapCard title={g.detail} body={g.what_would_change_it} /></li>)}</ul>
                  </div>
                )}
                <details className="rounded-xl border border-line p-3 text-sm">
                  <summary className="cursor-pointer font-medium">{t.coverage}</summary>
                  <p className="text-xs text-ink-3 mt-1">{t.coverage_detail}</p>
                  <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-2">
                    {Object.entries(j.coverage.counts).map(([k, v]) => <li key={k} className="flex justify-between gap-2"><span className="text-ink-3">{k.replace(/_/g, " ")}</span><span className="tabular-nums">{v}</span></li>)}
                  </ul>
                  <p className="mt-2 text-xs text-ink-3">{j.coverage.sources.map((s) => s.name).join(" · ")}</p>
                </details>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>
      <p className="px-5 py-3 border-t border-line text-[11px] text-ink-3">{t.disclaimer}</p>
    </div>
  );
}

function Facet({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-2">
      <p className="text-[11px] text-ink-3">{label}</p>
      <p className="text-sm text-ink-2">{items.join(" · ")}</p>
    </div>
  );
}

function GapCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="no-evidence rounded-r-lg px-3 py-2">
      <p className="text-sm">{title}</p>
      <p className="text-xs text-ink-2 mt-1">{body}</p>
    </div>
  );
}

function AssetList({ title, items, t, onInspect, hoverable }: { title: string; items: Journey["assets"]["own"]; t: Dict; onInspect: (e: string) => void; hoverable: (n: string[], e: string[]) => Record<string, () => void> }) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      {items.length === 0 && <p className="text-sm text-ink-3 mt-1">{t.none_found}</p>}
      <ul className="mt-2 space-y-2">
        {items.map((a) => (
          <li key={a.id + a.disease}>
            <button onClick={() => onInspect(a.edge)} {...hoverable([a.id, a.disease], [a.edge])} className="w-full text-left rounded-xl border border-line bg-paper p-3 hover:border-teal/50 transition-colors">
              <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-3">
                <span className="w-1.5 h-1.5 rounded-full bg-teal" aria-hidden />{t.kinds[a.kind] ?? a.kind} · {a.status.replace(/_/g, " ").toLowerCase()}
              </span>
              <span className="block text-sm mt-1 line-clamp-2">{a.title}</span>
              {a.shared_with.length > 0 && <span className="block text-xs text-teal mt-1">{t.shared_asset} {a.shared_with.join(", ")}</span>}
              {a.differs.length > 0 && <span className="block text-xs text-amber mt-1">{t.what_differs}: {a.differs.join(" · ")}</span>}
              {a.countries.length > 0 && <span className="block text-[11px] text-ink-3 mt-1 truncate">{a.countries.slice(0, 5).join(", ")}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
