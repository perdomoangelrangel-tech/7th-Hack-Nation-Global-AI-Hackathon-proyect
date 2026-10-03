"use client";
/**
 * Business model as a station fare board. Prices are a hypothesis and say so.
 * Why they pay: two sourced numbers (Emmes 2024). Ethics: never sell data, contact only with consent.
 */
import { useCopy } from "@/lib/i18n";
import { copy, SRC } from "./copy";
import { External, Lock } from "./icons";
import { Head, Section, wrap } from "./Section";

const DOT: Record<string, string> = { treat: "bg-treat", pheno: "bg-pheno", trial: "bg-trial", comm: "bg-comm", gene: "bg-gene", lit: "bg-lit" };

export function Fares() {
  const t = useCopy(copy).fares;
  return (
    <Section id="fares" tone="panel">
      <div className={wrap}>
        <Head id="fares" title={t.title} lead={t.lead} />

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
          {/* the board */}
          <div className="rounded-panel-lg bg-ink p-5 text-on-ink sm:p-8 lg:self-start">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-on-ink/25 pb-4">
              <h3 className="text-[1.75rem] uppercase tracking-[0.04em]!">{t.board}</h3>
              <p className="font-mono text-[0.8125rem] text-on-ink/80">{t.hypothesis}</p>
            </div>
            <dl>
              {t.rows.map((r) => (
                <div key={r.who} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-on-ink/15 py-4 last:border-b-0 last:pb-0">
                  <dt className="flex items-center gap-3 font-display text-lg font-bold sm:text-xl">
                    <span aria-hidden className={`size-4 shrink-0 rounded-full ring-2 ring-on-ink ${DOT[r.line]}`} />
                    {r.who}
                  </dt>
                  <span aria-hidden className="hidden min-w-6 flex-1 -translate-y-1 border-b-2 border-dotted border-on-ink/35 sm:block" />
                  <dd className="w-full pl-7 font-mono text-base tabular-nums sm:w-auto sm:pl-0 sm:text-lg">{r.fare}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* why they pay + ethics */}
          <div className="flex flex-col">
            <h3 className="text-2xl">{t.whyTitle}</h3>
            <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
              {t.why.map((w) => (
                <div key={w.n} className="border-t border-rule pt-4">
                  <dt className="font-display text-[clamp(2.25rem,4vw,3.25rem)] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{w.n}</dt>
                  <dd className="mt-2 max-w-[30ch] text-lg text-ink-2">{w.t}</dd>
                </div>
              ))}
            </dl>
            <a
              href={SRC.emmes}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex min-h-11 w-fit items-center gap-1.5 text-[0.8125rem] text-ink-3 underline decoration-rule hover:text-ink hover:decoration-ink"
            >
              {t.whySource}
              <External />
            </a>
            <ul className="mt-6 space-y-3 border-t border-rule pt-6">
              {t.ethics.map((e) => (
                <li key={e} className="flex items-start gap-3 font-display text-lg font-bold leading-snug">
                  <Lock className="mt-0.5 shrink-0 text-t-treat" />
                  {e}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}
