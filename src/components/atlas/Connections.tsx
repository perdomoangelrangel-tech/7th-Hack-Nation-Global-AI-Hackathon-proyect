"use client";
/**
 * Connections (Module 3). Each neighbor is drawn as an interchange: this disease's line (ink) and the
 * neighbor's line (grey) meet at shared stations, one per evidence kind, colored by line. Expand to see
 * every shared item with evidence on both sides, the next step and what must be validated.
 */
import { useState } from "react";
import type { Lang } from "@/lib/i18n";
import type { EvidenceRef } from "@/lib/atlas-data";
import { linkTrialStatus, nameIn, sideApproved, sidePhase, type Connections as Conn, type DiseaseRef, type LinkItem, type LinkKind, type Neighbor } from "@/lib/agents/connections";
import { approvalOf, str, strList } from "@/lib/agents/evidence";
import type { AtlasCopy } from "./copy";
import type { Audience } from "./lines";
import { CitationChip, day } from "./Plaque";
import { ArrowIcon, ChevronIcon, ExternalIcon } from "./Icons";
import styles from "./atlas.module.css";

const KIND_COLOR: Record<LinkKind, { stroke: string; text: string; bg: string }> = {
  treatment: { stroke: "var(--l-treat)", text: "text-t-treat", bg: "bg-treat" },
  trial: { stroke: "var(--l-trial)", text: "text-t-trial", bg: "bg-trial" },
  researcher: { stroke: "var(--l-comm)", text: "text-t-comm", bg: "bg-comm" },
  gene: { stroke: "var(--l-gene)", text: "text-t-gene", bg: "bg-gene" },
  phenotype: { stroke: "var(--l-pheno)", text: "text-t-pheno", bg: "bg-pheno" },
  organization: { stroke: "var(--l-comm)", text: "text-t-comm", bg: "bg-comm" },
};
const ORDER: LinkKind[] = ["treatment", "trial", "researcher", "gene", "phenotype", "organization"];

const nameOf = (d: DiseaseRef, lang: Lang) => (lang === "es" && d.name_es ? d.name_es : d.name);
/** Name inside a sentence (ES carries its article: "el síndrome de Dravet"). */
const midName = (d: DiseaseRef, lang: Lang) => nameIn(d, lang);

export function Connections({ conn, copy, lang, audience }: { conn: Conn; copy: AtlasCopy; lang: Lang; audience: Audience }) {
  const c = copy.conn;
  const ranked = conn.neighbors;
  return (
    <section id="connections" aria-labelledby="conn-title" className="mt-12 scroll-mt-48 md:scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 id="conn-title" className="text-2xl md:text-[2rem]">{c.title}</h2>
          <p className="mt-1 max-w-[62ch] text-ink-2">{c.intro(conn.disease.short)}</p>
        </div>
        <details className="group max-w-xl text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full border border-rule px-4 font-display font-bold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
            {c.how}<ChevronIcon size={14} className="transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-2 rounded-[var(--radius)] bg-panel p-3 text-ink-2">{c.formula}</p>
        </details>
      </div>
      {ranked.length === 0 ? (
        <p className="mt-4 text-ink-2">{c.empty}</p>
      ) : (
        <ol className="mt-5 space-y-3">
          {ranked.map((n, i) => (
            <li key={n.disease.orpha}>
              {n.gap ? <GapRow here={conn.disease} n={n} copy={copy} lang={lang} /> : <NeighborCard here={conn.disease} n={n} rank={i + 1} defaultOpen={i === 0} copy={copy} lang={lang} audience={audience} />}
            </li>
          ))}
        </ol>
      )}
      {conn.umbrella.length > 0 && <p className="mt-3 text-sm text-ink-3">{c.umbrella(conn.umbrella.map((u) => u.name.split(" · ")[0]).join(", "))}</p>}
    </section>
  );
}

function Pill({ label, tone }: { label: string; tone: "here" | "there" }) {
  return (
    <span className={`relative z-10 inline-flex h-7 max-w-[9rem] items-center truncate rounded-full border-[2.5px] bg-canvas px-2.5 font-display text-sm font-extrabold ${tone === "here" ? "border-ink text-ink" : "border-ink-3 text-ink-2"}`}>
      {label}
    </span>
  );
}

