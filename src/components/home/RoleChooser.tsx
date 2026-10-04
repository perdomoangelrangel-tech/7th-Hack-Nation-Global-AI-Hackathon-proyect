"use client";
/**
 * "Who are you?" (WAVE 5B): pick YOUR role → the other three collapse (≤ 250 ms; instant under reduced motion via
 * MotionConfig) and yours expands: "You're here as …", what you get, an example question, "Continue as …" and
 * "Change role". The picked card and the panel share a layoutId, so the card grows into the panel.
 * Focus follows the user: to "Continue as …" after a pick, back to the card after "Change role".
 */
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowLeftRight, Check, ChevronRight, HeartHandshake, Microscope, Target, UserRound, type LucideIcon } from "lucide-react";
import type { PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";
import { motionTokens } from "@/lib/motion";
import { ROLE_ORDER, homeCopy } from "./copy";
import { atlasHref } from "./memory";
import { PendingHint } from "./Pending";

const ROLE_ICON: Record<PersonaId, LucideIcon> = { devon: UserRound, maria: HeartHandshake, osei: Microscope, priya: Target };
/** ≤ 250 ms (WAVE 5B). MotionConfig reducedMotion turns the layout morph into an instant swap. */
const COLLAPSE = { duration: 0.22, ease: motionTokens.easing.smooth };

interface Props { locale: Locale; role: PersonaId | null; onPick: (p: PersonaId) => void; onContinue?: () => void }

export function RoleChooser({ locale, role, onPick, onContinue }: Props) {
  const c = homeCopy[locale];
  const [choosing, setChoosing] = useState(false);
  const focusNext = useRef<"continue" | PersonaId | null>(null);
  const continueRef = useRef<HTMLAnchorElement>(null);
  const cardRefs = useRef<Partial<Record<PersonaId, HTMLButtonElement | null>>>({});
  const collapsed = role !== null && !choosing;

  // Move focus only after a user action (never on the first render / remembered role).
  useEffect(() => {
    const f = focusNext.current;
    if (!f) return;
    focusNext.current = null;
    const id = requestAnimationFrame(() => (f === "continue" ? continueRef.current : cardRefs.current[f])?.focus());
    return () => cancelAnimationFrame(id);
  }, [collapsed]);

  const pick = (p: PersonaId) => { focusNext.current = "continue"; onPick(p); setChoosing(false); };
  const change = () => { focusNext.current = role; setChoosing(true); };

  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = ROLE_ORDER[(i + d + ROLE_ORDER.length) % ROLE_ORDER.length];
    cardRefs.current[next]?.focus(); // arrows move focus; Enter / Space / click picks (picking collapses the list)
  };

  return (
    <LayoutGroup>
      <AnimatePresence mode="popLayout" initial={false}>
        {collapsed ? (
          <Expanded key="expanded" locale={locale} role={role} onChange={change} onContinue={onContinue} continueRef={continueRef} />
        ) : (
          <motion.div key="picker" role="radiogroup" aria-labelledby="who-title" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            exit={{ opacity: 0 }} transition={COLLAPSE}>
            {ROLE_ORDER.map((id, i) => {
              const r = c.roles[id];
              const Icon = ROLE_ICON[id];
              const on = role === id;
              return (
                <motion.button key={id} layoutId={`role-${id}`} ref={(el) => { cardRefs.current[id] = el; }} type="button" role="radio" aria-checked={on}
                  tabIndex={on || (!role && i === 0) ? 0 : -1} onClick={() => pick(id)} onKeyDown={(e) => onKey(e, i)}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={COLLAPSE} whileTap={{ scale: motionTokens.scale.subtle }}
                  className={`relative flex flex-col rounded-[var(--radius)] border bg-paper p-4 text-left shadow-[var(--shadow-soft)] transition-colors sm:p-5 ${on ? "border-brand-deep ring-2 ring-brand/30" : "border-line hover:border-brand-light"}`}>
                  <span className="flex items-start gap-3 sm:flex-col sm:gap-0">
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${on ? "bg-brand-deep text-paper" : "bg-brand-soft text-brand-deep"}`}><Icon aria-hidden size={24} strokeWidth={1.75} /></span>
                    <span className="min-w-0 sm:mt-4">
                      <span className="block text-lg font-semibold leading-snug text-ink">{r.title}</span>
                      <span className="block text-sm text-ink-3">{r.persona}</span>
                    </span>
                  </span>
                  {on && <span aria-hidden className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-brand-deep text-paper"><Check size={14} strokeWidth={2.5} /></span>}
                  <span className="mt-3 block text-[15px] text-ink-2 sm:mb-4">{r.get}</span>
                  <span className="mt-3 block border-t border-line pt-3 text-sm italic text-ink-3 sm:mt-auto">{r.example}</span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}

function Expanded({ locale, role, onChange, onContinue, continueRef }: { locale: Locale; role: PersonaId; onChange: () => void; onContinue?: () => void; continueRef: React.RefObject<HTMLAnchorElement | null> }) {
  const c = homeCopy[locale];
  const r = c.roles[role];
  const Icon = ROLE_ICON[role];
  return (
    <motion.section layoutId={`role-${role}`} transition={COLLAPSE} aria-labelledby="role-here"
      className="mt-5 rounded-[var(--radius)] border border-brand-deep bg-paper p-5 shadow-[var(--shadow-soft)] ring-2 ring-brand/30 sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: motionTokens.duration.fast, delay: 0.08 }}
        className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-deep text-paper"><Icon aria-hidden size={26} strokeWidth={1.75} /></span>
          <div className="min-w-0">
            <p className="text-sm text-ink-3">{c.here_as}</p>
            <h3 id="role-here" className="text-xl font-semibold leading-snug text-ink">{r.title} <span className="text-base font-normal text-ink-3">· {r.persona}</span></h3>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-6">
              <div><dt className="eyebrow">{c.you_get}</dt><dd className="mt-1 text-[15px] text-ink-2">{r.get}</dd></div>
              <div><dt className="eyebrow">{c.you_ask}</dt><dd className="mt-1 text-[15px] italic text-ink-2">{r.example}</dd></div>
            </dl>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-stretch">
          <Link ref={continueRef} href={atlasHref({ p: role, l: locale })} onClick={onContinue}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-brand-deep px-5 text-sm font-semibold text-paper hover:bg-brand-ink">
            {c.continue_as(r.title)}<ChevronRight aria-hidden size={16} /><PendingHint label={c.opening} />
          </Link>
          <button type="button" onClick={onChange}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-paper px-4 text-sm font-medium text-ink-2 hover:bg-brand-soft">
            <ArrowLeftRight aria-hidden size={16} strokeWidth={1.75} />{c.change_role}
          </button>
        </div>
      </motion.div>
    </motion.section>
  );
}
