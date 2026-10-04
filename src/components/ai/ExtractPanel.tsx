"use client";
/**
 * <ExtractPanel pmid locale? onExtracted? apiBase? />
 * "Extract with OpenAI" on any PubMed evidence: entities reconciled to the atlas and claims with the exact
 * quote highlighted. Extracted claims are drawn dotted and always labeled "needs expert review".
 */
import { useState } from "react";
import { apiUrl, type ExtractResult } from "@/lib/ai/contract";

type Props = { pmid: string; locale?: "en" | "es"; onExtracted?: (r: ExtractResult) => void; className?: string; /** API origin when mounted outside the Next app. */ apiBase?: string };

const T = {
  en: { cta: "Extract with OpenAI", again: "Extract again", loading: "Reading the abstract…", error: "Could not extract right now.", entities: "Entities", claims: "Claims from the paper", none: "Nothing extractable in this abstract.", review: "AI-extracted · needs expert review", dictReview: "Name match, no AI · needs expert review", contradicts: "evidence against", supports: "supports", inAtlas: "in the atlas", isNew: "not in the atlas", ai: "Extracted by OpenAI", tpl: "Dictionary pass from atlas names (no AI)", saved: "saved to the graph as dotted edges", dropped: "dropped by the checks (not verbatim in the paper, not about the claim, or wrong entity types)" },
  es: { cta: "Extraer con OpenAI", again: "Extraer de nuevo", loading: "Leyendo el resumen…", error: "No se pudo extraer ahora.", entities: "Entidades", claims: "Afirmaciones del artículo", none: "Nada extraíble en este resumen.", review: "Extraído por IA · revisar con un experto", dictReview: "Coincidencia de nombres, sin IA · revisar con un experto", contradicts: "evidencia en contra", supports: "apoya", inAtlas: "en el atlas", isNew: "no está en el atlas", ai: "Extraído por OpenAI", tpl: "Búsqueda por diccionario del atlas (sin IA)", saved: "guardado en el grafo como aristas punteadas", dropped: "descartadas por las verificaciones (no literal en el artículo, no trata de la afirmación o tipos incorrectos)" },
};
const REL: Record<string, string> = { causes: "causes", has_phenotype: "has sign", has_variant: "has variant", treats: "tested for", participates_in: "takes part in", researches: "researches" };

export function ExtractPanel({ pmid, locale = "en", onExtracted, className = "", apiBase }: Props) {
  const t = T[locale];
  const [state, setState] = useState<{ status: "idle" | "loading" | "error" } | { status: "done"; data: ExtractResult }>({ status: "idle" });

  async function run() {
    setState({ status: "loading" });
    try {
      const r = await fetch(apiUrl(apiBase, "/api/extract"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pmid }) });
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as ExtractResult;
      setState({ status: "done", data });
      onExtracted?.(data);
    } catch {
      setState({ status: "error" });
    }
  }

  return (
    <div className={`mt-3 ${className}`}>
      <button type="button" onClick={run} disabled={state.status === "loading"} aria-busy={state.status === "loading"}
        className="inline-flex items-center gap-2 rounded-full border border-dotted border-brand bg-paper px-3 py-1.5 text-sm font-medium text-brand-deep hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand-deep disabled:opacity-50">
        <span aria-hidden>⋯</span>{state.status === "done" ? t.again : t.cta} <span className="font-mono text-[11px] text-ink-3">{pmid}</span>
      </button>
      <div aria-live="polite" className="mt-2">
        {state.status === "loading" && <p className="text-sm text-ink-3">{t.loading}</p>}
        {state.status === "error" && <p className="text-sm text-amber">{t.error}</p>}
        {state.status === "done" && <Result data={state.data} t={t} />}
      </div>
    </div>
  );
}

function Result({ data, t }: { data: ExtractResult; t: (typeof T)["en"] }) {
  return (
    <div className="rounded-xl border border-dotted border-brand bg-brand-mist p-3 space-y-3">
      {data.source.title && <p className="text-sm font-medium text-ink">{data.source.title}</p>}
      <section>
        <h4 className="text-xs uppercase tracking-wider text-ink-3">{t.entities}</h4>
        <ul className="mt-1 flex flex-wrap gap-1">
          {data.entities.map((e, i) => (
            <li key={i} className={`chip !text-[11px] ${e.entity_id ? "" : "border-dashed"}`} title={e.entity_id ? `${e.label} · ${e.match} · ${Math.round(e.confidence * 100)}%` : t.isNew}>
              <span className="text-ink-3">{e.type}</span> {e.mention}{e.entity_id && e.label && e.label !== e.mention ? ` → ${e.label}` : ""}
              <span className="sr-only">{e.entity_id ? t.inAtlas : t.isNew}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h4 className="text-xs uppercase tracking-wider text-ink-3">{t.claims}</h4>
        {data.claims.length === 0 ? <p className="text-sm text-ink-3 mt-1">{t.none}</p> : (
          <ul className="mt-1 space-y-2">
            {data.claims.map((c, i) => (
              <li key={i} className="border-l-[3px] border-dotted border-brand pl-3 text-sm">
                <p className="text-ink"><strong>{c.subject}</strong> {REL[c.relation] ?? c.relation} <strong>{c.object}</strong>
                  <span className={`ml-2 chip !text-[10px] ${c.polarity === "contradicts" ? "!border-amber text-amber" : ""}`}>{t[c.polarity]}</span></p>
                <p className="mt-0.5 text-xs text-ink-2">“<mark className="bg-brand-soft text-ink rounded px-0.5">{c.quote}</mark>”</p>
                <p className="text-[11px] text-ink-3 mt-0.5">{data.mode === "openai" ? t.review : t.dictReview} · {Math.round(c.confidence * 100)}%</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-[11px] text-ink-3">
        {data.mode === "openai" ? `${t.ai}${data.model ? ` (${data.model})` : ""}` : t.tpl}
        {data.saved ? ` · ${t.saved}` : ""}
        {data.dropped.length > 0 ? ` · ${data.dropped.length} ${t.dropped}` : ""}
      </p>
    </div>
  );
}

export default ExtractPanel;
