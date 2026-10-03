"use client";
/**
 * La experiencia del atlas: buscar -> el grafo se reorganiza alrededor de la enfermedad -> la voz
 * recorre el camino (conexión, activo, colaborador, siguiente paso) mientras ilumina cada arista citada.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { GLink, GNode, GraphView, Journey, SearchHit } from "@/lib/atlas/store";
import type { PersonaId } from "@/lib/agents/profiles";
import { dict, type Locale } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";
import { SearchBox } from "./SearchBox";
import { JourneyPanel } from "./JourneyPanel";
import { EdgeInspector } from "./EdgeInspector";
import { NarrationBar } from "./NarrationBar";
import { useNarration } from "./useNarration";
import { TYPE_COLOR } from "./colors";

const GraphCanvas = dynamic(() => import("./GraphCanvas"), { ssr: false, loading: () => <div className="absolute inset-0 grid place-items-center text-slate-400 text-sm">…</div> });

export interface PersonaOption { id: PersonaId; name: string; role: string }
interface Props {
  initialDisease: string | null; initialPersona: PersonaId; initialLocale: Locale;
  personas: Record<Locale, PersonaOption[]>;
  stats: { diseases: number; evidence: number; sources: number; edges: number; inferred: number };
  maria: string; // enfermedad del caso de demostración
}

const EMPTY = new Set<string>();

export function AtlasApp({ initialDisease, initialPersona, initialLocale, personas, stats, maria }: Props) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [persona, setPersona] = useState<PersonaId>(initialPersona);
  const [focus, setFocus] = useState<string | null>(initialDisease);
  const [view, setView] = useState<GraphView | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const [hover, setHover] = useState<{ nodes: string[]; edges: string[] }>({ nodes: [], edges: [] });
  const [clusterFilter, setClusterFilter] = useState<string | null>(null);
  const [autoNarrate, setAutoNarrate] = useState(true);
  const pendingNarration = useRef(false);
  const n = useNarration();
  // Alto real de la barra de narración: el grafo centra lo que se dice por encima de ella.
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
  const reduce = useReducedMotion();

  // Datos de la enfermedad en foco (o la constelación inicial). Si el usuario acaba de elegirla, la voz arranca al llegar.
  useEffect(() => {
    const c = new AbortController();
    const q = (p: string) => fetch(p, { signal: c.signal }).then((r) => r.json());
    if (!focus) { q(`/api/atlas/constellation?l=${locale}`).then(setView).catch(() => {}); return () => c.abort(); }
    Promise.all([q(`/api/atlas/graph?d=${encodeURIComponent(focus)}&l=${locale}`), q(`/api/atlas/journey?d=${encodeURIComponent(focus)}&l=${locale}`)])
      .then(([g, j]) => {
        setView(g); setJourney(j);
        if (pendingNarration.current) { pendingNarration.current = false; void startNarration(focus, persona, locale); }
      }).catch(() => {});
    return () => c.abort();
    // persona no es dependencia: cambiarla no recarga el grafo (switchPersona reinicia la voz).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, locale, startNarration]);
  const shownJourney = focus && journey?.disease.id === focus ? journey : null;

  // Estado en la URL: compartible (?d=…&p=maria&l=es).
  useEffect(() => {
    const u = new URL(window.location.href);
    if (focus) u.searchParams.set("d", focus); else u.searchParams.delete("d");
    u.searchParams.set("p", persona); u.searchParams.set("l", locale);
    window.history.replaceState(null, "", u.toString());
  }, [focus, persona, locale]);

  const { stop: stopNarration } = n;
  const goTo = useCallback((d: string, narrate = autoNarrate) => {
    stopNarration(); setInspect(null); setClusterFilter(null);
    pendingNarration.current = narrate;
    setFocus(d);
  }, [autoNarrate, stopNarration]);

  const onPick = (h: SearchHit) => { if (h.disease) goTo(h.disease); };
  const onNode = (node: GNode) => {
    if (node.type === "disease") { if (node.id !== focus) goTo(node.id); return; }
    const l = view?.links.find((x) => x.source === node.id || x.target === node.id || (typeof x.source === "object" && (x.source as GNode).id === node.id));
    if (l) setInspect(l.id);
  };
  const onLink = (l: GLink) => setInspect(l.id);
  const switchPersona = (p: PersonaId) => { setPersona(p); if (focus && (n.state === "playing" || n.state === "paused")) void n.start(focus, p, locale); };
  const switchLocale = (l: Locale) => { n.stop(); setLocale(l); };

  const spoken = n.current;
  const highlightNodes = useMemo(() => (spoken ? new Set(spoken.nodes) : hover.nodes.length ? new Set(hover.nodes) : EMPTY), [spoken, hover.nodes]);
  const highlightEdges = useMemo(() => (spoken ? new Set(spoken.edges) : hover.edges.length ? new Set(hover.edges) : inspect ? new Set([inspect]) : EMPTY), [spoken, hover.edges, inspect]);
  const personaInfo = personas[locale].find((p) => p.id === persona)!;

  return (
    <div className="min-h-dvh lg:h-dvh flex flex-col bg-paper text-ink">
      {/* Barra superior */}
      <header className="shrink-0 border-b border-line bg-paper/90 backdrop-blur z-30">
        <div className="flex items-center gap-3 px-4 h-16">
          <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Atlas home">
            <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden><circle cx="9" cy="10" r="3" fill="var(--teal)" /><circle cx="23" cy="8" r="2.2" fill="#c4b5fd" /><circle cx="20" cy="23" r="3.4" fill="#fbbf24" /><path d="M9 10 23 8M9 10l11 13M23 8l-3 15" stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 2" /></svg>
            <span className="font-semibold tracking-tight hidden sm:inline">Atlas</span>
          </Link>
          <div className="flex-1 max-w-2xl"><SearchBox t={t} locale={locale} onPick={onPick} autoFocus={!initialDisease} /></div>
          <div className="hidden md:flex items-center gap-1" role="radiogroup" aria-label={t.viewing_as}>
            <span className="text-xs text-ink-3 mr-1">{t.viewing_as}</span>
            {personas[locale].map((p) => (
              <button key={p.id} role="radio" aria-checked={persona === p.id} onClick={() => switchPersona(p.id)} title={p.role}
                className={`relative rounded-full px-3 py-1.5 text-sm ${persona === p.id ? "text-paper" : "text-ink-2 hover:bg-paper-2"}`}>
                {persona === p.id && <motion.span layoutId="persona-pill" className="absolute inset-0 rounded-full bg-navy" transition={springs.snappy} />}
                <span className="relative">{p.name}</span>
              </button>
            ))}
          </div>
          <button onClick={() => switchLocale(locale === "en" ? "es" : "en")} className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-medium hover:bg-paper-2" aria-label="Language">{locale === "en" ? "ES" : "EN"}</button>
        </div>
        {/* Personas en móvil */}
        <div className="md:hidden flex gap-1 px-4 pb-2 overflow-x-auto" role="radiogroup" aria-label={t.viewing_as}>
          {personas[locale].map((p) => <button key={p.id} role="radio" aria-checked={persona === p.id} onClick={() => switchPersona(p.id)} className={`rounded-full px-3 py-1 text-xs border whitespace-nowrap ${persona === p.id ? "bg-navy text-paper border-navy" : "border-line text-ink-2"}`}>{p.name} · {p.role}</button>)}
        </div>
      </header>

      <div className="flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-[240px_1fr_420px]">
        {/* Rail izquierdo: clusters y leyenda */}
        <aside className="hidden lg:flex flex-col gap-6 border-r border-line p-4 overflow-y-auto">
          <section>
            <p className="text-xs uppercase tracking-widest text-ink-3">{t.clusters}</p>
            <ul className="mt-3 space-y-1">
              {view?.clusters.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setClusterFilter(clusterFilter === c.id ? null : c.id)} aria-pressed={clusterFilter === c.id}
                    className={`w-full text-left rounded-lg px-2 py-1.5 text-sm flex gap-2 items-start ${clusterFilter === c.id ? "bg-paper-2" : "hover:bg-paper-2"}`}>
                    <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} aria-hidden />
                    <span className="min-w-0"><span className="block leading-snug">{c.label}</span><span className="text-xs text-ink-3">{c.diseases.length}</span></span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink-3 mt-2 leading-relaxed">{t.clusters_hint}</p>
          </section>
          <section>
            <p className="text-xs uppercase tracking-widest text-ink-3">{t.legend}</p>
            <ul className="mt-3 space-y-1.5 text-xs text-ink-2">
              {(["gene", "pathway", "phenotype", "organization", "trial", "investigator"] as const).map((k) => (
                <li key={k} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: TYPE_COLOR[k] }} aria-hidden />{t.types[k]}</li>
              ))}
              <li className="flex items-center gap-2 pt-1"><span className="w-6 border-t border-ink-3" aria-hidden />{t.legend_observed}</li>
              <li className="flex items-center gap-2"><span className="w-6 border-t-2 border-dashed border-yellow-500" aria-hidden />{t.legend_inferred}</li>
              <li className="text-ink-3">{t.legend_size}</li>
            </ul>
          </section>
          <label className="flex items-center gap-2 text-xs text-ink-2 cursor-pointer">
            <input type="checkbox" checked={autoNarrate} onChange={(e) => setAutoNarrate(e.target.checked)} className="accent-[var(--teal)]" />
            {locale === "es" ? "Narrar al elegir una enfermedad" : "Narrate when a disease is chosen"}
          </label>
          <p className="mt-auto text-[11px] text-ink-3 leading-relaxed">
            {stats.diseases} {locale === "es" ? "enfermedades" : "diseases"} · {stats.edges.toLocaleString()} {locale === "es" ? "aristas" : "edges"} · {stats.evidence.toLocaleString()} {locale === "es" ? "registros de evidencia" : "evidence records"} · {stats.sources} {locale === "es" ? "fuentes" : "sources"}
          </p>
        </aside>

        {/* Centro: la constelación */}
        <main className="relative h-[62vh] lg:h-auto lg:min-h-0 overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,#13284a_0%,#0a1424_55%,#060c17_100%)]">
          <Stars />
          <GraphCanvas view={view} highlightNodes={highlightNodes} highlightEdges={highlightEdges} selected={focus} clusterFilter={clusterFilter} bottomInset={focus ? barH : 0} onNode={onNode} onLink={onLink} />

          <AnimatePresence>
            {!focus && <motion.div key="veil" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-y-0 left-0 w-full md:w-[560px] bg-gradient-to-r from-[#060c17] via-[#060c17]/80 to-transparent pointer-events-none" />}
            {!focus && (
              <motion.div key="intro" initial={{ opacity: 0, y: reduce ? 0 : motionTokens.distance.md }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth }}
                className="absolute left-4 right-4 md:left-8 top-6 md:top-10 max-w-md text-slate-100 pointer-events-none">
                <h1 className="serif text-3xl md:text-4xl leading-tight">{t.start_title}</h1>
                <p className="mt-3 text-slate-300 text-sm md:text-base">{t.start_body}</p>
                <button onClick={() => goTo(maria, true)} className="pointer-events-auto mt-5 rounded-full bg-teal-2 text-[#062a26] px-5 py-2.5 text-sm font-semibold hover:brightness-110">{t.start_cta} →</button>
                <p className="mt-3 text-xs text-slate-400">{t.search_hint}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {focus && (
            <div className="absolute left-3 right-3 bottom-3 md:left-6 md:right-6 md:bottom-6 pointer-events-none">
              <div ref={barRef} className="max-w-2xl mx-auto"><NarrationBar n={n} t={t} personaName={personaInfo.name} onListen={() => focus && n.start(focus, persona, locale)} /></div>
            </div>
          )}
        </main>

        {/* Panel derecho: el recorrido */}
        <aside className="relative border-t lg:border-t-0 lg:border-l border-line lg:min-h-0 bg-paper min-h-[70vh]">
          <AnimatePresence mode="wait">
            {shownJourney ? (
              <motion.div key={shownJourney.disease.id + locale} className="lg:h-full" initial={{ opacity: 0, x: reduce ? 0 : motionTokens.distance.md }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={springs.gentle}>
                <JourneyPanel j={shownJourney} t={t} onInspect={setInspect} onHover={(nodes, edges) => setHover({ nodes, edges })} onFocusDisease={(d) => goTo(d)} />
              </motion.div>
            ) : (
              <motion.div key="empty" className="p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="text-xs uppercase tracking-widest text-ink-3">{t.q1}</p>
                <ul className="mt-4 space-y-3 text-sm text-ink-2">{[t.q1, t.q2, t.q3, t.q4].map((q, i) => <li key={q} className="flex gap-3"><span className="w-5 h-5 rounded-full border border-line grid place-items-center text-[11px] shrink-0">{i + 1}</span>{q}</li>)}</ul>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {inspect && <EdgeInspector key={inspect} edgeId={inspect} t={t} locale={locale} onClose={() => setInspect(null)} onFocusDisease={(d) => goTo(d)} />}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}

/** Fondo de estrellas fijo (decorativo, sin animación). */
function Stars() {
  const stars = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ x: (i * 73) % 100, y: (i * 37 + (i % 7) * 11) % 100, r: (i % 5) * 0.25 + 0.4, o: 0.15 + ((i * 13) % 10) / 40 })), []);
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
      {stars.map((s, i) => <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white" opacity={s.o} />)}
    </svg>
  );
}
