"use client";
/**
 * 3-stop tour (UX_WAVE4 §4.6) in a native <dialog> (focus trap, Esc, focus return for free).
 * Opens: once automatically on the atlas (`auto`), from any Help button via `openTour()` (window event
 * `nedamex:tour`), or with "?" when not typing. "Seen" persists per viewer (memory.ts).
 *   <Tour locale="en" auto />   · mounted next to AtlasApp in src/app/atlas/page.tsx
 *   <Tour locale={locale} />    · Home (opened by its Help button)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, ChevronLeft, ChevronRight, CircleHelp, Footprints, GitCompareArrows, Handshake, MousePointerClick, Recycle, Sigma, X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { motionTokens } from "@/lib/motion";
import { isEmbedded } from "@/components/atlas/useEmbed";
import { tourCopy } from "./copy";
import { readMemory, writeMemory } from "./memory";

export const TOUR_EVENT = "nedamex:tour";
/** Any lane can open the tour: `openTour()` or `window.dispatchEvent(new Event("nedamex:tour"))`. */
export function openTour() { window.dispatchEvent(new Event(TOUR_EVENT)); }

const AUTO_DELAY_MS = 1200; // let the route and the map appear first

export function Tour({ locale: initialLocale, auto = false }: { locale: Locale; auto?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [stop, setStop] = useState(0);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const c = tourCopy[locale];
  const last = c.stops.length - 1;

  const show = useCallback(() => {
    // The atlas keeps ?l= in the URL; follow the language the viewer is using right now.
    const l = new URLSearchParams(window.location.search).get("l");
    setLocale(l === "es" || l === "en" ? l : initialLocale);
    setStop(0);
    if (!ref.current?.open) ref.current?.showModal();
    // Focus "Next" ourselves; browsers block autofocus inside a cross-origin frame (the Lovable embed).
    if (window.self === window.top) nextRef.current?.focus();
  }, [initialLocale]);
  const close = useCallback(() => { ref.current?.close(); writeMemory({ tourSeen: true }); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "?" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); show(); }
    };
    window.addEventListener(TOUR_EVENT, show);
    window.addEventListener("keydown", onKey);
    // Never auto-open inside the platform shell (it has its own onboarding; Help / "?" still open it).
    const timer = auto && !readMemory().tourSeen && !isEmbedded() ? window.setTimeout(show, AUTO_DELAY_MS) : undefined;
    return () => { window.removeEventListener(TOUR_EVENT, show); window.removeEventListener("keydown", onKey); window.clearTimeout(timer); };
  }, [auto, show]);

  return (
    <dialog ref={ref} aria-labelledby="tour-title" aria-describedby="tour-body" onClose={() => writeMemory({ tourSeen: true })}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-[var(--radius)] border border-line bg-paper p-0 text-ink shadow-xl shadow-ink/15 backdrop:bg-brand-ink/30">
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">{c.label} · {c.of(stop + 1, c.stops.length)}</p>
          <button type="button" onClick={close} aria-label={c.skip} className="grid h-10 w-10 place-items-center rounded-full text-ink-3 hover:bg-brand-soft"><X aria-hidden size={18} /></button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={stop} initial={{ opacity: 0, x: motionTokens.distance.sm }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -motionTokens.distance.sm }} transition={{ duration: motionTokens.duration.fast }}>
            <div aria-hidden className="mt-3 rounded-2xl border border-line bg-brand-mist p-4"><Visual stop={stop} c={c} /></div>
            <h2 id="tour-title" className="serif mt-4 text-xl leading-snug text-brand-ink">{c.stops[stop].title}</h2>
            <p id="tour-body" className="mt-2 text-[15px] text-ink-2">{c.stops[stop].body}</p>
          </motion.div>
        </AnimatePresence>
        <p className="sr-only" aria-live="polite">{c.of(stop + 1, c.stops.length)}: {c.stops[stop].title}</p>
        <div className="mt-5 flex items-center gap-2">
          <span className="flex flex-1 gap-1.5" aria-hidden>
            {c.stops.map((_, i) => <span key={i} className={`h-2 rounded-full transition-all ${i === stop ? "w-6 bg-brand-deep" : "w-2 bg-line"}`} />)}
          </span>
          {stop > 0 ? (
            <button type="button" onClick={() => setStop(stop - 1)} className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-medium text-ink-2 hover:bg-brand-soft"><ChevronLeft aria-hidden size={16} />{c.back}</button>
          ) : (
            <button type="button" onClick={close} className="min-h-10 rounded-full px-3 text-sm font-medium text-ink-3 hover:bg-brand-soft">{c.skip}</button>
          )}
          <button type="button" ref={nextRef} onClick={() => (stop < last ? setStop(stop + 1) : close())}
            className="inline-flex min-h-10 items-center gap-1 rounded-full bg-brand-deep px-4 text-sm font-semibold text-paper hover:bg-brand-ink">
            {stop < last ? <>{c.next}<ChevronRight aria-hidden size={16} /></> : c.done}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Small, honest illustrations of what each stop points at (same icons and line grammar as the atlas). */
function Visual({ stop, c }: { stop: number; c: (typeof tourCopy)["en"] }) {
  if (stop === 0) {
    const icons = [GitCompareArrows, Recycle, Handshake, Footprints];
    return (
      <div className="flex items-center justify-between gap-2">
        {icons.map((Icon, i) => (
          <span key={i} className="flex flex-1 items-center gap-2">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${i === 0 ? "bg-brand-deep text-paper" : "border border-line bg-paper text-brand-deep"}`}><Icon size={20} strokeWidth={1.75} /></span>
            {i < 3 && <span className="h-px flex-1 bg-line" />}
          </span>
        ))}
      </div>
    );
  }
  if (stop === 1) {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-3"><svg width="72" height="8"><line x1="0" y1="4" x2="72" y2="4" stroke="var(--brand-deep)" strokeWidth="3" /></svg><BadgeCheck size={16} className="text-brand-deep" /><span className="text-ink-2">{c.observed}</span></div>
        <div className="flex items-center gap-3"><svg width="72" height="8"><line x1="0" y1="4" x2="72" y2="4" stroke="var(--brand)" strokeWidth="3" strokeDasharray="8 6" /></svg><Sigma size={16} className="text-brand" /><span className="text-ink-2">{c.inferred}</span></div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex-1">
        <svg width="100%" height="24" preserveAspectRatio="none" viewBox="0 0 100 24"><line x1="0" y1="12" x2="100" y2="12" stroke="var(--brand-deep)" strokeWidth="3" /></svg>
        <MousePointerClick size={20} className="absolute left-1/2 top-2 text-brand-ink" />
      </span>
      <span className="rounded-xl border border-line bg-paper px-3 py-2 text-sm shadow-[var(--shadow-soft)]"><span className="font-semibold text-ink">{c.sources}</span></span>
    </div>
  );
}

/** Help trigger (CircleHelp + "Help"), for headers this lane owns. */
export function HelpButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={openTour} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-paper/80 px-3 text-sm font-medium text-ink-2 hover:bg-brand-soft">
      <CircleHelp aria-hidden size={18} strokeWidth={1.75} />{label}
    </button>
  );
}
