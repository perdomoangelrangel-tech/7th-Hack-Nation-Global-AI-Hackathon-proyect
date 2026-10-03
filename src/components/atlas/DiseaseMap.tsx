"use client";
/**
 * The disease as a transit map. Center = interchange (the disease); six lines radiate with 45° bends,
 * one per evidence type. Stations exist only when a source backs them; low-confidence stations are
 * hollow and dashed; an empty line is a dashed stub ending in "No evidence in our sources".
 * ≥ md: radial SVG + plaque panel. < md: vertical line diagram with inline plaques.
 */
import { useState, type KeyboardEvent } from "react";
import type { DiseaseMap as Atlas, LineKey, Station } from "@/lib/atlas-data";
import { clip } from "@/lib/agents/evidence";
import type { AtlasCopy } from "./copy";
import { LINE_META } from "./lines";
import { StationPlaque, stationCode } from "./Plaque";
import styles from "./atlas.module.css";

export type Selection = { line: LineKey; id?: string } | null;

const STEP = 44;
const VB_W = 1000;
const VB_H = 704;

interface Col { line: LineKey; x: number; dir: -1 | 1; trunk: string; first: number; slots: number; maxChars: number }

// Top row left→right, then bottom row (also the keyboard order).
const COLS: Col[] = [
  { line: "literature", x: 90, dir: -1, trunk: "M400 338 H150 L90 278", first: 238, slots: 5, maxChars: 36 },
  { line: "phenotypes", x: 430, dir: -1, trunk: "M430 330", first: 280, slots: 6, maxChars: 31 },
  { line: "genes", x: 740, dir: -1, trunk: "M600 338 H680 L740 278", first: 238, slots: 5, maxChars: 26 },
  { line: "trials", x: 90, dir: 1, trunk: "M400 362 H150 L90 422", first: 462, slots: 5, maxChars: 36 },
  { line: "community", x: 430, dir: 1, trunk: "M430 370", first: 420, slots: 6, maxChars: 31 },
  { line: "treatments", x: 740, dir: 1, trunk: "M600 362 H680 L740 422", first: 462, slots: 5, maxChars: 26 },
];

const MOBILE_ORDER: LineKey[] = ["genes", "phenotypes", "treatments", "trials", "literature", "community"];
const MOBILE_CAP = 5;

const slotY = (c: Col, i: number) => c.first + c.dir * i * STEP;

function fitColumn(c: Col, stations: Station[], total: number) {
  const count = Math.max(total, stations.length);
  if (count <= c.slots) return { shown: stations.slice(0, c.slots), more: 0 };
  const shown = stations.slice(0, c.slots - 1);
  return { shown, more: count - shown.length };
}

function onActivate(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
  };
}

export function DiseaseMap({ map, copy, selection, onSelect }: { map: Atlas; copy: AtlasCopy; selection: Selection; onSelect: (s: Selection) => void }) {
  return (
    <>
      <div className="hidden md:block">
        <RadialMap map={map} copy={copy} selection={selection} onSelect={onSelect} />
        <MapPanel map={map} copy={copy} selection={selection} onSelect={onSelect} />
      </div>
      <div className="md:hidden">
        <LineDiagram map={map} copy={copy} />
      </div>
    </>
  );
}

