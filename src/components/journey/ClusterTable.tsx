"use client";
/**
 * Pharma center view (UX_WAVE4 S2): "Clusters for your mechanism", ranked by unmet need.
 * OWNER: action lane · mounted by explorer behind its Map/Table toggle:
 *   <ClusterTable locale onFocusCluster={(clusterId) => …} onFocusDisease={(diseaseId) => …} />
 * Data: GET /api/journey/clusters (CSV via ?format=csv).
 */
import { useEffect, useState } from "react";
import { Download, Table2 } from "lucide-react";
import { PanelHeader, PanelState } from "@/components/ui/PanelHeader";
import type { Locale } from "@/lib/i18n";
import type { ClusterTable as Data } from "@/lib/journey/clusters";

const C = {
  en: { title: "Clusters for your mechanism", sub: "Ranked by unmet need.", csv: "Export CSV", loading: "Following the evidence…", error: "We couldn't load this. Try again.", retry: "Try again", rank: "#", yes: "yes", no: "no", of: "of", no_approved: "No approved treatment in Open Targets" },
  es: { title: "Clusters para tu mecanismo", sub: "Ordenados por necesidad no cubierta.", csv: "Exportar CSV", loading: "Siguiendo la evidencia…", error: "No pudimos cargar esto. Intenta de nuevo.", retry: "Reintentar", rank: "#", yes: "sí", no: "no", of: "de", no_approved: "Sin tratamiento aprobado en Open Targets" },
};

export function ClusterTable({ locale = "en", onFocusCluster, onFocusDisease, apiBase = "" }: { locale?: Locale; onFocusCluster?: (id: string) => void; onFocusDisease?: (id: string) => void; apiBase?: string }) {
  const c = C[locale];
  // Standalone (/plan/clusters): without a handler a disease chip is a plain link to that disease in Pharma mode.
  const href = (id: string) => `${apiBase}/atlas?d=${encodeURIComponent(id)}&p=priya&l=${locale}`;
  const [state, setState] = useState<{ data: Data | null; error: boolean; key: string }>({ data: null, error: false, key: "" });
  const [attempt, setAttempt] = useState(0);
  const key = `${locale}|${attempt}`;
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`${apiBase}/api/journey/clusters?l=${locale}`, { signal: ctl.signal }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: Data) => setState({ data, error: false, key: `${locale}|${attempt}` }))
      .catch((e) => { if ((e as Error).name !== "AbortError") setState({ data: null, error: true, key: `${locale}|${attempt}` }); });
    return () => ctl.abort();
  }, [locale, attempt, apiBase]);
  const data = state.key === key ? state.data : null;

  return (
    <section className="h-full overflow-auto bg-paper p-4 sm:p-6" aria-labelledby="cluster-table">
      <PanelHeader icon={Table2} id="cluster-table" title={c.title} subtitle={c.sub} info={data?.method ?? c.sub}
        actions={<a href={`${apiBase}/api/journey/clusters?l=${locale}&format=csv`} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink-2 hover:bg-paper-2 min-h-10"><Download size={15} aria-hidden />{c.csv}</a>} />
      {!data && <PanelState status={state.key === key && state.error ? "error" : "loading"} onRetry={() => setAttempt((a) => a + 1)} skeleton={4} className="mt-4" />}
      {data && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-brand-mist text-left text-xs text-ink-3">
              <tr><th className="px-3 py-2 font-medium">{c.rank}</th>{data.columns.map((h) => <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className={`border-t border-line align-top hover:bg-brand-mist/60 ${onFocusCluster ? "cursor-pointer" : ""}`} onClick={() => onFocusCluster?.(r.id)}>
                  <td className="px-3 py-2.5 tabular-nums text-ink-3">{r.rank}</td>
                  <td className="px-3 py-2.5 min-w-48"><span className="flex items-start gap-2"><span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} aria-hidden /><span className="font-medium text-ink">{r.label}</span></span></td>
                  <td className="px-3 py-2.5 min-w-56">
                    <span className="flex flex-wrap gap-1">{r.diseases.map((d) => (
                      onFocusDisease
                        ? <button key={d.id} onClick={(e) => { e.stopPropagation(); onFocusDisease(d.id); }} className={`chip !text-[11px] hover:bg-brand-soft ${d.approved ? "" : "!border-amber/60"}`} title={d.approved ? "" : c.no_approved}>{d.name}</button>
                        : <a key={d.id} href={href(d.id)} onClick={(e) => e.stopPropagation()} className={`chip !text-[11px] hover:bg-brand-soft ${d.approved ? "" : "!border-amber/60"}`} title={d.approved ? "" : c.no_approved}>{d.name}</a>
                    ))}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-2 min-w-40">{r.variant_effect.text}</td>
                  <td className="px-3 py-2.5 tabular-nums">{r.active_trials}</td>
                  <td className="px-3 py-2.5 tabular-nums">{r.reusable_assets}</td>
                  <td className="px-3 py-2.5 tabular-nums">{r.patient_groups}</td>
                  <td className={`px-3 py-2.5 tabular-nums whitespace-nowrap ${r.approved_diseases === 0 ? "text-amber font-medium" : ""}`}>{r.approved_diseases} {c.of} {r.diseases.length}</td>
                  <td className="px-3 py-2.5 text-xs text-ink-2 min-w-40">{r.key_people.map((p) => p.name).join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <p className="mt-3 text-[11px] text-ink-3">{data.method}</p>}
    </section>
  );
}
