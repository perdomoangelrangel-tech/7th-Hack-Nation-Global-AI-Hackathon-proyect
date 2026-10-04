/**
 * S7 · No supported route (UX_WAVE4 §2 S7) — the honest failure the challenge asks for. Server component.
 * Says what we searched (the real sources and when we read them), what is missing, the closest name matches
 * (labelled weak — never evidence) and how to change it (prefilled GitHub issues: real, never a dead click).
 * Route: /atlas?q=<text> when <text> resolves to nothing (src/app/atlas/page.tsx).
 */
import Link from "next/link";
import { ArrowLeft, Check, CircleDashed, ExternalLink, FilePlus2, Info, Users } from "lucide-react";
import type { PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";
import { site } from "@/lib/site";
import { Logo } from "@/components/brand/Logo";
import { noRouteCopy } from "./copy";
import { EmbedHidden } from "./EmbedHidden";
import { atlasHref } from "./memory";

export interface Lead { word: string; hit: string; disease: string; diseaseName: string }
interface Props { query: string; locale: Locale; persona: PersonaId; sources: { id: string; name: string; last_synced_at?: string | null }[]; leads: Lead[]; embed?: boolean }

function issueUrl({ title, body }: { title: string; body: string }) {
  return `${site.github.replace(/\/$/, "")}/issues/new?${new URLSearchParams({ title, body }).toString()}`;
}

export function NoRoute({ query, locale, persona, sources, leads, embed = false }: Props) {
  const c = noRouteCopy[locale];
  const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", { day: "numeric", month: "short", year: "numeric" }) : null);
  const homeHref = `/atlas?${new URLSearchParams({ ...(locale === "es" ? { l: "es" } : {}), ...(embed ? { embed: "1" } : {}) }).toString()}`.replace(/\?$/, "");
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_20%_0%,var(--paper)_0%,var(--brand-mist)_60%,var(--brand-soft)_100%)] text-ink">
      <EmbedHidden embed={embed}>
        <header className="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-6">
          <Link href={homeHref} className="rounded-lg" aria-label={locale === "es" ? "Inicio de Nedamex" : "Nedamex home"}><Logo size="sm" /></Link>
        </header>
      </EmbedHidden>
      <main className="mx-auto max-w-3xl px-4 pb-12 sm:px-6">
        <section className="rounded-[var(--radius)] border border-dashed border-amber/50 bg-paper p-5 shadow-[var(--shadow-soft)] sm:p-7" aria-labelledby="noroute-title">
          <div className="flex items-start gap-3">
            <CircleDashed aria-hidden size={28} strokeWidth={1.75} className="mt-0.5 shrink-0 text-amber" />
            <h1 id="noroute-title" className="serif text-2xl leading-snug text-brand-ink sm:text-[1.75rem]">{c.title(query)}</h1>
          </div>

          <dl className="mt-6 space-y-6">
            <div>
              <dt className="eyebrow">{c.searched}</dt>
              <dd className="mt-2">
                <ul className="flex flex-wrap gap-2">
                  {sources.map((s) => (
                    <li key={s.id} className="chip" title={s.last_synced_at ? `${c.synced} ${day(s.last_synced_at)}` : undefined}>
                      <Check aria-hidden size={14} className="text-brand-deep" />{s.name}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-ink-3">{c.searched_tail(sources.length)}</p>
              </dd>
            </div>

            <div>
              <dt className="eyebrow">{c.missing}</dt>
              <dd className="mt-2">
                <ul className="space-y-1.5 text-[15px] text-ink-2">
                  {c.missing_items(query).map((m) => <li key={m} className="no-evidence rounded-r-lg px-3 py-1.5">{m}</li>)}
                </ul>
              </dd>
            </div>

            <div>
              <dt className="eyebrow">{c.leads}</dt>
              <dd className="mt-2">
                {leads.length ? (
                  <>
                    <ul className="space-y-2">
                      {leads.map((l) => (
                        <li key={l.disease + l.word} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-paper-2 px-3 py-2">
                          <span className="chip !border-amber/40 !text-amber">{c.lead_label}</span>
                          <span className="min-w-0 flex-1 text-[15px] text-ink-2">{c.lead_line(l.word, l.hit, l.diseaseName)}</span>
                          <Link href={atlasHref({ p: persona, d: l.disease, l: locale })} className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium text-brand-deep hover:bg-brand-soft">{c.open_lead} →</Link>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3"><Info aria-hidden size={14} />{c.leads_note}</p>
                  </>
                ) : <p className="text-[15px] text-ink-3">{c.no_leads}</p>}
              </dd>
            </div>

            <div>
              <dt className="eyebrow">{c.change}</dt>
              <dd className="mt-3 flex flex-wrap gap-2">
                <a href={issueUrl(c.issue_evidence(query))} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-deep px-4 text-sm font-semibold text-paper hover:bg-brand-ink">
                  <FilePlus2 aria-hidden size={18} strokeWidth={1.75} />{c.add_evidence}<ExternalLink aria-hidden size={14} /><span className="sr-only">({c.opens_github})</span>
                </a>
                <a href={issueUrl(c.issue_group(query))} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-ink-2 hover:bg-brand-soft">
                  <Users aria-hidden size={18} strokeWidth={1.75} />{c.tell_group}<ExternalLink aria-hidden size={14} /><span className="sr-only">({c.opens_github})</span>
                </a>
              </dd>
            </div>
          </dl>
        </section>
        <Link href={homeHref} className="mt-6 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-brand-deep hover:bg-brand-soft">
          <ArrowLeft aria-hidden size={16} />{c.back}
        </Link>
      </main>
    </div>
  );
}
