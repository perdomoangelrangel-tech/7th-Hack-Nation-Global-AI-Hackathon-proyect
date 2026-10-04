"use client";
/**
 * Explain every edge, next to the connection: the relationship in plain words, its kind (observed / inferred /
 * AI-extracted / community draft), source + external id as a link, confidence and its basis, dates, every evidence
 * row, contradicting evidence (or "none found in our sources") and, for inferred edges, why the atlas connects them.
 */
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { edgeDetail } from "@/lib/atlas/store";
import type { Dict, Locale } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";
import { KIND_STYLE, kindOf, type LinkKind } from "./colors";
import type { Draft } from "./proposals";
import { externalUrl } from "./links";
import type { PersonaId } from "@/lib/agents/profiles";
import { ExplainButton } from "@/components/ai/ExplainButton";
import { ExtractPanel } from "@/components/ai/ExtractPanel";
import { api } from "./api";

type Detail = NonNullable<ReturnType<typeof edgeDetail>>;

const SOURCE_NAME: Record<string, string> = {
  orphanet: "Orphanet", hpo: "HPO", monarch: "Monarch", clinvar: "ClinVar", ctgov: "ClinicalTrials.gov", opentargets: "Open Targets",
  reactome: "Reactome", pubmed: "PubMed", nih_reporter: "NIH RePORTER", patient_orgs: "Patient org (official site)", atlas_analysis: "Nedamex analysis", nexmed_analysis: "Nedamex analysis", community: "Nedamex community drafts (not evidence)", fda: "FDA", openai_extraction: "OpenAI extraction",
};

export function KindBadge({ kind, t }: { kind: string; t: Dict }) {
  const k = kindOf(kind);
  const s = KIND_STYLE[k];
  return (
    <span className="chip" style={{ borderColor: s.color, color: k === "proposed" ? undefined : s.color, borderStyle: s.dash ? "dashed" : "solid" }}>
      <svg width="18" height="6" aria-hidden><line x1="1" y1="3" x2="17" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash?.join(" ")} strokeLinecap="round" /></svg>
      {t.status[k] ?? k}
    </span>
  );
}

const KIND_SENTENCE: Record<LinkKind, { en: string; es: string }> = {
  observed: { en: "A cited source states this connection.", es: "Una fuente citada afirma esta conexión." },
  inferred: { en: "Nedamex computed this from observed edges. It is a hypothesis for experts to test, not a finding.", es: "Nedamex lo calculó a partir de aristas observadas. Es una hipótesis para que la prueben expertos, no un hallazgo." },
  extracted: { en: "An AI model extracted this from the cited paper. An expert has not reviewed it yet.", es: "Un modelo de IA lo extrajo del artículo citado. Aún no lo ha revisado un experto." },
  proposed: { en: "A community member proposed this. It is a draft, not evidence.", es: "Lo propuso un miembro de la comunidad. Es un borrador, no evidencia." },
};

