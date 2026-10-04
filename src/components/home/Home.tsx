"use client";
/**
 * S0 · Home at /atlas without params (UX_WAVE4 §2 S0). One question — "Who are you?" — one search, and one
 * primary path: Maria's STXBP1 case. Picking a role re-arranges the cards (motion layout) and changes the
 * greeting; picking a disease opens the atlas with that role. Role + last disease persist per viewer.
 * OWNER: mvp-builder (src/components/home/**).
 */
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { BadgeCheck, ChevronRight, Footprints, Info, Languages, Search, X, type LucideIcon } from "lucide-react";
import type { PersonaId } from "@/lib/agents/profiles";
import type { SearchHit } from "@/lib/atlas/store";
import { dict, type Locale } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";
import { usePrefs } from "@/lib/prefs";
import { Logo } from "@/components/brand/Logo";
import { SearchBox } from "@/components/atlas/SearchBox";
import { api } from "@/components/atlas/api";
import { useEmbed } from "@/components/atlas/useEmbed";
import { EXAMPLES, homeCopy } from "./copy";
import { atlasHref, readMemory, writeMemory, type HomeMemory } from "./memory";
import { PendingHint, PendingStatus } from "./Pending";
import { RoleChooser } from "./RoleChooser";
import { HelpButton, Tour } from "./Tour";

const STEP_ICON: LucideIcon[] = [Search, Footprints, BadgeCheck];

/** `embed`: the server saw ?embed=1; inside any frame useEmbed() also turns it on after mount (Lovable has its own header). */
interface Props { initialLocale: Locale; stats: { diseases: number; sources: number }; maria: string; diseaseNames: Record<string, string>; embed?: boolean; changeRole?: boolean }

