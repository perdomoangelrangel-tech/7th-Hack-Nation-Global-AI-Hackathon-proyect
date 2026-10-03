"use client";
/** Team as one line of hollow stations: honest placeholders until real names are confirmed. */
import { useCopy } from "@/lib/i18n";
import { copy } from "./copy";
import { Head, Section, wrap } from "./Section";

export function Team() {
  const t = useCopy(copy).team;
  return (
    <Section id="team">
      <div className={wrap}>
        <Head id="team" title={t.title} lead={t.lead} />
        <div className="relative mt-12 md:mt-16">
          <span
            aria-hidden
            className="absolute bottom-3 left-[9px] top-3 border-l-[5px] border-dashed border-gap md:bottom-auto md:left-0 md:right-0 md:top-[18px] md:border-l-0 md:border-t-[5px]"
          />
          <ul className="relative flex flex-col gap-6 md:flex-row md:justify-between">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-4 md:w-[13rem] md:flex-col md:items-start md:gap-4">
                <span aria-hidden className="size-6 shrink-0 rounded-full border-[2.5px] border-dashed border-gap bg-canvas md:mt-[8px]" />
                <span className="font-mono text-[0.9375rem] text-ink-2">{t.slot}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
