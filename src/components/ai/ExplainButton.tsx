"use client";
/**
 * <ExplainButton edgeIds persona locale simple? onHighlight? />
 * "Explain in plain words": calls POST /api/explain and shows verified, cited sentences.
 * Each sentence shows its kind (observed / inferred / AI-extracted) and lights its edges on hover/focus.
 * `simple` defaults to the user's "simple language" preference.
 */
import { useState } from "react";
import type { PersonaId } from "@/lib/agents/profiles";
import { usePrefs } from "@/lib/prefs";
import type { ExplainResponse } from "@/lib/ai/explain";

type Props = {
  edgeIds: string[];
  persona: PersonaId;
  locale: "en" | "es";
  simple?: boolean;
  /** Called with the edge ids of the sentence under the pointer / focus (null on leave). */
  onHighlight?: (edgeIds: string[] | null) => void;
  className?: string;
};

const T = {
  en: { cta: "Explain in plain words", again: "Explain again", loading: "Reading the sources…", error: "Could not explain right now.", ai: "Written by OpenAI", tpl: "Template from the sources (no AI)", left: "left out: no evidence", observed: "Observed", inferred: "Atlas inference", extracted: "AI-extracted · needs review", gap: "Gap", sources: "sources" },
  es: { cta: "Explicar en palabras simples", again: "Explicar de nuevo", loading: "Leyendo las fuentes…", error: "No se pudo explicar ahora.", ai: "Redactado por OpenAI", tpl: "Plantilla desde las fuentes (sin IA)", left: "omitidas: sin evidencia", observed: "Observado", inferred: "Inferencia del atlas", extracted: "Extraído por IA · revisar", gap: "Hueco", sources: "fuentes" },
};
const KIND_STYLE: Record<string, string> = {
  observed: "border-brand-deep",
  inferred: "border-brand border-dashed",
  extracted: "border-brand border-dotted",
  gap: "border-amber",
};

export function ExplainButton({ edgeIds, persona, locale, simple, onHighlight, className = "" }: Props) {
  const prefs = usePrefs();
  const t = T[locale];
  const [state, setState] = useState<{ status: "idle" | "loading" | "error" } | { status: "done"; data: ExplainResponse }>({ status: "idle" });
  const useSimple = simple ?? prefs.prefs.simpleLanguage;

  async function run() {
    setState({ status: "loading" });
    try {
      const r = await fetch("/api/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ edgeIds, persona, locale, simple: useSimple }) });
      if (!r.ok) throw new Error(String(r.status));
      setState({ status: "done", data: (await r.json()) as ExplainResponse });
    } catch {
      setState({ status: "error" });
    }
  }

  return (
    <div className={`mt-3 ${className}`}>
      <button type="button" onClick={run} disabled={!edgeIds.length || state.status === "loading"} aria-busy={state.status === "loading"}
        className="inline-flex items-center gap-2 rounded-full border border-brand bg-paper px-3 py-1.5 text-sm font-medium text-brand-deep hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand-deep disabled:opacity-50">
        <span aria-hidden>✦</span>{state.status === "done" ? t.again : t.cta}
      </button>
      <div aria-live="polite" className="mt-2">
        {state.status === "loading" && <p className="text-sm text-ink-3">{t.loading}</p>}
        {state.status === "error" && <p className="text-sm text-amber">{t.error}</p>}
        {state.status === "done" && (
          <div className="rounded-xl border border-line bg-brand-mist p-3">
            <ul className="space-y-2">
              {state.data.sentences.map((s, i) => (
                <li key={i} tabIndex={0} onMouseEnter={() => onHighlight?.(s.edge_ids)} onMouseLeave={() => onHighlight?.(null)} onFocus={() => onHighlight?.(s.edge_ids)} onBlur={() => onHighlight?.(null)}
                  className={`border-l-[3px] pl-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-brand-deep ${KIND_STYLE[s.kind] ?? ""}`}>
                  {s.text}
                  <span className="block text-[11px] text-ink-3 mt-0.5">{t[s.kind]} · {s.evidence_ids.length} {t.sources}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-ink-3">
              {state.data.mode === "openai" ? `${t.ai}${state.data.model ? ` (${state.data.model})` : ""}` : t.tpl}
              {state.data.dropped.length > 0 && ` · ${state.data.dropped.length} ${t.left}`}
            </p>
            <p className="mt-1 text-[11px] text-ink-3">{state.data.disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExplainButton;
