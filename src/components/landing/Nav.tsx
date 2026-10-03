"use client";
import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { LangToggle, useCopy } from "@/lib/i18n";
import { copy } from "./copy";

export function Nav() {
  const t = useCopy(copy).nav;
  const links = [
    { href: "#how", label: t.how },
    { href: "#riders", label: t.riders },
    { href: "#fares", label: t.fares },
    { href: "#videos", label: t.videos },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:font-display focus:font-bold focus:text-on-ink"
      >
        {t.skip}
      </a>
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Link href="/" aria-label={t.home} className="inline-flex min-h-11 items-center rounded-md">
          <span className="sm:hidden"><LogoMark size={30} title="" /></span>
          <span className="hidden sm:inline-flex"><Logo /></span>
        </Link>
        <nav aria-label={t.sections} className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="inline-flex min-h-11 items-center rounded-full px-3.5 font-display text-[0.95rem] font-semibold text-ink-2 transition-colors hover:bg-panel hover:text-ink"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <LangToggle className="ml-auto lg:ml-3" />
        <Link href="/atlas" className="btn btn-primary min-h-11! px-4! text-[0.95rem]">
          {t.open}
        </Link>
      </div>
    </header>
  );
}
