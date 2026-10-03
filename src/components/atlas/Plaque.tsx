"use client";
/** Citation chips and the station plaque (name · code · facts · evidence with source, ID and date). */
import type { EvidenceRef, LineKey, Station } from "@/lib/atlas-data";
import { countriesOf, isApproved, sourceLabel, str, strList, trialPhases, treatmentPhase, mechanismOf } from "@/lib/agents/evidence";
import type { AtlasCopy } from "./copy";
import { LINE_META } from "./lines";
import { BackIcon, CloseIcon, ExternalIcon } from "./Icons";

export const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);

export function CitationChip({ e, compact = false }: { e: EvidenceRef; compact?: boolean }) {
  const label = (
    <>
      <span className="shrink-0 whitespace-nowrap font-sans font-bold text-ink-2">{sourceLabel(e.source)}</span>
      <span className="min-w-0 truncate">{e.external_id}</span>
      {!compact && day(e.published_on) && <span className="shrink-0 whitespace-nowrap text-ink-3">· {day(e.published_on)}</span>}
    </>
  );
  const cls = "inline-flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden rounded-full border border-rule bg-canvas px-2.5 py-1 font-mono text-xs text-ink tabular-nums";
  if (!e.url) return <span className={cls} title={e.external_id}>{label}</span>;
  return (
    <a href={e.url} target="_blank" rel="noreferrer" title={`${sourceLabel(e.source)} · ${e.external_id}`}
      className={`${cls} transition-colors duration-150 hover:border-ink-3 hover:bg-panel`}>
      {label}
      <ExternalIcon size={12} className="shrink-0 text-ink-3" />
    </a>
  );
}

/** Short secondary line under a station name (code + the one fact that matters for that line). */
export function stationCode(s: Station, line: LineKey, c: AtlasCopy): string {
  const bits: (string | null)[] = [s.canonical_id || null];
  if (line === "phenotypes") bits.push(str(s.edge_props.frequency)?.replace(/\s*\(.*\)/, "") ?? null);
  if (line === "treatments") { const p = treatmentPhase(s); bits.push(isApproved(s) ? c.props.approved.toLowerCase() : p != null ? c.treat.phase(p).toLowerCase() : null); }
  if (line === "trials") bits.push(str(s.props.status)?.replace(/_/g, " ").toLowerCase() ?? null);
  if (line === "literature") bits.push(day(s.evidence[0]?.published_on)?.slice(0, 4) ?? null);
  if (line === "community") {
    const kind = s.props.kind === "researcher" ? str(s.props.role) : s.props.kind === "research" ? c.props.researchOrg : c.props.patientOrg;
    return [str(s.props.country), kind].filter(Boolean).join(" · ");
  }
  return bits.filter(Boolean).join(" · ");
}

function facts(s: Station, line: LineKey, c: AtlasCopy): [string, string][] {
  const p = c.props;
  const out: [string, string | null][] = [];
  if (line === "genes") out.push([p.association, str(s.edge_props.association_type)]);
  if (line === "phenotypes") out.push([p.frequency, str(s.edge_props.frequency)]);
  if (line === "treatments") {
    const ph = treatmentPhase(s);
    out.push([p.approved, isApproved(s) ? p.yes : p.no], [p.phase, ph != null ? String(ph) : null], [p.mechanism, mechanismOf(s)], [p.type, str(s.props.drug_type)]);
  }
  if (line === "trials") {
    const cs = countriesOf(s);
    out.push([p.status, str(s.props.status)?.replace(/_/g, " ") ?? null], [p.phase, trialPhases(s)], [p.countries, cs.length ? cs.slice(0, 8).join(", ") + (cs.length > 8 ? ` +${cs.length - 8}` : "") : null], [p.sponsor, str(s.props.sponsor)]);
  }
  if (line === "literature") out.push([p.journal, str(s.props.journal)], ["", strList(s.props.authors).slice(0, 3).join(", ") || null]);
  if (line === "community") {
    out.push([p.country, str(s.props.country)], [p.affiliation, str(s.props.affiliation)], [p.role, s.props.kind === "researcher" ? str(s.props.role) : str(s.props.kind)?.replace(/_/g, " ") ?? null], [p.focus, str(s.props.focus)]);
  }
  return out.filter((f): f is [string, string] => !!f[1]);
}

export function StationPlaque({ station, line, copy, onClose, onBack, headingLevel = 3 }: {
  station: Station; line: LineKey; copy: AtlasCopy; onClose?: () => void; onBack?: () => void; headingLevel?: 3 | 4;
}) {
  const meta = LINE_META[line];
  const H = headingLevel === 3 ? "h3" : "h4";
  return (
    <div className="plaque relative overflow-hidden">
      <div className={`h-1.5 ${meta.bg}`} aria-hidden />
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className={`font-display text-xs font-extrabold uppercase tracking-[0.06em] ${meta.text}`}>{copy.lines[line]}</p>
            <H className="mt-1 font-display text-lg font-bold leading-snug tracking-tight text-ink [overflow-wrap:anywhere]">{station.name}</H>
            {station.canonical_id && <p className="mt-0.5 font-mono text-sm text-ink-3">{station.canonical_id}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            {onBack && (
              <button type="button" onClick={onBack} aria-label={copy.map.back} title={copy.map.back}
                className="grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-panel hover:text-ink"><BackIcon /></button>
            )}
            {onClose && (
              <button type="button" onClick={onClose} aria-label={copy.map.close} title={copy.map.close}
                className="grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-panel hover:text-ink"><CloseIcon /></button>
            )}
          </div>
        </div>
        {facts(station, line, copy).length > 0 && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {facts(station, line, copy).map(([k, v], i) => (
              <div key={`${k}-${i}`} className="contents">
                <dt className="text-ink-3">{k}</dt>
                <dd className="text-ink [overflow-wrap:anywhere]">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-4 font-display text-xs font-bold uppercase tracking-[0.06em] text-ink-3">{copy.map.sources(station.evidence.length)}</p>
        <ul className="mt-2 space-y-2">
          {station.evidence.map((e) => (
            <li key={e.id} className="flex flex-col items-start gap-1">
              <CitationChip e={e} />
              {e.quote && <p className="pl-2.5 text-sm text-ink-2 [overflow-wrap:anywhere]">“{e.quote}”</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
