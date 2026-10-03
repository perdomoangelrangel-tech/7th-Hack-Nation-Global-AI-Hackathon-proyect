import type { Metadata } from "next";
import { AtlasApp, type PersonaOption } from "@/components/atlas/AtlasApp";
import { PERSONAS, type PersonaId } from "@/lib/agents/profiles";
import { atlas, loadAtlas, stats } from "@/lib/atlas/store";
import type { Locale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Nexmed · Rare disease atlas",
  description: "Search a rare disease and follow it to a shared mechanism, an existing asset, a collaborator and a next step — every edge with its source.",
};

const MARIA = "disease:ORPHA:599373"; // STXBP1-DEE: sin tratamiento aprobado, el caso de demostración

export default async function AtlasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await loadAtlas();
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const d = one("d");
  const initialDisease = d && atlas().byId.get(d)?.type === "disease" ? d : null;
  const p = one("p");
  const initialPersona: PersonaId = p && p in PERSONAS ? (p as PersonaId) : "maria";
  const e = one("e");
  const initialEdge = e && atlas().edgeById.has(e) ? e : null;
  const initialLocale: Locale = one("l") === "es" ? "es" : "en";
  const personas: Record<Locale, PersonaOption[]> = {
    en: Object.values(PERSONAS).map((x) => ({ id: x.id, name: x.name, role: x.role.en, mode: x.mode.en })),
    es: Object.values(PERSONAS).map((x) => ({ id: x.id, name: x.name, role: x.role.es, mode: x.mode.es })),
  };
  return <AtlasApp initialDisease={initialDisease} initialPersona={initialPersona} initialLocale={initialLocale} initialEdge={initialEdge} personas={personas} stats={stats()} maria={MARIA} />;
}
