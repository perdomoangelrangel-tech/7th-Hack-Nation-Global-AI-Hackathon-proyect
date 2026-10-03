"use client";
/** Búsqueda global: enfermedad, gen, síntoma, vía o grupo abren el mismo grafo, con la resolución de sinónimos visible. */
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { SearchHit } from "@/lib/atlas/store";
import type { Dict, Locale } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";
import { TYPE_COLOR } from "./colors";

export function SearchBox({ t, locale, onPick, autoFocus }: { t: Dict; locale: Locale; onPick: (h: SearchHit) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const c = new AbortController();
    const tm = setTimeout(() => {
      fetch(`/api/atlas/search?q=${encodeURIComponent(q)}&l=${locale}`, { signal: c.signal })
        .then((r) => r.json()).then((j: { hits: SearchHit[] }) => { setHits(j.hits); setActive(0); setOpen(true); }).catch(() => {});
    }, 140);
    return () => { clearTimeout(tm); c.abort(); };
  }, [q, locale]);

  // Atajo "/" o Ctrl/⌘+K para enfocar la búsqueda.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.key === "/" && !(e.target instanceof HTMLInputElement)) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);

  const shown = q.trim().length < 2 ? [] : hits;
  const pick = (h: SearchHit) => { onPick(h); setOpen(false); setQ(""); input.current?.blur(); };

  return (
    <div className="relative w-full">
      <label htmlFor={`${listId}-in`} className="sr-only">{t.search_placeholder}</label>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 h-11 focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/20 transition-[border-color,box-shadow]">
        <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-3 shrink-0"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          id={`${listId}-in`} ref={input} value={q} autoFocus={autoFocus} autoComplete="off" spellCheck={false}
          role="combobox" aria-expanded={open && shown.length > 0} aria-controls={listId} aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
          placeholder={t.search_placeholder}
          onChange={(e) => setQ(e.target.value)} onFocus={() => shown.length > 0 && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && shown[active]) { e.preventDefault(); pick(shown[active]); }
            else if (e.key === "Escape") setOpen(false);
          }}
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-ink-3"
        />
        <kbd className="hidden md:inline text-[11px] text-ink-3 border border-line rounded px-1.5 py-0.5">/</kbd>
      </div>
      <AnimatePresence>
        {open && shown.length > 0 && (
          <motion.ul
            id={listId} role="listbox"
            initial={{ opacity: 0, y: reduce ? 0 : -motionTokens.distance.xs }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={springs.instant}
            className="absolute z-40 mt-2 w-full max-h-[60vh] overflow-auto rounded-xl border border-line bg-paper shadow-xl shadow-black/10 py-1"
          >
            {shown.map((h, i) => (
              <li key={h.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); pick(h); }} onMouseEnter={() => setActive(i)}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${i === active ? "bg-paper-2" : ""}`}>
                <span aria-hidden className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: h.type === "disease" ? "var(--teal)" : TYPE_COLOR[h.type] }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{h.name}</span>
                  <span className="block text-xs text-ink-3 truncate">
                    {h.via_synonym ? <>“{h.matched}” {t.synonym} {h.name} · </> : null}{h.sub}
                  </span>
                </span>
                <span className="text-[11px] uppercase tracking-wider text-ink-3 shrink-0">{t.types[h.type] ?? h.type}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
