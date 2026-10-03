"use client";
/** Fetches Journey v2 for a disease (or the honest no-route answer for free text). */
import { useEffect, useState } from "react";
import type { JourneyV2 } from "@/lib/journey/build";
import type { NoRouteAnswer } from "@/lib/journey/noroute";
import type { PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";

export type JourneyResult = JourneyV2 | NoRouteAnswer;
export const isNoRoute = (j: JourneyResult | null): j is NoRouteAnswer => !!j && "kind" in j && j.kind === "no_route";

export function useJourney(disease: string | null, persona: PersonaId, locale: Locale) {
  const [state, setState] = useState<{ key: string; data: JourneyResult | null; error: boolean }>({ key: "", data: null, error: false });
  const key = disease ? `${disease}|${persona}|${locale}` : "";
  useEffect(() => {
    if (!disease) return;
    const c = new AbortController();
    fetch(`/api/journey?d=${encodeURIComponent(disease)}&p=${persona}&l=${locale}`, { signal: c.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: JourneyResult) => setState({ key: `${disease}|${persona}|${locale}`, data, error: false }))
      .catch((e) => { if ((e as Error).name !== "AbortError") setState({ key: `${disease}|${persona}|${locale}`, data: null, error: true }); });
    return () => c.abort();
  }, [disease, persona, locale]);
  const fresh = state.key === key;
  return { data: fresh ? state.data : null, loading: !!disease && !fresh, error: fresh && state.error };
}

/**
 * AtlasApp (explorer lane) does not pass persona/locale to JourneyPanel yet (HANDOFF NEED(explorer)).
 * Until it does, read them from the shareable URL (?p=…&l=…) that AtlasApp keeps in sync.
 */
export function useUrlParam<T extends string>(name: string, fallback: T, allowed: readonly T[], override?: T): T {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => {
    if (override) return;
    const read = () => { const x = new URLSearchParams(window.location.search).get(name) as T | null; setV(x && allowed.includes(x) ? x : fallback); };
    read();
    // AtlasApp updates the URL with history.replaceState (no event), so poll lightly while mounted.
    const id = window.setInterval(read, 400);
    return () => window.clearInterval(id);
  }, [name, fallback, allowed, override]);
  return override ?? v;
}