function RadialMap({ map, copy, selection, onSelect }: { map: Atlas; copy: AtlasCopy; selection: Selection; onSelect: (s: Selection) => void }) {
  const cols = COLS.map((c) => {
    const total = map.totals[c.line];
    const { shown, more } = fitColumn(c, map.lines[c.line], total);
    const empty = shown.length === 0;
    const lastSlot = empty ? 0 : shown.length - 1 + (more ? 1 : 0);
    const endY = slotY(c, lastSlot);
    // Terminus sign sits right past the line's last stop.
    const termY = c.dir === -1 ? endY - 36 : endY + 44;
    return { c, total, shown, more, empty, endY, termY };
  });
  // Crop the canvas to the lines actually drawn (short lines → compact map).
  const top = Math.max(0, Math.min(...cols.map((k) => k.termY)) - 22);
  const bottom = Math.min(VB_H, Math.max(...cols.map((k) => k.termY)) + 14);
  return (
    <svg viewBox={`0 ${top} ${VB_W} ${bottom - top}`} className="block h-auto w-full select-none" role="group" aria-label={`${copy.map.label}: ${map.disease.name}`}>
      {cols.map(({ c, total, shown, more, empty, endY, termY }, ci) => {
        const meta = LINE_META[c.line];
        const dimmed = selection && selection.line !== c.line;
        return (
          <g key={c.line} className={styles.dim} opacity={dimmed ? 0.3 : 1}>
            {empty ? (
              <path d={`${c.trunk} V ${endY}`} className="route route-gap" />
            ) : (
              <path d={`${c.trunk} V ${endY}`} pathLength={1} className={`route ${styles.draw}`} stroke={meta.stroke} style={{ animationDelay: `${ci * 40}ms` }} />
            )}
            {/* Terminus sign: line name + count; opens the station list */}
            <g role="button" tabIndex={0} aria-label={`${copy.lines[c.line]}: ${copy.map.inGraph(total)}`} className="group cursor-pointer outline-none"
              onClick={() => onSelect({ line: c.line })} onKeyDown={onActivate(() => onSelect({ line: c.line }))}>
              <rect x={c.x - 70} y={termY - 17} width={140} height={24} rx={12} className="fill-canvas stroke-rule opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-focus-visible:stroke-ink" strokeWidth={1.5} />
              <text x={c.x} y={termY} textAnchor="middle" className={`font-display text-[13px] font-extrabold tracking-[0.06em] ${meta.fill}`}>
                {copy.lineShort[c.line].toUpperCase()} <tspan className="font-mono font-medium fill-ink-3">{total}</tspan>
              </text>
            </g>
            {empty ? (
              <g>
                <circle cx={c.x} cy={endY} r={8} className="station-gap" strokeWidth={2.5} />
                <text x={c.x + 18} y={endY + 5} className="font-sans text-[14px] fill-ink-3">{copy.map.empty}</text>
              </g>
            ) : (
              shown.map((s, i) => {
                const y = slotY(c, i);
                const selected = selection?.id === s.id;
                const pick = () => onSelect(selected ? { line: c.line } : { line: c.line, id: s.id });
                return (
                  <g key={s.id} role="button" tabIndex={0} aria-pressed={selected}
                    aria-label={`${s.name}, ${copy.lines[c.line]}, ${copy.map.sources(s.evidence.length)}`}
                    className={`group cursor-pointer outline-none ${styles.pop}`} style={{ animationDelay: `${Math.min(120 + i * 50 + ci * 20, 420)}ms` }}
                    onClick={pick} onKeyDown={onActivate(pick)}>
                    <title>{s.name}</title>
                    <rect x={c.x - 22} y={y - 20} width={Math.round(c.maxChars * 8.1) + 40} height={40} fill="transparent" />
                    <circle cx={c.x} cy={y} r={14} fill="none" className={`stroke-ink transition-opacity duration-150 ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-30 group-focus-visible:opacity-100"}`} strokeWidth={2} />
                    <circle cx={c.x} cy={y} r={8} className={s.weak ? "station-gap" : "station"} fill={s.weak ? undefined : meta.stroke} strokeWidth={s.weak ? 2.5 : undefined} />
                    <text x={c.x + 20} y={y - 3} className={`font-sans text-[16px] ${selected ? "fill-ink font-bold" : "fill-ink"} group-hover:underline`}>{clip(s.name, c.maxChars)}</text>
                    <text x={c.x + 20} y={y + 14} className="font-mono text-[13px] fill-ink-3">{clip(stationCode(s, c.line, copy), c.maxChars + 4)}</text>
                  </g>
                );
              })
            )}
            {more > 0 && (
              <g role="button" tabIndex={0} aria-label={`${copy.lines[c.line]}: ${copy.map.more(more)}`} className="group cursor-pointer outline-none"
                onClick={() => onSelect({ line: c.line })} onKeyDown={onActivate(() => onSelect({ line: c.line }))}>
                <path d={`M ${c.x - 9} ${endY} H ${c.x + 9}`} stroke={meta.stroke} strokeWidth={6} strokeLinecap="round" />
                <rect x={c.x + 12} y={endY - 14} width={96} height={28} rx={14} className="fill-canvas stroke-rule group-hover:stroke-ink-3 group-focus-visible:stroke-ink" strokeWidth={1.5} />
                <text x={c.x + 60} y={endY + 5} textAnchor="middle" className={`font-display text-[13px] font-bold ${meta.fill}`}>{copy.map.more(more)}</text>
              </g>
            )}
          </g>
        );
      })}
      {/* Interchange: the disease */}
      <g>
        <rect x={400} y={322} width={200} height={56} rx={28} className="fill-canvas stroke-ink" strokeWidth={3} />
        <text x={500} y={349} textAnchor="middle" className="font-display text-[22px] font-extrabold fill-ink">{map.disease.short}</text>
        <text x={500} y={367} textAnchor="middle" className="font-mono text-[12px] fill-ink-3">{map.disease.orpha}</text>
      </g>
    </svg>
  );
}

