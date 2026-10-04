/**
 * Shared layout for the legal pages (/terms, /security). Plain, readable, light. OWNER: brand lane.
 */
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { site } from "@/lib/site";

export type LegalSection = { title: string; paragraphs?: string[]; bullets?: string[] };

export function LegalPage({ eyebrow, title, updated, intro, sections, outro }: {
  eyebrow: string; title: string; updated: string; intro?: string; sections: LegalSection[]; outro?: string;
}) {
  return (
    <>
      <Nav />
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display mt-2 text-4xl font-semibold text-brand-ink sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-ink-3">Last updated: {updated} · Prototype built at Hack-Nation 7 (Challenge 05)</p>
        {intro && <p className="mt-8 text-lg leading-relaxed text-ink-2">{intro}</p>}
        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={s.title} aria-labelledby={`legal-${i}`}>
              <h2 id={`legal-${i}`} className="display text-2xl font-semibold text-brand-ink">{s.title}</h2>
              {s.paragraphs?.map((p) => <p key={p.slice(0, 40)} className="mt-3 leading-relaxed text-ink-2">{p}</p>)}
              {s.bullets && (
                <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed text-ink-2">
                  {s.bullets.map((b) => <li key={b.slice(0, 40)}>{b}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
        {outro && <p className="mt-12 border-t border-line pt-6 text-sm text-ink-3">{outro}</p>}
      </main>
      <footer className="border-t border-line bg-paper">
        <p className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-ink-3 sm:px-6">
          © {new Date().getFullYear()} {site.company} · <Link href="/" className="hover:underline">Home</Link> · <Link href="/terms" className="hover:underline">Terms of Use</Link> · <Link href="/security" className="hover:underline">Security &amp; Privacy</Link> · Not medical advice.
        </p>
      </footer>
    </>
  );
}
