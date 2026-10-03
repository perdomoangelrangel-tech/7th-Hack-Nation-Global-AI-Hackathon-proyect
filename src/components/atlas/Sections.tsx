"use client";
/** Detail tabs under the map: Treatments & care · Trials · Community · Research gaps. */
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import type { DiseaseMap, GapItem, Station } from "@/lib/atlas-data";
import { countriesOf, isApproved, isRecruiting, str, trialPhases, trialStatus, treatmentPhase, mechanismOf } from "@/lib/agents/evidence";
import { site } from "@/lib/site";
import type { AtlasCopy } from "./copy";
import { LINE_META } from "./lines";
import { CitationChip } from "./Plaque";
import { ArrowIcon, ExternalIcon } from "./Icons";

export type TabKey = "treatments" | "trials" | "community" | "gaps";
export const TABS: TabKey[] = ["treatments", "trials", "community", "gaps"];

const TAB_COLOR: Record<TabKey, { bar: string; text: string }> = {
  treatments: { bar: "bg-treat", text: "text-t-treat" },
  trials: { bar: "bg-trial", text: "text-t-trial" },
  community: { bar: "bg-comm", text: "text-t-comm" },
  gaps: { bar: "bg-gap", text: "text-ink-2" },
};

export function Sections({ map, copy, tab, onTab }: { map: DiseaseMap; copy: AtlasCopy; tab: TabKey; onTab: (t: TabKey) => void }) {
  const refs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});
  const count: Record<TabKey, number> = {
    treatments: map.totals.treatments, trials: map.totals.trials, community: map.totals.community, gaps: map.gaps.length,
  };

  const onKey = (e: KeyboardEvent) => {
    const i = TABS.indexOf(tab);
    const next = e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length] : e.key === "ArrowLeft" ? TABS[(i + TABS.length - 1) % TABS.length] : e.key === "Home" ? TABS[0] : e.key === "End" ? TABS[TABS.length - 1] : null;
    if (!next) return;
    e.preventDefault();
    onTab(next);
    refs.current[next]?.focus();
  };

  return (
    <section aria-label={copy.tabs.label} className="mt-12">
      <div role="tablist" aria-label={copy.tabs.label} onKeyDown={onKey} className="-mx-4 flex gap-1 overflow-x-auto border-b border-rule px-4 md:mx-0 md:px-0">
        {TABS.map((t) => {
          const on = t === tab;
          return (
            <button key={t} id={`tab-${t}`} ref={(el) => { refs.current[t] = el; }} role="tab" type="button" aria-selected={on} aria-controls={`panel-${t}`} tabIndex={on ? 0 : -1}
              onClick={() => onTab(t)}
              className={`relative flex min-h-12 shrink-0 items-center gap-2 px-3 font-display text-[15px] font-bold transition-colors sm:px-4 ${on ? "text-ink" : "text-ink-3 hover:text-ink"}`}>
              {copy.tabs[t]}
              <span className="font-mono text-xs font-medium text-ink-3">{count[t]}</span>
              <span className={`absolute inset-x-2 -bottom-px h-[5px] rounded-full ${TAB_COLOR[t].bar} ${on ? "opacity-100" : "opacity-0"}`} aria-hidden />
            </button>
          );
        })}
      </div>
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0} className="pt-6 outline-none">
        {tab === "treatments" && <Treatments map={map} copy={copy} />}
        {tab === "trials" && <Trials map={map} copy={copy} />}
        {tab === "community" && <Community map={map} copy={copy} />}
        {tab === "gaps" && <Gaps map={map} copy={copy} />}
      </div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="flex min-h-12 items-center gap-3 text-sm text-ink-2">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><circle cx="9" cy="9" r="6" className="station-gap" strokeWidth={2.5} /></svg>
      {children}
    </p>
  );
}

function Chips({ s, n = 2 }: { s: Station; n?: number }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {s.evidence.slice(0, n).map((e) => <li key={e.id} className="min-w-0 max-w-full"><CitationChip e={e} compact /></li>)}
    </ul>
  );
}

