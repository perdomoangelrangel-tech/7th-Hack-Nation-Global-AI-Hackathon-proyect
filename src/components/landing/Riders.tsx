"use client";
/**
 * Three riders as three parallel lines leaving one interchange (the shared graph).
 * Wide: horizontal lines with stops; compact: each rider's line runs down the page.
 */
import { useCopy } from "@/lib/i18n";
import { copy } from "./copy";
import { Head, Section, wrap } from "./Section";

const STYLE: Record<string, { line: string; fare: string }> = {
  families: { line: "bg-treat", fare: "text-t-treat" },
  clinicians: { line: "bg-trial", fare: "text-t-trial" },
  research: { line: "bg-comm", fare: "text-t-comm" },
};

export function Riders() {
  const t = useCopy(copy).riders;
  return (
    <Section id="riders">
      <div className={wrap}>
        <Head id="riders" title={t.title} lead={t.lead} />

        <div className="relative mt-14 md:mt-20">
          {/* interchange shared by the three lines (wide only) */}
          <div aria-hidden className="absolute left-[208px] top-[4px] hidden h-[308px] w-[34px] rounded-full border-[5px] border-ink bg-canvas md:block lg:left-[248px]" />
          <p aria-hidden className="absolute -top-8 left-[200px] hidden font-mono text-[0.8125rem] text-ink-3 md:block lg:left-[240px]">{t.graph}</p>

          <ul className="space-y-12 md:space-y-0">
            {t.list.map((r) => {
              const s = STYLE[r.key];
              return (
                <li key={r.key} className="grid gap-5 md:h-[136px] md:grid-cols-[224px_minmax(0,1fr)] md:gap-0 lg:grid-cols-[264px_minmax(0,1fr)]">
                  <div className="md:pt-1">
                    <h3 className="text-2xl">{r.name}</h3>
                    <p className={`mt-1.5 font-mono text-[0.9375rem] font-semibold ${s.fare}`}>{r.fare}</p>
                    {r.persona ? <p className="mt-1 font-mono text-[0.8125rem] text-ink-3">{r.persona}</p> : null}
                  </div>
                  <div className="relative">
                    <span
                      aria-hidden
                      className={`absolute bottom-3 left-[8px] top-3 w-[7px] rounded-full md:bottom-auto md:left-0 md:right-0 md:top-[19px] md:h-[7px] md:w-auto ${s.line}`}
                    />
                    <ol className="relative flex flex-col gap-5 md:flex-row md:justify-between md:gap-6 md:pl-14">
                      {r.stops.map((stop) => (
                        <li key={stop} className="flex items-start gap-3 md:w-[10.5rem] md:flex-col md:gap-3 lg:w-[12rem]">
                          <span aria-hidden className="size-[23px] shrink-0 rounded-full border-[2.5px] border-ink bg-canvas md:mt-[11px]" />
                          <span className="text-[1.0625rem] leading-snug">{stop}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Section>
  );
}
