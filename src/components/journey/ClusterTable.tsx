"use client";
/**
 * Pharma center view (UX_WAVE4 S2): "Clusters for your mechanism", ranked by unmet need.
 * OWNER: action lane · mounted by explorer behind its Map/Table toggle:
 *   <ClusterTable locale onFocusCluster={(clusterId) => …} onFocusDisease={(diseaseId) => …} />
 * Data: GET /api/journey/clusters (CSV via ?format=csv).
 */
import { useEffect, useState } from "react";
import { ChevronDown, Download, Table2 } from "lucide-react";
import { PanelHeader, PanelState } from "@/components/ui/PanelHeader";
import type { Locale } from "@/lib/i18n";
import type { ClusterTable as Data } from "@/lib/journey/clusters";

const C = {
  en: { title: "Clusters for your mechanism", sub: "Ranked by unmet need.", csv: "Export CSV", loading: "Following the evidence…", error: "We couldn't load this. Try again.", retry: "Try again", rank: "#", yes: "yes", no: "no", of: "of", no_approved: "No approved treatment in Open Targets", diseases: (n: number) => `${n} ${n === 1 ? "disease" : "diseases"}`, approved_tip: "Diseases in the cluster with an approved treatment (Open Targets)" },
  es: { title: "Clusters para tu mecanismo", sub: "Ordenados por necesidad no cubierta.", csv: "Exportar CSV", loading: "Siguiendo la evidencia…", error: "No pudimos cargar esto. Intenta de nuevo.", retry: "Reintentar", rank: "#", yes: "sí", no: "no", of: "de", no_approved: "Sin tratamiento aprobado en Open Targets", diseases: (n: number) => `${n} ${n === 1 ? "enfermedad" : "enfermedades"}`, approved_tip: "Enfermedades del cluster con tratamiento aprobado (Open Targets)" },
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
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const col = (i: number) => data?.columns[i] ?? "";

  return (
    <section className="h-full overflow-auto bg-paper p-4 sm:p-6" aria-labelledby="cluster-table">
      <PanelHeader icon={Table2} id="cluster-table" title={c.title} subtitle={c.sub} info={data?.method ?? c.sub}
        actions={<a href={`${apiBase}/api/journey/clusters?l=${locale}&format=csv`} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink-2 hover:bg-paper-2 min-h-10"><Download size={15} aria-hidden />{c.csv}</a>} />
      {!data && <PanelState status={state.key === key && state.error ? "error" : "loading"} onRetry={() => setAttempt((a) => a + 1)} skeleton={4} className="mt-4" />}
      {data && (
        // QA-32: the unmet-need columns (Approved treatment?, Active trials) must be visible in the ~600 px atlas center
        // without horizontal scrolling. Compact numeric columns always; disease chips, variant effect and key people live
        // in a row expander, and come back as columns only when the container is wide (≥ 56rem, e.g. /plan/clusters).
        <div className="@container mt-4 rounded-xl border border-line">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-brand-mist text-left text-[11px] leading-tight text-ink-3">
              <tr>
                <th scope="col" className="w-8 px-2 py-2 font-medium">{c.rank}</th>
                <th scope="col" className="px-2 py-2 font-medium">{col(0)}</th>
                <th scope="col" className="w-[5.5rem] px-2 py-2 font-medium text-ink-2">{col(6)}</th>
                <th scope="col" className="w-[4.5rem] px-2 py-2 font-medium text-ink-2">{col(3)}</th>
                <th scope="col" className="hidden @md:table-cell w-[4.5rem] px-2 py-2 font-medium">{col(4)}</th>
                <th scope="col" className="hidden @md:table-cell w-[4.5rem] px-2 py-2 font-medium">{col(5)}</th>
                <th scope="col" className="hidden @4xl:table-cell w-44 px-2 py-2 font-medium">{col(2)}</th>
                <th scope="col" className="hidden @4xl:table-cell w-44 px-2 py-2 font-medium">{col(7)}</th>
              </tr>
            </thead>
            {data.rows.map((r) => {
              const isOpen = open.has(r.id);
              const chips = r.diseases.map((d) => {
                const cls = `chip !text-[11px] hover:bg-brand-soft ${d.approved ? "" : "!border-amber/60"}`;
                const tip = d.approved ? "" : c.no_approved;
                return onFocusDisease
                  ? <button key={d.id} onClick={(e) => { e.stopPropagation(); onFocusDisease(d.id); }} className={cls} title={tip}>{d.name}</button>
                  : <a key={d.id} href={href(d.id)} onClick={(e) => e.stopPropagation()} className={cls} title={tip}>{d.name}</a>;
              });
              return (
                <tbody key={r.id} className="border-t border-line">
                  <tr className={`align-top hover:bg-brand-mist/60 ${onFocusCluster ? "cursor-pointer" : ""}`} onClick={() => onFocusCluster?.(r.id)}>
                    <td className="px-2 py-2.5 tabular-nums text-ink-3">{r.rank}</td>
                    <td className="px-2 py-2.5">
                      <span className="flex items-start gap-2"><span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} aria-hidden /><span className="font-medium text-ink leading-snug">{r.label}</span></span>
                      <button type="button" aria-expanded={isOpen} aria-controls={`ct-${r.id}`} onClick={(e) => { e.stopPropagation(); toggle(r.id); }}
                        className="mt-1 ml-[1.125rem] inline-flex items-center gap-1 text-xs text-brand-deep hover:underline">
                        <ChevronDown size={13} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />{c.diseases(r.diseases.length)}
                      </button>
                      {/* Details live inside the Cluster cell, so the grid never changes with the container width. */}
                      {isOpen && (
                        <div id={`ct-${r.id}`} className="mt-2 ml-[1.125rem] text-xs" onClick={(e) => e.stopPropagation()}>
                          <span className="flex flex-wrap gap-1">{chips}</span>
                          <p className="mt-2 text-ink-2 @md:hidden"><span className="text-ink-3">{col(4)}: </span>{r.reusable_assets} · <span className="text-ink-3">{col(5)}: </span>{r.patient_groups}</p>
                          <p className="mt-1.5 text-ink-2 @4xl:hidden"><span className="text-ink-3">{col(2)}: </span>{r.variant_effect.text}</p>
                          <p className="mt-1 text-ink-2 @4xl:hidden"><span className="text-ink-3">{col(7)}: </span>{r.key_people.map((p) => p.name).join(" · ") || "—"}</p>
                        </div>
                      )}
                    </td>
                    <td className={`px-2 py-2.5 tabular-nums ${r.approved_diseases === 0 ? "text-amber font-semibold" : "text-ink"}`} title={c.approved_tip}>{r.approved_diseases} {c.of} {r.diseases.length}</td>
                    <td className="px-2 py-2.5 tabular-nums text-ink">{r.active_trials}</td>
                    <td className="hidden @md:table-cell px-2 py-2.5 tabular-nums">{r.reusable_assets}</td>
                    <td className="hidden @md:table-cell px-2 py-2.5 tabular-nums">{r.patient_groups}</td>
                    <td className="hidden @4xl:table-cell px-2 py-2.5 text-xs text-ink-2">{r.variant_effect.text}</td>
                    <td className="hidden @4xl:table-cell px-2 py-2.5 text-xs text-ink-2">{r.key_people.map((p) => p.name).join(" · ") || "—"}</td>
                  </tr>
                </tbody>
              );
            })}
          </table>
        </div>
      )}
      {data && <p className="mt-3 text-[11px] text-ink-3">{data.method}</p>}
    </section>
  );
}