function MapPanel({ map, copy, selection, onSelect }: { map: Atlas; copy: AtlasCopy; selection: Selection; onSelect: (s: Selection) => void }) {
  if (!selection) {
    return <p className="mt-2 border-t border-rule pt-3 text-sm text-ink-3">{copy.map.hint}</p>;
  }
  const line = selection.line;
  const station = selection.id ? map.lines[line].find((s) => s.id === selection.id) : undefined;
  if (station) {
    return (
      <div key={station.id} className={`mt-3 ${styles.fade}`}>
        <StationPlaque station={station} line={line} copy={copy} onBack={() => onSelect({ line })} onClose={() => onSelect(null)} />
      </div>
    );
  }
  return (
    <div key={line} className={`plaque mt-3 overflow-hidden ${styles.fade}`}>
      <div className={`h-1.5 ${LINE_META[line].bg}`} aria-hidden />
      <div className="p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className={`font-display text-lg font-bold ${LINE_META[line].text}`}>{copy.lines[line]}</h3>
          <button type="button" onClick={() => onSelect(null)} className="min-h-11 rounded-full px-3 text-sm text-ink-2 hover:bg-panel hover:text-ink">{copy.map.close}</button>
        </div>
        <p className="font-mono text-xs text-ink-3">{copy.map.showing(map.lines[line].length, Math.max(map.totals[line], map.lines[line].length))}</p>
        <StationList stations={map.lines[line]} line={line} copy={copy} onPick={(id) => onSelect({ line, id })} />
      </div>
    </div>
  );
}

function StationList({ stations, line, copy, onPick }: { stations: Station[]; line: LineKey; copy: AtlasCopy; onPick: (id: string) => void }) {
  if (!stations.length) return <p className="mt-3 text-sm text-ink-3">{copy.map.empty}</p>;
  return (
    <ul className="mt-3 grid max-h-80 gap-x-6 overflow-y-auto sm:grid-cols-2">
      {stations.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => onPick(s.id)} className="flex min-h-11 w-full items-center gap-3 rounded-md px-1 text-left hover:bg-panel">
            <Dot line={line} weak={s.weak} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{s.name}</span>
              <span className="block truncate font-mono text-xs text-ink-3">{stationCode(s, line, copy)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Dot({ line, weak, size = 14 }: { line: LineKey; weak?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden className="shrink-0">
      <circle cx={7} cy={7} r={5} className={weak ? "station-gap" : "station"} fill={weak ? undefined : LINE_META[line].stroke} strokeWidth={2} />
    </svg>
  );
}

/** < md: one vertical strip per line, inline plaques. */
function LineDiagram({ map, copy }: { map: Atlas; copy: AtlasCopy }) {
  const [open, setOpen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<LineKey>>(new Set());
  return (
    <div className="space-y-6" aria-label={copy.map.label}>
      <div className="flex items-center gap-3">
        <span className="rounded-full border-[3px] border-ink bg-canvas px-4 py-1.5 font-display text-lg font-extrabold">{map.disease.short}</span>
        <span className="font-mono text-xs text-ink-3">{map.disease.orpha}</span>
      </div>
      {MOBILE_ORDER.map((line) => {
        const meta = LINE_META[line];
        const stations = map.lines[line];
        const total = Math.max(map.totals[line], stations.length);
        const isOpen = expanded.has(line);
        const shown = isOpen ? stations : stations.slice(0, MOBILE_CAP);
        const more = isOpen ? 0 : total - shown.length;
        return (
          <section key={line} aria-labelledby={`ml-${line}`}>
            <h3 id={`ml-${line}`} className="flex items-center gap-2">
              <span className={`h-1.5 w-7 rounded-full ${meta.bg}`} aria-hidden />
              <span className={`font-display text-sm font-extrabold uppercase tracking-[0.06em] ${meta.text}`}>{copy.lines[line]}</span>
              <span className="font-mono text-xs text-ink-3">{total}</span>
            </h3>
            {stations.length === 0 ? (
              <div className="ml-[9px] mt-2 flex min-h-11 items-center gap-3 border-l-[5px] border-dashed border-gap pl-4 text-sm text-ink-3">{copy.map.empty}</div>
            ) : (
              <ol className="ml-[9px] mt-2 border-l-[5px]" style={{ borderColor: meta.stroke }}>
                {shown.map((s) => {
                  const isSel = open === s.id;
                  return (
                    <li key={s.id} className="relative">
                      <button type="button" aria-expanded={isSel} onClick={() => setOpen(isSel ? null : s.id)}
                        className="flex min-h-12 w-full items-center gap-3 py-1.5 pl-5 pr-2 text-left hover:bg-panel">
                        <span className="absolute -left-[12px] top-1/2 -translate-y-1/2"><Dot line={line} weak={s.weak} size={18} /></span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[15px] leading-snug text-ink ${isSel ? "font-bold" : ""}`}>{s.name}</span>
                          <span className="block truncate font-mono text-xs text-ink-3">{stationCode(s, line, copy)}</span>
                        </span>
                      </button>
                      {isSel && (
                        <div className={`mb-2 ml-4 ${styles.fade}`}>
                          <StationPlaque station={s} line={line} copy={copy} headingLevel={4} onClose={() => setOpen(null)} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {more > 0 && stations.length > shown.length && (
              <button type="button" onClick={() => setExpanded((e) => new Set(e).add(line))}
                className={`ml-6 mt-1 min-h-11 rounded-full px-3 font-display text-sm font-bold ${meta.text} hover:bg-panel`}>
                {copy.map.more(more)}
              </button>
            )}
            {more > 0 && stations.length <= shown.length && (
              <p className="ml-6 mt-1 font-mono text-xs text-ink-3">{copy.map.showing(stations.length, total)}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
