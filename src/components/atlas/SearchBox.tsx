"use client";
/**
 * One global search (⌘K / "/"): results grouped by type in a fixed order — Diseases → Mechanisms → Genes → Symptoms →
 * Patient groups → Studies — with synonym resolution visible ("Munc18-1" → STXBP1) and the matching text highlighted.
 * Mechanism clusters come back too ("lysosomal storage" → the cluster and its diseases). Keyboard: arrows, Enter, Esc.
 * When local search finds nothing, the server asks /api/reconcile (ai lane) for the closest atlas entity — labeled as such.
 */
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Command, Search } from "lucide-react";
import type { SearchHit } from "@/lib/atlas/store";
import type { Dict, Locale } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";
import { api } from "./api";
import { TypeIcon } from "./icons";

type Hit = SearchHit & { reconciled?: boolean };

/** Fixed group order (UX_WAVE4 S1). `max` = rows shown before "Show N more". */
const GROUPS: { key: string; types: string[]; max: number }[] = [
  { key: "diseases", types: ["disease"], max: 6 },
  { key: "mechanisms", types: ["cluster", "pathway"], max: 4 },
  { key: "genes", types: ["gene", "variant"], max: 4 },
  { key: "symptoms", types: ["phenotype"], max: 4 },
  { key: "groups", types: ["organization"], max: 4 },
  { key: "studies", types: ["trial", "study"], max: 3 },
  { key: "other", types: ["treatment", "investigator"], max: 3 },
];

