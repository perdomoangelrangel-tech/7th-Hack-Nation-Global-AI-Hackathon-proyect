"use client";
/**
 * 10× view: typical route vs Nexmed route to "launch a shared natural-history study", as two animated
 * timelines on one weeks axis. Every duration is labeled "assumption" with its rationale; reduced motion = static.
 */
import { motion, useReducedMotion } from "motion/react";
import type { Locale } from "@/lib/i18n";
import type { TenX as TenXData, Phase } from "@/lib/journey/tenx";
import { motionTokens } from "@/lib/motion";

const C = {
  en: { title: "The 10× route", milestone: "Milestone", typical: "Typical route", nexmed: "With Nexmed", discovery: "Discovery", protocol: "Protocol & ethics", week: "week", weeks: "weeks", months: "months", assumption: "assumption", why: "Rationale", what: "What the atlas gives you", validate: "What must be validated next", cited: "cited edges", discovery_gain: "Discovery phase", unchanged: "Nexmed does not shorten this unless an existing study already enrolls your disease.", total: "Whole milestone" },
  es: { title: "La ruta 10×", milestone: "Hito", typical: "Ruta típica", nexmed: "Con Nexmed", discovery: "Descubrimiento", protocol: "Protocolo y ética", week: "semana", weeks: "semanas", months: "meses", assumption: "supuesto", why: "Razón", what: "Qué te da el atlas", validate: "Qué hay que validar después", cited: "aristas citadas", discovery_gain: "Fase de descubrimiento", unchanged: "Nexmed no acorta esto salvo que un estudio existente ya incluya tu enfermedad.", total: "Hito completo" },
};

const fmt = (w: number, c: (typeof C)["en"]) => (w === 0 ? "0" : w >= 8 ? `${Math.round(w / 4.345)} ${c.months}` : w < 1 ? `${Math.max(1, Math.round(w * 7))} d` : `${Math.round(w)} ${Math.round(w) === 1 ? c.week : c.weeks}`);
const range = (a: number, b: number, c: (typeof C)["en"]) => `${fmt(a, c)}–${fmt(b, c)}`;

export function TenX({ data, locale }: { data: TenXData; locale: Locale }) {
  const c = C[locale];
  const reduce = useReducedMotion();
  const axis = data.total.typical[1];
  return (
    <div>
      <p className="text-[11px] uppercase tracking-widest text-ink-3">{c.milestone}</p>
      <p className="serif text-lg text-brand-ink leading-snug mt-0.5">{data.milestone}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label={c.discovery_gain} value={`${range(data.discovery.typical[0], data.discovery.typical[1], c)} → ${range(data.discovery.nexmed[0], data.discovery.nexmed[1], c)}`} note={`≈${Math.min(...data.discovery.ratio)}–${Math.max(...data.discovery.ratio)}× · ${c.assumption}`} strong />
        <Stat label={c.total} value={`${range(data.total.typical[0], data.total.typical[1], c)} → ${range(data.total.nexmed[0], data.total.nexmed[1], c)}`} note={c.assumption} />
      </div>

      <div className="mt-5 space-y-4" role="img" aria-label={`${c.typical}: ${range(data.total.typical[0], data.total.typical[1], c)}. ${c.nexmed}: ${range(data.total.nexmed[0], data.total.nexmed[1], c)}. ${data.assumption_note}`}>
        <Lane label={c.typical} phases={data.phases} k="typical" axis={axis} reduce={!!reduce} />
        <Lane label={c.nexmed} phases={data.phases} k="nexmed" axis={axis} reduce={!!reduce} />
        <div className="flex justify-between text-[10px] text-ink-3 tabular-nums" aria-hidden>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => <span key={f}>{fmt(axis * f, c)}</span>)}
        </div>
        <p className="flex gap-4 text-[11px] text-ink-2" aria-hidden>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-brand" />{c.discovery}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-brand-ink/70" />{c.protocol}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-brand/25 border border-dashed border-brand" />{c.assumption} (min–max)</span>
        </p>
      </div>

      <ol className="mt-5 space-y-3">
        {data.phases.map((p, i) => (
          <li key={p.id} className="rounded-lg border border-line p-3">
            <p className="text-sm font-medium"><span className="text-ink-3 mr-1.5">{i + 1}.</span>{p.label}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs">
              <div>
                <p className="text-ink-3">{c.typical} · <span className="tabular-nums text-ink-2">{range(p.typical.min, p.typical.max, c)}</span> <Assume c={c} /></p>
                <p className="text-ink-2 mt-0.5">{p.typical.rationale}</p>
              </div>
              <div>
                <p className="text-ink-3">{c.nexmed} · <span className="tabular-nums text-brand-deep font-medium">{range(p.nexmed.min, p.nexmed.max, c)}</span> <Assume c={c} /></p>
                <p className="text-ink mt-0.5">{p.nexmed.what}</p>
                <p className="text-ink-3 mt-0.5">{p.nexmed.rationale}{p.nexmed.cite ? ` · ${p.nexmed.cite.edges.length} ${c.cited}` : ""}</p>
              </div>
            </div>
            {!p.discovery && <p className="mt-2 text-[11px] text-ink-3">{c.unchanged}</p>}
          </li>
        ))}
      </ol>

      <div className="mt-4 rounded-lg border border-dashed border-brand-deep/40 bg-brand-mist px-3 py-2">
        <p className="text-[11px] uppercase tracking-wider text-brand-deep">{c.validate}</p>
        <ul className="mt-1 text-sm text-ink-2 list-disc pl-4 space-y-0.5">{data.validate_next.map((v) => <li key={v}>{v}</li>)}</ul>
      </div>
      <p className="mt-3 text-[11px] text-ink-3">{data.assumption_note}</p>
    </div>
  );
}