/** Two parallel lines meeting at one interchange per shared kind. */
function Interchange({ here, n, copy }: { here: DiseaseRef; n: Neighbor; copy: AtlasCopy }) {
  const kinds = ORDER.filter((k) => n.counts[k] > 0);
  return (
    <div className="relative grid h-[72px] min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2" aria-hidden>
      <div className="absolute left-3 right-10 top-[24px] h-[5px] rounded-full bg-ink" />
      <div className="absolute left-10 right-3 top-[43px] h-[5px] rounded-full bg-ink-3" />
      <span className="self-start pt-[12px]"><Pill label={here.short} tone="here" /></span>
      <span className="relative z-10 flex items-center justify-evenly gap-1.5">
        {kinds.map((k) => (
          <span key={k} title={copy.conn.kinds[k](n.counts[k])}
            className={`grid h-[44px] w-9 place-items-center rounded-full border-[3px] bg-canvas font-mono text-sm font-bold tabular-nums ${KIND_COLOR[k].text}`}
            style={{ borderColor: KIND_COLOR[k].stroke }}>
            {n.counts[k]}
          </span>
        ))}
      </span>
      <span className="self-end pb-[12px]"><Pill label={n.disease.short} tone="there" /></span>
    </div>
  );
}

function ScoreBar({ n, copy }: { n: Neighbor; copy: AtlasCopy }) {
  const b = n.breakdown;
  const parts: [string, number, string][] = [
    [copy.conn.breakdown.phenotypes, b.phenotypes.value, "bg-pheno"],
    [copy.conn.breakdown.treatments, b.treatments.value, "bg-treat"],
    [copy.conn.breakdown.trials, b.trials.value, "bg-trial"],
    [copy.conn.breakdown.researchers, b.researchers.value, "bg-comm"],
  ];
  return (
    <div className="w-28 shrink-0 text-right">
      <p className="font-mono text-2xl font-bold leading-none tabular-nums text-ink">{n.score.toFixed(2)}</p>
      <p className="mt-0.5 text-xs text-ink-3">{copy.conn.match}</p>
      <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-panel-2" role="img"
        aria-label={parts.map(([l, v]) => `${l} ${v.toFixed(2)}`).join(", ")}>
        {parts.map(([l, v, bg]) => (v > 0 ? <span key={l} className={bg} style={{ width: `${Math.max(v * 100, 2)}%` }} /> : null))}
      </div>
    </div>
  );
}