export function EdgeInspector({ edgeId, t, locale, persona, onClose, onFocusDisease, onInspect, onHighlight }: { edgeId: string; t: Dict; locale: Locale; persona: PersonaId; onClose: () => void; onFocusDisease: (id: string) => void; onInspect?: (edgeId: string) => void; onHighlight?: (edgeIds: string[] | null) => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    const c = new AbortController();
    fetch(api(`/api/atlas/edge?id=${encodeURIComponent(edgeId)}&l=${locale}`), { signal: c.signal })
      .then((r) => { if (!r.ok) throw new Error("missing"); return r.json(); }).then(setD)
      .catch((e: Error) => { if (e.name !== "AbortError") setMissing(true); });
    return () => c.abort();
  }, [edgeId, locale]);

  const kind = kindOf(d?.edge.kind);
  const accent = KIND_STYLE[kind].color;
  return (
    <Shell t={t} onClose={onClose} reduce={!!reduce}>
      {missing ? <p className="p-5 text-sm text-ink-3">{t.edge_missing}</p> : !d ? <div className="p-5 space-y-3" aria-busy>{[0, 1, 2].map((i) => <div key={i} className="h-4 rounded bg-paper-2 pulse" />)}</div> : (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <p className="text-base leading-snug">
              <EntityLink e={d.from} onFocusDisease={onFocusDisease} />{" "}
              <span className="text-ink-3">{t.relations[d.edge.relation] ?? d.edge.relation.replace(/_/g, " ")}</span>{" "}
              <EntityLink e={d.to} onFocusDisease={onFocusDisease} />
            </p>
            <p className="mt-2 text-sm text-ink-2"><span className="sr-only">{t.plain_words}: </span>{KIND_SENTENCE[kind][locale]}</p>
            {kind === "extracted" && <p className="mt-2 rounded-lg border border-dashed px-3 py-2 text-sm" style={{ borderColor: accent }}>{t.needs_review}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <KindBadge kind={d.edge.kind} t={t} />
              <span className="chip">{t.edge_relation}: {d.edge.relation.replace(/_/g, " ")}</span>
            </div>
            <div className="mt-3">
              <p className="text-xs text-ink-3 flex justify-between"><span>{t.edge_confidence}</span><span className="tabular-nums text-ink-2">{d.edge.confidence.toFixed(2)}</span></p>
              <div className="mt-1 h-1.5 rounded-full bg-paper-2 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={d.edge.confidence} aria-label={t.edge_confidence}>
                <motion.div className="h-full origin-left" style={{ background: accent }} initial={{ scaleX: reduce ? d.edge.confidence : 0 }} animate={{ scaleX: d.edge.confidence }} transition={springs.gentle} />
              </div>
              <p className="mt-1 text-xs text-ink-3">{t.basis}: {d.edge.confidence_basis.replace(/_/g, " ")}</p>
            </div>
          </div>

          {d.similarity && (
            <section>
              <h3 className="text-sm font-medium">{t.why_connected}</h3>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                {([["score", d.similarity.score], ["phenotype", d.similarity.phenotype_score], ["pathway", d.similarity.pathway_score]] as const).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-brand-mist py-2"><dt className="text-[11px] text-ink-3">{k}</dt><dd className="tabular-nums font-medium">{Number(v).toFixed(2)}</dd></div>
                ))}
              </dl>
              <p className="text-xs text-ink-3 mt-3">{t.shared_symptoms}</p>
              <ul className="mt-1 space-y-1">
                {d.similarity.shared_phenotypes.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">{p.name}</span>
                    <span className="text-[11px] tabular-nums text-ink-3">IC {p.ic.toFixed(2)}</span>
                    <span className="w-14 h-1 rounded bg-paper-2 overflow-hidden" aria-hidden><span className="block h-full bg-brand" style={{ width: `${Math.min(1, p.ic) * 100}%` }} /></span>
                  </li>
                ))}
              </ul>
              {d.similarity.shared_pathways.length > 0 && <><p className="text-xs text-ink-3 mt-3">{t.shared_pathways}</p><p className="text-sm">{d.similarity.shared_pathways.map((p) => p.name).join(" · ")}</p></>}
              {d.similarity.shared_genes.length > 0 && <><p className="text-xs text-ink-3 mt-3">{t.shared_genes}</p><p className="text-sm">{d.similarity.shared_genes.map((g) => g.replace(/^gene:/, "")).join(" · ")}</p></>}
              {d.similarity.variant_effect_match !== null && <p className="text-xs text-ink-2 mt-3">{t.variant_effect}: {d.similarity.variant_effect_match ? (locale === "es" ? "✓ coincide" : "✓ match") : (locale === "es" ? "≠ difiere — el mecanismo puede ser distinto" : "≠ differs — mechanism may differ")}</p>}
              {d.similarity.supporting_edges.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-ink-3">{t.supporting_edges} ({d.similarity.supporting_edges.length})</summary>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {d.similarity.supporting_edges.slice(0, 24).map((id) => (
                      <li key={id}><button type="button" onClick={() => onInspect?.(id)} className="chip hover:bg-brand-soft font-mono !text-[10px]">{id.replace(/^edge:/, "").slice(0, 28)}</button></li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}

          <section>
            <h3 className="text-sm font-medium">{t.edge_sources} <span className="text-ink-3 font-normal">({d.edge.evidence.length})</span></h3>
            <ul className="mt-2 space-y-2">
              {d.edge.evidence.map((ev, i) => {
                const href = externalUrl(ev.external_id, ev.url);
                return (
                  <motion.li key={ev.id} initial={{ opacity: 0, y: reduce ? 0 : motionTokens.distance.xs }} animate={{ opacity: 1, y: 0 }} transition={{ ...springs.gentle, delay: reduce ? 0 : i * 0.04 }}
                    className="pl-3 py-1 border-l-[3px]" style={{ borderColor: accent }}>
                    <p className="text-sm font-medium">
                      {SOURCE_NAME[ev.source] ?? ev.source}{" · "}
                      {href ? <a href={href} target="_blank" rel="noreferrer" className="text-brand-deep underline-offset-2 hover:underline">{ev.external_id}<span className="sr-only"> (opens in a new tab)</span> ↗</a> : <span>{ev.external_id}</span>}
                    </p>
                    {ev.quote && <p className="text-xs text-ink-2 mt-0.5 line-clamp-3">“{ev.quote}”</p>}
                    <p className="text-[11px] text-ink-3 mt-0.5">{ev.published_on ? `${t.published} ${ev.published_on} · ` : ""}{t.retrieved} {ev.retrieved_at.slice(0, 10)}</p>
                  </motion.li>
                );
              })}
            </ul>
            {/* ai lane: verified plain-language explanation of this edge (simple language follows usePrefs()). */}
            <div className="mt-3"><ExplainButton edgeIds={[d.edge.id]} persona={persona} locale={locale} onHighlight={onHighlight} /></div>
            {/* ai lane: OpenAI extraction from the first cited PubMed paper (results are "needs expert review"). */}
            {(() => { const pm = d.edge.evidence.find((ev) => ev.source === "pubmed"); return pm ? <div className="mt-3"><ExtractPanel pmid={pm.external_id} locale={locale} /></div> : null; })()}
          </section>

          <section>
            <h3 className="text-sm font-medium">{t.edge_contradictions}</h3>
            {d.contradictions.length === 0 ? <p className="text-sm text-ink-3 mt-1">{t.none_found}</p> : (
              <ul className="mt-2 space-y-2">{d.contradictions.map((c, i) => {
                const href = c.evidence ? externalUrl(c.evidence.external_id, c.evidence.url) : null;
                return <li key={i} className="no-evidence rounded-r-lg px-3 py-2 text-sm">{c.text}{c.evidence && (href ? <a className="block text-xs underline mt-0.5" href={href} target="_blank" rel="noreferrer">{c.evidence.external_id}</a> : <span className="block text-xs mt-0.5">{c.evidence.external_id}</span>)}</li>;
              })}</ul>
            )}
          </section>
          <p className="text-[11px] text-ink-3">{t.disclaimer}</p>
        </div>
      )}
    </Shell>
  );
}

