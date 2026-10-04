"use client";
/**
 * One global search (⌘K / "/"): results grouped by type in a fixed order — Diseases → Mechanisms → Genes → Symptoms →
 * Patient groups → Studies — with synonym resolution visible ("Munc18-1" → STXBP1) and the matching text highlighted.
 * Mechanism clusters come back too ("lysosomal storage" → the cluster and its diseases). Keyboard: arrows, Enter, Esc.
 * When local search finds nothing, the server asks /api/reconcile (ai lane) for the closest atlas entity — labeled as such.
 * Empty box on focus (WAVE 5B): "Browse diseases" — every disease grouped by mechanism cluster with its ORPHA code — plus
 * quick chips; results have type filters; footer actions "Request a disease" / "Suggest a source" open the co-creation
 * dialog (action lane) as a community request, never evidence.
 */
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Command, FilePlus2, Link2, Search } from "lucide-react";
import { openCoCreate } from "@/components/journey/events";
import { playSfx } from "@/lib/sfx";
import type { SearchHit } from "@/lib/atlas/store";
import type { Dict, Locale } from "@/lib/i18n";
import { motionTokens, springs } from "@/lib/motion";
import { api } from "./api";
import { TypeIcon } from "./icons";

type Hit = SearchHit & { reconciled?: boolean };
interface DiseaseRow { id: string; name: string; canonical_id?: string; cluster: string | null; cluster_label?: string | null; color: string | null }
const QUICK = ["STXBP1", "Dravet", "hand wringing", "Munc18-1"];
/** Type filters for results (keys of GROUPS; "all" = no filter). */
const FILTERS = ["all", "diseases", "genes", "symptoms", "medicines", "researchers", "trials", "groups"] as const;

/** Fixed group order (UX_WAVE4 S1). `max` = rows shown before "Show N more". */
const GROUPS: { key: string; types: string[]; max: number }[] = [
  { key: "diseases", types: ["disease"], max: 5 },
  { key: "mechanisms", types: ["cluster", "pathway", "mechanism"], max: 5 },
  { key: "genes", types: ["gene", "variant"], max: 5 },
  { key: "symptoms", types: ["phenotype"], max: 5 },
  { key: "medicines", types: ["treatment"], max: 5 },
  { key: "researchers", types: ["investigator"], max: 5 },
  { key: "trials", types: ["trial", "study"], max: 5 },
  { key: "groups", types: ["organization"], max: 5 },
];