export function SearchBox({ t, locale, persona, onPick, autoFocus }: { t: Dict; locale: Locale; persona?: string; onPick: (h: SearchHit) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searched, setSearched] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const c = new AbortController();
    const tm = setTimeout(async () => {
      try {
        const j = await fetch(api(`/api/atlas/search?q=${encodeURIComponent(q)}&l=${locale}`), { signal: c.signal }).then((r) => r.json()) as { hits: Hit[] };
        setHits(j.hits); setSearched(q); setActive(0); setExpanded(new Set()); setOpen(true);
      } catch { /* aborted or offline */ }
    }, 140);
    return () => { clearTimeout(tm); c.abort(); };
  }, [q, locale]);

  // "/" or Ctrl/⌘+K focuses search (not while typing in another field).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) { e.preventDefault(); input.current?.focus(); input.current?.select(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);

  const shown = useMemo(() => (q.trim().length < 2 ? [] : hits), [q, hits]);
  // Group, cap each group, and flatten in display order for keyboard navigation.
  const groups = useMemo(() => GROUPS.map((g) => {
    const all = shown.filter((h) => g.types.includes(h.type));
    return { ...g, all, rows: expanded.has(g.key) ? all : all.slice(0, g.max) };
  }).filter((g) => g.all.length), [shown, expanded]);
  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const synonym = shown.find((h) => h.via_synonym && !h.reconciled);
  const empty = q.trim().length >= 2 && searched === q && hits.length === 0;
  const pick = (h: SearchHit) => { onPick(h); setOpen(false); setQ(""); input.current?.blur(); };

  return (
    <div className="relative w-full">
      <label htmlFor={`${listId}-in`} className="sr-only">{t.search_placeholder}</label>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 h-11 focus-within:border-brand-deep focus-within:ring-2 focus-within:ring-brand/25 transition-[border-color,box-shadow]">
        <Search aria-hidden size={18} strokeWidth={1.75} className="text-ink-3 shrink-0" />
        <input
          id={`${listId}-in`} ref={input} value={q} autoFocus={autoFocus} autoComplete="off" spellCheck={false}
          role="combobox" aria-autocomplete="list" aria-expanded={open && flat.length > 0} aria-controls={listId} aria-activedescendant={open && flat[active] ? `${listId}-${active}` : undefined}
          placeholder={t.search_placeholder}
          onChange={(e) => setQ(e.target.value)} onFocus={() => shown.length > 0 && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, flat.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && flat[active]) { e.preventDefault(); pick(flat[active]); }
            else if (e.key === "Escape") { if (open) setOpen(false); else { setQ(""); input.current?.blur(); } }
          }}
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-3 truncate"
        />
        <kbd className="hidden md:inline-flex items-center gap-0.5 text-[11px] text-ink-3 border border-line rounded px-1.5 py-0.5"><Command aria-hidden size={11} />K</kbd>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{open && q.trim().length >= 2 ? `${shown.length} results` : ""}</p>
      <AnimatePresence>
        {open && (flat.length > 0 || empty) && (
          <motion.div
            initial={{ opacity: 0, y: -motionTokens.distance.xs }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={springs.instant}
            className="absolute z-40 mt-2 w-full max-h-[70vh] overflow-auto rounded-xl border border-line bg-paper shadow-xl shadow-ink/10 py-1"
          >
            {empty ? (
              <div className="px-4 py-3 text-sm">
                <p className="text-ink-2">{t.search_empty.replace("{q}", q.trim())}</p>
                {/* S1 → S7: the honest no-route page (what we searched · what is missing · how to help). */}
                <a href={`/atlas?q=${encodeURIComponent(q.trim())}&p=${persona ?? "maria"}&l=${locale}`} onMouseDown={(e) => e.preventDefault()}
                  className="mt-1 inline-block text-xs font-medium text-brand-deep hover:underline">{t.search_no_route}</a>
              </div>
            ) : (
              <ul id={listId} role="listbox" aria-label={t.search_placeholder}>
                {synonym && (
                  <li role="presentation" className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-widest text-ink-3">
                    {t.search_group.synonym} <span className="normal-case tracking-normal text-ink-2">“{synonym.matched}” → {synonym.name}</span>
                  </li>
                )}
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    <li role="presentation" className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-widest text-ink-3">{t.search_group[g.key]}</li>
                    {g.rows.map((h) => {
                      const i = flat.indexOf(h);
                      return (
                        <li key={h.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                          onMouseDown={(e) => { e.preventDefault(); pick(h); }} onMouseEnter={() => setActive(i)}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${i === active ? "bg-brand-soft" : ""}`}>
                          <TypeIcon type={h.type} size={16} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-ink truncate"><Mark text={h.name} q={q} /></span>
                            <span className="flex items-center gap-1.5 text-xs text-ink-3 min-w-0">
                              {(h.via_synonym || h.reconciled) && (
                                <span className="chip !py-0 !px-1.5 !text-[11px] shrink-0 max-w-[60%] truncate" title={h.reconciled ? t.reconciled : t.synonym}>
                                  <span className="truncate">“{h.matched}”</span><span aria-hidden>→</span><span className="sr-only">{h.reconciled ? t.reconciled : t.synonym}</span><span className="truncate">{h.name}</span>
                                </span>
                              )}
                              <span className="truncate">{h.reconciled ? t.reconciled : h.via_definition ? t.search_via_definition : h.sub}</span>
                            </span>
                          </span>
                        </li>
                      );
                    })}
                    {g.all.length > g.rows.length && (
                      <li role="presentation">
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); setExpanded((s) => new Set(s).add(g.key)); }}
                          className="w-full px-3 py-1.5 text-left text-xs text-brand-deep hover:underline">
                          {t.search_more.replace("{n}", String(g.all.length - g.rows.length))}
                        </button>
                      </li>
                    )}
                  </Fragment>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Highlight the matching part of a name (accent-insensitive). */
function Mark({ text, q }: { text: string; q: string }) {
  const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const i = n(text).indexOf(n(q.trim()));
  if (i < 0 || !q.trim()) return <>{text}</>;
  const j = i + q.trim().length;
  return <>{text.slice(0, i)}<mark className="bg-brand-soft text-ink rounded-sm">{text.slice(i, j)}</mark>{text.slice(j)}</>;
}
