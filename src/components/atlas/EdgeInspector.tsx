"use client";
/**
 * S3 · Evidence drawer (UX_WAVE4): slides over the route panel. Header = the connection in words, its kind badge and,
 * for similarity edges, a Strong / Possible / Weak lead label. Tabs:
 *   Why            plain sentence · "Explain in plain words" (OpenAI, verified) · informative shared symptoms (IC bars) ·
 *                  shared pathways / genes · variant effect · the observed edges behind an inference
 *   Sources (n)    every evidence row: source, external id link, quote, "Read on <date>", confidence + basis, raw scores
 *                  (raw numbers appear ONLY here) · AI extraction for PubMed papers
 *   Uncertain      what could make this edge wrong (kind, low confidence, variant effect, no shared pathway, one source)
 *   Contradicting  contradicting / weakening evidence, or "none found in our sources"
 * Footer: Copy citation · Flag as wrong (stored as a community note, never evidence) · Propose a link.
 */
import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, Copy, ExternalLink, Flag, Lightbulb } from "lucide-react";
import type { edgeDetail } from "@/lib/atlas/store";
import type { Dict, Locale } from "@/lib/i18n";
import type { PersonaId } from "@/lib/agents/profiles";
import { motionTokens, springs } from "@/lib/motion";
import { ExplainButton } from "@/components/ai/ExplainButton";
import { ExtractPanel } from "@/components/ai/ExtractPanel";
import { KIND_STYLE, kindOf, type LinkKind } from "./colors";
import { KIND_ICON } from "./icons";
import { externalUrl } from "./links";
import { strengthOf, uncertainReasons } from "./evidence";
import type { Draft } from "./proposals";
import { api } from "./api";

type Detail = NonNullable<ReturnType<typeof edgeDetail>>;
type Tab = "why" | "sources" | "uncertain" | "contradicting";

/** Window event for "Propose a link": the co-creation dialog (action lane, `openCoCreate()`) listens; the mount already
 *  receives the inspected edge as `edgeIds`. */
export const COCREATE_OPEN_EVENT = "nedamex:cocreate";

const SOURCE_NAME: Record<string, string> = {
  orphanet: "Orphanet", hpo: "HPO", monarch: "Monarch", clinvar: "ClinVar", ctgov: "ClinicalTrials.gov", opentargets: "Open Targets",
  reactome: "Reactome", pubmed: "PubMed", nih_reporter: "NIH RePORTER", patient_orgs: "Patient org (official site)", atlas_analysis: "Nedamex analysis", nexmed_analysis: "Nedamex analysis", community: "Nedamex community drafts (not evidence)", fda: "FDA", openai_extraction: "OpenAI extraction",
};

