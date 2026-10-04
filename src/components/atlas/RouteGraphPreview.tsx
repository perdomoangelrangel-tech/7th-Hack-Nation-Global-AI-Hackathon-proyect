"use client";
/**
 * Read-only Route graph for the website (WAVE 7 · T3): the same radial layout and 2D renderer as the atlas, fixed,
 * no toolbar, pointer events off except the CTA. Data comes from the engine's own API (server snapshot / cache) —
 * no client Supabase calls.
 *
 *   <RouteGraphPreview diseaseId="disease:ORPHA:599373" persona="maria" height={420} ctaHref="/atlas?d=…&p=maria" />
 */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { GraphView, Journey } from "@/lib/atlas/store";
import { dict } from "@/lib/i18n";
import { routeLayout, LAYERS } from "./radial";
import { strengthOf, type Strength } from "./evidence";
import { api } from "./api";

const GraphCanvas = dynamic(() => import("./GraphCanvas"), { ssr: false });
const EMPTY = new Set<string>();

export function RouteGraphPreview({ diseaseId, persona = "maria", interactive = false, height = 420, ctaHref, ctaLabel = "Open this route in Nedamex", className = "" }: {
  diseaseId: string; persona?: string; interactive?: boolean; height?: number; ctaHref?: string; ctaLabel?: string; className?: string;
}) {
  const [view, setView] = useState<GraphView | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  useEffect(() => {
    const c = new AbortController();
    const q = (p: string) => fetch(api(p), { signal: c.signal }).then((r) => (r.ok ? r.json() : null));
    Promise.all([q(`/api/atlas/graph?d=${encodeURIComponent(diseaseId)}&l=en`), q(`/api/atlas/journey?d=${encodeURIComponent(diseaseId)}&l=en`)])
      .then(([g, j]) => { if (g) setView(g); if (j) setJourney(j); }).catch(() => {});
    return () => c.abort();
  }, [diseaseId]);
  const t = dict.en;
  const laid = useMemo(() => {
    if (!view) return null;
    const strength = Object.fromEntries((journey?.shares ?? []).filter((x) => x.explanation).map((x) => [x.disease, strengthOf(x.explanation)])) as Record<string, Strength>;
    return routeLayout(view, diseaseId, {
      strength, expanded: new Set(), layers: new Set(LAYERS), strengthLabel: { strong: t.drawer.strong, possible: t.drawer.possible, weak: t.drawer.weak },
      sectorLabel: { symptoms: t.sector.symptoms, studies: t.sector.studies, people: t.sector.people, treatments: t.sector.treatments },
      moreLabel: (n) => t.sector.more.replace("{n}", String(n)), fewerLabel: t.sector.fewer, noneLabel: t.sector.none,
    });
  }, [view, journey, diseaseId, t]);
  const href = ctaHref ?? `/atlas?d=${encodeURIComponent(diseaseId)}&p=${persona}`;
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line bg-[radial-gradient(ellipse_at_30%_20%,var(--paper)_0%,var(--brand-mist)_60%,var(--brand-soft)_100%)] ${className}`} style={{ height }}>
      <div className={interactive ? "absolute inset-0" : "absolute inset-0 pointer-events-none"} aria-hidden={!interactive}>
        {laid && <GraphCanvas view={laid.view} highlightNodes={EMPTY} highlightEdges={EMPTY} selected={diseaseId} clusterFilter={null} bottomInset={0} still labelIds={laid.labelIds} onNode={() => {}} onLink={() => {}} />}
      </div>
      {!laid && <p className="absolute inset-0 grid place-items-center text-sm text-ink-3">Following the evidence…</p>}
      <p className="sr-only">Route graph preview: {journey?.disease.name ?? diseaseId}, its gene and mechanism, neighbour diseases and labelled sectors. Every link has a source in the atlas.</p>
      <a href={href} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-deep px-4 py-2 text-sm font-semibold text-paper shadow-md hover:bg-brand-ink">{ctaLabel} →</a>
    </div>
  );
}

export default RouteGraphPreview;
