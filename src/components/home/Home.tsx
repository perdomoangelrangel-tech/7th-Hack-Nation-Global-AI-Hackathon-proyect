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
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import { BadgeCheck, Check, ChevronRight, Footprints, HeartHandshake, Info, Languages, Microscope, Play, Search, Target, UserRound, X, type LucideIcon } from "lucide-react";
import type { PersonaId } from "@/lib/agents/profiles";
import type { SearchHit } from "@/lib/atlas/store";
import { dict, type Locale } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";
import { usePrefs } from "@/lib/prefs";
import { Logo } from "@/components/brand/Logo";
import { SearchBox } from "@/components/atlas/SearchBox";
import { api } from "@/components/atlas/api";
import { EXAMPLES, ROLE_ORDER, homeCopy } from "./copy";
import { atlasHref, readMemory, writeMemory, type HomeMemory } from "./memory";

const ROLE_ICON: Record<PersonaId, LucideIcon> = { devon: UserRound, maria: HeartHandshake, osei: Microscope, priya: Target };
const STEP_ICON: LucideIcon[] = [Search, Footprints, BadgeCheck];

interface Props { initialLocale: Locale; stats: { diseases: number; sources: number }; maria: string; diseaseNames: Record<string, string> }

export function Home({ initialLocale, stats, maria, diseaseNames }: Props) {
  const router = useRouter();
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

  const pickRole = (p: PersonaId) => { setRole(p); writeMemory({ role: p }); };
  const open = (d: string) => {
    const p = role ?? "maria";
    writeMemory({ role: p, disease: d });
    router.push(atlasHref({ p, d, l: locale }));
  };
  const onPick = (h: SearchHit) => { if (h.disease) open(h.disease); };
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

        <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link href="/" className="rounded-lg" aria-label={`${homeLabel(locale)}`}><Logo size="sm" /></Link>
          <span className="flex-1" />
          <button type="button" onClick={() => setLocale(locale === "en" ? "es" : "en")} aria-label={c.lang_aria}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-paper/80 px-3 text-sm font-medium text-ink-2 hover:bg-brand-soft">
            <Languages aria-hidden size={18} strokeWidth={1.75} />{locale === "en" ? "ES" : "EN"}
          </button>
        </header>

        <main className="relative z-10 mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          {/* Hero + search */}
          <section className="mx-auto max-w-3xl pt-8 text-center md:pt-14">
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
          </section>

          {/* Welcome back */}
          <AnimatePresence>
            {resumeName && memory.disease && (
              <motion.div initial={{ opacity: 0, y: motionTokens.distance.sm }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={springs.gentle}
                className="mx-auto mt-8 flex max-w-2xl items-center gap-3 rounded-2xl border border-line bg-paper/90 p-3 pl-4 shadow-[var(--shadow-soft)]">
                <span className="min-w-0 flex-1 text-sm text-ink-2"><span className="font-semibold text-ink">{c.welcome_back}</span> · {resumeName}</span>
                <Link href={atlasHref({ p: memory.role ?? "maria", d: memory.disease, l: locale })}
                  className="inline-flex min-h-10 items-center gap-1 rounded-full bg-brand-deep px-4 text-sm font-semibold text-paper hover:bg-brand-ink">
                  {c.continue_with(resumeName)}<ChevronRight aria-hidden size={16} />
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
            <RoleCards locale={locale} role={role} onPick={pickRole} />
            <AnimatePresence>
              {role && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 text-right">
                  <Link href={atlasHref({ p: role, l: locale })} className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-medium text-brand-deep hover:bg-brand-soft">
                    {c.explore_as(c.roles[role].persona.replace(/^(e\.g\.|p\. ej\.)\s*/, ""))}<ChevronRight aria-hidden size={16} />
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Primary path: Maria's case */}
          <div className="mt-8 flex justify-center">
            <Link href={atlasHref({ p: "maria", d: maria, l: locale })} aria-label={c.maria_aria}
              onClick={() => writeMemory({ role: "maria", disease: maria })}
              className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-brand-deep px-6 text-base font-semibold text-paper shadow-[var(--shadow-soft)] transition-colors hover:bg-brand-ink">
              <Play aria-hidden size={18} strokeWidth={2} fill="currentColor" />{c.maria_cta}
            </Link>
          </div>

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
      </div>
    </MotionConfig>
  );
}

function homeLabel(l: Locale) { return l === "es" ? "Inicio de Nedamex" : "Nedamex home"; }

/** 4 big role cards as one radiogroup (arrows move + select). Selected card is lifted and outlined. */
function RoleCards({ locale, role, onPick }: { locale: Locale; role: PersonaId | null; onPick: (p: PersonaId) => void }) {
  const c = homeCopy[locale];
  const refs = useRef<Partial<Record<PersonaId, HTMLButtonElement | null>>>({});
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = ROLE_ORDER[(i + d + ROLE_ORDER.length) % ROLE_ORDER.length];
    onPick(next); refs.current[next]?.focus();
  };
  return (
    <LayoutGroup>
      <div role="radiogroup" aria-labelledby="who-title" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLE_ORDER.map((id, i) => {
          const r = c.roles[id];
          const Icon = ROLE_ICON[id];
          const on = role === id;
          return (
            <motion.button layout key={id} ref={(el) => { refs.current[id] = el; }} type="button" role="radio" aria-checked={on}
              tabIndex={on || (!role && i === 0) ? 0 : -1} onClick={() => onPick(id)} onKeyDown={(e) => onKey(e, i)}
              transition={springs.snappy} whileTap={{ scale: motionTokens.scale.subtle }}
              className={`relative flex flex-col rounded-[var(--radius)] border bg-paper p-4 sm:p-5 text-left shadow-[var(--shadow-soft)] transition-colors ${on ? "border-brand-deep ring-2 ring-brand/30" : "border-line hover:border-brand-light"}`}>
              <span className="flex items-start gap-3 sm:flex-col sm:gap-0">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-colors ${on ? "bg-brand-deep text-paper" : "bg-brand-soft text-brand-deep"}`}><Icon aria-hidden size={24} strokeWidth={1.75} /></span>
                <span className="min-w-0 sm:mt-4">
                  <span className="block text-lg font-semibold leading-snug text-ink">{r.title}</span>
                  <span className="block text-sm text-ink-3">{r.persona}</span>
                </span>
              </span>
              {on && <motion.span layoutId="role-check" aria-hidden className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-brand-deep text-paper" transition={springs.snappy}><Check size={14} strokeWidth={2.5} /></motion.span>}
              <span className="mt-3 block text-[15px] text-ink-2 sm:mb-4">{r.get}</span>
              <span className="mt-3 block border-t border-line pt-3 text-sm italic text-ink-3 sm:mt-auto">{r.example}</span>
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
