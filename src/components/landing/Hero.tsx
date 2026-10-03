"use client";
import Link from "next/link";
import { site } from "@/lib/site";
import { useCopy, useLang } from "@/lib/i18n";
import { copy } from "./copy";
import { HeroMap } from "./HeroMap";
import { ArrowDown, ArrowRight } from "./icons";
import { wrap } from "./Section";

/** Break the tagline after its comma: "Rare disease," / "mapped." */
function Tagline({ text }: { text: string }) {
  const i = text.indexOf(", ");
  if (i < 0) return <>{text}</>;
  return (
    <>
      <span className="block">{text.slice(0, i + 1)}</span>
      <span className="block">{text.slice(i + 2)}</span>
    </>
  );
}

export function Hero() {
  const { lang } = useLang();
  const t = useCopy(copy).hero;
  return (
    <section aria-labelledby="hero-title" className="bg-canvas">
      <div
        className={`${wrap} grid items-center gap-10 pb-14 pt-10 sm:pt-14 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8 lg:py-12`}
      >
        <div className="@container max-w-xl">
          <h1 id="hero-title" className="text-[clamp(2.75rem,14cqw,5.25rem)]">
            <Tagline text={site.tagline[lang]} />
          </h1>
          <p className="mt-6 max-w-[30ch] text-xl text-ink-2 sm:text-[1.375rem] sm:leading-snug">{site.promise[lang]}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/atlas" className="btn btn-primary max-sm:w-full max-sm:justify-center">
              {t.ctaMap}
              <ArrowRight />
            </Link>
            <a href="#videos" className="btn btn-ghost max-sm:w-full max-sm:justify-center">
              {t.ctaDemo}
              <ArrowDown />
            </a>
          </div>
        </div>
        <HeroMap />
      </div>
    </section>
  );
}
