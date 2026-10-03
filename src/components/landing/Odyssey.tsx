"use client";
/**
 * The problem as a broken route: a tangle of wrong turns (the diagnostic odyssey), a diagnosis,
 * then a buffer stop and a dashed gap (no approved treatment). Exactly three sourced numbers.
 */
import { useCopy } from "@/lib/i18n";
import { copy } from "./copy";
import { External } from "./icons";
import { BufferStop, Station } from "./map";
import { Head, Section, wrap } from "./Section";

// Tangle from the first symptoms (x=14) to a confirmed diagnosis (x=414). 45° bends only.
const TANGLE =
  "M14 120 H90 L140 70 H220 L270 120 L230 160 H160 L120 120 L150 90 H300 L330 120 L360 90 L390 120 H414";
const TO_DEAD_END = "M414 120 H520 L560 80 H640 L680 120 H814";

export function Odyssey() {
  const t = useCopy(copy).odyssey;
  return (
    <Section id="odyssey" tone="panel">
      <div className={wrap}>
        <Head id="odyssey" title={t.title} lead={t.lead} />

        {/* wide: full route aligned with the three plaques */}
        <svg viewBox="0 0 1200 200" className="mt-12 hidden h-auto w-full md:block" role="img" aria-label={t.mapLabel}>
          <path d={TANGLE} className="route" stroke="var(--ink-2)" />
          <path d={TO_DEAD_END} className="route" stroke="var(--ink-2)" />
          <path d="M852 120 H1176" className="route route-gap" />
          <BufferStop x={834} y={120} />
          <Station x={14} y={120} r={10} />
          <Station x={414} y={120} r={10} color="var(--ink)" />
          <Station x={814} y={120} r={10} />
          <Station x={1184} y={120} r={9} gap />
        </svg>

        {/* compact: just the tangle, larger */}
        <svg viewBox="0 0 430 200" className="mt-10 h-auto w-full md:hidden" role="img" aria-label={t.mapLabel}>
          <path d={TANGLE} className="route" stroke="var(--ink-2)" />
          <Station x={14} y={120} r={10} />
          <Station x={414} y={120} r={10} color="var(--ink)" />
        </svg>

        <ol className="mt-6 grid gap-y-8 md:mt-4 md:grid-cols-3">
          {t.stats.map((s) => (
            <li key={s.n} className="border-t border-rule pt-6 md:border-t-0 md:pr-8 md:pt-0">
              <p className="font-display text-[clamp(2.75rem,5.2vw,4.25rem)] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
                {s.n}
              </p>
              <p className="mt-3 max-w-[26ch] text-lg text-ink-2">{s.t}</p>
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[0.8125rem] text-ink-3 underline decoration-rule hover:text-ink hover:decoration-ink"
              >
                {s.s}
                <External />
              </a>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
