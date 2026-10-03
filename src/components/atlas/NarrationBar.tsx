"use client";
/**
 * Narration player over the graph: live caption of the current claim with its status and citations,
 * play/pause/skip, speed, captions toggle, clickable transcript, keyboard shortcuts (space, ←/→).
 * OWNER: voice lane. Props contract used by AtlasApp: { n, t, onListen, personaName }.
 */
import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { dict, type Dict } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";
import { usePrefs } from "@/lib/prefs";
import { voiceCopy } from "@/lib/voice/copy";
import type { useNarration } from "./useNarration";

type N = ReturnType<typeof useNarration>;
const STATUS_STYLE: Record<string, string> = {
  observed: "border-brand-deep text-brand-deep bg-brand-soft",
  inferred: "border-brand text-brand-deep border-dashed bg-paper",
  gap: "border-amber text-amber bg-amber-soft",
};
const RATES = [0.8, 0.9, 1, 1.1, 1.2] as const;

function isTyping(el: EventTarget | null) {
  const e = el as HTMLElement | null;
  return !!e && (e.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.tagName));
}

export function NarrationBar({ n, t, onListen, personaName }: { n: N; t: Dict; onListen: () => void; personaName: string }) {
  const reduce = useReducedMotion();
  const { prefs, setPrefs } = usePrefs();
  const locale = t === dict.es ? "es" : "en"; // props contract passes only the dict
  const v = voiceCopy(locale);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptId = useId();
  const busy = n.state === "loading";
  const playing = n.state === "playing";
  const active = playing || n.state === "paused";
  const calm = reduce || prefs.reduceMotion;

  const toggle = () => (playing ? n.pause() : n.state === "paused" ? n.resume() : onListen());

  // Keyboard: space play/pause, ←/→ previous/next claim. Ignored while typing or on focused buttons (space).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " " && (e.target as HTMLElement | null)?.closest("button, a, [role=button]")) return;
      if (e.key === " " && (active || n.state === "done" || n.state === "idle") && n.narration) { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowRight" && active) { e.preventDefault(); n.next(); }
      else if (e.key === "ArrowLeft" && active) { e.preventDefault(); n.prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const statusLine = n.state === "idle" || n.state === "done" || n.state === "error"
    ? t.listen : busy ? t.preparing : `${personaName} · ${n.index + 1}/${n.narration?.claims.length ?? 0}`;

  return (
    <div className="pointer-events-auto rounded-2xl bg-paper/95 backdrop-blur-md border border-line text-ink shadow-xl shadow-brand-ink/10 p-3 md:p-4" role="region" aria-label={t.listen}>
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={calm ? undefined : { scale: motionTokens.scale.press }} transition={springs.snappy}
          onClick={toggle} disabled={busy}
          aria-label={playing ? t.pause : n.state === "paused" ? t.resume : t.listen}
          className="relative shrink-0 w-11 h-11 rounded-full bg-brand-deep text-paper grid place-items-center disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand">
          {playing && !calm && <span className="absolute inset-0 rounded-full bg-brand/30 animate-ping" aria-hidden />}
          {busy ? <span className="w-4 h-4 rounded-full border-2 border-paper border-t-transparent animate-spin" aria-hidden />
            : playing ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>}
        </motion.button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{statusLine}</p>
          <p className="text-[11px] text-ink-3 truncate">
            {n.narration ? (n.narration.mode === "openai" ? `${t.narration_openai} ${n.narration.model}` : t.narration_template) : t.legend_inferred}
            {n.voice ? ` · ${n.voice === "elevenlabs" ? v.voice_eleven : v.voice_browser}` : ""}
            {n.narration ? ` · ${n.narration.verified ? t.verified_all : `${n.narration.dropped.length} ${t.dropped}`}` : ""}
          </p>
        </div>

        {active && (
          <div className="flex items-center gap-1">
            <IconBtn label={v.skip_prev} onClick={n.prev} disabled={n.index <= 0}><path d="M6 5h2v14H6zM20 5v14L9 12z" /></IconBtn>
            <IconBtn label={v.skip_next} onClick={n.next} disabled={!n.narration || n.index >= n.narration.claims.length - 1}><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></IconBtn>
            <button onClick={n.stop} className="text-xs text-ink-2 hover:text-ink px-2 py-1 rounded-md focus-visible:outline-2 focus-visible:outline-brand">{t.stop}</button>
          </div>
        )}
      </div>

      {/* Progress: one segment per claim; click to jump */}
      {n.narration && n.narration.claims.length > 0 && (
        <div className="mt-3 flex gap-1" role="group" aria-label={v.transcript}>
          {n.narration.claims.map((c, i) => (
            <button key={i} onClick={() => n.jump(i)} aria-label={`${i + 1}: ${c.text.slice(0, 60)}`} aria-current={i === n.index ? "step" : undefined}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i < n.index ? "bg-brand" : i === n.index ? "bg-brand-deep" : "bg-line"}`} />
          ))}
        </div>
      )}

      {/* Live caption (visual, always on when prefs.captions) */}
      <AnimatePresence mode="wait">
        {n.current && prefs.captions && (
          <motion.div key={n.index} initial={{ opacity: 0, y: calm ? 0 : motionTokens.distance.sm }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: calm ? 0 : -motionTokens.distance.xs }}
            transition={{ duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth }} className="mt-3">
            <p className="text-[15px] leading-relaxed text-ink line-clamp-4">
              <span className={`inline-block align-middle mr-2 text-[10px] uppercase tracking-widest border rounded-full px-1.5 py-px ${STATUS_STYLE[n.current.status]}`}>{t.status[n.current.status]}</span>
              {n.current.text}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {n.current.evidence.map((e, i) => (
                <motion.li key={e.id} initial={{ opacity: 0, scale: calm ? 1 : motionTokens.scale.subtle }} animate={{ opacity: 1, scale: 1 }} transition={{ ...springs.gentle, delay: calm ? 0 : 0.15 + i * 0.08 }}>
                  <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] rounded-full border border-line bg-brand-mist px-2 py-0.5 text-ink-2 hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand" aria-hidden />{e.source} · {e.external_id.length > 28 ? `${e.external_id.slice(0, 27)}…` : e.external_id}
                  </a>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen readers: announce each claim as it is spoken, regardless of the captions toggle */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">{n.current ? `${t.status[n.current.status]}: ${n.current.text}` : ""}</p>

      {(n.narration || active) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-2">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={prefs.captions} onChange={(e) => setPrefs({ captions: e.target.checked })} className="accent-[var(--brand-deep)]" />
            {v.captions}
          </label>
          <label className="inline-flex items-center gap-1.5">
            {v.speed}
            <select value={prefs.voiceRate} onChange={(e) => setPrefs({ voiceRate: Number(e.target.value) })}
              className="rounded-md border border-line bg-paper px-1.5 py-0.5 text-ink focus-visible:outline-2 focus-visible:outline-brand">
              {RATES.map((r) => <option key={r} value={r}>{r}×</option>)}
            </select>
          </label>
          {n.narration && (
            <button onClick={() => setShowTranscript((s) => !s)} aria-expanded={showTranscript} aria-controls={transcriptId}
              className="underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand rounded">{v.transcript}</button>
          )}
          <span className="hidden md:inline text-ink-3 ml-auto">{v.shortcuts}</span>
        </div>
      )}

      {showTranscript && n.narration && (
        <ol id={transcriptId} className="mt-2 max-h-40 overflow-y-auto space-y-1 text-sm border-t border-line pt-2">
          {n.narration.claims.map((c, i) => (
            <li key={i}>
              <button onClick={() => n.jump(i)} className={`text-left w-full rounded px-1.5 py-0.5 hover:bg-brand-mist focus-visible:outline-2 focus-visible:outline-brand ${i === n.index ? "bg-brand-soft text-ink font-medium" : "text-ink-2"}`}>
                {i + 1}. {c.text}
              </button>
            </li>
          ))}
        </ol>
      )}
      {n.state === "error" && <p className="mt-2 text-xs text-amber" role="alert">Narration failed — check /api/health.</p>}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="w-8 h-8 grid place-items-center rounded-full text-ink-2 hover:bg-brand-mist hover:text-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-brand">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>{children}</svg>
    </button>
  );
}
