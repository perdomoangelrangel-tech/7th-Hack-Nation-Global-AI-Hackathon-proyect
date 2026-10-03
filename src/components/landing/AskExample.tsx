"use client";
/**
 * A static, labelled example of one answer: the question, two sourced stations with plaques
 * (source · id · date) and one gap station the verifier dropped. IDs used: ORPHA:778 (Rett), MECP2.
 */
import { useCopy } from "@/lib/i18n";
import { copy, type LineKey } from "./copy";
import { Mic } from "./icons";
import { Head, Section, wrap } from "./Section";

const SEG: Record<string, string> = { treat: "bg-treat", gene: "bg-gene", trial: "bg-trial", comm: "bg-comm", pheno: "bg-pheno", lit: "bg-lit" };

export function AskExample() {
  const t = useCopy(copy).ask;
  return (
    <Section id="ask" tone="panel">
      <div className={`${wrap} grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16`}>
        <Head id="ask" title={t.title} lead={t.lead} />

        <figure className="relative m-0 rounded-panel-lg border border-rule bg-canvas p-5 sm:p-8">
          <p className="absolute right-5 top-5 font-mono text-[0.8125rem] text-ink-3 sm:right-8 sm:top-8">{t.example}</p>

          <p className="flex items-center gap-2 pr-20 text-[0.9375rem] text-ink-3">
            <Mic />
            {t.asker}
          </p>
          <blockquote className="mt-3 font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-bold leading-tight tracking-[-0.015em]">
            {t.question}
          </blockquote>

          <ol className="mt-8">
            {t.claims.map((c) => (
              <li key={c.text} className="relative pb-8 pl-12">
                <span aria-hidden className={`absolute bottom-0 left-[14px] top-0 w-[7px] ${SEG[c.line as LineKey]}`} />
                <span aria-hidden className={`absolute left-[6px] top-[2px] size-[23px] rounded-full border-[2.5px] border-ink ${SEG[c.line as LineKey]}`} />
                <p className="text-lg font-semibold leading-snug">{c.text}</p>
                <p className="plaque mt-2 inline-flex flex-wrap gap-x-2 px-2.5 py-1 font-mono text-[0.8125rem] text-ink-2">
                  <span>{c.source}</span>
                  <span aria-hidden>·</span>
                  <span>{c.id}</span>
                  <span aria-hidden>·</span>
                  <span>{c.date}</span>
                </p>
              </li>
            ))}
            <li className="relative pl-12">
              <span aria-hidden className="absolute left-[15px] top-[-2px] h-[14px] border-l-[5px] border-dashed border-gap" />
              <span aria-hidden className="absolute left-[6px] top-[2px] size-[23px] rounded-full border-[2.5px] border-dashed border-gap bg-canvas" />
              <p className="text-lg leading-snug text-ink-3 line-through decoration-gap decoration-2">{t.dropped.text}</p>
              <p className="mt-2 font-mono text-[0.8125rem] text-t-gene">{t.dropped.reason}</p>
            </li>
          </ol>

          <figcaption className="mt-8 border-t border-rule pt-4 text-[0.9375rem] text-ink-3">{t.disclaimer}</figcaption>
        </figure>
      </div>
    </Section>
  );
}
