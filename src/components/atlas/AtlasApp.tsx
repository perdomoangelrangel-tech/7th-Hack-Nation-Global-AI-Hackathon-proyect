"use client";
/**
 * The atlas experience — "one route, not a map" (UX_WAVE4): search → the graph shows the disease, its direct neighbours
 * and the route only → the right panel answers one question at a time, and the map responds (card ↔ edge sync,
 * the rest dims). WAVE 5B: the graph is a deterministic, still layout — Route (radial: disease · gene/mechanism · neighbours ·
 * labelled sectors) by default, Constellation (clusters as regions) or Table — with a slim toolbar: View · Layers · 2D/3D · Fit · Legend.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Box, ChevronRight, CircleHelp, Focus, Minus, Plus, RotateCcw, Expand, Shrink, PanelRightClose, PanelRightOpen, Layers as LayersIcon, BookOpen, Orbit, Table2, HeartHandshake, History, Info, Languages, Maximize2, Microscope, Square, Target, UserRound, type LucideIcon } from "lucide-react";
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
import { linkEnd } from "./focus";
import { constellationLayout, filterView, routeLayout, routeLayersFor, SECTORS, TYPE_LAYERS, type Sector } from "./radial";
import { strengthOf, type Strength } from "./evidence";
import type { GraphCommand } from "./graphProps";
import { PrefsPanel } from "./PrefsPanel";
import { useGraphMode } from "./useGraphMode";
import { useEmbed } from "./useEmbed";
import { kindOf, type LinkKind } from "./colors";
import { isDraftId, parseDrafts, withDrafts, type Draft } from "./proposals";
import { FOCUS_EVIDENCE_EVENT, parseHl, type FocusEvidence } from "./focusEvidence";
import { TypeIcon } from "./icons";
import { VoiceDock } from "@/components/voice/VoiceDock";
import { CoCreate } from "@/components/cocreate/CoCreate";
import { ClusterTable } from "@/components/journey/ClusterTable";
import { HelixLoader } from "@/components/three/HelixLoader";
import { api } from "./api";

/** Loading state for the graph (canvas chunk or data): Blender-style helix + "Following the evidence…". */
const Loading = () => (
  <div className="absolute inset-0 grid place-items-center" aria-busy>
    <span className="flex flex-col items-center gap-3 text-sm text-ink-3"><HelixLoader size={48} label="Following the evidence…" />Following the evidence…</span>
  </div>
);
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
  // The role is chosen on the home (or the Lovable app) — the atlas only shows it (WAVE 6).
  const [persona] = useState<PersonaId>(initialPersona);
  const [focus, setFocus] = useState<string | null>(initialDisease);
  const [view, setView] = useState<GraphView | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [inspect, setInspect] = useState<string | null>(initialEdge);
  const [hover, setHover] = useState<{ nodes: string[]; edges: string[] }>({ nodes: [], edges: [] });
  const [clusterFilter, setClusterFilter] = useState<string | null>(null);
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(EMPTY);
  const [loadError, setLoadError] = useState(false);
  // WAVE 5B view: Route (radial, needs a focus) · Constellation · Table. Pharma starts on the table.
  const [viewMode, setViewMode] = useState<"route" | "constellation" | "table">(initialPersona === "priya" ? "table" : initialDisease ? "route" : "constellation");
  // WAVE 6 layers: per node type (hidden set) + evidence-source filter (empty = every source).
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(() => new Set());
  const [sourceFilter, setSourceFilter] = useState<Set<string>>(() => new Set());
  const [sourceList, setSourceList] = useState<{ id: string; name: string; edges: number }[]>([]);
  useEffect(() => {
    fetch(api("/api/atlas/sources")).then((r) => (r.ok ? r.json() : null)).then((j: { sources?: { id: string; name: string; edges: number }[] } | null) => {
      if (j?.sources) setSourceList(j.sources.filter((x) => x.edges > 0).sort((a, b) => b.edges - a.edges));
    }).catch(() => {});
  }, []);
  const layers = useMemo(() => routeLayersFor(hiddenLayers), [hiddenLayers]);
  const [expanded, setExpanded] = useState<Set<Sector>>(() => new Set());
  const [showLegend, setShowLegend] = useState(true);
  // Route panel (right): 480 px default, drag handle 360–720 px, "Expand" = 60 % of the window, collapsible (mode=free).
  const [panelW, setPanelW] = useState(480);
  const [panelMode, setPanelMode] = useState<"normal" | "expanded" | "closed">("normal");
  // < 1024 px: the route panel is a bottom sheet with 3 snap points (peek 120 px · 50 % · 90 %).
  const [sheet, setSheet] = useState<0 | 1 | 2>(1);
  const [sheetDrag, setSheetDrag] = useState<number | null>(null);
  // Phones: frame the graph above the bottom sheet (peek or half); desktop: no inset.
  const [vp, setVp] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    const id = requestAnimationFrame(on); window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", on); };
  }, []);
  const mobileInset = vp && vp.w < 1024 ? (sheet === 0 ? 120 : Math.round(vp.h * 0.5)) : 0;
  const [railTab, setRailTab] = useState<RailTab | null>(defaultRailTab(initialPersona));
  const [command, setCommand] = useState<GraphCommand | null>(null);
  // Spotlight: nodes to keep lit + framed (a cluster picked in the table). Unlike hover, the pointer does not clear it.
  const [spotlight, setSpotlight] = useState<string[]>([]);
  // "Explore in the graph" (Guide chat, transcripts, Lovable medicine chat ?hl=): edges + entities to light and frame.
  const [evidenceHl, setEvidenceHl] = useState<FocusEvidence | null>(null);
  const center: "map" | "table" = viewMode === "table" ? "table" : "map";
  const cmd = (kind: GraphCommand["kind"]) => setCommand((c) => ({ kind, n: (c?.n ?? 0) + 1 }));
  // Keyboard zoom: + / − / 0 (fit) when not typing.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el?.isContentEditable) return;
      const kind = e.key === "+" || e.key === "=" ? "zoomIn" : e.key === "-" || e.key === "_" ? "zoomOut" : e.key === "0" ? "fit" : null;
      if (kind) { e.preventDefault(); setCommand((c) => ({ kind, n: (c?.n ?? 0) + 1 })); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  const pendingNarration = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const firstInspect = useRef(true);
  const n = useNarration();
  const { prefs, setPrefs } = usePrefs();
  const autoNarrate = prefs.autoRead;
  const graph = useGraphMode(persona);
  // Inside the Lovable app (iframe) or ?embed=1: the host supplies the header → compact bar, no logo, no autofocus.
  const embed = useEmbed();
  // Real height of the narration bar: the graph frames what is said above it.
  const [, setBarH] = useState(0); // narration bar height (kept for the voice lane's bar; framing now uses the sheet inset)
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
  // Lead strength per neighbour (deterministic rule, src/components/atlas/evidence.ts) for ring 2 labels and order.
  const strength = useMemo(() => Object.fromEntries((shownJourney?.shares ?? []).filter((x) => x.explanation).map((x) => [x.disease, strengthOf(x.explanation)])) as Record<string, Strength>, [shownJourney]);
  const laid = useMemo(() => {
    if (!fullView) return null;
    if (viewMode === "route" && focus && fullView.focus === focus) return routeLayout(fullView, focus, {
      strength, expanded, layers, strengthLabel: { strong: t.drawer.strong, possible: t.drawer.possible, weak: t.drawer.weak },
      sectorLabel: { symptoms: t.sector.symptoms, studies: t.sector.studies, people: t.sector.people, treatments: t.sector.treatments },
      moreLabel: (n) => t.sector.more.replace("{n}", String(n)), fewerLabel: t.sector.fewer, noneLabel: t.sector.none,
    });
    return constellationLayout(fullView);
  }, [fullView, viewMode, focus, strength, expanded, layers, t]);
  const shownView = useMemo(() => (laid ? filterView(laid.view, focus, hiddenLayers, sourceFilter) : null), [laid, focus, hiddenLayers, sourceFilter]);
  const labelIds = laid?.labelIds ?? null;
  // Frame the highlighted evidence once its nodes are on screen (once per highlight).
  const framedHl = useRef<FocusEvidence | null>(null);
  useEffect(() => {
    if (!evidenceHl || framedHl.current === evidenceHl || !shownView) return;
    const want = new Set(evidenceHl.entityIds ?? []);
    for (const l of shownView.links) if (evidenceHl.edgeIds?.includes(l.id)) { want.add(linkEnd(l.source)); want.add(linkEnd(l.target)); }
    const ids = shownView.nodes.filter((n) => want.has(n.id)).map((n) => n.id);
    if (!ids.length) return;
    framedHl.current = evidenceHl;
    // After the canvas' own "new layout → fit all" (30 ms) so the evidence framing wins.
    const id = setTimeout(() => setCommand((c) => ({ kind: "focus", ids, n: (c?.n ?? 0) + 1 })), 250);
    return () => clearTimeout(id);
  }, [evidenceHl, shownView]);
  const hasBridges = useMemo(() => !!shownView?.links.some((l) => l.bridge), [shownView]);
  const shownKinds = useMemo(() => new Set((shownView?.links ?? []).map((l) => kindOf(l.kind))), [shownView]);
  const centrality = useMemo(() => Object.fromEntries((view?.nodes ?? []).filter((x) => x.type === "disease").map((x) => [x.id, Math.max(0, (x.size - 8) * 14)])), [view]);

  // Client-only URL reads: `?c=<cluster>` (Home sends it with cluster hits) highlights that cluster and opens the Clusters
  // panel; `?e=<edge>` opens the drawer even when the server page could not confirm the id (live UUID edges can exist in
  // the API's graph cache before the page's) — the drawer fetches it and says so honestly if it is missing.
  // Evidence highlight: light + frame the edges/entities, open the drawer on the first edge, show every sector's items.
  const applyEvidence = useCallback((hl: FocusEvidence) => {
    if (!hl.edgeIds?.length && !hl.entityIds?.length) return;
    setEvidenceHl(hl); setExpanded(new Set(SECTORS)); setSpotlight([]);
    if (hl.openDrawer !== false && hl.edgeIds?.[0]) setInspect(hl.edgeIds[0]);
  }, []);
  useEffect(() => {
    const on = (e: Event) => applyEvidence((e as CustomEvent<FocusEvidence>).detail ?? {});
    window.addEventListener(FOCUS_EVIDENCE_EVENT, on); return () => window.removeEventListener(FOCUS_EVIDENCE_EVENT, on);
  }, [applyEvidence]);

  // Captured at first render: the URL-sync effect below rewrites the address (and StrictMode re-runs effects).
  const firstSearch = useRef(typeof window !== "undefined" ? window.location.search : "");
  useEffect(() => {
    const sp = new URLSearchParams(firstSearch.current);
    const c = sp.get("c"), e = sp.get("e"), mode = sp.get("mode");
    const hl = parseHl(sp.get("hl"));
    if (hl) requestAnimationFrame(() => applyEvidence(hl));
    // mode=challenge → Maria's route (step 1, stepper); mode=free → route panel closed, Constellation 2D, search focused.
    if (mode === "challenge" && !focus) requestAnimationFrame(() => { setFocus(maria); setViewMode("route"); });
    if (mode === "free") requestAnimationFrame(() => {
      setPanelMode("closed"); setViewMode("constellation"); graph.setMode("2d");
      (document.querySelector('input[role="combobox"]') as HTMLInputElement | null)?.focus();
    });
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
    if (inspect && window.innerWidth < 1024) { const id = requestAnimationFrame(() => setSheet(2)); return () => cancelAnimationFrame(id); } // drawer opens the sheet at full height
  }, [inspect, prefs.reduceMotion]);

  const { stop: stopNarration } = n;
  const goTo = useCallback((d: string, narrate = autoNarrate) => {
    stopNarration(); setInspect(null); setClusterFilter(null); setDrafts([]); setSpotlight([]); setExpanded(new Set()); setEvidenceHl(null);
    setViewMode((v) => (v === "table" ? v : "route"));
    pendingNarration.current = narrate;
    setFocus(d);
  }, [autoNarrate, stopNarration]);

  const onPick = (h: SearchHit) => {
    // A mechanism cluster opens the constellation with that cluster highlighted and the Clusters panel open.
    if (h.type === "cluster") { stopNarration(); setInspect(null); setFocus(null); setClusterFilter(h.id); setRailTab("clusters"); setViewMode("constellation"); return; }
    if (h.disease) goTo(h.disease);
  };
  const onNode = (node: GNode) => {
    // Sector header ("+N more") expands / collapses that sector; a region header filters its cluster.
    if (node.header && (SECTORS as string[]).includes(node.header)) { const sec = node.header as Sector; setExpanded((x) => { const y = new Set(x); if (y.has(sec)) y.delete(sec); else y.add(sec); return y; }); return; }
    if (node.header === "region") { setClusterFilter((c) => (c === node.cluster ? null : node.cluster)); return; }
    if (node.draft) { setInspect(node.id); return; }
    if (node.type === "disease") { if (node.id !== focus) goTo(node.id); return; }
    const end = (v: unknown) => (typeof v === "object" && v ? (v as GNode).id : v);
    const l = fullView?.links.find((x) => end(x.source) === node.id || end(x.target) === node.id);
    if (l) setInspect(l.id);
  };
  const onLink = (l: GLink) => setInspect(l.kind === "proposed" ? String(l.source) : l.id);
  const switchLocale = (l: Locale) => { n.stop(); setLocale(l); };
  const toggleKind = (k: LinkKind) => setHiddenKinds((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });
  const onRailHover = useCallback((nodes: string[], edges: string[]) => setHover({ nodes, edges }), []);

  const spoken = n.current;
  const highlightEdges = useMemo(() => {
    if (spoken) return new Set(spoken.edges);
    if (hover.edges.length) return new Set(hover.edges);
    const ids = new Set<string>(evidenceHl?.edgeIds ?? []);
    if (inspect) ids.add(inspect);
    return ids.size ? ids : EMPTY;
  }, [spoken, hover.edges, inspect, evidenceHl]);
  // "The map responds": a hovered / selected edge lights its two endpoints too, so the canvas dims the rest and
  // the camera frames the pair (card ↔ edge sync both ways).
  const highlightNodes = useMemo(() => {
    if (!spoken && spotlight.length) return new Set(spotlight); // a picked cluster wins until dismissed
    const ids = new Set(spoken ? spoken.nodes : hover.nodes.length ? hover.nodes : evidenceHl?.entityIds ?? []);
    for (const l of fullView?.links ?? []) if (highlightEdges.has(l.id)) { ids.add(linkEnd(l.source)); ids.add(linkEnd(l.target)); }
    return ids.size ? ids : EMPTY;
  }, [spoken, hover.nodes, highlightEdges, fullView, spotlight, evidenceHl]);
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
        <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 ${embed ? "h-12" : "h-16"}`}>
          {!embed && <Link href="/" className="flex items-center gap-2 shrink-0 rounded-lg" aria-label={`${site.name} home`}>
            <Image src="/brand/nexmed-logo-192.png" alt="" width={30} height={30} priority />
            <span className="font-semibold tracking-tight text-brand-ink hidden sm:inline">{site.name}</span>
          </Link>}
          <div className="flex-1 min-w-0 max-w-2xl"><SearchBox t={t} locale={locale} persona={persona} onPick={onPick} autoFocus={!initialDisease && !embed} /></div>
          {/* Embedded: the host (Lovable) already shows the role. */}
          {!embed && <RolePill t={t} personas={personas[locale]} persona={persona} locale={locale} embed={embed} />}
          {/* Help → the 3-step tour (mvp-builder's Tour listens to `nedamex:tour`). */}
          <button type="button" onClick={() => window.dispatchEvent(new Event("nedamex:tour"))} aria-label={t.help} title={t.help}
            className="grid place-items-center w-9 h-9 shrink-0 rounded-full border border-line text-ink-2 hover:bg-brand-soft hover:text-ink">
            <CircleHelp aria-hidden size={20} strokeWidth={1.75} />
          </button>
          <PrefsPanel t={t} />
          <button type="button" onClick={() => switchLocale(locale === "en" ? "es" : "en")} className="shrink-0 flex items-center gap-1 rounded-full border border-line h-9 px-2.5 text-xs font-medium text-ink-2 hover:bg-brand-soft" aria-label={locale === "en" ? "Cambiar a español" : "Switch to English"}><Languages aria-hidden size={16} strokeWidth={1.75} />{locale === "en" ? "ES" : "EN"}</button>
        </div>
        {/* Modes below xl (always visible on mobile) */}
      </header>

      <div className="flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-[auto_1fr_var(--panel-w)]"
        style={{ ["--panel-w" as string]: panelMode === "closed" ? "0px" : panelMode === "expanded" ? "60vw" : `${panelW}px` }}>
        {/* Left icon rail: Clusters · How to read · Community */}
        <LeftRail {...railProps} tab={railTab} onTab={setRailTab} />

        {/* Center: the graph */}
        <main id="atlas-main" className="relative h-[calc(100dvh-120px)] min-h-[380px] lg:h-auto lg:min-h-0 overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,var(--paper)_0%,var(--brand-mist)_55%,var(--brand-soft)_100%)]">
          {/* Data still on its way (first load or a new focus): keep the helix up until the view matches. */}
          {(!graph.ready || !shownView || (focus && shownView.focus !== focus)) && !loadError && <Loading />}
          {graph.ready && <Canvas view={shownView} highlightNodes={highlightNodes} highlightEdges={highlightEdges} selected={focus} clusterFilter={clusterFilter} bottomInset={mobileInset} hiddenKinds={hiddenKinds} still={reduce}
            labelIds={labelIds} command={command} onNode={onNode} onLink={onLink}
            onLinkHover={(id) => setHover(id ? { nodes: [], edges: [id] } : { nodes: [], edges: [] })} onBackground={() => { setInspect(null); setHover({ nodes: [], edges: [] }); setSpotlight([]); setEvidenceHl(null); }} />}

          {/* Floating controls: 2D/3D · Focus/All · zoom · fit · rotate (3D) */}
          <div className="absolute left-3 right-3 lg:right-24 top-3 z-20 flex flex-wrap items-center gap-2">
            <Segmented label={t.ctrl.center} value={viewMode} onChange={(v) => { setViewMode(v as typeof viewMode); setSpotlight([]); }}
              options={[{ v: "route", label: t.ctrl.route, icon: Focus, disabled: !focus, title: t.ctrl.route_hint }, { v: "constellation", label: t.ctrl.constellation, icon: Orbit, title: t.ctrl.constellation_hint }, { v: "table", label: t.ctrl.table, icon: Table2 }]} />
            {center === "map" && <>
              <LayersMenu t={t} hidden={hiddenLayers} onToggle={(l) => setHiddenLayers((x) => { const y = new Set(x); if (y.has(l)) y.delete(l); else y.add(l); return y; })}
                sources={sourceList} selected={sourceFilter} onSource={(id) => setSourceFilter((x) => { const y = new Set(x); if (y.has(id)) y.delete(id); else y.add(id); return y; })} onClearSources={() => setSourceFilter(new Set())} />
              <Segmented label={t.ctrl.view} value={graph.mode} onChange={(m) => graph.setMode(m as "2d" | "3d")}
                options={[{ v: "2d", label: t.view_2d, icon: Square }, { v: "3d", label: t.view_3d, icon: Box, disabled: !graph.webgl }]} />
              <div className="flex rounded-full border border-line bg-paper/90 p-0.5 shadow-sm">
                <IconBtn icon={BookOpen} label={t.ctrl.legend} pressed={showLegend} onClick={() => setShowLegend((x) => !x)} />
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
                  setClusterFilter(id); setRailTab("clusters"); setViewMode("constellation");
                  setSpotlight(view?.clusters.find((c) => c.id === id)?.diseases ?? []);
                }}
                onFocusDisease={(d) => { setViewMode("route"); goTo(d); }} />
            </div>
          )}
          {center === "map" && showLegend && <div className="absolute left-3 bottom-3 z-10 hidden md:block"><MiniLegend t={t} presentKinds={shownKinds} hasBridges={hasBridges} /></div>}
          {/* Route panel size: Expand (60 %) / Hide — on the canvas edge so it never covers the panel's own header. */}
          {panelMode !== "closed" && (
            <div className="hidden lg:flex absolute right-3 top-3 z-20 rounded-full border border-line bg-paper/90 p-0.5 shadow-sm">
              <IconBtn icon={panelMode === "expanded" ? Shrink : Expand} label={panelMode === "expanded" ? t.panel.shrink : t.panel.expand} onClick={() => setPanelMode((m) => (m === "expanded" ? "normal" : "expanded"))} />
              <IconBtn icon={PanelRightClose} label={t.panel.close} onClick={() => setPanelMode("closed")} />
            </div>
          )}
          {panelMode === "closed" && (
            <button type="button" onClick={() => setPanelMode("normal")} className="hidden lg:flex absolute right-3 top-3 z-20 items-center gap-1.5 rounded-full border border-line bg-paper/95 px-3 py-1.5 text-xs font-medium text-ink-2 shadow-sm hover:bg-brand-soft">
              <PanelRightOpen aria-hidden size={14} strokeWidth={1.75} />{t.panel.open}
            </button>
          )}
          {/* Zoom control (WAVE 6): + / − / Fit / Reset, 44 px targets; keys + − 0. */}
          {center === "map" && (
            <div role="group" aria-label={t.ctrl.zoom} className="absolute right-3 bottom-3 max-lg:top-28 max-lg:bottom-auto z-20 flex flex-col overflow-hidden rounded-2xl border border-line bg-paper/95 shadow-md">
              <ZoomBtn icon={Plus} label={`${t.ctrl.zoom_in} (+)`} onClick={() => cmd("zoomIn")} />
              <ZoomBtn icon={Minus} label={`${t.ctrl.zoom_out} (−)`} onClick={() => cmd("zoomOut")} />
              <ZoomBtn icon={Maximize2} label={`${t.ctrl.fit} (0)`} onClick={() => cmd("fit")} />
              <ZoomBtn icon={RotateCcw} label={t.ctrl.reset} onClick={() => { setInspect(null); setHover({ nodes: [], edges: [] }); setSpotlight([]); setEvidenceHl(null); setClusterFilter(null); setExpanded(new Set()); cmd("reset"); }} />
            </div>
          )}

          {/* Breadcrumb: what the map is highlighting, in words. */}
          {focus && center === "map" && (
            <p aria-live="polite" className="absolute left-3 right-3 top-[3.75rem] z-10 hidden md:block truncate text-xs text-ink-2 md:right-auto md:max-w-[70%]">
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
              {/* Route sectors as real buttons (the canvas "+N more" pills are not reachable by keyboard / screen readers). */}
              {laid?.sectors.length ? (
                <ul aria-label={t.sector.list} className="mb-1 border-b border-line pb-1">
                  {laid.sectors.map((x) => (
                    <li key={x.sector}>
                      <button type="button" aria-expanded={x.expanded} disabled={x.total <= x.shown && !x.expanded}
                        onClick={() => setExpanded((e) => { const y = new Set(e); if (y.has(x.sector)) y.delete(x.sector); else y.add(x.sector); return y; })}
                        className="w-full rounded-lg px-2 py-1 text-left text-xs text-ink-2 hover:bg-brand-soft focus:bg-brand-soft disabled:opacity-60">
                        {t.sector[x.sector]}: {t.sector.shown.replace("{a}", String(x.shown)).replace("{b}", String(x.total))}{x.total > x.shown ? ` — ${t.sector.show_all}` : x.expanded ? ` — ${t.sector.fewer}` : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
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

        {/* Right panel: the journey */}
        <aside ref={panelRef}
          style={{ ["--sheet-h" as string]: sheetDrag !== null ? `${sheetDrag}px` : sheet === 0 ? "120px" : sheet === 1 ? "50dvh" : "90dvh" }}
          className={`max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:h-[var(--sheet-h)] max-lg:rounded-t-2xl max-lg:shadow-[0_-8px_24px_rgb(14_44_71/0.12)] max-lg:overflow-y-auto ${sheetDrag === null ? "max-lg:transition-[height] max-lg:duration-200" : ""} relative border-t lg:border-t-0 lg:border-l border-line lg:min-h-0 bg-paper pb-20 lg:overflow-hidden text-base ${panelMode === "closed" ? "lg:hidden" : ""}`} aria-label={shownJourney?.disease.name ?? t.q1}>
          {/* Bottom-sheet handle (< 1024 px): drag or tap to cycle peek → half → full. */}
          <button type="button" aria-label={t.panel.sheet.replace("{n}", String(sheet + 1))}
            onClick={() => setSheet((x) => ((x + 1) % 3) as 0 | 1 | 2)}
            onPointerDown={(e) => {
              const startY = e.clientY, startH = (panelRef.current?.getBoundingClientRect().height ?? 300);
              let moved = false;
              const move = (ev: PointerEvent) => { const dy = startY - ev.clientY; if (Math.abs(dy) > 6) moved = true; if (moved) setSheetDrag(Math.min(window.innerHeight * 0.9, Math.max(120, startH + dy))); };
              const up = (ev: PointerEvent) => {
                window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
                if (!moved) { setSheetDrag(null); return; }
                const h = Math.min(window.innerHeight * 0.9, Math.max(120, startH + (startY - ev.clientY))), vh = window.innerHeight;
                const snaps = [120, vh * 0.5, vh * 0.9]; const k = snaps.reduce((b, v, i) => (Math.abs(v - h) < Math.abs(snaps[b] - h) ? i : b), 0);
                setSheet(k as 0 | 1 | 2); setSheetDrag(null);
                ev.preventDefault();
              };
              window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
            }}
            className="lg:hidden sticky top-0 z-50 flex w-full justify-center bg-paper pt-2 pb-1 touch-none">
            <span className="h-1.5 w-12 rounded-full bg-line" aria-hidden />
          </button>
          {/* Resize: drag the left edge (360–720 px), keyboard ← → on the handle; Expand = 60 %; close. */}
          <div role="separator" aria-orientation="vertical" aria-label={t.panel.resize} aria-valuemin={360} aria-valuemax={720} aria-valuenow={panelW} tabIndex={0}
            onPointerDown={(e) => {
              const startX = e.clientX, startW = panelW; setPanelMode("normal"); (e.target as HTMLElement).setPointerCapture(e.pointerId);
              const move = (ev: PointerEvent) => setPanelW(Math.min(720, Math.max(360, startW + (startX - ev.clientX))));
              const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
              window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
            }}
            onKeyDown={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setPanelMode("normal"); setPanelW((w) => Math.min(720, Math.max(360, w + (e.key === "ArrowLeft" ? 24 : -24)))); } }}
            className="hidden lg:block absolute left-0 top-0 bottom-0 z-40 w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-brand/40 focus-visible:bg-brand/60" />
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
          <details className="lg:hidden border-t border-line bg-paper px-4 py-3 mt-4">
          <summary className="cursor-pointer text-sm font-medium text-ink-2">{t.rail.legend.title} · {t.rail.clusters.title} · {t.rail.community.title}</summary>
          <div className="mt-4 flex flex-col gap-6">{(["community", "clusters", "legend"] as const).map((k) => <RailSection key={k} tab={k} {...railProps} />)}</div>
          </details>
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

/** WAVE 6: no persona switcher inside the atlas — a static "You're here as: <role>" pill + "Change role".
 *  Embedded (Lovable) → the host app's role chooser; standalone → /atlas?role=change (mvp-builder's role picker). */
const ROLE_LABEL: Partial<Record<PersonaId, { en: string; es: string }>> = { osei: { en: "Researcher & clinician", es: "Investigador y clínico" } };
function RolePill({ t, personas, persona, locale, embed }: { t: Dict; personas: PersonaOption[]; persona: PersonaId; locale: Locale; embed: boolean }) {
  const cur = personas.find((p) => p.id === persona)!;
  const label = ROLE_LABEL[persona]?.[locale] ?? cur.mode;
  const change = (e: React.MouseEvent) => {
    if (!embed) return; // plain link to the role picker (/atlas?role=change)
    e.preventDefault();
    try { window.top!.location.href = `${site.appUrl}/?role=change`; } catch { window.open(`${site.appUrl}/?role=change`, "_top"); }
  };
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="flex items-center gap-1.5 rounded-full border border-line bg-brand-soft h-9 px-3 text-xs text-brand-ink" title={`${cur.name} · ${cur.role}`}>
        <ModeIcon id={persona} /><span className="hidden lg:inline text-ink-3">{t.here_as}</span><span className="hidden md:inline font-semibold">{label}</span>
      </span>
      <a href={embed ? `${site.appUrl}/?role=change` : "/atlas?role=change"} onClick={change} className="hidden sm:inline text-xs font-medium text-brand-deep underline-offset-2 hover:underline">{t.change_role}</a>
    </div>
  );
}

/** Layers (WAVE 6): node types on/off + filter by evidence source (chips with edge counts from /api/atlas/sources). */
function LayersMenu({ t, hidden, onToggle, sources, selected, onSource, onClearSources }: {
  t: Dict; hidden: Set<string>; onToggle: (l: string) => void;
  sources: { id: string; name: string; edges: number }[]; selected: Set<string>; onSource: (id: string) => void; onClearSources: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", away); window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("mousedown", away); window.removeEventListener("keydown", esc); };
  }, [open]);
  const onCount = TYPE_LAYERS.length - hidden.size;
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true"
        className="flex items-center gap-1 rounded-full border border-line bg-paper/90 px-2.5 py-1 text-xs font-medium text-ink-2 shadow-sm hover:bg-brand-soft">
        <LayersIcon aria-hidden size={14} strokeWidth={1.75} />{t.ctrl.layers} <span className="text-ink-3">{onCount}/{TYPE_LAYERS.length}{selected.size ? ` · ${selected.size} ${t.layers.sources_short}` : ""}</span>
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 w-[min(320px,calc(100vw-2rem))] max-h-[70vh] overflow-auto rounded-xl border border-line bg-paper p-2 shadow-xl shadow-ink/10">
          <p className="px-2 pt-1 pb-1 text-[11px] uppercase tracking-widest text-ink-3">{t.layers.types}</p>
          <div className="grid grid-cols-2">
            {TYPE_LAYERS.map((l) => (
              <label key={l.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-2 hover:bg-brand-mist cursor-pointer">
                <input type="checkbox" checked={!hidden.has(l.key)} onChange={() => onToggle(l.key)} className="accent-[var(--brand-deep)]" />
                <TypeIcon type={l.key} size={14} />{t.layers.type[l.key]}
              </label>
            ))}
          </div>
          {sources.length > 0 && (
            <>
              <p className="flex items-center justify-between px-2 pt-3 pb-1 text-[11px] uppercase tracking-widest text-ink-3">
                {t.layers.sources}
                {selected.size > 0 && <button type="button" onClick={onClearSources} className="normal-case tracking-normal text-brand-deep hover:underline">{t.layers.all_sources}</button>}
              </p>
              <div className="flex flex-wrap gap-1.5 px-2 pb-1" role="group" aria-label={t.layers.sources}>
                {sources.map((x) => (
                  <button key={x.id} type="button" aria-pressed={selected.has(x.id)} onClick={() => onSource(x.id)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] ${selected.has(x.id) ? "border-brand-deep bg-brand-soft text-ink" : "border-line text-ink-2 hover:bg-brand-mist"}`}>
                    {x.name} <span className="tabular-nums text-ink-3">{x.edges.toLocaleString("en-US")}</span>
                  </button>
                ))}
              </div>
              <p className="px-2 pb-1 text-[11px] text-ink-3">{t.layers.sources_hint}</p>
            </>
          )}
        </div>
      )}
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

function ZoomBtn({ icon: I, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="grid place-items-center w-11 h-11 border-b border-line last:border-b-0 text-ink-2 hover:bg-brand-soft hover:text-ink focus-visible:bg-brand-soft">
      <I aria-hidden size={18} strokeWidth={1.75} />
    </button>
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
