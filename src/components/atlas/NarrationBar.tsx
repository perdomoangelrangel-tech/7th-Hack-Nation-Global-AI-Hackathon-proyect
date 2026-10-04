"use client";
/**
 * Narration caption strip over the map. Shows ONLY while narration runs (nothing when idle, so it never
 * covers the graph): the current claim with its status, its evidence chips, play/pause and stop.
 * The controls (Listen tab: start, transcript, speed, captions) live in the Guide dock; this component
 * publishes the narration to it through the voice bridge. Keyboard: space play/pause, ←/→ previous/next.
 * OWNER: voice lane. Props contract used by AtlasApp: { n, t, onListen, personaName }.
 */
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Dict } from "@/lib/i18n";
import { motionTokens } from "@/lib/motion";
import { usePrefs } from "@/lib/prefs";
import { publishNarration, useGuideOpen } from "@/lib/voice/bridge";
import type { useNarration } from "./useNarration";

type N = ReturnType<typeof useNarration>;
export const STATUS_STYLE: Record<string, string> = {
  observed: "border-brand-deep text-brand-deep bg-brand-soft",
  inferred: "border-brand-deep text-brand-deep border-dashed bg-paper",
  gap: "border-amber text-amber bg-amber-soft",
};

function isTyping(el: EventTarget | null) {
  const e = el as HTMLElement | null;
  return !!e && (e.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.tagName));
}

export function NarrationBar({ n, t, onListen, personaName }: { n: N; t: Dict; onListen: () => void; personaName: string }) {
  const { prefs } = usePrefs();
  const guideOpen = useGuideOpen();
  const playing = n.state === "playing";
  const active = playing || n.state === "paused";

  // Hand the narration to the Guide dock (Listen tab). Cleared on unmount.
  useEffect(() => { publishNarration({ n, t, personaName, onListen }); });
  useEffect(() => () => publishNarration(null), []);

  // Keyboard: space play/pause, ←/→ previous/next claim. Ignored while typing or on focused buttons (space).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!n.narration || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " ") {
        if ((e.target as HTMLElement | null)?.closest("button, a, [role=button], [role=tab]")) return;
        if (!active) return;
        e.preventDefault(); if (playing) n.pause(); else n.resume();
      } else if (e.key === "ArrowRight" && active) { e.preventDefault(); n.next(); }
      else if (e.key === "ArrowLeft" && active) { e.preventDefault(); n.prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const showStrip = !guideOpen && (n.state === "loading" || (active && !!n.current) || n.state === "error");

  return (
    <>
      {/* Screen readers: announce each claim as it is spoken, regardless of the captions toggle */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">{n.current ? `${t.status[n.current.status]}: ${n.current.text}` : ""}</p>
      <AnimatePresence>
        {showStrip && (
          <motion.div key="strip" role="region" aria-label={t.listen}
            initial={{ opacity: 0, y: motionTokens.distance.sm }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: motionTokens.distance.sm }}
            transition={{ duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth }}
            className="pointer-events-auto rounded-2xl bg-paper/95 backdrop-blur-md border border-line text-ink shadow-lg shadow-brand-ink/10 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={() => (playing ? n.pause() : n.state === "paused" ? n.resume() : onListen())} disabled={n.state === "loading"}
                aria-label={playing ? t.pause : n.state === "paused" ? t.resume : t.listen}
                className="shrink-0 w-8 h-8 rounded-full bg-brand-deep text-paper grid place-items-center disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                {n.state === "loading" ? <span className="w-3.5 h-3.5 rounded-full border-2 border-paper border-t-transparent animate-spin" aria-hidden />
                  : playing ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>}
              </button>
              <p className="text-xs font-semibold text-ink-2 shrink-0">
                {n.state === "loading" ? t.preparing : n.state === "error" ? t.listen : `${personaName} · ${n.index + 1}/${n.narration?.claims.length ?? 0}`}
              </p>
              {n.current && (
                <span className={`text-[10px] uppercase tracking-widest border rounded-full px-1.5 py-px ${STATUS_STYLE[n.current.status]}`}>{t.status[n.current.status]}</span>
              )}
              <button type="button" onClick={n.stop} className="ml-auto text-xs text-ink-2 hover:text-ink px-2 py-1 rounded-md focus-visible:outline-2 focus-visible:outline-brand">{t.stop}</button>
            </div>
            {n.current && prefs.captions && (
              <>
                <p className="mt-1.5 text-sm leading-relaxed text-ink line-clamp-3">{n.current.text}</p>
                {n.current.evidence.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {n.current.evidence.slice(0, 4).map((e) => (
                      <li key={e.id}>
                        <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] rounded-full border border-line bg-brand-mist px-2 py-0.5 text-ink-2 hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand" aria-hidden />{e.source} · {e.external_id.length > 28 ? `${e.external_id.slice(0, 27)}…` : e.external_id}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {n.state === "error" && <p className="mt-1 text-xs text-amber" role="alert">Narration is unavailable right now — read the route on the right.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