function Lane({ label, phases, k, axis, reduce }: { label: string; phases: Phase[]; k: "typical" | "nexmed"; axis: number; reduce: boolean }) {
  // Phases chain at their midpoint estimate.
  const starts = phases.map((_, i) => phases.slice(0, i).reduce((s, p) => s + (p[k].min + p[k].max) / 2, 0));
  return (
    <div>
      <p className="text-xs font-medium text-ink-2 mb-1">{label}</p>
      <div className="relative h-7 rounded-md bg-paper-2 overflow-hidden" style={{ perspective: 600 }}>
        {phases.map((p, i) => {
          const s = p[k]; const left = starts[i] / axis; const wMin = s.min / axis; const wMax = s.max / axis;
          const solid = p.discovery ? "bg-brand" : "bg-brand-ink/70";
          return (
            <motion.div key={p.id} className="absolute top-1 bottom-1 origin-left" style={{ left: `${left * 100}%`, width: `${Math.max(wMax * 100, 0.6)}%` }}
              initial={reduce ? false : { scaleX: 0, rotateX: 35, opacity: 0 }} animate={{ scaleX: 1, rotateX: 0, opacity: 1 }}
              transition={{ duration: reduce ? 0 : motionTokens.duration.slow, ease: motionTokens.easing.smooth, delay: reduce ? 0 : (k === "nexmed" ? 0.5 : 0) + i * 0.18 }}>
              <span className={`absolute inset-y-0 left-0 rounded-sm ${solid}`} style={{ width: `${(wMin / Math.max(wMax, 1e-9)) * 100}%`, minWidth: 3 }} title={p.label} />
              <span className="absolute inset-0 rounded-sm border border-dashed border-brand bg-brand/20" />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, note, strong }: { label: string; value: string; note: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${strong ? "border-brand/50 bg-brand-mist" : "border-line"}`}>
      <p className="text-[11px] uppercase tracking-wider text-ink-3">{label}</p>
      <p className={`mt-1 tabular-nums ${strong ? "text-brand-deep font-semibold" : "text-ink-2"} text-sm`}>{value}</p>
      <p className="text-[11px] text-ink-3 mt-0.5">{note}</p>
    </div>
  );
}

const Assume = ({ c }: { c: (typeof C)["en"] }) => <span className="ml-1 inline-flex rounded-full border border-dashed border-ink-3/50 px-1.5 text-[10px] text-ink-3">{c.assumption}</span>;
