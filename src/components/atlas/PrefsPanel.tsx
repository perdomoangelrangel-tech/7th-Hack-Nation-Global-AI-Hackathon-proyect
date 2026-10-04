"use client";
/** Accessibility & voice settings (gear in the header). Edits the shared usePrefs() store every lane reads. */
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Accessibility } from "lucide-react";
import { playSfx } from "@/lib/sfx";
import { useSfx } from "./useSfx";
import { usePrefs, type Prefs } from "@/lib/prefs";
import type { Dict } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";

const SIZES: Prefs["textScale"][] = [1, 1.15, 1.3];

export function PrefsPanel({ t }: { t: Dict }) {
  const { prefs, setPrefs } = usePrefs();
  const [open, setOpen] = useState(false);
  const [sounds, setSounds] = useSfx();
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
      <button ref={btn} type="button" onClick={() => { playSfx(open ? "close" : "open"); setOpen((o) => !o); }} aria-expanded={open} aria-controls={id} aria-label={t.settings} title={t.settings}
        className="grid place-items-center w-9 h-9 rounded-full border border-line text-ink-2 hover:bg-brand-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-deep">
        <Accessibility aria-hidden size={20} strokeWidth={1.75} />
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
              <label className="flex items-center justify-between gap-3 py-1.5 text-sm text-ink-2 cursor-pointer">
                <span>{t.sounds}</span>
                <input type="checkbox" role="switch" checked={sounds} onChange={(e) => { setSounds(e.target.checked); if (e.target.checked) playSfx("toggle"); }} className="w-4 h-4 accent-[var(--brand-deep)]" />
              </label>
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
