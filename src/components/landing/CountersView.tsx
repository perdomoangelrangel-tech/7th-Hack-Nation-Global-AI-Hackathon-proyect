"use client";
/** Live graph counters as a signage strip. Only rendered with real numbers from `graph_stats`. */
import { useCopy, useLang } from "@/lib/i18n";
import { copy } from "./copy";

export type GraphStats = {
  entities: number;
  edges: number;
  evidence: number;
  diseases: number;
  trials: number;
  treatments: number;
  sources_used: number;
  last_retrieved_at: string | null;
};

const ORDER = ["diseases", "entities", "edges", "evidence", "treatments", "trials", "sources_used"] as const;

export function CountersView({ stats }: { stats: GraphStats }) {
  const { lang } = useLang();
  const t = useCopy(copy).scale;
  const fmt = new Intl.NumberFormat(lang === "es" ? "es-MX" : "en-US");
  return (
    <div className="mt-16 rounded-panel-lg border border-rule bg-panel p-5 sm:p-7">
      <p className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="font-display text-xl font-extrabold">{t.live}</span>
        {stats.last_retrieved_at ? (
          <span className="font-mono text-[0.8125rem] text-ink-2">
            {t.updated} · <time dateTime={stats.last_retrieved_at}>{stats.last_retrieved_at.slice(0, 10)}</time>
          </span>
        ) : null}
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 lg:grid-cols-7">
        {ORDER.map((k) => (
          <div key={k} className="flex flex-col-reverse border-t border-rule pt-3">
            <dt className="mt-1 text-[0.9375rem] text-ink-2">{t.counters[k]}</dt>
            <dd className="font-mono text-2xl font-semibold tabular-nums sm:text-[1.75rem]">{fmt.format(stats[k])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
