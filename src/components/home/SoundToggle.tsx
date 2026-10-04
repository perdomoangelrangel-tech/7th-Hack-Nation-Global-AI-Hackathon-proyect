"use client";
/**
 * Sound effects on/off for Home's header (WAVE 6B A). Same storage + event as the atlas toggle (src/lib/sfx.ts),
 * so both stay in sync. Read after mount (server renders "on", the default). Turning on plays `toggle` as a preview.
 */
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { playSfx, setSfxEnabled, sfxEnabled } from "@/lib/sfx";
import { homeCopy } from "./copy";

export function SoundToggle({ locale }: { locale: Locale }) {
  const c = homeCopy[locale];
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(sfxEnabled()));
    const sync = (e: Event) => setOn((e as CustomEvent<boolean>).detail);
    window.addEventListener("nedamex:sfx", sync);
    return () => { cancelAnimationFrame(id); window.removeEventListener("nedamex:sfx", sync); };
  }, []);
  const flip = () => { const next = !on; setSfxEnabled(next); setOn(next); if (next) playSfx("toggle"); };
  const Icon = on ? Volume2 : VolumeX;
  return (
    <button type="button" onClick={flip} aria-pressed={on} aria-label={c.sounds} title={on ? c.sounds_on : c.sounds_off}
      className="grid h-10 w-10 place-items-center rounded-full border border-line bg-paper/80 text-ink-2 hover:bg-brand-soft">
      <Icon aria-hidden size={18} strokeWidth={1.75} />
    </button>
  );
}
