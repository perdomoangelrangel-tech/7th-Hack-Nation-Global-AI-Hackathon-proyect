"use client";
import { Logo } from "@/components/brand/Logo";
import { site } from "@/lib/site";
import { useCopy } from "@/lib/i18n";
import { copy } from "./copy";
import { GitHubMark } from "./icons";
import { wrap } from "./Section";

export function Footer() {
  const t = useCopy(copy).footer;
  return (
    <footer className="border-t border-rule bg-panel">
      <div className={`${wrap} grid gap-8 py-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-end`}>
        <div>
          <Logo />
          <p className="mt-4 max-w-[60ch] text-[0.9375rem] text-ink-2">{site.challenge}</p>
          <p className="mt-4 font-display font-bold">{t.notAdvice}</p>
          <p className="font-display font-bold">{t.noSell}</p>
        </div>
        <a
          href={site.github}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost w-fit"
        >
          <GitHubMark />
          {t.github}
        </a>
      </div>
    </footer>
  );
}
