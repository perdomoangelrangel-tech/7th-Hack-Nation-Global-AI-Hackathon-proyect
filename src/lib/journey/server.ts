/** Server wiring: the live graph (Supabase, falling back to data/atlas.json) → the pure journey engine. */
import "server-only";
import { atlas, loadAtlas, search } from "@/lib/atlas/store";
import { PERSONAS, type PersonaId } from "@/lib/agents/profiles";
import { buildJourney } from "./build";
import { noRouteForQuery } from "./noroute";
import type { GraphIndex, Locale } from "./graph";

export async function graph(): Promise<GraphIndex> {
  await loadAtlas();
  return atlas();
}

export const parsePersona = (p: string | null | undefined): PersonaId => (p && p in PERSONAS ? (p as PersonaId) : "maria");
export const parseLocale = (l: string | null | undefined): Locale => (l === "es" ? "es" : "en");

/** Resolves `d` (entity id) or free text `q` to a disease journey, or to the honest no-route answer. */
export async function journeyFor({ d, q, persona, locale }: { d?: string | null; q?: string | null; persona: PersonaId; locale: Locale }) {
  const g = await graph();
  let id = d && g.byId.get(d)?.type === "disease" ? d : null;
  if (!id && q) id = search(q, locale, 5).find((h) => h.type === "disease")?.disease ?? null;
  if (id) return buildJourney(g, id, persona, locale)!;
  return noRouteForQuery(g, q || d || "", locale);
}