/** A community draft (proposals layer): never evidence. */
export function DraftInspector({ draft, t, onClose }: { draft: Draft; t: Dict; onClose: () => void }) {
  const reduce = useReducedMotion();
  return (
    <Shell t={t} onClose={onClose} reduce={!!reduce}>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <KindBadge kind="proposed" t={t} />
        <p className="rounded-lg border border-dashed border-line bg-brand-mist px-3 py-2 text-sm text-ink-2">{t.draft_banner}</p>
        <h3 className="text-base font-medium">{draft.title}</h3>
        {draft.body && <p className="text-sm text-ink-2 whitespace-pre-line">{draft.body}</p>}
        <p className="text-xs text-ink-3">{draft.kind}{draft.persona ? ` · ${draft.persona}` : ""}{draft.created_at ? ` · ${draft.created_at.slice(0, 10)}` : ""}</p>
      </div>
    </Shell>
  );
}

function Shell({ t, onClose, reduce, children }: { t: Dict; onClose: () => void; reduce: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <motion.aside
      initial={{ opacity: 0, x: reduce ? 0 : motionTokens.distance.lg }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduce ? 0 : motionTokens.distance.lg }}
      transition={springs.snappy}
      className="absolute inset-0 z-30 bg-paper flex flex-col" role="dialog" aria-label={t.inspect}>
      <header className="flex items-center justify-between px-5 h-12 border-b border-line bg-brand-mist">
        <p className="text-xs uppercase tracking-widest text-ink-3">{t.inspect}</p>
        <button type="button" onClick={onClose} autoFocus className="rounded-full w-8 h-8 grid place-items-center text-ink-2 hover:bg-brand-soft hover:text-ink" aria-label={t.close}>✕</button>
      </header>
      {children}
    </motion.aside>
  );
}

function EntityLink({ e, onFocusDisease }: { e: Detail["from"]; onFocusDisease: (id: string) => void }) {
  if (e.type === "disease") return <button type="button" onClick={() => onFocusDisease(e.id)} className="font-medium text-brand-deep hover:underline">{e.display}</button>;
  const url = ((e.props.url ?? e.props.hpo_url) as string | undefined) ?? externalUrl(e.canonical_id) ?? undefined;
  return url ? <a href={url} target="_blank" rel="noreferrer" className="font-medium text-brand-deep hover:underline">{e.display}</a> : <span className="font-medium">{e.display}</span>;
}
