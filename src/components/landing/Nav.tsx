import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { site } from "@/lib/site";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#modes", label: "Modes" },
  { href: "#evidence", label: "Evidence" },
  { href: "#guide", label: "Voice guide" },
  { href: "#videos", label: "Videos" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 chip">Skip to content</a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={`${site.name} home`}><Logo size="sm" /></Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm text-ink-2">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hidden rounded-full px-3 py-1.5 hover:bg-brand-mist hover:text-brand-ink md:inline-block">{l.label}</a>
          ))}
          <a href={site.github} target="_blank" rel="noreferrer" className="hidden rounded-full px-3 py-1.5 hover:bg-brand-mist hover:text-brand-ink sm:inline-block">GitHub</a>
          <a href={site.programUrl} className="ml-1 rounded-full bg-brand-deep px-4 py-2 font-semibold text-white shadow-sm hover:bg-brand-ink">Open {site.name}</a>
        </nav>
      </div>
    </header>
  );
}
