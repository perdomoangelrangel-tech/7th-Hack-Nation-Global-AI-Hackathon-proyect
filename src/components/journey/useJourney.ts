"use client";
/** Fetches Journey v2 for a disease (or the honest no-route answer for free text). */
import { useEffect, useState } from "react";
import type { JourneyV2 } from "@/lib/journey/build";
import type { NoRouteAnswer } from "@/lib/journey/noroute";
import type { PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";

export type JourneyResult = JourneyV2 | NoRouteAnswer;
export { isNoRoute } from "@/lib/journey/noroute";

export function useJourney(disease: string | null, persona: PersonaId, locale: Locale) {
  const [state, setState] = useState<{ key: string; data: JourneyResult | null; error: boolean }>({ key: "", data: null, error: false });
  const [attempt, setAttempt] = useState(0);
  const key = disease ? `${disease}|${persona}|${locale}|${attempt}` : "";
  useEffect(() => {
    if (!disease) return;
    const c = new AbortController();
    const k = `${disease}|${persona}|${locale}|${attempt}`;
    fetch(`/api/journey?d=${encodeURIComponent(disease)}&p=${persona}&l=${locale}`, { signal: c.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: JourneyResult) => setState({ key: k, data, error: false }))
      .catch((e) => { if ((e as Error).name !== "AbortError") setState({ key: k, data: null, error: true }); });
    return () => c.abort();
  }, [disease, persona, locale, attempt]);
  const fresh = state.key === key;
  // retry() feeds <PanelState onRetry> ("We couldn't load this. Try again.").
  return { data: fresh ? state.data : null, loading: !!disease && !fresh, error: fresh && state.error, retry: () => setAttempt((a) => a + 1) };
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
