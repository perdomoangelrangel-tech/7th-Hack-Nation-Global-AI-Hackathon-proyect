"use client";
/**
 * Scale: the same ingestion for any Orphanet code. Five demo diseases (from supabase/seed/diseases.json)
 * highlighted inside a network that multiplies left → right. Live counters are passed in from the server
 * and simply don't render when the graph can't be reached.
 */
import type { ReactNode } from "react";
import { useCopy } from "@/lib/i18n";
import { copy, LINE, type LineKey } from "./copy";
import { Station } from "./map";
import { Head, Section, wrap } from "./Section";

const DEMO: { orpha: string; line: LineKey }[] = [
  { orpha: "ORPHA:33069", line: "gene" },
  { orpha: "ORPHA:778", line: "treat" },
  { orpha: "ORPHA:505652", line: "trial" },
  { orpha: "ORPHA:72", line: "comm" },
  { orpha: "ORPHA:228349", line: "pheno" },
];
const DOT: Record<LineKey, string> = { gene: "bg-gene", treat: "bg-treat", trial: "bg-trial", comm: "bg-comm", pheno: "bg-pheno", lit: "bg-lit" };

/** Deterministic PRNG so server and client draw the same network. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Each demo disease starts a line that walks right on a 45° lattice and keeps branching:
 * five stations become a dense network. Same pipeline, more codes.
 */
function network(w: number, h: number, step: number, rows: number[], seed: number, x0: number, split: number, cap: number) {
  const rnd = mulberry32(seed);
  const top = step * 0.75;
  const bottom = h - step * 0.75;
  return rows.map((y0) => {
    let walkers = [{ y: y0, dy: 0 }];
    let d = "";
    const nodes = new Set<string>();
    for (let x = x0; x + step <= w - step / 2; x += step) {
      const next: { y: number; dy: number }[] = [];
      for (const wk of walkers) {
        const r = rnd();
        let dy = r < 0.5 ? 0 : r < 0.75 ? -step : step;
        if (wk.y + dy < top || wk.y + dy > bottom) dy = 0;
        d += `M${x} ${wk.y}L${x + step} ${wk.y + dy}`;
        nodes.add(`${x + step},${wk.y + dy}`);
        next.push({ y: wk.y + dy, dy });
        if (next.length < cap && rnd() < split) {
          const alt = dy === 0 ? (rnd() < 0.5 ? -step : step) : 0;
          if (wk.y + alt >= top && wk.y + alt <= bottom) {
            d += `M${x} ${wk.y}L${x + step} ${wk.y + alt}`;
            nodes.add(`${x + step},${wk.y + alt}`);
            next.push({ y: wk.y + alt, dy: alt });
          }
        }
      }
      // merge walkers that landed on the same point
      const seen = new Set<number>();
      walkers = next.filter((n) => (seen.has(n.y) ? false : (seen.add(n.y), true)));
    }
    const rr = step * 0.07;
    const dots = [...nodes]
      .map((k) => k.split(",").map(Number))
      .map(([x, y]) => `M${x - rr} ${y}a${rr} ${rr} 0 1 0 ${2 * rr} 0a${rr} ${rr} 0 1 0 ${-2 * rr} 0`)
      .join("");
    return { d, dots };
  });
}

const WIDE_X0 = 40;
const WIDE_ROWS = [56, 120, 184, 248, 344];
const WIDE = network(880, 400, 32, WIDE_ROWS, 7, WIDE_X0, 0.24, 14);
const COMPACT_X0 = 24;
const COMPACT_ROWS = [48, 96, 120, 168, 216];
const COMPACT = network(360, 240, 24, COMPACT_ROWS, 11, COMPACT_X0, 0.26, 9);

function Field({ net, x0, rows, w, h, stroke, r, label }: { net: ReturnType<typeof network>; x0: number; rows: number[]; w: number; h: number; stroke: number; r: number; label: string }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={label}>
      {net.map((t, i) => (
        <path key={i} d={t.d} stroke={LINE[DEMO[i].line]} strokeOpacity={0.8} strokeWidth={stroke} strokeLinecap="round" fill="none" />
      ))}
      {net.map((t, i) => (
        <path key={i} d={t.dots} fill="var(--ink-2)" />
      ))}
      {rows.map((y, i) => (
        <Station key={i} x={x0} y={y} r={r} color={LINE[DEMO[i].line]} />
      ))}
    </svg>
  );
}

export function Scale({ counters }: { counters?: ReactNode }) {
  const t = useCopy(copy).scale;
  return (
    <Section id="scale">
      <div className={wrap}>
        <Head id="scale" title={t.title} lead={t.lead} />

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-12">
          <div>
            <p className="flex items-baseline gap-3">
              <span className="font-display text-[clamp(3rem,6vw,4.5rem)] font-extrabold leading-none tabular-nums">5</span>
              <span className="text-lg text-ink-2">{t.from}</span>
            </p>
            <ul className="mt-6 divide-y divide-rule border-y border-rule">
              {t.diseases.map((name, i) => (
                <li key={DEMO[i].orpha} className="flex items-center gap-3 py-3">
                  <span aria-hidden className={`size-4 shrink-0 rounded-full border-2 border-ink ${DOT[DEMO[i].line]}`} />
                  <span className="min-w-0 flex-1 font-semibold leading-snug">{name}</span>
                  <span className="font-mono text-[0.8125rem] text-ink-2">{DEMO[i].orpha}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="hidden md:block">
              <Field net={WIDE} x0={WIDE_X0} rows={WIDE_ROWS} w={880} h={400} stroke={3} r={10} label={t.mapLabel} />
            </div>
            <div className="md:hidden">
              <Field net={COMPACT} x0={COMPACT_X0} rows={COMPACT_ROWS} w={360} h={240} stroke={2.5} r={7} label={t.mapLabel} />
            </div>
            <p className="mt-4 flex flex-wrap items-baseline justify-end gap-x-3 text-right">
              <span className="font-display text-[clamp(3rem,6vw,4.5rem)] font-extrabold leading-none tabular-nums">5,000+</span>
              <span className="text-lg text-ink-2">{t.to}</span>
            </p>
          </div>
        </div>

        {counters}
      </div>
    </Section>
  );
}
