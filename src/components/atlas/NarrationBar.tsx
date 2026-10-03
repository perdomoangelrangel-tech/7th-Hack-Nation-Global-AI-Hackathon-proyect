"use client";
/** Reproductor de la narración: subtítulo de la frase actual con su estado y sus citas, sobre el grafo. */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Dict } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";
import type { useNarration } from "./useNarration";

type N = ReturnType<typeof useNarration>;
const STATUS_STYLE: Record<string, string> = {
  observed: "border-teal-2/70 text-teal-2",
  inferred: "border-yellow-300/80 text-yellow-200 border-dashed",
  gap: "border-amber/80 text-amber",
};

export function NarrationBar({ n, t, onListen, personaName }: { n: N; t: Dict; onListen: () => void; personaName: string }) {
  const reduce = useReducedMotion();
  const busy = n.state === "loading";
  const playing = n.state === "playing";
  return (
    <div className="pointer-events-auto rounded-2xl bg-[#0a1424]/85 backdrop-blur-md border border-white/10 text-slate-100 shadow-2xl shadow-black/40 p-3 md:p-4">
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={reduce ? undefined : { scale: motionTokens.scale.press }} transition={springs.snappy}
          onClick={() => (playing ? n.pause() : n.state === "paused" ? n.resume() : onListen())}
          disabled={busy}
          aria-label={playing ? t.pause : n.state === "paused" ? t.resume : t.listen}
          className="relative shrink-0 w-11 h-11 rounded-full bg-teal-2 text-[#062a26] grid place-items-center disabled:opacity-60">
          {playing && !reduce && <span className="absolute inset-0 rounded-full bg-teal-2/40 animate-ping" aria-hidden />}
          {busy ? <span className="w-4 h-4 rounded-full border-2 border-[#062a26] border-t-transparent animate-spin" aria-hidden />
            : playing ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>}
        </motion.button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{n.state === "idle" || n.state === "done" || n.state === "error" ? t.listen : busy ? t.preparing : `${personaName} · ${n.index + 1}/${n.narration?.claims.length ?? 0}`}</p>
          <p className="text-[11px] text-slate-400 truncate">
            {n.narration ? (n.narration.mode === "openai" ? `${t.narration_openai} ${n.narration.model}` : t.narration_template) : t.legend_inferred}
            {n.voice ? ` · ${n.voice === "openai" ? t.voice_openai : t.voice_browser}` : ""}
            {n.narration ? ` · ${n.narration.verified ? t.verified_all : `${n.narration.dropped.length} ${t.dropped}`}` : ""}
          </p>
        </div>
        {(playing || n.state === "paused") && <button onClick={n.stop} className="text-xs text-slate-300 hover:text-white px-2 py-1">{t.stop}</button>}
      </div>

      {/* Progreso: un segmento por frase; clic para saltar */}
      {n.narration && n.narration.claims.length > 0 && (
        <div className="mt-3 flex gap-1" role="list">
          {n.narration.claims.map((c, i) => (
            <button key={i} role="listitem" onClick={() => n.jump(i)} aria-label={`${i + 1}`}
              className={`h-1 flex-1 rounded-full transition-colors ${i < n.index ? "bg-teal-2/70" : i === n.index ? "bg-white" : "bg-white/15"}`} />
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {n.current && (
          <motion.div key={n.index} initial={{ opacity: 0, y: reduce ? 0 : motionTokens.distance.sm }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -motionTokens.distance.xs }}
            transition={{ duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth }} className="mt-3" aria-live="polite">
            <p className="text-[15px] leading-relaxed line-clamp-4">
              <span className={`inline-block align-middle mr-2 text-[10px] uppercase tracking-widest border rounded-full px-1.5 py-px ${STATUS_STYLE[n.current.status]}`}>{t.status[n.current.status]}</span>
              {n.current.text}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {n.current.evidence.map((e, i) => (
                <motion.li key={e.id} initial={{ opacity: 0, scale: reduce ? 1 : motionTokens.scale.subtle }} animate={{ opacity: 1, scale: 1 }} transition={{ ...springs.gentle, delay: reduce ? 0 : 0.15 + i * 0.08 }}>
                  <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-slate-200 hover:bg-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-2" aria-hidden />{e.source} · {e.external_id.length > 28 ? `${e.external_id.slice(0, 27)}…` : e.external_id}
                  </a>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      {n.state === "error" && <p className="mt-2 text-xs text-amber">Narration failed — check /api/health.</p>}
    </div>
  );
}
