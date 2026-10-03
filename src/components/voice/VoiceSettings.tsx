"use client";
/**
 * Voice personalization: ElevenLabs voice per mode (alternates), speed, read answers aloud, preview.
 * OWNER: voice lane. Voice choice + readAnswers live in voice prefs; speed is the shared prefs.voiceRate.
 */
import { useId, useState } from "react";
import { PERSONAS, type PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { speakVerified, stopSpeaking, type VoiceProvider } from "@/lib/voice/client";
import { voiceCopy } from "@/lib/voice/copy";
import { useVoicePrefs } from "@/lib/voice/prefs";
import { voiceOptions, VOICES } from "@/lib/voice/voices";

const RATES = [0.8, 0.9, 1, 1.1, 1.2] as const;

export function VoiceSettings({ persona, locale }: { persona: PersonaId; locale: Locale }) {
  const t = voiceCopy(locale);
  const { prefs, setPrefs } = usePrefs();
  const { prefs: vp, setVoicePrefs, setVoice } = useVoicePrefs();
  const [previewing, setPreviewing] = useState<VoiceProvider | "loading" | null>(null);
  const id = useId();
  const mode = PERSONAS[persona].mode[locale];
  const chosen = vp.voiceByPersona[persona] ?? VOICES[persona].primary.id;

  async function preview() {
    if (previewing === "loading") { stopSpeaking(); setPreviewing(null); return; }
    setPreviewing("loading");
    const used = await speakVerified(t.preview_line, { persona, locale, rate: prefs.voiceRate, voiceId: chosen });
    setPreviewing(used);
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-brand-mist p-3 text-xs text-ink-2 space-y-2.5">
      <div>
        <label htmlFor={`${id}-voice`} className="block font-semibold text-ink mb-1">{t.voice_for(mode)}</label>
        <div className="flex gap-2">
          <select id={`${id}-voice`} value={chosen} onChange={(e) => setVoice(persona, e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-ink focus-visible:outline-2 focus-visible:outline-brand">
            {voiceOptions(persona).map((o) => <option key={o.id} value={o.id}>{o.name} — {o.note}</option>)}
          </select>
          <button onClick={preview} aria-busy={previewing === "loading"}
            className="rounded-md border border-line bg-paper px-2.5 py-1 font-semibold text-brand-deep hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand">
            {previewing === "loading" ? "■" : "▶"} {t.preview}
          </button>
        </div>
        {previewing && previewing !== "loading" && (
          <p className="mt-1 text-ink-3" role="status">{previewing === "elevenlabs" ? t.voice_eleven : t.voice_browser}</p>
        )}
        <p className="mt-1 text-ink-3">ElevenLabs · live calls use the agent&apos;s own voice.</p>
      </div>
      <label className="flex items-center gap-2">
        {t.speed}
        <select value={prefs.voiceRate} onChange={(e) => setPrefs({ voiceRate: Number(e.target.value) })}
          className="rounded-md border border-line bg-paper px-1.5 py-0.5 text-ink focus-visible:outline-2 focus-visible:outline-brand">
          {RATES.map((r) => <option key={r} value={r}>{r}×</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={vp.readAnswers} onChange={(e) => setVoicePrefs({ readAnswers: e.target.checked })} className="accent-[var(--brand-deep)]" />
        {t.read_answers}
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={prefs.captions} onChange={(e) => setPrefs({ captions: e.target.checked })} className="accent-[var(--brand-deep)]" />
        {t.captions}
      </label>
    </div>
  );
}