export function SearchBox({ t, locale, persona, onPick, autoFocus }: { t: Dict; locale: Locale; persona?: string; onPick: (h: SearchHit) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searched, setSearched] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [diseases, setDiseases] = useState<DiseaseRow[] | null>(null);
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
    }, 120);
    return () => { clearTimeout(tm); c.abort(); };
  }, [q, locale]);

  // Initial focus is programmatic and skipped inside an iframe (browsers block cross-origin autofocus and log it).
  useEffect(() => {
    if (!autoFocus) return;
    let framed = true; try { framed = window.self !== window.top; } catch { /* cross-origin → framed */ }
    if (!framed) input.current?.focus();
  }, [autoFocus]);

  // "/" or Ctrl/⌘+K focuses search (not while typing in another field).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) { e.preventDefault(); input.current?.focus(); input.current?.select(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);

  // Browse list: loaded once, the first time the box opens empty.
  const browsing = open && q.trim().length < 2;
  useEffect(() => {
    if (!browsing || diseases) return;
    fetch(api(`/api/atlas/diseases?l=${locale}`)).then((r) => r.json()).then((j: { diseases: DiseaseRow[] }) => setDiseases(j.diseases)).catch(() => setDiseases([]));
  }, [browsing, diseases, locale]);
  const browseGroups = useMemo(() => {
    const m = new Map<string, { label: string; color: string | null; rows: DiseaseRow[] }>();
    for (const d of diseases ?? []) {
      const k = d.cluster ?? "none";
      if (!m.has(k)) m.set(k, { label: d.cluster_label ?? t.search_group.diseases, color: d.color, rows: [] });
      m.get(k)!.rows.push(d);
    }
    return [...m.values()].map((g) => ({ ...g, rows: g.rows.sort((a, b) => a.name.localeCompare(b.name)) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [diseases, t]);
  const request = (kind: "disease" | "source") => {
    openCoCreate("evidence", { title: `${kind === "disease" ? "Disease request" : "Source suggestion"}: ${q.trim()}`.replace(/: $/, ": ") });
    setOpen(false);
  };

  const shown = useMemo(() => (q.trim().length < 2 ? [] : hits), [q, hits]);
  // Group, cap each group, and flatten in display order for keyboard navigation.
  const groups = useMemo(() => GROUPS.filter((g) => filter === "all" || g.key === filter).map((g) => {
    const all = shown.filter((h) => g.types.includes(h.type));
    return { ...g, all, rows: expanded.has(g.key) ? all : all.slice(0, g.max) };
  }).filter((g) => g.all.length), [shown, expanded, filter]);
  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const synonym = shown.find((h) => h.via_synonym && !h.reconciled);
  const empty = q.trim().length >= 2 && searched === q && hits.length === 0;
  const pick = (h: SearchHit) => { playSfx("select"); onPick(h); setOpen(false); setQ(""); input.current?.blur(); };

  return (
    <div className="relative w-full">
      <label htmlFor={`${listId}-in`} className="sr-only">{t.search_placeholder}</label>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 h-11 focus-within:border-brand-deep focus-within:ring-2 focus-within:ring-brand/25 transition-[border-color,box-shadow]">
        <Search aria-hidden size={18} strokeWidth={1.75} className="text-ink-3 shrink-0" />
        <input
          id={`${listId}-in`} ref={input} value={q} autoComplete="off" spellCheck={false}
          role="combobox" aria-autocomplete="list" aria-expanded={open && flat.length > 0} aria-controls={listId} aria-activedescendant={open && flat[active] ? `${listId}-${active}` : undefined}
          placeholder={t.search_placeholder}
          onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); if (flat.length) playSfx("tick"); setActive((a) => Math.min(a + 1, flat.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); if (flat.length) playSfx("tick"); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && flat[active]) { e.preventDefault(); pick(flat[active]); }
            else if (e.key === "Escape") { if (open) setOpen(false); else { setQ(""); input.current?.blur(); } }
          }}
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-3 truncate"
        />
        <kbd className="hidden md:inline-flex items-center gap-0.5 text-[11px] text-ink-3 border border-line rounded px-1.5 py-0.5"><Command aria-hidden size={11} />K</kbd>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{open && q.trim().length >= 2 ? `${shown.length} results` : ""}</p>
      <AnimatePresence>
        {open && (browsing || flat.length > 0 || empty || shown.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -motionTokens.distance.xs }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={springs.instant}
            className="absolute z-40 mt-2 w-full max-h-[70vh] overflow-auto rounded-xl border border-line bg-paper shadow-xl shadow-ink/10 py-1"
          >
            {browsing ? (
              <div className="py-1">
                <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2 pb-1">
                  <span className="text-[11px] uppercase tracking-widest text-ink-3 mr-1">{t.search_try_label}</span>
                  {QUICK.map((x) => <button key={x} type="button" onMouseDown={(e) => { e.preventDefault(); setQ(x); }} className="chip hover:bg-brand-soft">{x}</button>)}
                </div>
                <p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-widest text-ink-3">{t.search_browse}</p>
                {!diseases ? <p className="px-3 py-2 text-sm text-ink-3">…</p> : (
                  <ul aria-label={t.search_browse}>
                    {browseGroups.map((g) => (
                      <li key={g.label}>
                        <p className="flex items-center gap-2 px-3 pt-2 pb-0.5 text-xs font-medium text-ink-2"><span className="w-2 h-2 rounded-full" style={{ background: g.color ?? undefined }} aria-hidden />{g.label}</p>
                        <ul>
                          {g.rows.map((d) => (
                            <li key={d.id}>
                              <button type="button" onMouseDown={(e) => { e.preventDefault(); pick({ id: d.id, type: "disease", name: d.name, matched: d.name, via_synonym: false, disease: d.id, sub: d.canonical_id ?? "" }); }}
                                className="flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-brand-soft">
                                <TypeIcon type="disease" size={14} /><span className="flex-1 text-sm text-ink truncate">{d.name}</span><span className="text-[11px] text-ink-3 tabular-nums">{d.canonical_id}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : empty ? (
              <div className="px-4 py-3 text-sm">
                <p className="text-ink-2">{t.search_empty.replace("{q}", q.trim())}</p>
                {/* S1 → S7: the honest no-route page (what we searched · what is missing · how to help). */}
                <a href={`/atlas?q=${encodeURIComponent(q.trim())}&p=${persona ?? "maria"}&l=${locale}`} onMouseDown={(e) => e.preventDefault()}
                  className="mt-1 inline-block text-xs font-medium text-brand-deep hover:underline">{t.search_no_route}</a>
              </div>
            ) : (
              <>
              <div role="group" aria-label={t.search_filter} className="flex flex-wrap gap-1 px-3 pt-2 pb-1">
                {FILTERS.map((f) => (
                  <button key={f} type="button" aria-pressed={filter === f} onMouseDown={(e) => { e.preventDefault(); setFilter(f); setActive(0); }}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] border ${filter === f ? "border-brand-deep bg-brand-soft text-ink" : "border-line text-ink-2 hover:bg-brand-mist"}`}>
                    {f === "all" ? t.search_all : t.search_group[f]}
                  </button>
                ))}
              </div>
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
              </>
            )}
            {/* Footer: ask for what is missing (community requests, never evidence). */}
            <div className="mt-1 flex flex-wrap gap-2 border-t border-line px-3 py-2">
              <button type="button" onMouseDown={(e) => { e.preventDefault(); request("disease"); }} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink-2 hover:bg-brand-mist"><FilePlus2 aria-hidden size={14} strokeWidth={1.75} />{t.search_request_disease}</button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); request("source"); }} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink-2 hover:bg-brand-mist"><Link2 aria-hidden size={14} strokeWidth={1.75} />{t.search_suggest_source}</button>
            </div>
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
