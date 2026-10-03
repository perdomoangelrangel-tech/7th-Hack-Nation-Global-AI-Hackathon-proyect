"use client";
/** /atlas shell: top bar (logo · disease · audience · language), map + ask, detail tabs, footer. */
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { LangToggle, useCopy, useLang } from "@/lib/i18n";
import type { DiseaseMap as Atlas, DiseaseSummary, LineKey } from "@/lib/atlas-data";
import { atlasCopy } from "./copy";
import { AUDIENCES, AUDIENCE_META, LINE_META, type Audience } from "./lines";
import { DiseaseMap, type Selection } from "./DiseaseMap";
import { AskPanel } from "./AskPanel";
import { VoiceAgent } from "./VoiceAgent";
import { Sections, TABS, type TabKey } from "./Sections";
import { Connections } from "./Connections";
import type { Connections as Conn } from "@/lib/agents/connections";
import { day } from "./Plaque";
import { ChevronIcon } from "./Icons";
import { prevalenceLabel } from "@/lib/agents/evidence";

const LINE_KEYS: LineKey[] = ["genes", "phenotypes", "treatments", "trials", "literature", "community"];
const DEFAULT_TAB: Record<Audience, TabKey> = { family: "treatments", clinical: "trials", research: "gaps" };

export function AtlasApp({ diseases, map, connections, orpha, initialAudience }: { diseases: DiseaseSummary[]; map: Atlas | null; connections: Conn | null; orpha: string; initialAudience: Audience }) {
  const copy = useCopy(atlasCopy);
  const { lang } = useLang();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [audience, setAudience] = useState<Audience>(initialAudience);
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<TabKey>(DEFAULT_TAB[initialAudience]);
  const detailsRef = useRef<HTMLDivElement>(null);

  // Reset map-local state when the disease changes (new server payload).
  const [shownOrpha, setShownOrpha] = useState(orpha);
  if (shownOrpha !== orpha) {
    setShownOrpha(orpha);
    setSelection(null);
  }

  // Escape closes the plaque.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelection(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const current = diseases.find((d) => d.orpha === orpha);
  const nameOf = (d: { name: string; name_es: string | null }) => (lang === "es" && d.name_es ? d.name_es : d.name);

  const go = (nextOrpha: string, aud = audience) => {
    startTransition(() => router.push(`/atlas?d=${encodeURIComponent(nextOrpha)}&a=${aud}`, { scroll: false }));
  };
  const pickAudience = (a: Audience) => {
    setAudience(a);
    setTab(DEFAULT_TAB[a]);
    try { window.history.replaceState(null, "", `/atlas?d=${encodeURIComponent(orpha)}&a=${a}`); } catch { /* ignore */ }
  };
  const navigate = (anchor: string) => {
    if (anchor === "connections") {
      document.getElementById("connections")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      return;
    }
    if ((TABS as string[]).includes(anchor)) setTab(anchor as TabKey);
    detailsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  const diseaseName = map ? nameOf(map.disease) : current ? nameOf(current) : orpha;
  const prevalence = map ? prevalenceLabel(map.disease.props.prevalence) : null;

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-rule bg-canvas">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 md:px-8">
          <Link href="/" aria-label={copy.home} className="-ml-1 rounded-md px-1 py-1"><Logo size={28} /></Link>
          <div className="order-3 flex w-full items-center gap-2 md:order-none md:w-auto md:flex-1">
            <label htmlFor="atlas-disease" className="sr-only">{copy.disease}</label>
            <div className="relative min-w-0 flex-1 md:max-w-sm">
              <select id="atlas-disease" value={orpha} onChange={(e) => go(e.target.value)} disabled={pending}
                className="min-h-11 w-full appearance-none truncate rounded-full border-[1.5px] border-rule bg-canvas pl-4 pr-10 font-display text-[15px] font-bold text-ink transition-colors hover:border-ink-3 focus:border-ink focus:outline-none disabled:opacity-60">
                {diseases.map((d) => <option key={d.orpha} value={d.orpha}>{nameOf(d)}</option>)}
                {!current && <option value={orpha}>{orpha}</option>}
              </select>
              <ChevronIcon size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-2" />
            </div>
          </div>
          <div role="radiogroup" aria-label={copy.audience} className="order-4 flex w-full rounded-full border border-rule p-0.5 md:order-none md:w-auto">
            {AUDIENCES.map((a) => {
              const on = a === audience;
              return (
                <button key={a} type="button" role="radio" aria-checked={on} onClick={() => pickAudience(a)}
                  className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full px-3 font-display text-sm font-bold transition-colors md:flex-none ${on ? "bg-ink text-on-ink" : "text-ink-2 hover:text-ink"}`}>
                  <span className={`size-2.5 rounded-full ${AUDIENCE_META[a].bg}`} aria-hidden />
                  {copy.audiences[a].label}
                </button>
              );
            })}
          </div>
          <LangToggle className="order-2 ml-auto md:order-none md:ml-0" />
        </div>
        {pending && <div className="h-0.5 overflow-hidden"><div className={`loading-bar h-full w-full ${AUDIENCE_META[audience].bg}`} /></div>}
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pb-10 pt-6 md:px-8">
        {/* Disease header */}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-[1.875rem] md:text-[2.5rem] [overflow-wrap:anywhere]">{diseaseName}</h1>
            <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 font-mono text-sm text-ink-3">
              {[
                <span key="o" className="text-ink-2">{orpha}</span>,
                prevalence ? <span key="p">{copy.status.prevalence} {prevalence}</span> : null,
                map ? <span key="s">{map.source === "live" ? copy.status.live : copy.status.snapshot(day(map.retrieved_at) ?? "")}</span> : null,
              ].filter(Boolean).map((el, i) => (
                <span key={i} className="inline-flex gap-2">{i > 0 && <span aria-hidden className="text-rule">/</span>}{el}</span>
              ))}
            </p>
          </div>
          {map && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label={copy.legend.title}>
              {LINE_KEYS.map((k) => (
                <li key={k} className="flex items-center gap-1.5 text-sm text-ink-2">
                  <span className={`h-1.5 w-5 rounded-full ${LINE_META[k].bg}`} aria-hidden />
                  {copy.lineShort[k]} <span className="font-mono text-xs text-ink-3">{map.totals[k]}</span>
                </li>
              ))}
              <li className="flex items-center gap-1.5 text-sm text-ink-3">
                <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden><path d="M2 4 H20" className="route route-gap" strokeWidth={4} /></svg>
                {copy.legend.gap}
              </li>
              <li className="flex items-center gap-1.5 text-sm text-ink-3">
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><circle cx="7" cy="7" r="5" className="station-gap" strokeWidth={2} /></svg>
                {copy.legend.weak}
              </li>
            </ul>
          )}
        </div>

        <div className={`mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_440px] ${pending ? "opacity-60 transition-opacity" : ""}`}>
          <section aria-label={copy.map.label} className="order-2 mx-auto w-full min-w-0 max-w-[1040px] xl:order-1 xl:max-w-none">
            {map ? (
              <DiseaseMap key={map.disease.orpha} map={map} copy={copy} selection={selection} onSelect={setSelection} />
            ) : (
              <div className="flex min-h-64 items-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed border-gap p-6 text-ink-2">
                <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden><circle cx="11" cy="11" r="8" className="station-gap" strokeWidth={2.5} /></svg>
                {copy.map.empty}
              </div>
            )}
          </section>
          <aside aria-label={copy.ask.title} className="order-1 mx-auto w-full min-w-0 max-w-[1040px] xl:order-2 xl:max-w-none">
            <h2 className="mb-3 text-2xl">{copy.ask.title}</h2>
            <VoiceAgent audience={audience} disease={{ orpha, name: map?.disease.name ?? diseaseName }} lang={lang} copy={copy} />
            <div className="mt-4">
              <AskPanel audience={audience} disease={{ orpha, short: map?.disease.short ?? current?.short ?? orpha }} copy={copy} lang={lang}
                onNavigate={navigate} onShowDisease={(o) => go(o)} />
            </div>
          </aside>
        </div>

        {connections && <Connections key={connections.disease.orpha} conn={connections} copy={copy} lang={lang} audience={audience} />}

        {map && (
          <div ref={detailsRef} id="details" className="scroll-mt-24">
            <Sections map={map} copy={copy} tab={tab} onTab={setTab} />
          </div>
        )}
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-ink-2 md:px-8">
          <p>{copy.footer}</p>
          <p className="font-mono text-xs text-ink-3">{map ? (map.source === "live" ? copy.status.live : copy.status.snapshot(day(map.retrieved_at) ?? "")) : ""}</p>
        </div>
      </footer>
    </div>
  );
}