export function Home({ initialLocale, stats, maria, diseaseNames, embed: embedParam = false, changeRole = false }: Props) {
  const router = useRouter();
  const embed = useEmbed() || embedParam;
  const [pending, startTransition] = useTransition();
  const { prefs } = usePrefs();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [role, setRole] = useState<PersonaId | null>(null);
  const [memory, setMemory] = useState<HomeMemory>({});
  const [exampleMiss, setExampleMiss] = useState<string | null>(null);
  const c = homeCopy[locale];
  const t = dict[locale];

  // Hydrate the remembered role after mount (the server renders "no role"), deferred like PrefsProvider.
  useEffect(() => {
    const id = requestAnimationFrame(() => { const m = readMemory(); setMemory(m); if (m.role) setRole(m.role); });
    return () => cancelAnimationFrame(id);
  }, []);
  // QA-39: the challenge is the most clicked path — have it ready before the click.
  useEffect(() => { router.prefetch(atlasHref({ p: role ?? "maria", d: maria, mode: "challenge", l: locale })); }, [router, maria, locale, role]);

  const pickRole = (p: PersonaId) => { setRole(p); writeMemory({ role: p }); };
  const open = (d: string, c?: string) => {
    const p = role ?? "maria";
    writeMemory({ role: p, disease: d });
    startTransition(() => router.push(atlasHref({ p, d, c, l: locale })));
  };
  // Every hit carries the disease that opens the graph (a mechanism cluster: its lead disease + the cluster id).
  const onPick = (h: SearchHit) => { if (h.disease) open(h.disease, (h.type as string) === "cluster" ? h.id : undefined); };
  const tryExample = async (q: string) => {
    setExampleMiss(null);
    try {
      const j = (await fetch(api(`/api/atlas/search?q=${encodeURIComponent(q)}&l=${locale}`)).then((r) => r.json())) as { hits: SearchHit[] };
      const h = j.hits.find((x) => x.disease);
      if (h) onPick(h); else setExampleMiss(q);
    } catch { setExampleMiss(q); }
  };
    // Welcome back only for a disease still in the atlas; its name comes from the server, never from storage.
  const resumeName = memory.disease ? diseaseNames[memory.disease] : undefined;

  return (
    <MotionConfig reducedMotion={prefs.reduceMotion ? "always" : "user"}>
      <div className="relative min-h-dvh overflow-x-hidden bg-[radial-gradient(ellipse_at_20%_0%,var(--paper)_0%,var(--brand-mist)_60%,var(--brand-soft)_100%)] text-ink">
        {/* Decorative Blender helix, right side (UX_WAVE4 S0). */}
        <Image src="/models/nexmed-hero.png" alt="" aria-hidden width={720} height={720} priority
          className="pointer-events-none select-none absolute -right-40 top-10 w-[560px] md:w-[720px] max-w-none opacity-15" />

        {!embed && <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link href="/" className="rounded-lg" aria-label={`${homeLabel(locale)}`}><Logo size="sm" /></Link>
          <span className="flex-1" />
          <HelpButton label={c.help} />
          <button type="button" onClick={() => setLocale(locale === "en" ? "es" : "en")} aria-label={c.lang_aria}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-paper/80 px-3 text-sm font-medium text-ink-2 hover:bg-brand-soft">
            <Languages aria-hidden size={18} strokeWidth={1.75} />{locale === "en" ? "ES" : "EN"}
          </button>
        </header>}

        <main className="relative z-10 mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          {/* Hero + search */}
          <section className={`mx-auto max-w-3xl text-center ${embed ? "pt-6" : "pt-8 md:pt-14"}`}>
            <h1 className="serif text-[2rem] leading-tight text-brand-ink md:text-[2.5rem]">{c.title}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-ink-2 md:text-lg">{c.lead}</p>
            <div className="mx-auto mt-7 max-w-2xl text-left"><SearchBox t={t} locale={locale} onPick={onPick} /></div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm" role="group" aria-label={c.example_label}>
              <span className="text-ink-3">{c.try_label}</span>
              {EXAMPLES.map((q) => (
                <button key={q} type="button" onClick={() => void tryExample(q)} className="chip min-h-8 hover:border-brand hover:text-brand-deep">{q}</button>
              ))}
            </div>
            {exampleMiss && <p role="status" className="mt-2 text-sm text-amber">{c.example_none(exampleMiss)}</p>}
            <PendingStatus pending={pending} label={c.opening} />
          </section>

          {/* Welcome back */}
          <AnimatePresence>
            {resumeName && memory.disease && (
              <motion.div initial={{ opacity: 0, y: motionTokens.distance.sm }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={springs.gentle}
                className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-paper/90 p-3 pl-4 shadow-[var(--shadow-soft)]">
                <span className="min-w-[10rem] flex-1 text-sm text-ink-2"><span className="font-semibold text-ink">{c.welcome_back}</span> · {resumeName}</span>
                <Link href={atlasHref({ p: memory.role ?? "maria", d: memory.disease, l: locale })}
                  className="inline-flex min-h-10 min-w-0 max-w-full items-center gap-1 rounded-full bg-brand-deep px-4 text-sm font-semibold text-paper hover:bg-brand-ink">
                  <span className="truncate">{c.continue_with(resumeName)}</span><ChevronRight aria-hidden size={16} /><PendingHint label={c.opening} />
                </Link>
                <button type="button" aria-label={c.dismiss} onClick={() => { writeMemory({ disease: undefined }); setMemory((m) => ({ ...m, disease: undefined })); }}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-brand-soft"><X aria-hidden size={18} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Who are you? */}
          <section className="mt-12" aria-labelledby="who-title">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id="who-title" className="serif text-2xl text-brand-ink">{c.who}</h2>
              <span className="text-sm text-ink-3">{c.who_hint}</span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={role ?? "none"} aria-live="polite" className="mt-1 min-h-6 text-ink-2"
                initial={{ opacity: 0, y: motionTokens.distance.xs }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: motionTokens.duration.fast }}>
                {role ? c.roles[role].greeting : c.greeting_default}
              </motion.p>
            </AnimatePresence>
            <RoleChooser locale={locale} role={role} onPick={pickRole} maria={maria} initialChoosing={changeRole}
              onStart={(mode) => writeMemory(mode === "challenge" ? { role: role ?? "maria", disease: maria } : { role: role ?? "maria" })} />
          </section>

          {/* 3-step strip */}
          <section className="mt-12" aria-label={c.steps_label}>
            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-0">
              {c.steps.map((s, i) => {
                const Icon = STEP_ICON[i];
                return (
                  <li key={s} className="relative flex items-center gap-3 rounded-2xl border border-line bg-paper/90 px-3 py-2.5 sm:flex-col sm:gap-2 sm:border-0 sm:bg-transparent sm:px-4 sm:text-center">
                    {i > 0 && <span aria-hidden className="absolute right-[calc(50%+1.75rem)] top-5 hidden h-px w-[calc(100%-3.5rem)] bg-line sm:block" />}
                    <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-deep"><Icon aria-hidden size={20} strokeWidth={1.75} /></span>
                    <span className="text-sm text-ink-2"><span className="mr-1 font-semibold text-ink">{i + 1}</span>{s}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <p className="mt-10 flex items-center justify-center gap-1.5 text-center text-xs text-ink-3">
            <Info aria-hidden size={14} strokeWidth={1.75} />{c.footer(stats.diseases, stats.sources)}
          </p>
        </main>
        <Tour locale={locale} />
      </div>
    </MotionConfig>
  );
}

function homeLabel(l: Locale) { return l === "es" ? "Inicio de Nedamex" : "Nedamex home"; }
