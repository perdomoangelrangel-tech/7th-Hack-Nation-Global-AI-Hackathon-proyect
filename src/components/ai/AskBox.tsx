"use client";
/**
 * <AskBox persona locale focus? simple? onHighlight? onFocusDisease? apiBase? />
 * "Ask Nexmed": a question box that calls POST /api/ask and shows verified answer cards. Each card cites
 * its sources (links open the source), shows observed / inferred / gap, and lights its edges on hover/focus.
 * Portable (no Next-only imports). `simple` defaults to the user's simple-language preference.
 */
import { useId, useState, type FormEvent } from "react";
import { usePrefs } from "@/lib/prefs";
import { apiUrl, type AskAnswer, type PersonaKey } from "@/lib/ai/contract";

type Props = {
  persona: PersonaKey;
  locale: "en" | "es";
  /** Entity id the question is about (e.g. the disease on screen). */
  focus?: string;
  simple?: boolean;
  onHighlight?: (edgeIds: string[] | null) => void;
  /** Called with the disease the answer resolved to, so the explorer can open it. */
  onFocusDisease?: (diseaseId: string) => void;
  apiBase?: string;
  className?: string;
};

const T = {
  en: { label: "Ask Nexmed", placeholder: "e.g. Who else works on my mechanism?", ask: "Ask", asking: "Checking the sources…", error: "Could not answer right now.", sources: "Sources", about: "About", via: "matched", open: "Open in the atlas", observed: "From a source", inferred: "Atlas inference · needs expert review", extracted: "AI-extracted · needs review", gap: "Gap in the evidence", ai: "Written by OpenAI, checked against the sources", tpl: "Assembled from the sources (no AI)", left: "left out: no evidence" },
  es: { label: "Pregunta a Nexmed", placeholder: "p. ej. ¿Quién más trabaja en mi mecanismo?", ask: "Preguntar", asking: "Revisando las fuentes…", error: "No se pudo responder ahora.", sources: "Fuentes", about: "Sobre", via: "coincidió", open: "Abrir en el atlas", observed: "De una fuente", inferred: "Inferencia del atlas · revisar con un experto", extracted: "Extraído por IA · revisar", gap: "Hueco en la evidencia", ai: "Redactado por OpenAI, verificado contra las fuentes", tpl: "Armado desde las fuentes (sin IA)", left: "omitidas: sin evidencia" },
};
const BORDER: Record<string, string> = { observed: "border-brand-deep", inferred: "border-brand border-dashed", extracted: "border-brand border-dotted", gap: "border-amber" };

export function AskBox({ persona, locale, focus, simple, onHighlight, onFocusDisease, apiBase, className = "" }: Props) {
  const t = T[locale];
  const { prefs } = usePrefs();
  const inputId = useId();
  const [q, setQ] = useState("");
  const [state, setState] = useState<{ status: "idle" | "loading" | "error" } | { status: "done"; data: AskAnswer }>({ status: "idle" });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (question.length < 2) return;
    setState({ status: "loading" });
    try {
      const r = await fetch(apiUrl(apiBase, "/api/ask"), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, persona, locale, focus, simple: simple ?? prefs.simpleLanguage }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setState({ status: "done", data: (await r.json()) as AskAnswer });
    } catch {
      setState({ status: "error" });
    }
  }

  return (
    <section className={`card p-4 ${className}`} aria-label={t.label}>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">{t.label}</label>
        <input id={inputId} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.placeholder} maxLength={500} autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-2 text-sm text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-brand-deep" />
        <button type="submit" disabled={state.status === "loading" || q.trim().length < 2}
          className="rounded-full bg-brand-deep px-4 py-2 text-sm font-medium text-paper hover:bg-brand-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
          {t.ask}
        </button>
      </form>

      <div aria-live="polite" className="mt-3">
        {state.status === "loading" && <p className="text-sm text-ink-3">{t.asking}</p>}
        {state.status === "error" && <p className="text-sm text-amber">{t.error}</p>}
        {state.status === "done" && <Answer a={state.data} t={t} onHighlight={onHighlight} onFocusDisease={onFocusDisease} />}
      </div>
    </section>
  );
}

function Answer({ a, t, onHighlight, onFocusDisease }: { a: AskAnswer; t: (typeof T)["en"]; onHighlight?: Props["onHighlight"]; onFocusDisease?: Props["onFocusDisease"] }) {
  // No disease found: the spoken text is the honest "not in the atlas" message (no claims to show).
  const message = !a.disease ? a.spoken.replace(a.disclaimer, "").replace(a.notice ?? "", "").trim() : null;
  return (
    <div className="space-y-3">
      {a.notice && <p className="rounded-lg bg-amber-soft px-3 py-2 text-sm text-ink">{a.notice}</p>}
      {message && <p className="text-sm text-ink-2">{message}</p>}
      {a.disease && a.disease_name && (
        <p className="text-xs text-ink-3">
          {t.about} <strong className="text-ink-2">{a.disease_name}</strong>
          {a.resolved_via?.matched_synonym && <> · {t.via} “{a.resolved_via.matched_synonym}”</>}
          {onFocusDisease && <> · <button type="button" onClick={() => onFocusDisease(a.disease!)} className="text-brand-deep underline-offset-2 hover:underline">{t.open}</button></>}
        </p>
      )}
      <ol className="space-y-2">
        {a.claims.map((c, i) => (
          <li key={i} tabIndex={0} onMouseEnter={() => onHighlight?.(c.edges)} onMouseLeave={() => onHighlight?.(null)} onFocus={() => onHighlight?.(c.edges)} onBlur={() => onHighlight?.(null)}
            className={`rounded-r-lg border-l-[3px] bg-brand-mist py-2 pl-3 pr-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-brand-deep ${BORDER[c.status] ?? ""}`}>
            <p>{c.text}</p>
            <p className="mt-1 text-[11px] text-ink-3">
              {t[c.status as "observed"] ?? c.status} · {t.sources}:{" "}
              {c.evidence.slice(0, 4).map((ev, j) => (
                <span key={ev.id}>{j > 0 && ", "}<a href={ev.url} target="_blank" rel="noreferrer" className="text-brand-deep underline-offset-2 hover:underline">{ev.external_id}<span className="sr-only"> (opens in a new tab)</span></a></span>
              ))}
              {c.evidence_ids.length > 4 && ` +${c.evidence_ids.length - 4}`}
            </p>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-ink-3">
        {a.mode === "openai" ? `${t.ai}${a.model ? ` (${a.model})` : ""}` : t.tpl}
        {a.dropped.length > 0 && ` · ${a.dropped.length} ${t.left}`}
      </p>
      <p className="text-[11px] text-ink-3">{a.disclaimer}</p>
    </div>
  );
}

export default AskBox;