export function KindBadge({ kind, t }: { kind: string; t: Dict }) {
  const k = kindOf(kind);
  const s = KIND_STYLE[k];
  const I = KIND_ICON[k];
  return (
    <span className="chip" style={{ borderColor: s.color, color: k === "proposed" ? undefined : s.color, borderStyle: s.dash ? "dashed" : "solid" }}>
      <I aria-hidden size={14} strokeWidth={1.75} />
      {t.kind_badge[k] ?? t.status[k] ?? k}
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
  const [tab, setTab] = useState<Tab>("why");
  const reduce = useReducedMotion();
  const tabsId = useId();
  useEffect(() => {
    const c = new AbortController();
    fetch(api(`/api/atlas/edge?id=${encodeURIComponent(edgeId)}&l=${locale}`), { signal: c.signal })
      .then((r) => { if (!r.ok) throw new Error("missing"); return r.json(); }).then(setD)
      .catch((e: Error) => { if (e.name !== "AbortError") setMissing(true); });
    return () => c.abort();
  }, [edgeId, locale]);

  const kind = kindOf(d?.edge.kind);
  const accent = KIND_STYLE[kind].color;
  const sim = d?.similarity ?? null;
  const strength = sim ? strengthOf(sim) : null;
  const reasons = d ? uncertainReasons(d.edge, sim) : [];
  const TABS: { id: Tab; label: string; n?: number }[] = [
    { id: "why", label: t.drawer.why },
    { id: "sources", label: t.drawer.sources, n: d?.edge.evidence.length },
    { id: "uncertain", label: t.drawer.uncertain, n: reasons.length || undefined },
    { id: "contradicting", label: t.drawer.contradicting, n: d?.contradictions.length || undefined },
  ];
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const dlt = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!dlt) return;
    e.preventDefault(); const next = TABS[(i + dlt + TABS.length) % TABS.length].id; setTab(next);
    document.getElementById(`${tabsId}-${next}`)?.focus();
  };

  return (
    <Shell t={t} onClose={onClose} reduce={!!reduce}>
      {missing ? <p className="p-5 text-sm text-ink-3">{t.edge_missing}</p> : !d ? <div className="p-5 space-y-3" aria-busy>{[0, 1, 2].map((i) => <div key={i} className="h-4 rounded bg-paper-2 pulse" />)}</div> : (
        <>
          {/* Summary: the connection, its kind, its strength */}
          <div className="px-5 pt-4 pb-3 border-b border-line">
            <p className="text-base leading-snug">
              <EntityLink e={d.from} onFocusDisease={onFocusDisease} />{" "}
              <span className="text-ink-3">{t.relations[d.edge.relation] ?? d.edge.relation.replace(/_/g, " ")}</span>{" "}
              <EntityLink e={d.to} onFocusDisease={onFocusDisease} />
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><KindBadge kind={d.edge.kind} t={t} /></div>
            {sim && strength && (
              <p className="mt-2 text-sm" title={t.drawer.strength_rule}>
                <span className="text-ink-3">{t.drawer.strength}: </span>
                <b className="font-semibold text-ink">{t.drawer[strength]}</b>{" "}
                <span className="text-ink-3">({t.drawer.strength_basis.replace("{s}", String(sim.shared_phenotypes.length)).replace("{p}", String(sim.shared_pathways.length)).replace("{g}", String(sim.shared_genes.length))})</span>
              </p>
            )}
          </div>

          <div role="tablist" aria-label={t.drawer.why} className="flex gap-1 px-3 pt-2 border-b border-line overflow-x-auto">
            {TABS.map((x, i) => (
              <button key={x.id} id={`${tabsId}-${x.id}`} role="tab" type="button" aria-selected={tab === x.id} aria-controls={`${tabsId}-panel`} tabIndex={tab === x.id ? 0 : -1}
                onClick={() => setTab(x.id)} onKeyDown={(e) => onTabKey(e, i)}
                className={`relative px-3 pb-2 pt-1 text-sm whitespace-nowrap ${tab === x.id ? "text-ink font-medium" : "text-ink-3 hover:text-ink-2"}`}>
                {x.label}{x.n !== undefined && <span className={`ml-1 text-[11px] ${x.id === "contradicting" ? "text-amber" : "text-ink-3"}`}>{x.n}</span>}
                {tab === x.id && <motion.span layoutId="drawer-tab" className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-brand-deep" transition={springs.snappy} />}
              </button>
            ))}
          </div>

          <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`} className="flex-1 overflow-y-auto p-5 space-y-4">
            {tab === "why" && (
              <>
                <p className="text-sm text-ink-2">{KIND_SENTENCE[kind][locale]}</p>
                <ExplainButton edgeIds={[d.edge.id]} persona={persona} locale={locale} onHighlight={onHighlight} />
                {sim && (
                  <section>
                    <h3 className="text-xs text-ink-3">{t.shared_symptoms}</h3>
                    <ul className="mt-1 space-y-1">
                      {sim.shared_phenotypes.map((p) => (
                        <li key={p.id} className="flex items-center gap-2 text-sm">
                          <span className="flex-1">{p.name}</span>
                          <span className="w-20 h-1.5 rounded bg-paper-2 overflow-hidden" aria-hidden><span className="block h-full bg-brand" style={{ width: `${Math.min(1, p.ic) * 100}%` }} /></span>
                        </li>
                      ))}
                    </ul>
                    {sim.shared_pathways.length > 0 && <><h3 className="text-xs text-ink-3 mt-3">{t.shared_pathways}</h3><p className="text-sm">{sim.shared_pathways.map((p) => p.name).join(" · ")}</p></>}
                    {sim.shared_genes.length > 0 && <><h3 className="text-xs text-ink-3 mt-3">{t.shared_genes}</h3><p className="text-sm">{sim.shared_genes.map((g) => g.replace(/^gene:(HGNC:)?/, "")).join(" · ")}</p></>}
                    {sim.variant_effect_match !== null && <p className="text-xs text-ink-2 mt-3">{t.variant_effect}: {sim.variant_effect_match ? (locale === "es" ? "✓ coincide" : "✓ match") : (locale === "es" ? "≠ difiere — el mecanismo puede ser distinto" : "≠ differs — mechanism may differ")}</p>}
                    {sim.supporting_edges.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-ink-3">{t.supporting_edges} ({sim.supporting_edges.length})</summary>
                        <ul className="mt-1 flex flex-wrap gap-1">
                          {sim.supporting_edges.slice(0, 24).map((id) => (
                            <li key={id}><button type="button" onClick={() => onInspect?.(id)} className="chip hover:bg-brand-soft font-mono !text-[10px]">{id.replace(/^edge:/, "").slice(0, 28)}</button></li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </section>
                )}
              </>
            )}

            {tab === "sources" && (
              <>
                <ul className="space-y-2">
                  {d.edge.evidence.map((ev, i) => {
                    const href = externalUrl(ev.external_id, ev.url);
                    return (
                      <motion.li key={ev.id} initial={{ opacity: 0, y: motionTokens.distance.xs }} animate={{ opacity: 1, y: 0 }} transition={{ ...springs.gentle, delay: reduce ? 0 : i * 0.03 }}
                        className="pl-3 py-1 border-l-[3px]" style={{ borderColor: accent }}>
                        <p className="text-sm font-medium">
                          {SOURCE_NAME[ev.source] ?? ev.source}{" · "}
                          {href ? <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-deep underline-offset-2 hover:underline">{ev.external_id}<ExternalLink aria-hidden size={12} /><span className="sr-only"> (opens in a new tab)</span></a> : <span>{ev.external_id}</span>}
                        </p>
                        {ev.quote && <p className="text-xs text-ink-2 mt-0.5 line-clamp-3">“{ev.quote}”</p>}
                        <p className="text-[11px] text-ink-3 mt-0.5">{ev.published_on ? `${t.drawer.published.replace("{d}", ev.published_on)} · ` : ""}{t.drawer.read_on.replace("{d}", ev.retrieved_at.slice(0, 10))}</p>
                      </motion.li>
                    );
                  })}
                </ul>
                <section className="rounded-xl bg-brand-mist p-3">
                  <h3 className="text-xs text-ink-3">{t.drawer.raw_scores}</h3>
                  <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-ink-3">{t.drawer.confidence}</dt><dd className="tabular-nums text-ink">{d.edge.confidence.toFixed(3)}</dd>
                    <dt className="text-ink-3">{t.basis}</dt><dd className="text-ink">{d.edge.confidence_basis.replace(/_/g, " ")}</dd>
                    {sim && <><dt className="text-ink-3">score</dt><dd className="tabular-nums text-ink">{sim.score.toFixed(3)}</dd>
                      <dt className="text-ink-3">symptoms</dt><dd className="tabular-nums text-ink">{sim.phenotype_score.toFixed(3)}</dd>
                      <dt className="text-ink-3">pathways</dt><dd className="tabular-nums text-ink">{sim.pathway_score.toFixed(3)}</dd></>}
                  </dl>
                </section>
                {(() => { const pm = d.edge.evidence.find((ev) => ev.source === "pubmed"); return pm ? <ExtractPanel pmid={pm.external_id} locale={locale} /> : null; })()}
              </>
            )}

            {tab === "uncertain" && (
              reasons.length === 0 ? <p className="text-sm text-ink-3">{t.drawer.uncertain_none}</p> : (
                <ul className="space-y-2">
                  {reasons.map((r) => <li key={r} className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-ink-2">{t.drawer[r].replace("{c}", d.edge.confidence.toFixed(2))}</li>)}
                </ul>
              )
            )}

            {tab === "contradicting" && (
              d.contradictions.length === 0 ? <p className="text-sm text-ink-3">{t.none_found}</p> : (
                <ul className="space-y-2">{d.contradictions.map((c, i) => {
                  const href = c.evidence ? externalUrl(c.evidence.external_id, c.evidence.url) : null;
                  return <li key={i} className="no-evidence rounded-r-lg px-3 py-2 text-sm">{c.text}{c.evidence && (href ? <a className="block text-xs underline mt-0.5" href={href} target="_blank" rel="noreferrer">{c.evidence.external_id}</a> : <span className="block text-xs mt-0.5">{c.evidence.external_id}</span>)}</li>;
                })}</ul>
              )
            )}
            <p className="text-[11px] text-ink-3">{t.disclaimer}</p>
          </div>

          <DrawerFooter d={d} t={t} persona={persona} />
        </>
      )}
    </Shell>
  );
}

/** Copy citation · Flag as wrong (community note through /api/proposals — never evidence) · Propose a link. */
function DrawerFooter({ d, t, persona }: { d: Detail; t: Dict; persona: PersonaId }) {
  const [status, setStatus] = useState<string | null>(null);
  const [flagging, setFlagging] = useState(false);
  const [note, setNote] = useState("");
  const rel = t.relations[d.edge.relation] ?? d.edge.relation.replace(/_/g, " ");
  const citation = `${d.from.display} ${rel} ${d.to.display} — ${d.edge.evidence.map((e) => `${SOURCE_NAME[e.source] ?? e.source} ${e.external_id}${e.url ? ` (${e.url})` : ""}`).join("; ")}. Nedamex edge ${d.edge.id} (${d.edge.kind}).`;
  const copy = async () => { try { await navigator.clipboard.writeText(citation); setStatus(t.drawer.copied); } catch { setStatus(t.drawer.flag_failed); } };
  const flag = async () => {
    try {
      const r = await fetch(api("/api/proposals"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        kind: "evidence", title: `Flag: ${d.from.display} ${rel} ${d.to.display} may be wrong`.slice(0, 200),
        body: (note.trim() || "Flagged from the evidence drawer.") + ` (edge ${d.edge.id})`, persona, entities: [d.from.id, d.to.id], edges: [d.edge.id],
      }) });
      if (!r.ok) throw new Error(String(r.status));
      setStatus(t.drawer.flagged); setFlagging(false); setNote("");
    } catch { setStatus(t.drawer.flag_failed); }
  };
  const propose = () => window.dispatchEvent(new CustomEvent(COCREATE_OPEN_EVENT, { detail: { kind: "hypothesis" } }));
  return (
    <footer className="border-t border-line px-4 py-3 space-y-2">
      {flagging && (
        <div className="space-y-2">
          <label className="block text-xs text-ink-2">{t.drawer.flag}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={600} className="mt-1 w-full rounded-lg border border-line bg-paper px-2 py-1 text-sm" />
          </label>
          <button type="button" onClick={flag} className="rounded-full bg-brand-deep px-3 py-1 text-xs font-medium text-paper hover:bg-brand-ink">{t.drawer.flag}</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <FooterBtn icon={Copy} label={t.drawer.copy} onClick={copy} />
        <FooterBtn icon={Flag} label={t.drawer.flag} onClick={() => setFlagging((f) => !f)} pressed={flagging} />
        <FooterBtn icon={Lightbulb} label={t.drawer.propose} onClick={propose} />
      </div>
      {status && <p role="status" className="text-xs text-ink-2">{status}</p>}
    </footer>
  );
}

function FooterBtn({ icon: I, label, onClick, pressed }: { icon: typeof Copy; label: string; onClick: () => void; pressed?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${pressed ? "border-brand-deep bg-brand-soft text-ink" : "border-line text-ink-2 hover:bg-brand-mist"}`}>
      <I aria-hidden size={14} strokeWidth={1.75} />{label}
    </button>
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
      className="absolute inset-0 z-30 bg-paper flex flex-col lg:pb-20" role="dialog" aria-label={t.rail_evidence}>
      <header className="flex items-center gap-2 px-3 h-12 border-b border-line bg-brand-mist">
        <button type="button" onClick={onClose} autoFocus className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm text-ink-2 hover:bg-brand-soft hover:text-ink">
          <ChevronLeft aria-hidden size={18} strokeWidth={1.75} />{t.drawer.back}
        </button>
        <p className="ml-auto pr-2 text-xs uppercase tracking-widest text-ink-3">{t.rail_evidence}</p>
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
