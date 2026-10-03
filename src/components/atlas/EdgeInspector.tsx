"use client";
/** Explicar cada arista: fuente, tipo de relación, confianza, observada vs. inferida y evidencia en contra, al lado de la conexión. */
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { edgeDetail } from "@/lib/atlas/store";
import type { Dict, Locale } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";

type Detail = NonNullable<ReturnType<typeof edgeDetail>>;

const SOURCE_NAME: Record<string, string> = {
  orphanet: "Orphanet", hpo: "HPO", monarch: "Monarch", clinvar: "ClinVar", ctgov: "ClinicalTrials.gov", opentargets: "Open Targets",
  reactome: "Reactome", pubmed: "PubMed", nih_reporter: "NIH RePORTER", patient_orgs: "Patient org (official site)", atlas_analysis: "Atlas analysis", openai_extraction: "OpenAI extraction",
};

export function EdgeInspector({ edgeId, t, locale, onClose, onFocusDisease }: { edgeId: string; t: Dict; locale: Locale; onClose: () => void; onFocusDisease: (id: string) => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/atlas/edge?id=${encodeURIComponent(edgeId)}&l=${locale}`, { signal: c.signal }).then((r) => r.json()).then(setD).catch(() => {});
    return () => c.abort();
  }, [edgeId, locale]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const inferred = d?.edge.kind === "inferred";
  return (
    <motion.aside
      initial={{ opacity: 0, x: reduce ? 0 : motionTokens.distance.lg }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduce ? 0 : motionTokens.distance.lg }}
      transition={springs.snappy}
      className="absolute inset-0 z-30 bg-paper flex flex-col" role="dialog" aria-label={t.inspect}>
      <header className="flex items-center justify-between px-5 h-12 border-b border-line">
        <p className="text-xs uppercase tracking-widest text-ink-3">{t.inspect}</p>
        <button onClick={onClose} className="text-sm text-ink-2 hover:text-ink" aria-label={t.close}>✕</button>
      </header>
      {!d ? <div className="p-5 space-y-3" aria-busy>{[0, 1, 2].map((i) => <div key={i} className="h-4 rounded bg-paper-2 pulse" />)}</div> : (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <p className="text-sm">
              <EntityLink e={d.from} onFocusDisease={onFocusDisease} />{" "}
              <span className="text-ink-3">{t.relations[d.edge.relation] ?? d.edge.relation}</span>{" "}
              <EntityLink e={d.to} onFocusDisease={onFocusDisease} />
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={`chip ${inferred ? "!border-dashed !border-amber text-amber" : "!border-teal text-teal"}`}>{t.edge_kind}: {t.status[d.edge.kind] ?? d.edge.kind}</span>
              <span className="chip">{d.edge.confidence_basis.replace(/_/g, " ")}</span>
            </div>
            <div className="mt-3">
              <p className="text-xs text-ink-3">{t.edge_confidence} · {d.edge.confidence.toFixed(2)}</p>
              <div className="mt-1 h-1.5 rounded-full bg-paper-2 overflow-hidden"><motion.div className={`h-full origin-left ${inferred ? "bg-amber" : "bg-teal"}`} initial={{ scaleX: 0 }} animate={{ scaleX: d.edge.confidence }} transition={springs.gentle} /></div>
            </div>
          </div>

          {d.similarity && (
            <section>
              <p className="text-sm font-medium">{t.why_connected}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                {[["score", d.similarity.score], ["phenotype", d.similarity.phenotype_score], ["pathway", d.similarity.pathway_score]].map(([k, v]) => (
                  <div key={String(k)} className="rounded-lg bg-paper-2 py-2"><dt className="text-[11px] text-ink-3">{k}</dt><dd className="tabular-nums font-medium">{Number(v).toFixed(2)}</dd></div>
                ))}
              </dl>
              <p className="text-xs text-ink-3 mt-3">{t.shared_symptoms}</p>
              <ul className="mt-1 space-y-1">
                {d.similarity.shared_phenotypes.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">{p.name}</span>
                    <span className="w-16 h-1 rounded bg-paper-2 overflow-hidden" title={`IC ${p.ic}`}><span className="block h-full bg-navy-2" style={{ width: `${p.ic * 100}%` }} /></span>
                  </li>
                ))}
              </ul>
              {d.similarity.shared_pathways.length > 0 && <><p className="text-xs text-ink-3 mt-3">{t.shared_pathways}</p><p className="text-sm">{d.similarity.shared_pathways.map((p) => p.name).join(" · ")}</p></>}
              {d.similarity.variant_effect_match !== null && <p className="text-xs text-ink-2 mt-3">{t.variant_effect}: {d.similarity.variant_effect_match ? "✓ match" : "≠ differs — mechanism may differ"}</p>}
            </section>
          )}

          <section>
            <p className="text-sm font-medium">{t.edge_sources} <span className="text-ink-3 font-normal">({d.edge.evidence.length})</span></p>
            <ul className="mt-2 space-y-2">
              {d.edge.evidence.map((ev, i) => (
                <motion.li key={ev.id} initial={{ opacity: 0, y: reduce ? 0 : motionTokens.distance.xs }} animate={{ opacity: 1, y: 0 }} transition={{ ...springs.gentle, delay: reduce ? 0 : i * 0.04 }}
                  className="evidence pl-3 py-1">
                  <a href={ev.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">{SOURCE_NAME[ev.source] ?? ev.source} · {ev.external_id}</a>
                  {ev.quote && <p className="text-xs text-ink-2 mt-0.5 line-clamp-3">{ev.quote}</p>}
                  <p className="text-[11px] text-ink-3 mt-0.5">{ev.published_on ? `${ev.published_on} · ` : ""}retrieved {ev.retrieved_at.slice(0, 10)}</p>
                </motion.li>
              ))}
            </ul>
          </section>

          <section>
            <p className="text-sm font-medium">{t.edge_contradictions}</p>
            {d.contradictions.length === 0 ? <p className="text-sm text-ink-3 mt-1">{t.none_found}</p> : (
              <ul className="mt-2 space-y-2">{d.contradictions.map((c, i) => (
                <li key={i} className="no-evidence rounded-r-lg px-3 py-2 text-sm">{c.text}{c.evidence && <a className="block text-xs underline mt-0.5" href={c.evidence.url} target="_blank" rel="noreferrer">{c.evidence.external_id}</a>}</li>
              ))}</ul>
            )}
          </section>
        </div>
      )}
    </motion.aside>
  );
}

function EntityLink({ e, onFocusDisease }: { e: Detail["from"]; onFocusDisease: (id: string) => void }) {
  if (e.type === "disease") return <button onClick={() => onFocusDisease(e.id)} className="font-medium hover:underline">{e.display}</button>;
  const url = (e.props.url ?? e.props.hpo_url) as string | undefined;
  return url ? <a href={url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{e.display}</a> : <span className="font-medium">{e.display}</span>;
}
