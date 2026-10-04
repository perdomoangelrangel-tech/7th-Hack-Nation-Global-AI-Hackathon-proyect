import type { Metadata } from "next";
import { AtlasApp, type PersonaOption } from "@/components/atlas/AtlasApp";
import { redirect } from "next/navigation";
import { Home } from "@/components/home/Home";
import { NoRoute, type Lead } from "@/components/home/NoRoute";
import { Tour } from "@/components/home/Tour";
import { atlasHref } from "@/components/home/memory";
import { EmbedBridge } from "@/components/home/EmbedBridge";
import { originOf } from "@/components/home/bridge";
import { site } from "@/lib/site";
import { PERSONAS, type PersonaId } from "@/lib/agents/profiles";
import { atlas, loadAtlas, nameOf, search, stats } from "@/lib/atlas/store";
import type { Locale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Nedamex · Rare disease atlas",
  description: "Search a rare disease and follow it to a shared mechanism, an existing asset, a collaborator and a next step — every edge with its source.",
};

const MARIA = "disease:ORPHA:599373"; // STXBP1-DEE: sin tratamiento aprobado, el caso de demostración

export default async function AtlasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await loadAtlas();
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const initialLocale: Locale = one("l") === "es" ? "es" : "en";
  const d = one("d");
  const p = one("p");
  const embed = one("embed") === "1";
  const mode = one("mode") === "challenge" || one("mode") === "free" ? (one("mode") as "challenge" | "free") : undefined;
  const bridge = <EmbedBridge allowedOrigins={parentOrigins()} />;
  // WAVE 6: the challenge is Maria's STXBP1 route — a bare ?mode=challenge opens it.
  if (mode === "challenge" && !d) redirect(`${atlasHref({ p: p && p in PERSONAS ? (p as PersonaId) : "maria", d: MARIA, mode, l: initialLocale })}${embed ? "&embed=1" : ""}`);
  // S7: /atlas?q=<text> — a match opens its route; nothing → the honest "no supported route" page.
  const q = one("q")?.trim().slice(0, 120);
  if (q && !d) {
    const persona: PersonaId = p && p in PERSONAS ? (p as PersonaId) : "maria";
    const hit = search(q, initialLocale, 1).find((h) => h.disease);
    if (hit?.disease) redirect(atlasHref({ p: persona, d: hit.disease, l: initialLocale }));
    return <>{bridge}<NoRoute query={q} locale={initialLocale} persona={persona} embed={embed} sources={noRouteSources()} leads={closestLeads(q, initialLocale)} /></>;
  }
  // S0 Home: no disease, role or start mode yet → "Who are you?" (UX_WAVE4 S0 · WAVE 6 T8). ?role=change opens the picker.
  if (!d && !p && !mode) {
    const s = stats();
    const diseaseNames = Object.fromEntries(atlas().snap.entities.filter((x) => x.type === "disease").map((x) => [x.id, nameOf(x, initialLocale)]));
    return <>{bridge}<Home initialLocale={initialLocale} stats={{ diseases: s.diseases, sources: s.sources }} maria={MARIA} diseaseNames={diseaseNames} embed={embed} changeRole={one("role") === "change"} /></>;
  }
  const initialDisease = d && atlas().byId.get(d)?.type === "disease" ? d : null;
  const initialPersona: PersonaId = p && p in PERSONAS ? (p as PersonaId) : "maria";
  const e = one("e");
  const initialEdge = e && atlas().edgeById.has(e) ? e : null;
  const personas: Record<Locale, PersonaOption[]> = {
    en: Object.values(PERSONAS).map((x) => ({ id: x.id, name: x.name, role: x.role.en, mode: x.mode.en })),
    es: Object.values(PERSONAS).map((x) => ({ id: x.id, name: x.name, role: x.role.es, mode: x.mode.es })),
  };
  // Keyed by what the parent can change (nedamex:navigate) so a new disease / role / mode remounts with fresh state.
  return <>{bridge}<AtlasApp key={`${initialDisease}|${initialPersona}|${mode ?? ""}|${initialLocale}`} initialDisease={initialDisease} initialPersona={initialPersona} initialLocale={initialLocale} initialEdge={initialEdge} personas={personas} stats={stats()} maria={MARIA} /><Tour locale={initialLocale} auto={!initialDisease} /></>;
}

/** Parents allowed to frame-talk with the engine: the platform app, the program URL, CORS extras, local dev. */
function parentOrigins(): string[] {
  const list = [site.appUrl, process.env.NEXT_PUBLIC_PROGRAM_URL, ...(process.env.CORS_EXTRA_ORIGINS ?? "").split(","), "http://localhost:8080", "http://localhost:5173"];
  return [...new Set(list.map((u) => originOf(u?.trim())).filter((o): o is string => !!o))];
}

function noRouteSources() {
  return Object.values(atlas().snap.sources).flatMap((s) => (s ? [{ id: s.id, name: s.name, last_synced_at: s.last_synced_at ?? null }] : []));
}

/** Words too generic to be a lead on their own ("syndrome" would match half the atlas). */
const GENERIC = new Set(["syndrome", "syndromes", "disease", "diseases", "disorder", "type", "rare", "the", "and", "with", "sindrome", "síndrome", "enfermedad", "tipo", "con"]);

/** Closest leads for an unmatched query: each word on its own, first hit that opens a disease (max 3, weak by label). */
function closestLeads(q: string, l: Locale): Lead[] {
  const { byId } = atlas();
  const words = [...new Set(q.toLowerCase().split(/[^\p{L}\p{N}-]+/u).filter((w) => w.length >= 3 && !GENERIC.has(w)))].slice(0, 6);
  const out: Lead[] = [];
  for (const word of words) {
    const h = search(word, l, 3).find((x) => x.disease && !out.some((o) => o.disease === x.disease));
    if (h?.disease) out.push({ word, hit: h.name, disease: h.disease, diseaseName: byId.get(h.disease)?.name ?? h.disease });
    if (out.length === 3) break;
  }
  return out;
}
