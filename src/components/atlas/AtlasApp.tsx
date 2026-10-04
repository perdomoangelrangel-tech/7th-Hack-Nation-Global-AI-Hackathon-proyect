"use client";
/**
 * The atlas experience — "one route, not a map" (UX_WAVE4): search → the graph shows the disease, its direct neighbours
 * and the route only → the right panel answers one question at a time, and the map responds (card ↔ edge sync,
 * camera flies, the rest dims). Layout: icon rail left · graph center (2D/3D, floating controls) · route right · footer.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Box, ChevronRight, CircleHelp, Focus, Map as MapIcon, Table2, HeartHandshake, History, Info, Languages, Maximize2, Microscope, Network, Rotate3d, Square, Target, UserRound, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";
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
import { LeftRail, MiniLegend, RailSection, defaultRailTab, type RailTab } from "./AtlasRail";
import { focusView, labelSet, linkEnd, routeEdges } from "./focus";
import type { GraphCommand } from "./graphProps";
import { PrefsPanel } from "./PrefsPanel";
import { useGraphMode } from "./useGraphMode";
import { kindOf, type LinkKind } from "./colors";
import { isDraftId, parseDrafts, withDrafts, type Draft } from "./proposals";
import { VoiceDock } from "@/components/voice/VoiceDock";
import { CoCreate } from "@/components/cocreate/CoCreate";
import { ClusterTable } from "@/components/journey/ClusterTable";
import { api } from "./api";

const Loading = () => <div className="absolute inset-0 grid place-items-center text-ink-3 text-sm" aria-busy>…</div>;
const GraphCanvas = dynamic(() => import("./GraphCanvas"), { ssr: false, loading: Loading });
const GraphCanvas3D = dynamic(() => import("./GraphCanvas3D"), { ssr: false, loading: Loading });

export interface PersonaOption { id: PersonaId; name: string; role: string; mode: string }
interface Props {
  initialDisease: string | null; initialPersona: PersonaId; initialLocale: Locale; initialEdge?: string | null;
  personas: Record<Locale, PersonaOption[]>;
  stats: { diseases: number; evidence: number; sources: number; edges: number; inferred: number; generated_at?: string };
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
  const [focusMode, setFocusMode] = useState(true);
  const [railTab, setRailTab] = useState<RailTab | null>(defaultRailTab(initialPersona));
  const [command, setCommand] = useState<GraphCommand | null>(null);
  const [spin, setSpin] = useState(false);
  // Spotlight: nodes to keep lit + framed (a cluster picked in the table). Unlike hover, the pointer does not clear it.
  const [spotlight, setSpotlight] = useState<string[]>([]);
  // Pharma starts on the ranked cluster table (UX_WAVE4 S2); everyone else on the map.
  const [center, setCenter] = useState<"map" | "table">(initialPersona === "priya" ? "table" : "map");
  const cmd = (kind: GraphCommand["kind"]) => setCommand((c) => ({ kind, n: (c?.n ?? 0) + 1 }));
  const pendingNarration = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const firstInspect = useRef(true);
  const n = useNarration();
  const { prefs, setPrefs } = usePrefs();
  const autoNarrate = prefs.autoRead;
  const graph = useGraphMode(persona);
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
    const q = (p: string) => fetch(api(p), { signal: c.signal }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
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
    const load = () => fetch(api(`/api/proposals?d=${encodeURIComponent(focus)}`), { signal: c.signal })
      .then((r) => (r.ok ? r.json() : [])).then((j) => setDrafts(parseDrafts(j))).catch(() => {});
    void load();
    // The action lane fires `nexmed:proposal` after a draft is saved: show it right away.
    window.addEventListener("nexmed:proposal", load);
    return () => { c.abort(); window.removeEventListener("nexmed:proposal", load); };
  }, [focus]);
  const fullView = useMemo(() => (view && focus && view.focus === focus ? withDrafts(view, drafts) : view), [view, drafts, focus]);
  const presentKinds = useMemo(() => new Set((fullView?.links ?? []).map((l) => kindOf(l.kind))), [fullView]);
  // Focus (default): the disease, its direct neighbours and the route edges. "All" shows the whole view.
  const route = useMemo(() => routeEdges(shownJourney), [shownJourney]);
  const shownView = useMemo(() => (fullView && focus && focusMode && fullView.focus === focus ? focusView(fullView, focus, route) : fullView), [fullView, focus, focusMode, route]);
  const labelIds = useMemo(() => (shownView && focus && shownView.focus === focus ? labelSet(shownView, focus, route) : null), [shownView, focus, route]);
  const hasBridges = useMemo(() => !!shownView?.links.some((l) => l.bridge), [shownView]);
  const shownKinds = useMemo(() => new Set((shownView?.links ?? []).map((l) => kindOf(l.kind))), [shownView]);
  const centrality = useMemo(() => Object.fromEntries((view?.nodes ?? []).filter((x) => x.type === "disease").map((x) => [x.id, Math.max(0, (x.size - 8) * 14)])), [view]);

  // Client-only URL reads: `?c=<cluster>` (Home sends it with cluster hits) highlights that cluster and opens the Clusters
  // panel; `?e=<edge>` opens the drawer even when the server page could not confirm the id (live UUID edges can exist in
  // the API's graph cache before the page's) — the drawer fetches it and says so honestly if it is missing.
  // Captured at first render: the URL-sync effect below rewrites the address (and StrictMode re-runs effects).
  const firstSearch = useRef(typeof window !== "undefined" ? window.location.search : "");
  useEffect(() => {
    const sp = new URLSearchParams(firstSearch.current);
    const c = sp.get("c"), e = sp.get("e");
    if (!c && !(e && !initialEdge)) return;
    const id = requestAnimationFrame(() => {
      if (c) { setClusterFilter(c); setRailTab("clusters"); }
      if (e && !initialEdge) setInspect(e);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    stopNarration(); setInspect(null); setClusterFilter(null); setDrafts([]); setSpotlight([]);
    pendingNarration.current = narrate;
    setFocus(d);
  }, [autoNarrate, stopNarration]);

  const onPick = (h: SearchHit) => {
    // A mechanism cluster opens the constellation with that cluster highlighted and the Clusters panel open.
    if (h.type === "cluster") { stopNarration(); setInspect(null); setFocus(null); setClusterFilter(h.id); setRailTab("clusters"); return; }
    if (h.disease) goTo(h.disease);
  };
  const onNode = (node: GNode) => {
    if (node.draft) { setInspect(node.id); return; }
    if (node.type === "disease") { if (node.id !== focus) goTo(node.id); return; }
    const end = (v: unknown) => (typeof v === "object" && v ? (v as GNode).id : v);
    const l = fullView?.links.find((x) => end(x.source) === node.id || end(x.target) === node.id);
    if (l) setInspect(l.id);
  };
  const onLink = (l: GLink) => setInspect(l.kind === "proposed" ? String(l.source) : l.id);
  const switchPersona = (p: PersonaId) => { setPersona(p); setRailTab(defaultRailTab(p)); setCenter(p === "priya" ? "table" : "map"); if (focus && (n.state === "playing" || n.state === "paused")) void n.start(focus, p, locale); };
  const switchLocale = (l: Locale) => { n.stop(); setLocale(l); };
  const toggleKind = (k: LinkKind) => setHiddenKinds((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });
  const onRailHover = useCallback((nodes: string[], edges: string[]) => setHover({ nodes, edges }), []);

  const spoken = n.current;
  const highlightEdges = useMemo(() => (spoken ? new Set(spoken.edges) : hover.edges.length ? new Set(hover.edges) : inspect ? new Set([inspect]) : EMPTY), [spoken, hover.edges, inspect]);
  // "The map responds": a hovered / selected edge lights its two endpoints too, so the canvas dims the rest and
  // the camera frames the pair (card ↔ edge sync both ways).
  const highlightNodes = useMemo(() => {
    if (!spoken && spotlight.length) return new Set(spotlight); // a picked cluster wins until dismissed
    const ids = new Set(spoken ? spoken.nodes : hover.nodes);
    for (const l of fullView?.links ?? []) if (highlightEdges.has(l.id)) { ids.add(linkEnd(l.source)); ids.add(linkEnd(l.target)); }
    return ids.size ? ids : EMPTY;
  }, [spoken, hover.nodes, highlightEdges, fullView, spotlight]);
  // Breadcrumb: what the map is showing, in words.
  const crumb = useMemo(() => {
    const id = hover.edges[0] ?? inspect; if (!id || !fullView) return null;
    const l = fullView.links.find((x) => x.id === id); if (!l) return null;
    const name = (v: unknown) => fullView.nodes.find((x) => x.id === linkEnd(v))?.name ?? linkEnd(v);
    return { from: name(l.source), rel: t.relations[l.relation] ?? l.relation.replace(/_/g, " "), to: name(l.target), kind: kindOf(l.kind) };
  }, [hover.edges, inspect, fullView, t]);
  const personaInfo = personas[locale].find((p) => p.id === persona)!;
  const Canvas = graph.mode === "3d" ? GraphCanvas3D : GraphCanvas;
  const draft = inspect && isDraftId(inspect) ? drafts.find((d) => `draft:${d.id}` === inspect) ?? null : null;

  const railProps = { t, persona, view: shownView, clusterFilter, onCluster: (id: string | null) => { setClusterFilter(id); if (!id) setSpotlight([]); }, hiddenKinds, onToggleKind: toggleKind, onHover: onRailHover, presentKinds, centrality, onInspect: setInspect };

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
          <div className="flex-1 min-w-0 max-w-2xl"><SearchBox t={t} locale={locale} persona={persona} onPick={onPick} autoFocus={!initialDisease} /></div>
          <ModeSelector className="hidden xl:flex" t={t} personas={personas[locale]} persona={persona} onPick={switchPersona} />
          {/* Help → the 3-step tour (mvp-builder's Tour listens to `nedamex:tour`). */}
          <button type="button" onClick={() => window.dispatchEvent(new Event("nedamex:tour"))} aria-label={t.help} title={t.help}
            className="grid place-items-center w-9 h-9 shrink-0 rounded-full border border-line text-ink-2 hover:bg-brand-soft hover:text-ink">
            <CircleHelp aria-hidden size={20} strokeWidth={1.75} />
          </button>
          <PrefsPanel t={t} />
          <button type="button" onClick={() => switchLocale(locale === "en" ? "es" : "en")} className="shrink-0 flex items-center gap-1 rounded-full border border-line h-9 px-2.5 text-xs font-medium text-ink-2 hover:bg-brand-soft" aria-label={locale === "en" ? "Cambiar a español" : "Switch to English"}><Languages aria-hidden size={16} strokeWidth={1.75} />{locale === "en" ? "ES" : "EN"}</button>
        </div>
        {/* Modes below xl (always visible on mobile) */}
        <ModeSelector className="xl:hidden flex px-3 sm:px-4 pb-2 overflow-x-auto" t={t} personas={personas[locale]} persona={persona} onPick={switchPersona} compact />
      </header>

      <div className="flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-[auto_1fr_420px]">
        {/* Left icon rail: Clusters · How to read · Community */}
        <LeftRail {...railProps} tab={railTab} onTab={setRailTab} />

        {/* Center: the graph */}
        <main id="atlas-main" className="relative h-[62vh] min-h-[380px] lg:h-auto lg:min-h-0 overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,var(--paper)_0%,var(--brand-mist)_55%,var(--brand-soft)_100%)]">
          {graph.ready && <Canvas view={shownView} highlightNodes={highlightNodes} highlightEdges={highlightEdges} selected={focus} clusterFilter={clusterFilter} bottomInset={focus ? barH : 0} hiddenKinds={hiddenKinds} still={reduce}
            labelIds={labelIds} command={command} spin={spin} onNode={onNode} onLink={onLink}
            onLinkHover={(id) => setHover(id ? { nodes: [], edges: [id] } : { nodes: [], edges: [] })} onBackground={() => { setInspect(null); setHover({ nodes: [], edges: [] }); setSpotlight([]); }} />}

          {/* Floating controls: 2D/3D · Focus/All · zoom · fit · rotate (3D) */}
          <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
            <Segmented label={t.ctrl.center} value={center} onChange={(v) => setCenter(v as "map" | "table")}
              options={[{ v: "map", label: t.ctrl.map, icon: MapIcon }, { v: "table", label: t.ctrl.table, icon: Table2 }]} />
            {center === "map" && <>
            <Segmented label={t.ctrl.view} value={graph.mode} onChange={(m) => graph.setMode(m as "2d" | "3d")}
              options={[{ v: "2d", label: t.view_2d, icon: Square }, { v: "3d", label: t.view_3d, icon: Box, disabled: !graph.webgl }]} />
            {focus && <Segmented label={t.ctrl.focus} value={focusMode ? "focus" : "all"} onChange={(v) => { setFocusMode(v === "focus"); cmd("fit"); }}
              options={[{ v: "focus", label: t.ctrl.focus, icon: Focus, title: t.ctrl.focus_hint }, { v: "all", label: t.ctrl.all, icon: Network, title: t.ctrl.all_hint }]} />}
            <div className="flex rounded-full border border-line bg-paper/90 p-0.5 shadow-sm">
              <IconBtn icon={ZoomOut} label={t.ctrl.zoom_out} onClick={() => cmd("zoomOut")} />
              <IconBtn icon={ZoomIn} label={t.ctrl.zoom_in} onClick={() => cmd("zoomIn")} />
              <IconBtn icon={Maximize2} label={t.ctrl.fit} onClick={() => cmd("fit")} />
              {graph.mode === "3d" && <IconBtn icon={Rotate3d} label={spin ? t.ctrl.stop_rotate : t.ctrl.rotate} pressed={spin} onClick={() => setSpin((x) => !x)} disabled={reduce} />}
            </div>
            {graph.mode === "2d" && graph.reason && <span className="hidden sm:inline rounded-full bg-paper/90 px-2 py-0.5 text-[11px] text-ink-3">{t.fallback_reason[graph.reason]}</span>}
            </>}
          </div>

          {/* Pharma table (action lane): ranked clusters; a row focuses that cluster on the map. */}
          {center === "table" && (
            <div className="absolute inset-0 z-10 overflow-auto bg-paper px-3 pt-16 pb-4">
              <ClusterTable locale={locale}
                onFocusCluster={(id) => {
                  // Show the whole view, highlight the cluster and frame its diseases (the rest dims).
                  setClusterFilter(id); setFocusMode(false); setRailTab("clusters"); setCenter("map");
                  setSpotlight(view?.clusters.find((c) => c.id === id)?.diseases ?? []);
                }}
                onFocusDisease={(d) => { setCenter("map"); goTo(d); }} />
            </div>
          )}
          {center === "map" && <div className="absolute right-3 bottom-3 z-10 hidden md:block"><MiniLegend t={t} presentKinds={shownKinds} hasBridges={hasBridges} /></div>}

          {/* Breadcrumb: what the map is highlighting, in words. */}
          {focus && center === "map" && (
            <p aria-live="polite" className="absolute left-3 right-3 top-14 z-10 truncate text-xs text-ink-2 md:right-auto md:max-w-[70%]">
              {crumb ? <span className="rounded-full bg-paper/90 px-2.5 py-1 shadow-sm"><b className="font-semibold text-ink">{crumb.from}</b> <ChevronRight aria-hidden size={12} className="inline -mt-0.5" /> {crumb.rel} <ChevronRight aria-hidden size={12} className="inline -mt-0.5" /> <b className="font-semibold text-ink">{crumb.to}</b> · {t.status[crumb.kind]}</span>
                : <span className="rounded-full bg-paper/80 px-2.5 py-1 text-ink-3">{t.breadcrumb_hint}</span>}
            </p>
          )}

          {/* Graph tooltips (float-tooltip) in the light theme. */}
          <style>{`.float-tooltip-kap{background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:4px 8px;font:500 12px var(--font-sans);box-shadow:0 4px 14px rgb(14 44 71 / .12)}`}</style>

          {/* Keyboard / screen-reader path through the graph: appears when focused. */}
          {fullView && fullView.links.length > 0 && (
            <nav aria-label={t.explore_more} className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:right-3 focus-within:top-24 focus-within:z-20 focus-within:max-h-[60%] focus-within:w-72 focus-within:overflow-auto focus-within:rounded-xl focus-within:border focus-within:border-line focus-within:bg-paper focus-within:p-2 focus-within:shadow-lg">
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
            <div role="status" className="absolute left-3 right-3 top-24 z-10 mx-auto max-w-md rounded-2xl border border-dashed border-amber/50 bg-paper/95 p-4 shadow-sm">
              <p className="text-sm font-semibold text-amber">{shownJourney.honest_gap.title}</p>
              <p className="mt-1 text-sm text-ink-2">{shownJourney.honest_gap.detail}</p>
              <p className="mt-2 text-sm text-ink">{shownJourney.honest_gap.next_question}</p>
            </div>
          )}

          {loadError && <p role="status" className="absolute left-3 right-3 top-24 z-10 mx-auto max-w-md rounded-xl border border-amber/40 bg-amber-soft px-3 py-2 text-sm text-amber">{t.load_error}</p>}

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
          <summary className="cursor-pointer text-sm font-medium text-ink-2">{t.rail.legend.title} · {t.rail.clusters.title} · {t.rail.community.title}</summary>
          <div className="mt-4 flex flex-col gap-6">{(["community", "clusters", "legend"] as const).map((k) => <RailSection key={k} tab={k} {...railProps} />)}</div>
        </details>

        {/* Right panel: the journey */}
        <aside ref={panelRef} className="relative scroll-mt-2 border-t lg:border-t-0 lg:border-l border-line lg:min-h-0 bg-paper min-h-[70vh] pb-20 lg:overflow-hidden" aria-label={shownJourney?.disease.name ?? t.q1}>
          {/* Cross-lane mount points (voice lane, action lane). Keep them. */}
          <VoiceDock persona={persona} locale={locale} disease={focus} diseaseName={shownJourney?.disease.name} />
          <CoCreate persona={persona} locale={locale} disease={focus} diseaseName={shownJourney?.disease.name} edgeIds={inspect && !isDraftId(inspect) ? [inspect] : undefined} />
          <AnimatePresence mode="wait">
            {shownJourney ? (
              <motion.div key={shownJourney.disease.id + locale} className="lg:h-full" initial={{ opacity: 0, x: motionTokens.distance.md }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={springs.gentle}>
                <JourneyPanel j={shownJourney} t={t} persona={persona} locale={locale} onInspect={setInspect} onHover={(nodes, edges) => setHover({ nodes, edges })} onFocusDisease={(d) => goTo(d)} />
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
            {inspect && !isDraftId(inspect) && <EdgeInspector key={inspect} edgeId={inspect} t={t} locale={locale} onClose={() => setInspect(null)} onFocusDisease={(d) => goTo(d)} onInspect={setInspect} persona={persona} onHighlight={(edges) => setHover({ nodes: [], edges: edges ?? [] })} />}
            {draft && <DraftInspector key={inspect!} draft={draft} t={t} onClose={() => setInspect(null)} />}
          </AnimatePresence>
        </aside>
      </div>

      {/* Footer: disclaimer · snapshot date · counts (live from the graph) · narrate on pick */}
      <footer className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-paper px-4 py-2 pr-4 lg:pr-60 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5"><Info aria-hidden size={14} strokeWidth={1.75} />{t.footer_disclaimer}</span>
        {stats.generated_at && <span className="flex items-center gap-1.5"><History aria-hidden size={14} strokeWidth={1.75} />{t.snapshot.replace("{d}", stats.generated_at.slice(0, 10))}</span>}
        <span className="hidden md:inline">{t.stats_line.replace("{d}", String(stats.diseases)).replace("{e}", stats.edges.toLocaleString("en-US")).replace("{v}", stats.evidence.toLocaleString("en-US")).replace("{s}", String(stats.sources))}</span>
        <label className="ml-auto flex items-center gap-2 text-ink-2 cursor-pointer">
          <input type="checkbox" checked={autoNarrate} onChange={(e) => setPrefs({ autoRead: e.target.checked })} className="accent-[var(--brand-deep)]" />
          {t.narrate_on_pick}
        </label>
      </footer>
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
            <span className="relative flex items-center gap-1.5 text-xs font-semibold leading-tight whitespace-nowrap"><ModeIcon id={p.id} />{p.mode}</span>
            <span className={`relative block text-[11px] leading-tight whitespace-nowrap ${on ? "text-brand-soft" : "text-ink-3"}`}>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}

const MODE_ICON: Record<PersonaId, LucideIcon> = { devon: UserRound, maria: HeartHandshake, osei: Microscope, priya: Target };
function ModeIcon({ id }: { id: PersonaId }) { const I = MODE_ICON[id]; return <I aria-hidden size={14} strokeWidth={1.75} />; }

function Segmented({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; label: string; icon: LucideIcon; disabled?: boolean; title?: string }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full border border-line bg-paper/90 p-0.5 shadow-sm">
      {options.map(({ v, label: l, icon: I, disabled, title }) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} disabled={disabled} onClick={() => onChange(v)} title={title ?? l}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${value === v ? "bg-brand-deep text-paper" : "text-ink-2 hover:bg-brand-soft"}`}>
          <I aria-hidden size={14} strokeWidth={1.75} />{l}
        </button>
      ))}
    </div>
  );
}

function IconBtn({ icon: I, label, onClick, pressed, disabled }: { icon: LucideIcon; label: string; onClick: () => void; pressed?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={pressed} disabled={disabled}
      className={`grid place-items-center w-8 h-7 rounded-full transition-colors disabled:opacity-40 ${pressed ? "bg-brand-deep text-paper" : "text-ink-2 hover:bg-brand-soft"}`}>
      <I aria-hidden size={15} strokeWidth={1.75} />
    </button>
  );
}

type Dict = (typeof dict)["en"];
