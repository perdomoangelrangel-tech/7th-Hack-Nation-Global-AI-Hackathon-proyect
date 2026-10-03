"use client";
/**
 * The atlas experience: search -> the graph reorganizes around the disease -> the voice walks the path
 * (connection, asset, collaborator, next step) while lighting each cited edge.
 * Layout (challenge concept): cluster rail left · graph center (3D first, 2D fallback) · selected disease right.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { GLink, GNode, GraphView, Journey, SearchHit } from "@/lib/atlas/store";
import type { PersonaId } from "@/lib/agents/profiles";
import { dict, type Locale } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";
import { usePrefs } from "@/lib/prefs";
import { site } from "@/lib/site";
import { SearchBox } from "./SearchBox";
import { JourneyPanel } from "./JourneyPanel";
import { EdgeInspector, DraftInspector } from "./EdgeInspector";
import { NarrationBar } from "./NarrationBar";
import { useNarration } from "./useNarration";
import { AtlasRail } from "./AtlasRail";
import { PrefsPanel } from "./PrefsPanel";
import { useGraphMode } from "./useGraphMode";
import { kindOf, type LinkKind } from "./colors";
import { isDraftId, parseDrafts, withDrafts, type Draft } from "./proposals";
import { VoiceDock } from "@/components/voice/VoiceDock";
import { CoCreate } from "@/components/cocreate/CoCreate";

const Loading = () => <div className="absolute inset-0 grid place-items-center text-ink-3 text-sm" aria-busy>…</div>;
const GraphCanvas = dynamic(() => import("./GraphCanvas"), { ssr: false, loading: Loading });
const GraphCanvas3D = dynamic(() => import("./GraphCanvas3D"), { ssr: false, loading: Loading });

export interface PersonaOption { id: PersonaId; name: string; role: string; mode: string }
interface Props {
  initialDisease: string | null; initialPersona: PersonaId; initialLocale: Locale; initialEdge?: string | null;
  personas: Record<Locale, PersonaOption[]>;
  stats: { diseases: number; evidence: number; sources: number; edges: number; inferred: number };
  maria: string; // demo case disease
}

const EMPTY = new Set<string>();

export function AtlasApp({ initialDisease, initialPersona, initialLocale, initialEdge = null, personas, stats, maria }: Props) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [persona, setPersona] = useState<PersonaId>(initialPersona);
  const [focus, setFocus] = useState<string | null>(initialDisease);
  const [view, setView] = useState<GraphView | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [inspect, setInspect] = useState<string | null>(initialEdge);
  const [hover, setHover] = useState<{ nodes: string[]; edges: string[] }>({ nodes: [], edges: [] });
  const [clusterFilter, setClusterFilter] = useState<string | null>(null);
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(EMPTY);
  const [loadError, setLoadError] = useState(false);
  const pendingNarration = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const firstInspect = useRef(true);
  const n = useNarration();
  const { prefs, setPrefs } = usePrefs();
  const autoNarrate = prefs.autoRead;
  const graph = useGraphMode();
  // Real height of the narration bar: the graph frames what is said above it.
  const [barH, setBarH] = useState(0);
  const barObserver = useRef<ResizeObserver | null>(null);
  const barRef = useCallback((el: HTMLDivElement | null) => {
    barObserver.current?.disconnect();
    if (!el) { setBarH(0); return; }
    barObserver.current = new ResizeObserver(([e]) => setBarH(e.contentRect.height + 24));
    barObserver.current.observe(el);
  }, []);
  const { start: startNarration } = n;
  const t = dict[locale];
  // Motion: transforms are skipped by MotionConfig when the user (OS or prefs) asks for reduced motion, so
  // initial props stay identical on server and client (no hydration mismatch). Canvases get `still`.
  const reduce = prefs.reduceMotion || graph.reason === "reduced-motion";

  // Focused disease data (or the initial constellation). If the user just chose it, narration starts on arrival.
  useEffect(() => {
    const c = new AbortController();
    const q = (p: string) => fetch(p, { signal: c.signal }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
    const fail = (e: unknown) => { if ((e as Error).name !== "AbortError") setLoadError(true); };
    if (!focus) { q(`/api/atlas/constellation?l=${locale}`).then((v) => { setView(v); setLoadError(false); }).catch(fail); return () => c.abort(); }
    Promise.all([q(`/api/atlas/graph?d=${encodeURIComponent(focus)}&l=${locale}`), q(`/api/atlas/journey?d=${encodeURIComponent(focus)}&l=${locale}`)])
      .then(([g, j]) => {
        setView(g); setJourney(j); setLoadError(false);
        if (pendingNarration.current) { pendingNarration.current = false; void startNarration(focus, persona, locale); }
      }).catch(fail);
    return () => c.abort();
    // persona is not a dependency: switching it does not reload the graph (switchPersona restarts the voice).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, locale, startNarration]);
  const shownJourney = focus && journey?.disease.id === focus ? journey : null;

  // Proposals layer (action lane route; absent → no drafts, silently).
  useEffect(() => {
    if (!focus) return;
    const c = new AbortController();
    const load = () => fetch(`/api/proposals?d=${encodeURIComponent(focus)}`, { signal: c.signal })
      .then((r) => (r.ok ? r.json() : [])).then((j) => setDrafts(parseDrafts(j))).catch(() => {});
    void load();
    // The action lane fires `nexmed:proposal` after a draft is saved: show it right away.
    window.addEventListener("nexmed:proposal", load);
    return () => { c.abort(); window.removeEventListener("nexmed:proposal", load); };
  }, [focus]);
  const fullView = useMemo(() => (view && focus && view.focus === focus ? withDrafts(view, drafts) : view), [view, drafts, focus]);
  const presentKinds = useMemo(() => new Set((fullView?.links ?? []).map((l) => kindOf(l.kind))), [fullView]);
  const centrality = useMemo(() => Object.fromEntries((view?.nodes ?? []).filter((x) => x.type === "disease").map((x) => [x.id, Math.max(0, (x.size - 8) * 14)])), [view]);

  // Shareable URL state (?d=…&p=maria&l=en).
  useEffect(() => {
    const u = new URL(window.location.href);
    if (focus) u.searchParams.set("d", focus); else u.searchParams.delete("d");
    u.searchParams.set("p", persona); u.searchParams.set("l", locale);
    if (inspect && !isDraftId(inspect)) u.searchParams.set("e", inspect); else u.searchParams.delete("e");
    window.history.replaceState(null, "", u.toString());
  }, [focus, persona, locale, inspect]);

  // Small screens: the panel sits under the graph, so bring an opened edge into view (not on first load).
  useEffect(() => {
    if (firstInspect.current) { firstInspect.current = false; return; }
    if (inspect && window.innerWidth < 1024) panelRef.current?.scrollIntoView({ behavior: prefs.reduceMotion ? "auto" : "smooth", block: "start" });
  }, [inspect, prefs.reduceMotion]);

  const { stop: stopNarration } = n;
  const goTo = useCallback((d: string, narrate = autoNarrate) => {
    stopNarration(); setInspect(null); setClusterFilter(null); setDrafts([]);
    pendingNarration.current = narrate;
    setFocus(d);
  }, [autoNarrate, stopNarration]);

  const onPick = (h: SearchHit) => { if (h.disease) goTo(h.disease); };
  const onNode = (node: GNode) => {
    if (node.draft) { setInspect(node.id); return; }
    if (node.type === "disease") { if (node.id !== focus) goTo(node.id); return; }
    const end = (v: unknown) => (typeof v === "object" && v ? (v as GNode).id : v);
    const l = fullView?.links.find((x) => end(x.source) === node.id || end(x.target) === node.id);
    if (l) setInspect(l.id);
  };
  const onLink = (l: GLink) => setInspect(l.kind === "proposed" ? String(l.source) : l.id);
  const switchPersona = (p: PersonaId) => { setPersona(p); if (focus && (n.state === "playing" || n.state === "paused")) void n.start(focus, p, locale); };
  const switchLocale = (l: Locale) => { n.stop(); setLocale(l); };
  const toggleKind = (k: LinkKind) => setHiddenKinds((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });
  const onRailHover = useCallback((nodes: string[], edges: string[]) => setHover({ nodes, edges }), []);

  const spoken = n.current;
  const highlightNodes = useMemo(() => (spoken ? new Set(spoken.nodes) : hover.nodes.length ? new Set(hover.nodes) : EMPTY), [spoken, hover.nodes]);
  const highlightEdges = useMemo(() => (spoken ? new Set(spoken.edges) : hover.edges.length ? new Set(hover.edges) : inspect ? new Set([inspect]) : EMPTY), [spoken, hover.edges, inspect]);
  const personaInfo = personas[locale].find((p) => p.id === persona)!;
  const Canvas = graph.mode === "3d" ? GraphCanvas3D : GraphCanvas;
  const draft = inspect && isDraftId(inspect) ? drafts.find((d) => `draft:${d.id}` === inspect) ?? null : null;

  const rail = (
    <AtlasRail t={t} persona={persona} view={view} journey={shownJourney} clusterFilter={clusterFilter} onCluster={setClusterFilter}
      hiddenKinds={hiddenKinds} onToggleKind={toggleKind} onHover={onRailHover} presentKinds={presentKinds} centrality={centrality} onInspect={setInspect} />
  );

  return (
    <MotionConfig reducedMotion={prefs.reduceMotion ? "always" : "user"}>
    <div className="min-h-dvh lg:h-dvh flex flex-col bg-paper text-ink">
      <a href="#atlas-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-paper focus:px-3 focus:py-2 focus:shadow">Skip to the graph</a>
      {/* Header */}
      <header className="shrink-0 border-b border-line bg-paper/95 backdrop-blur z-30">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-16">
          <Link href="/" className="flex items-center gap-2 shrink-0 rounded-lg" aria-label={`${site.name} home`}>
            <Image src="/brand/nexmed-logo-192.png" alt="" width={30} height={30} priority />
            <span className="font-semibold tracking-tight text-brand-ink hidden sm:inline">{site.name}</span>
          </Link>
          <div className="flex-1 min-w-0 max-w-2xl"><SearchBox t={t} locale={locale} onPick={onPick} autoFocus={!initialDisease} /></div>
          <ModeSelector className="hidden xl:flex" t={t} personas={personas[locale]} persona={persona} onPick={switchPersona} />
          <PrefsPanel t={t} />
          <button type="button" onClick={() => switchLocale(locale === "en" ? "es" : "en")} className="shrink-0 rounded-full border border-line w-9 h-9 text-xs font-medium text-ink-2 hover:bg-brand-soft" aria-label={locale === "en" ? "Cambiar a español" : "Switch to English"}>{locale === "en" ? "ES" : "EN"}</button>
        </div>
        {/* Modes below xl (always visible on mobile) */}
        <ModeSelector className="xl:hidden flex px-3 sm:px-4 pb-2 overflow-x-auto" t={t} personas={personas[locale]} persona={persona} onPick={switchPersona} compact />
      </header>

      <div className="flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr_420px]">
        {/* Left rail */}
        <aside className="hidden lg:flex flex-col gap-6 border-r border-line bg-paper p-4 overflow-y-auto" aria-label={t.clusters}>
          {rail}
          <label className="flex items-center gap-2 text-xs text-ink-2 cursor-pointer">
            <input type="checkbox" checked={autoNarrate} onChange={(e) => setPrefs({ autoRead: e.target.checked })} className="accent-[var(--brand-deep)]" />
            {t.narrate_on_pick}
          </label>
          <p className="mt-auto text-[11px] text-ink-3 leading-relaxed">
            {t.stats_line.replace("{d}", String(stats.diseases)).replace("{e}", stats.edges.toLocaleString("en-US")).replace("{v}", stats.evidence.toLocaleString("en-US")).replace("{s}", String(stats.sources))}
          </p>
        </aside>

        {/* Center: the graph */}
        <main id="atlas-main" className="relative h-[62vh] min-h-[380px] lg:h-auto lg:min-h-0 overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,var(--paper)_0%,var(--brand-mist)_55%,var(--brand-soft)_100%)]">
          {graph.ready && <Canvas view={fullView} highlightNodes={highlightNodes} highlightEdges={highlightEdges} selected={focus} clusterFilter={clusterFilter} bottomInset={focus ? barH : 0} hiddenKinds={hiddenKinds} still={reduce} onNode={onNode} onLink={onLink} />}

          {/* 3D / 2D toggle */}
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
            <div role="radiogroup" aria-label={t.view_label} className="flex rounded-full border border-line bg-paper/90 p-0.5 shadow-sm">
              {(["3d", "2d"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={graph.mode === m} disabled={m === "3d" && !graph.webgl} onClick={() => graph.setMode(m)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${graph.mode === m ? "bg-brand-deep text-paper" : "text-ink-2 hover:bg-brand-soft"}`}>
                  {m === "3d" ? t.view_3d : t.view_2d}
                </button>
              ))}
            </div>
            {graph.mode === "2d" && graph.reason && <span className="hidden sm:inline rounded-full bg-paper/90 px-2 py-0.5 text-[11px] text-ink-3">{t.fallback_reason[graph.reason]}</span>}
          </div>

          {/* Graph tooltips (float-tooltip) in the light theme. */}
          <style>{`.float-tooltip-kap{background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:4px 8px;font:500 12px var(--font-sans);box-shadow:0 4px 14px rgb(14 44 71 / .12)}`}</style>

          {/* Keyboard / screen-reader path through the graph: appears when focused. */}
          {fullView && fullView.links.length > 0 && (
            <nav aria-label={t.explore_more} className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:right-3 focus-within:top-14 focus-within:z-20 focus-within:max-h-[60%] focus-within:w-72 focus-within:overflow-auto focus-within:rounded-xl focus-within:border focus-within:border-line focus-within:bg-paper focus-within:p-2 focus-within:shadow-lg">
              <p className="px-2 py-1 text-xs uppercase tracking-widest text-ink-3">{t.explore_more}</p>
              <ul>
                {fullView.links.slice(0, 60).map((l) => {
                  const name = (v: unknown) => { const id = typeof v === "object" && v ? (v as GNode).id : String(v); return fullView.nodes.find((x) => x.id === id)?.name ?? id; };
                  return <li key={l.id}><button type="button" onClick={() => onLink(l)} onFocus={() => setHover({ nodes: [], edges: [l.id] })} onBlur={() => setHover({ nodes: [], edges: [] })} className="w-full rounded-lg px-2 py-1 text-left text-xs text-ink-2 hover:bg-brand-soft focus:bg-brand-soft">{name(l.source)} <span className="text-ink-3">{t.relations[l.relation] ?? l.relation}</span> {name(l.target)} · {t.status[kindOf(l.kind)]}</button></li>;
                })}
              </ul>
            </nav>
          )}

          {/* Honest "no supported route": say what is unknown and what would change the answer. */}
          {shownJourney?.honest_gap && !inspect && (
            <div role="status" className="absolute left-3 right-3 top-14 z-10 mx-auto max-w-md rounded-2xl border border-dashed border-amber/50 bg-paper/95 p-4 shadow-sm">
              <p className="text-sm font-semibold text-amber">{shownJourney.honest_gap.title}</p>
              <p className="mt-1 text-sm text-ink-2">{shownJourney.honest_gap.detail}</p>
              <p className="mt-2 text-sm text-ink">{shownJourney.honest_gap.next_question}</p>
            </div>
          )}

          {loadError && <p role="status" className="absolute left-3 right-3 top-14 z-10 mx-auto max-w-md rounded-xl border border-amber/40 bg-amber-soft px-3 py-2 text-sm text-amber">{t.load_error}</p>}

          <AnimatePresence>
            {!focus && (
              <motion.div key="intro" initial={{ opacity: 0, y: motionTokens.distance.md }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth }}
                className="absolute left-3 right-3 md:left-8 top-14 md:top-16 max-w-md rounded-2xl border border-line bg-paper/90 p-5 shadow-lg shadow-ink/5 backdrop-blur pointer-events-none">
                <h1 className="serif text-2xl md:text-3xl leading-tight text-brand-ink">{t.start_title}</h1>
                <p className="mt-3 text-ink-2 text-sm md:text-base">{t.start_body}</p>
                <button type="button" onClick={() => goTo(maria, true)} className="pointer-events-auto mt-5 rounded-full bg-brand-deep text-paper px-5 py-2.5 text-sm font-semibold hover:bg-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">{t.start_cta} →</button>
                <p className="mt-3 text-xs text-ink-3">{t.search_hint}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {focus && (
            <div className="absolute left-3 right-3 bottom-3 md:left-6 md:right-6 md:bottom-6 pointer-events-none">
              <div ref={barRef} className="max-w-2xl mx-auto"><NarrationBar n={n} t={t} personaName={personaInfo.name} onListen={() => focus && n.start(focus, persona, locale)} /></div>
            </div>
          )}
        </main>

        {/* Mobile: rail content under the graph */}
        <details className="lg:hidden border-t border-line bg-paper px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-ink-2">{t.legend} · {t.clusters}</summary>
          <div className="mt-4 flex flex-col gap-6">{rail}</div>
        </details>

        {/* Right panel: the journey */}
        <aside ref={panelRef} className="relative scroll-mt-2 border-t lg:border-t-0 lg:border-l border-line lg:min-h-0 bg-paper min-h-[70vh]" aria-label={shownJourney?.disease.name ?? t.q1}>
          {/* Cross-lane mount points (voice lane, action lane). Keep them. */}
          <VoiceDock persona={persona} locale={locale} disease={focus} diseaseName={shownJourney?.disease.name} />
          <CoCreate persona={persona} locale={locale} disease={focus} diseaseName={shownJourney?.disease.name} edgeIds={inspect && !isDraftId(inspect) ? [inspect] : undefined} />
          <AnimatePresence mode="wait">
            {shownJourney ? (
              <motion.div key={shownJourney.disease.id + locale} className="lg:h-full" initial={{ opacity: 0, x: motionTokens.distance.md }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={springs.gentle}>
                <JourneyPanel j={shownJourney} t={t} onInspect={setInspect} onHover={(nodes, edges) => setHover({ nodes, edges })} onFocusDisease={(d) => goTo(d)} />
              </motion.div>
            ) : (
              <motion.div key="empty" className="p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="text-xs uppercase tracking-widest text-ink-3">{personaInfo.mode} · {personaInfo.name}</p>
                <p className="mt-1 text-sm text-ink-2">{t.mode_hint[persona]}</p>
                <ul className="mt-5 space-y-3 text-sm text-ink-2">{[t.q1, t.q2, t.q3, t.q4].map((q, i) => <li key={q} className="flex gap-3"><span className="w-5 h-5 rounded-full border border-line bg-brand-mist grid place-items-center text-[11px] text-brand-deep shrink-0">{i + 1}</span>{q}</li>)}</ul>
                <p className="mt-6 text-xs text-ink-3">{t.disclaimer}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {inspect && !isDraftId(inspect) && <EdgeInspector key={inspect} edgeId={inspect} t={t} locale={locale} onClose={() => setInspect(null)} onFocusDisease={(d) => goTo(d)} onInspect={setInspect} />}
            {draft && <DraftInspector key={inspect!} draft={draft} t={t} onClose={() => setInspect(null)} />}
          </AnimatePresence>
        </aside>
      </div>
    </div>
    </MotionConfig>
  );
}

function ModeSelector({ t, personas, persona, onPick, className = "", compact }: { t: Dict; personas: PersonaOption[]; persona: PersonaId; onPick: (p: PersonaId) => void; className?: string; compact?: boolean }) {
  // Roving focus: arrows move between modes (radiogroup pattern).
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = personas[(i + d + personas.length) % personas.length];
    onPick(next.id);
    (e.currentTarget.parentElement?.querySelector(`[data-mode="${next.id}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div className={`items-center gap-1 ${className}`} role="radiogroup" aria-label={t.mode}>
      {personas.map((p, i) => {
        const on = persona === p.id;
        return (
          <button key={p.id} data-mode={p.id} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => onPick(p.id)} onKeyDown={(e) => onKey(e, i)} title={p.role}
            className={`relative shrink-0 rounded-xl px-3 ${compact ? "py-1" : "py-1 min-w-[92px]"} text-left transition-colors ${on ? "text-paper" : "text-ink-2 hover:bg-brand-soft"}`}>
            {on && <motion.span layoutId={`mode-pill${compact ? "-m" : ""}`} className="absolute inset-0 rounded-xl bg-brand-deep" transition={springs.snappy} />}
            <span className="relative block text-xs font-semibold leading-tight whitespace-nowrap">{p.mode}</span>
            <span className={`relative block text-[11px] leading-tight whitespace-nowrap ${on ? "text-brand-soft" : "text-ink-3"}`}>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}

type Dict = (typeof dict)["en"];
