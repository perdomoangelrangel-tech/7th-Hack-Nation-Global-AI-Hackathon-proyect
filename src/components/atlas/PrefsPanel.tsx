"use client";
/** Accessibility & voice settings (gear in the header). Edits the shared usePrefs() store every lane reads. */
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePrefs, type Prefs } from "@/lib/prefs";
import type { Dict } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";

const SIZES: Prefs["textScale"][] = [1, 1.15, 1.3];

export function PrefsPanel({ t }: { t: Dict }) {
  const { prefs, setPrefs } = usePrefs();
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    window.addEventListener("mousedown", away); window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("mousedown", away); window.removeEventListener("keydown", esc); };
  }, [open]);

  const toggle = (k: keyof Prefs, label: string) => (
    <label className="flex items-center justify-between gap-3 py-1.5 text-sm text-ink-2 cursor-pointer">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={!!prefs[k]} onChange={(e) => setPrefs({ [k]: e.target.checked } as Partial<Prefs>)} className="w-4 h-4 accent-[var(--brand-deep)]" />
    </label>
  );

  return (
    <div className="relative shrink-0">
      <button ref={btn} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id} aria-label={t.settings} title={t.settings}
        className="grid place-items-center w-9 h-9 rounded-full border border-line text-ink-2 hover:bg-brand-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-deep">
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div ref={box} id={id} role="dialog" aria-label={t.settings}
            initial={{ opacity: 0, y: reduce ? 0 : -motionTokens.distance.xs }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={springs.instant}
            className="absolute right-0 z-50 mt-2 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-line bg-paper p-4 shadow-xl shadow-ink/10">
            <p className="text-xs uppercase tracking-widest text-ink-3">{t.settings}</p>
            <fieldset className="mt-3">
              <legend className="text-sm text-ink-2">{t.text_size}</legend>
              <div className="mt-1.5 flex gap-1.5">
                {SIZES.map((s, i) => (
                  <button key={s} type="button" onClick={() => setPrefs({ textScale: s })} aria-pressed={prefs.textScale === s}
                    className={`flex-1 rounded-lg border py-1.5 ${prefs.textScale === s ? "border-brand-deep bg-brand-soft text-ink font-medium" : "border-line text-ink-2 hover:bg-brand-mist"}`}
                    style={{ fontSize: `${0.8 + i * 0.15}rem` }}>A</button>
                ))}
              </div>
            </fieldset>
            <div className="mt-3 divide-y divide-line">
              {toggle("highContrast", t.high_contrast)}
              {toggle("reduceMotion", t.reduce_motion)}
              {toggle("simpleLanguage", t.simple_language)}
              {toggle("autoRead", t.auto_read)}
              {toggle("captions", t.captions)}
            </div>
            <label className="mt-3 block text-sm text-ink-2">
              <span className="flex justify-between">{t.voice_speed}<span className="tabular-nums text-ink-3">{prefs.voiceRate.toFixed(1)}×</span></span>
              <input type="range" min={0.8} max={1.2} step={0.1} value={prefs.voiceRate} onChange={(e) => setPrefs({ voiceRate: Number(e.target.value) })} className="mt-1 w-full accent-[var(--brand-deep)]" />
            </label>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
