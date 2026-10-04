"use client";
/**
 * One global search: disease, gene, symptom, mechanism, patient group or researcher all open the same graph,
 * with synonym resolution visible ("SMEI" → Dravet syndrome). Keyboard: "/" or Ctrl/⌘+K to focus, arrows, Enter, Esc.
 * When local search finds nothing, the server asks /api/reconcile (ai lane) for the closest atlas entity — labeled as such.
 */
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { SearchHit } from "@/lib/atlas/store";
import type { Dict, Locale } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";
import { Shape } from "./AtlasRail";
import { api } from "./api";

type Hit = SearchHit & { reconciled?: boolean };

export function SearchBox({ t, locale, onPick, autoFocus }: { t: Dict; locale: Locale; onPick: (h: SearchHit) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searched, setSearched] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const c = new AbortController();
    const tm = setTimeout(async () => {
      try {
        const j = await fetch(api(`/api/atlas/search?q=${encodeURIComponent(q)}&l=${locale}`), { signal: c.signal }).then((r) => r.json()) as { hits: Hit[] };
        setHits(j.hits as Hit[]); setSearched(q); setActive(0); setOpen(true);
      } catch { /* aborted or offline */ }
    }, 140);
    return () => { clearTimeout(tm); c.abort(); };
  }, [q, locale]);

  // "/" or Ctrl/⌘+K focuses search (not while typing in another field).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);

  const shown = q.trim().length < 2 ? [] : hits;
  const empty = q.trim().length >= 2 && searched === q && hits.length === 0;
  const pick = (h: SearchHit) => { onPick(h); setOpen(false); setQ(""); input.current?.blur(); };

  return (
    <div className="relative w-full">
      <label htmlFor={`${listId}-in`} className="sr-only">{t.search_placeholder}</label>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 h-11 focus-within:border-brand-deep focus-within:ring-2 focus-within:ring-brand/25 transition-[border-color,box-shadow]">
        <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-3 shrink-0"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          id={`${listId}-in`} ref={input} value={q} autoFocus={autoFocus} autoComplete="off" spellCheck={false}
          role="combobox" aria-autocomplete="list" aria-expanded={open && shown.length > 0} aria-controls={listId} aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
          placeholder={t.search_placeholder}
          onChange={(e) => setQ(e.target.value)} onFocus={() => shown.length > 0 && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, shown.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && shown[active]) { e.preventDefault(); pick(shown[active]); }
            else if (e.key === "Escape") { if (open) setOpen(false); else { setQ(""); input.current?.blur(); } }
          }}
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-3 truncate"
        />
        <kbd className="hidden md:inline text-[11px] text-ink-3 border border-line rounded px-1.5 py-0.5">/</kbd>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{open && q.trim().length >= 2 ? `${shown.length} results` : ""}</p>
      <AnimatePresence>
        {open && (shown.length > 0 || empty) && (
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : -motionTokens.distance.xs }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={springs.instant}
            className="absolute z-40 mt-2 w-full max-h-[60vh] overflow-auto rounded-xl border border-line bg-paper shadow-xl shadow-ink/10 py-1"
          >
            {empty ? (
              <div className="px-4 py-3 text-sm">
                <p className="text-ink-2">{t.no_results} “{q.trim()}”.</p>
                <p className="text-xs text-ink-3 mt-1">{t.search_try}</p>
              </div>
            ) : (
              <ul id={listId} role="listbox" aria-label={t.search_placeholder}>
                {shown.map((h, i) => (
                  <li key={h.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                    onMouseDown={(e) => { e.preventDefault(); pick(h); }} onMouseEnter={() => setActive(i)}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${i === active ? "bg-brand-soft" : ""}`}>
                    <Shape type={h.type === "disease" ? "disease" : h.type} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink truncate">{h.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-ink-3 min-w-0">
                        {(h.via_synonym || h.reconciled) && (
                          <span className="chip !py-0 !px-1.5 !text-[11px] shrink-0 max-w-[60%] truncate" title={h.reconciled ? t.reconciled : t.synonym}>
                            <span className="truncate">“{h.matched}”</span><span aria-hidden>→</span><span className="sr-only">{h.reconciled ? t.reconciled : t.synonym}</span><span className="truncate">{h.name}</span>
                          </span>
                        )}
                        <span className="truncate">{h.reconciled ? t.reconciled : h.sub}</span>
                      </span>
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-ink-3 shrink-0">{t.types[h.type] ?? h.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