function NeighborCard({ here, n, rank, defaultOpen, copy, lang, audience }: { here: DiseaseRef; n: Neighbor; rank: number; defaultOpen: boolean; copy: AtlasCopy; lang: Lang; audience: Audience }) {
  const [open, setOpen] = useState(defaultOpen);
  const c = copy.conn;
  const kinds = ORDER.filter((k) => n.counts[k] > 0);
  const panelId = `conn-${n.disease.orpha.replace(/\W/g, "")}`;
  return (
    <article className="rounded-[var(--radius-lg)] border border-rule bg-canvas">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:flex-nowrap sm:p-5">
        <span className="font-mono text-sm text-ink-3 tabular-nums">#{rank}</span>
        <div className="order-3 w-full min-w-0 sm:order-none sm:flex-1">
          <h3 className="font-display text-lg font-bold leading-tight text-ink">{nameOf(n.disease, lang)} <span className="font-mono text-xs font-medium text-ink-3">{n.disease.orpha}</span></h3>
          <Interchange here={here} n={n} copy={copy} />
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-2">
            {kinds.map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-full ${KIND_COLOR[k].bg}`} aria-hidden />{c.kinds[k](n.counts[k])}</span>
            ))}
          </p>
        </div>
        <span className="ml-auto sm:ml-0"><ScoreBar n={n} copy={copy} /></span>
      </div>
      <div className="border-t border-rule px-4 sm:px-5">
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}
          className="flex min-h-12 w-full items-center gap-2 font-display text-sm font-bold text-ink-2 hover:text-ink">
          <ChevronIcon size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          {open ? c.close : c.open}
        </button>
      </div>
      {open && (
        <div id={panelId} className={`grid gap-6 px-4 pb-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] ${styles.fade}`}>
          <div className="min-w-0 space-y-5">
            {ORDER.filter((k) => n.shared[k].length > 0).map((k) => (
              <SharedGroup key={k} kind={k} items={n.shared[k]} total={n.counts[k]} here={here} there={n.disease} copy={copy} lang={lang} />
            ))}
            {n.umbrella.length > 0 && <p className="text-sm text-ink-3">{c.umbrella(n.umbrella.map((u) => u.name.split(" · ")[0]).join(", "))}</p>}
          </div>
          <NextCard here={here} n={n} copy={copy} lang={lang} audience={audience} />
        </div>
      )}
    </article>
  );
}

function SideLinks({ items, label }: { items: EvidenceRef[]; label: string }) {
  if (!items.length) return null;
  return (
    <>
      {items.slice(0, 1).map((e) => (
        <a key={e.id} href={e.url} target="_blank" rel="noreferrer" title={`${e.source} · ${e.external_id}`}
          className="inline-flex min-h-8 items-center gap-1 rounded-full border border-rule px-2 font-mono text-xs text-ink-2 hover:border-ink-3 hover:text-ink">
          {label}<ExternalIcon size={11} />
        </a>
      ))}
    </>
  );
}

function treatmentStatus(side: Record<string, unknown>, d: string, c: AtlasCopy["conn"]) {
  const ph = sidePhase(side);
  if (sideApproved(side)) { const a = approvalOf(side); return `${c.approvedFor(d, ph)}${a ? ` · ${a.label}` : ""}`; }
  return ph != null ? c.phaseFor(d, ph) : c.studiedFor(d);
}

function SharedGroup({ kind, items, total, here, there, copy, lang }: { kind: LinkKind; items: LinkItem[]; total: number; here: DiseaseRef; there: DiseaseRef; copy: AtlasCopy; lang: Lang }) {
  const c = copy.conn;
  const color = KIND_COLOR[kind];
  return (
    <section>
      <h4 className={`flex items-baseline gap-2 font-display text-xs font-extrabold uppercase tracking-[0.06em] ${color.text}`}>
        {c.group[kind]}<span className="font-mono font-medium normal-case tracking-normal text-ink-3">{total}</span>
      </h4>
      <ul className="mt-2 divide-y divide-rule border-l-[5px] pl-3" style={{ borderColor: color.stroke }}>
        {items.map((it, i) => (
          <li key={`${it.code ?? it.name}-${i}`} className="py-2.5 first:pt-1">
            {kind === "treatment" && (
              <>
                <p className="text-[15px] text-ink"><span className="font-display font-bold">{it.name}</span>
                  {" — "}{treatmentStatus(it.there, midName(there, lang), c)} · {treatmentStatus(it.here, here.short, c)}
                  {strList(it.here.nct_ids)[0] ? <span className="font-mono text-sm text-ink-3"> · {strList(it.here.nct_ids)[0]}</span> : null}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {[...it.evidence_there.slice(0, 1), ...it.evidence_here.slice(0, 1)].map((e) => <li key={e.id} className="min-w-0 max-w-full"><CitationChip e={e} compact /></li>)}
                </ul>
              </>
            )}
            {kind === "trial" && (
              <>
                <p className="text-[15px] text-ink">
                  <a href={`https://clinicaltrials.gov/study/${it.code}`} target="_blank" rel="noreferrer" className="font-mono text-sm font-bold text-t-trial underline-offset-2 hover:underline">{it.code}</a>
                  {" "}{it.name}
                  {linkTrialStatus(it) && <span className="font-mono text-xs text-ink-3"> · {c.trialStatus(linkTrialStatus(it))}</span>}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5"><SideLinks items={it.evidence_here} label={here.short} /><SideLinks items={it.evidence_there} label={there.short} /></div>
              </>
            )}
            {kind === "researcher" && (
              <>
                <p className="text-[15px] text-ink"><span className="font-display font-bold">{it.name}</span>
                  {[str(it.props.affiliation), str(it.props.country)].filter(Boolean).length > 0 && <span className="text-sm text-ink-2"> · {[str(it.props.affiliation), str(it.props.country)].filter(Boolean).join(" · ")}</span>}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <SideLinks items={it.evidence_here} label={c.paper(here.short)} />
                  <SideLinks items={it.evidence_there} label={c.paper(there.short)} />
                  {str(it.props.orcid) && (
                    <a href={`https://orcid.org/${str(it.props.orcid)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 rounded-full border border-rule px-2 font-mono text-xs text-ink-2 hover:text-ink">ORCID<ExternalIcon size={11} /></a>
                  )}
                </div>
              </>
            )}
            {(kind === "phenotype" || kind === "gene" || kind === "organization") && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[15px] text-ink">{it.name}</span>
                {it.code && <span className="font-mono text-xs text-ink-3">{it.code}</span>}
                {kind === "phenotype" && (str(it.here.frequency) || str(it.there.frequency)) && (
                  <span className="font-mono text-xs text-ink-3">{here.short}: {str(it.here.frequency)?.replace(/\s*\(.*\)/, "") ?? "—"} · {there.short}: {str(it.there.frequency)?.replace(/\s*\(.*\)/, "") ?? "—"}</span>
                )}
                <span className="flex gap-1.5"><SideLinks items={it.evidence_here} label={here.short} /><SideLinks items={it.evidence_there} label={there.short} /></span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {total > items.length && <p className="mt-1 pl-4 font-mono text-xs text-ink-3">{c.more(total - items.length)}</p>}
    </section>
  );
}

function NextCard({ here, n, copy, lang, audience }: { here: DiseaseRef; n: Neighbor; copy: AtlasCopy; lang: Lang; audience: Audience }) {
  const c = copy.conn;
  const neighbor = midName(n.disease, lang);
  return (
    <aside className="h-fit space-y-4">
      <div className="rounded-[var(--radius)] border-2 border-ink p-4">
        <h4 className="font-display text-sm font-extrabold uppercase tracking-[0.06em] text-ink">{c.next}</h4>
        <ul className="mt-2 space-y-2.5">
          {n.steps.map((s, i) => (
            <li key={i} className="flex gap-2 text-[15px] leading-snug text-ink">
              <ArrowIcon size={16} className="mt-0.5 shrink-0" />
              <span>
                {c.steps[s.kind]({ item: s.item, nct: s.nct, neighbor, here: here.short, np: s.neighborPhase, hp: s.herePhase, label: s.label, status: s.status })}
                {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 font-mono text-xs text-ink-2 underline-offset-2 hover:underline">{s.nct ?? "PubMed"}<ExternalIcon size={11} /></a>}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {n.validate.length > 0 && (
        <div className="border-l-[5px] border-dashed border-gap pl-3">
          <h4 className="font-display text-xs font-extrabold uppercase tracking-[0.06em] text-ink-3">{c.validate}</h4>
          <ul className="mt-1 space-y-1 text-sm text-ink-2">{n.validate.map((v) => <li key={v}>{c.validateText[v](neighbor)}</li>)}</ul>
        </div>
      )}
      <Explain here={here} n={n} copy={copy} lang={lang} audience={audience} />
    </aside>
  );
}

interface ExplainResponse { mode: "llm" | "demo"; source: "live" | "snapshot"; spoken: string; claims: { text: string; citations: EvidenceRef[] }[]; dropped: { text: string }[]; retrieved_at: string }

function Explain({ here, n, copy, lang, audience }: { here: DiseaseRef; n: Neighbor; copy: AtlasCopy; lang: Lang; audience: Audience }) {
  const [state, setState] = useState<{ kind: "idle" | "loading" | "error" } | { kind: "done"; data: ExplainResponse }>({ kind: "idle" });
  const c = copy.conn;
  async function run() {
    setState({ kind: "loading" });
    try {
      const r = await fetch("/api/explain-connection", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ orpha: here.orpha, neighbor_orpha: n.disease.orpha, locale: lang, audience }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setState({ kind: "done", data: (await r.json()) as ExplainResponse });
    } catch {
      setState({ kind: "error" });
    }
  }
  return (
    <div aria-live="polite">
      {state.kind !== "done" && (
        <button type="button" onClick={run} disabled={state.kind === "loading"} className="btn btn-ghost w-full justify-center text-sm">
          {state.kind === "loading" ? c.explaining : c.explain}
        </button>
      )}
      {state.kind === "loading" && <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel-2"><div className="loading-bar h-full w-full bg-ink-3" /></div>}
      {state.kind === "error" && <p className="mt-2 text-sm text-t-gene">{c.explainError}</p>}
      {state.kind === "done" && (
        <div className={`rounded-[var(--radius)] bg-panel p-4 ${styles.fade}`}>
          <p className="font-display text-xs font-bold uppercase tracking-[0.06em] text-ink-3">{c.explain}</p>
          <ol className="mt-2 space-y-2.5">
            {state.data.claims.map((cl, i) => (
              <li key={i} className="text-sm leading-snug text-ink">
                {cl.text}
                <span className="mt-1 flex flex-wrap gap-1">{cl.citations.slice(0, 2).map((e) => <CitationChip key={e.id} e={e} compact />)}</span>
              </li>
            ))}
            {state.data.dropped.map((d, i) => <li key={`d${i}`} className="text-sm font-bold text-ink-2">{copy.ask.noEvidence}</li>)}
          </ol>
          <p className="mt-3 border-t border-rule pt-2 text-xs text-ink-2">{copy.disclaimer}</p>
          <p className="font-mono text-[11px] text-ink-3">{copy.ask.meta(state.data.mode, state.data.source, day(state.data.retrieved_at) ?? "")}</p>
        </div>
      )}
    </div>
  );
}

function GapRow({ here, n, copy, lang }: { here: DiseaseRef; n: Neighbor; copy: AtlasCopy; lang: Lang }) {
  const c = copy.conn;
  const neighbor = midName(n.disease, lang);
  return (
    <article className="rounded-[var(--radius-lg)] border border-dashed border-gap p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Pill label={here.short} tone="here" />
        <span className="h-0 w-10 border-t-[4px] border-dashed border-gap" aria-hidden />
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden><circle cx="10" cy="10" r="7" className="station-gap" strokeWidth={2.5} /></svg>
        <span className="h-0 w-10 border-t-[4px] border-dashed border-gap" aria-hidden />
        <Pill label={n.disease.short} tone="there" />
        <span className="font-display font-bold text-ink-2">{c.gapTitle}</span>
      </div>
      <p className="mt-2 text-sm text-ink-2">{c.gapBody(neighbor)}</p>
      <p className="mt-1 flex gap-2 text-sm text-ink"><ArrowIcon size={16} className="mt-0.5 shrink-0" />{c.steps.investigate({ neighbor, here: here.short })}</p>
    </article>
  );
}