function Treatments({ map, copy }: { map: DiseaseMap; copy: AtlasCopy }) {
  const t = map.lines.treatments;
  if (!t.length) return <Empty>{copy.treat.none}</Empty>;
  const groups: [string, Station[]][] = [[copy.treat.approved, t.filter(isApproved)], [copy.treat.investigational, t.filter((s) => !isApproved(s)).sort((a, b) => (treatmentPhase(b) ?? 0) - (treatmentPhase(a) ?? 0))]];
  return (
    <div className="grid gap-8 md:grid-cols-2">
      {groups.map(([title, list]) => (
        <div key={title} className="min-w-0">
          <h3 className="flex items-baseline gap-2 font-display text-lg font-bold">{title}<span className="font-mono text-sm font-medium text-ink-3">{list.length}</span></h3>
          {list.length === 0 ? <Empty>{copy.map.empty}</Empty> : (
            <ul className="mt-2 divide-y divide-rule">
              {list.map((s) => {
                const ph = treatmentPhase(s);
                return (
                  <li key={s.id} className="py-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-display text-base font-bold text-ink">{s.name}</span>
                      {ph != null && <span className="rounded-full bg-panel px-2 py-0.5 font-mono text-xs text-t-treat">{copy.treat.phase(ph)}</span>}
                      <span className="font-mono text-xs text-ink-3">{s.canonical_id}</span>
                    </div>
                    {mechanismOf(s) && <p className="mt-0.5 text-sm text-ink-2">{mechanismOf(s)}</p>}
                    <Chips s={s} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

const STATUS_TONE = (status: string) =>
  status === "RECRUITING" || status === "NOT_YET_RECRUITING" || status === "ENROLLING_BY_INVITATION" ? { dot: "var(--l-treat)", text: "text-t-treat" }
  : status === "ACTIVE_NOT_RECRUITING" ? { dot: "var(--l-trial)", text: "text-t-trial" }
  : status === "TERMINATED" || status === "WITHDRAWN" || status === "SUSPENDED" ? { dot: "var(--l-gene)", text: "text-t-gene" }
  : { dot: "var(--gap)", text: "text-ink-3" };

function Trials({ map, copy }: { map: DiseaseMap; copy: AtlasCopy }) {
  const t = [...map.lines.trials].sort((a, b) => Number(isRecruiting(b)) - Number(isRecruiting(a)));
  if (!t.length) return <Empty>{copy.trials.none}</Empty>;
  const rec = t.filter(isRecruiting).length;
  return (
    <div>
      <p className="font-mono text-sm text-ink-2">{copy.trials.recruiting(rec)} · {copy.map.showing(t.length, Math.max(map.totals.trials, t.length))}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-rule font-display text-xs uppercase tracking-[0.06em] text-ink-3">
              <th scope="col" className="py-2 pr-4 font-bold">{copy.trials.title}</th>
              <th scope="col" className="py-2 pr-4 font-bold">{copy.trials.status}</th>
              <th scope="col" className="py-2 pr-4 font-bold">{copy.trials.phase}</th>
              <th scope="col" className="py-2 pr-4 font-bold">{copy.trials.countries}</th>
              <th scope="col" className="py-2 font-bold">{copy.trials.id}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {t.map((s) => {
              const st = trialStatus(s);
              const tone = STATUS_TONE(st);
              const cs = countriesOf(s);
              return (
                <tr key={s.id} className="align-top">
                  <td className="max-w-[28rem] py-3 pr-4 text-ink">{s.name}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-xs ${tone.text}`}>
                      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden><circle cx="4" cy="4" r="4" fill={tone.dot} /></svg>
                      {st ? st.replace(/_/g, " ").toLowerCase() : "—"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-ink-2">{trialPhases(s) ?? "—"}</td>
                  <td className="py-3 pr-4 text-ink-2">{cs.length ? `${cs.slice(0, 3).join(", ")}${cs.length > 3 ? ` +${cs.length - 3}` : ""}` : "—"}</td>
                  <td className="py-3">
                    {s.evidence[0]?.url ? (
                      <a href={s.evidence[0].url} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 whitespace-nowrap font-mono text-xs text-t-trial underline-offset-2 hover:underline">
                        {s.canonical_id}<ExternalIcon size={12} />
                      </a>
                    ) : <span className="font-mono text-xs">{s.canonical_id}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Community({ map, copy }: { map: DiseaseMap; copy: AtlasCopy }) {
  const orgs = map.lines.community.filter((s) => s.props.kind !== "researcher");
  const people = map.lines.community.filter((s) => s.props.kind === "researcher");
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="min-w-0">
        <h3 className="flex items-baseline gap-2 font-display text-lg font-bold">{copy.comm.orgs}<span className="font-mono text-sm font-medium text-ink-3">{orgs.length}</span></h3>
        {orgs.length === 0 ? <Empty>{copy.comm.none}</Empty> : (
          <ul className="mt-2 divide-y divide-rule">
            {orgs.map((s) => (
              <li key={s.id} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  {str(s.props.url) ? (
                    <a href={str(s.props.url)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-display text-base font-bold text-ink underline-offset-2 hover:underline">{s.name}<ExternalIcon size={14} className="text-ink-3" /></a>
                  ) : <span className="font-display text-base font-bold">{s.name}</span>}
                  {str(s.props.country) && <span className="font-mono text-xs text-ink-3">{str(s.props.country)}</span>}
                </div>
                <Chips s={s} n={1} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-baseline gap-2 font-display text-lg font-bold">{copy.comm.researchers}<span className="font-mono text-sm font-medium text-ink-3">{people.length}</span></h3>
          {site.portal && (
            <a href={site.portal} target="_blank" rel="noreferrer" className="btn btn-ghost !min-h-11 text-sm">{copy.comm.join}<ArrowIcon size={16} /></a>
          )}
        </div>
        {people.length === 0 ? <Empty>{copy.comm.noResearchers}</Empty> : (
          <ul className="mt-2 divide-y divide-rule">
            {people.map((s) => (
              <li key={s.id} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-display text-base font-bold">{s.name}</span>
                  {s.props.open_to_contact === true && <span className="rounded-full bg-panel px-2 py-0.5 text-xs text-t-comm">{copy.comm.openToContact}</span>}
                </div>
                <p className="text-sm text-ink-2">{[str(s.props.affiliation), str(s.props.country), str(s.props.role)].filter(Boolean).join(" · ")}</p>
                {str(s.props.focus) && <p className="text-sm text-ink-3">{str(s.props.focus)}</p>}
                <Chips s={s} n={1} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function gapText(g: GapItem, copy: AtlasCopy, disease: string) {
  const subject = g.station ? `${g.station.name} (${g.station.canonical_id}) → ${disease}` : copy.lines[g.line];
  return copy.gaps[g.kind](subject);
}

function Gaps({ map, copy }: { map: DiseaseMap; copy: AtlasCopy }) {
  return (
    <div>
      <p className="text-sm text-ink-2">{copy.gaps.intro}</p>
      {map.gaps.length === 0 ? <div className="mt-3"><Empty>{copy.gaps.none}</Empty></div> : (
        <ol className="mt-4 grid gap-x-10 md:grid-cols-2 [&>li]:min-w-0">
          {map.gaps.map((g, i) => (
            <li key={`${g.kind}-${i}`} className="relative py-2.5 pl-9 before:absolute before:bottom-0 before:left-[9px] before:top-0 before:border-l-[5px] before:border-dashed before:border-gap">
              <svg width="24" height="24" viewBox="0 0 24 24" className="absolute left-0 top-2" aria-hidden><circle cx="12" cy="12" r="8" className="station-gap" strokeWidth={2.5} /></svg>
              <p className="text-[15px] leading-snug text-ink">{gapText(g, copy, map.disease.short)}</p>
              <p className={`mt-0.5 font-display text-xs font-bold uppercase tracking-[0.06em] ${LINE_META[g.line].text}`}>{copy.lineShort[g.line]}{g.evidence_ids.length ? <span className="ml-2 font-mono font-medium normal-case tracking-normal text-ink-3">{copy.map.sources(g.evidence_ids.length)}</span> : null}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
