"use client";
/**
 * The challenge's core idea: diseases are connected through shared symptoms, drugs, trials and people.
 * One real, sourced example drawn as interchanges between disease lines (IDs and counts supplied by
 * the data lane from the live graph, retrieved 2026-10-03):
 *   CDKL5 deficiency (ORPHA:505652) ⟷ Dravet syndrome (ORPHA:33069): 4 shared HPO symptoms, fenfluramine,
 *   soticlestat, 2 shared PubMed researchers. Rett syndrome (ORPHA:778) also stops at fenfluramine.
 * Line colors match the Scale section (Dravet = gene, CDKL5 = trial, Rett = treat).
 */
import Link from "next/link";
import { useCopy } from "@/lib/i18n";
import { copy, LINE } from "./copy";
import { ArrowRight } from "./icons";
import { Label, Station } from "./map";
import { Head, Section, wrap } from "./Section";

const HALO = "var(--panel)";
const TEXT: Record<string, string> = { gene: "var(--t-gene)", trial: "var(--t-trial)", treat: "var(--t-treat)" };

/** Interchange drawn as a pill spanning parallel lines. */
function Pill({ x, y, w, h, vertical = true }: { x: number; y: number; w: number; h: number; vertical?: boolean }) {
  const r = vertical ? w / 2 : h / 2;
  return <rect x={x} y={y} width={w} height={h} rx={r} fill="var(--canvas)" stroke="var(--ink)" strokeWidth={4} />;
}

/** Fenfluramine's three evidence lines, each led by its disease in the line's text color. */
function Evidence({ x, y, step, size, rows }: { x: number; y: number; step: number; size: number; rows: { who: string; what: string; line: string }[] }) {
  return (
    <text x={x} y={y} stroke={HALO} strokeWidth={5} strokeLinejoin="round" style={{ paintOrder: "stroke" }} className="font-mono" fontSize={size}>
      {rows.map((r, i) => (
        <tspan key={r.who} x={x} dy={i === 0 ? 0 : step}>
          <tspan fill={TEXT[r.line]} fontWeight={700}>{r.who}</tspan>
          <tspan fill="var(--ink-2)">{` · ${r.what}`}</tspan>
        </tspan>
      ))}
    </text>
  );
}

function Sub({ children }: { children: string }) {
  return (
    <tspan className="font-sans" fill="var(--ink-2)" fontWeight={500}>
      {children}
    </tspan>
  );
}

function WideMap() {
  const t = useCopy(copy).connections;
  return (
    <svg viewBox="0 0 1200 430" className="hidden h-auto w-full md:block" role="img" aria-label={t.mapLabel}>
      <path d="M240 400 H348 L520 228 H620 L792 400 H860" className="route" stroke={LINE.treat} strokeWidth={7} />
      <path d="M40 120 H200 L280 200 H1040 L1120 120 H1190" className="route" stroke={LINE.gene} strokeWidth={7} />
      <path d="M40 300 H200 L286 214 H1040 L1126 300 H1190" className="route" stroke={LINE.trial} strokeWidth={7} />

      <Station x={40} y={120} r={10} color={LINE.gene} />
      <Station x={40} y={300} r={10} color={LINE.trial} />
      <Station x={240} y={400} r={10} color={LINE.treat} />
      <Pill x={339} y={188} w={26} h={38} />
      <Pill x={556} y={187} w={28} h={54} />
      <Pill x={772} y={188} w={26} h={38} />
      <Pill x={977} y={188} w={26} h={38} />

      <Label x={40} y={84} lines={t.dravet} code="ORPHA:33069" size={17} halo={HALO} />
      <Label x={40} y={336} lines={t.cdkl5} code="ORPHA:505652" size={17} halo={HALO} />
      <Label x={222} y={396} anchor="end" lines={t.rett} code="ORPHA:778" size={17} halo={HALO} />

      <Label x={352} y={158} anchor="middle" lines={[t.symptoms]} code="HPO" size={16} halo={HALO} />
      <Label x={570} y={98} anchor="middle" lines={[t.fenfluramine]} size={18} halo={HALO} />
      <Evidence x={455} y={124} step={18} size={12} rows={t.fenf} />
      <Label x={785} y={158} anchor="middle" lines={[t.soticlestat]} code={<Sub>{t.investigational}</Sub>} size={16} codeSize={13} halo={HALO} />
      <Label x={990} y={139} anchor="middle" lines={t.researchers} code="PubMed" size={16} halo={HALO} />
    </svg>
  );
}

function CompactMap() {
  const t = useCopy(copy).connections;
  return (
    <svg viewBox="0 0 360 650" className="h-auto w-full md:hidden" role="img" aria-label={t.mapLabel}>
      <path d="M30 290 V304 L96 370 V410 L30 476 V492" className="route" stroke={LINE.treat} strokeWidth={6} />
      <path d="M110 40 V640" className="route" stroke={LINE.gene} strokeWidth={6} />
      <path d="M250 110 V130 L124 256 V640" className="route" stroke={LINE.trial} strokeWidth={6} />

      <Station x={110} y={40} r={9} color={LINE.gene} />
      <Station x={250} y={110} r={9} color={LINE.trial} />
      <Station x={30} y={290} r={8} color={LINE.treat} />
      <Pill x={100} y={287} w={34} h={26} vertical={false} />
      <Pill x={84} y={377} w={52} h={26} vertical={false} />
      <Pill x={100} y={487} w={34} h={26} vertical={false} />
      <Pill x={100} y={567} w={34} h={26} vertical={false} />

      <Label x={130} y={38} lines={t.dravet} code="ORPHA:33069" size={15} codeSize={11} halo={HALO} />
      <Label x={266} y={104} lines={t.cdkl5Short} code="ORPHA:505652" size={14} codeSize={11} halo={HALO} />
      <Label x={14} y={238} lines={t.rettShort} code="ORPHA:778" size={13} codeSize={10} halo={HALO} />

      <Label x={148} y={297} lines={[t.symptoms]} code="HPO" size={15} codeSize={11} halo={HALO} />
      <Label x={148} y={385} lines={[t.fenfluramine]} size={15} halo={HALO} />
      <Evidence x={148} y={403} step={16} size={10.5} rows={t.fenf} />
      <Label x={148} y={497} lines={[t.soticlestat]} code={<Sub>{t.investigational}</Sub>} size={15} codeSize={12} halo={HALO} />
      <Label x={148} y={575} lines={t.researchers} code="PubMed" size={15} codeSize={11} halo={HALO} />
    </svg>
  );
}

/** Marks a time label as our hypothesis, not a measured result. */
function Hyp({ label }: { label: string }) {
  return <span className="mt-2 inline-block rounded border border-rule px-1.5 align-[1px] font-mono text-[0.75rem] leading-5 text-ink-3">{label}</span>;
}

function Routes() {
  const t = useCopy(copy).connections.routes;
  const SOURCES = [
    { name: "Orphanet", line: LINE.comm },
    { name: "HPO", line: LINE.pheno },
    { name: "Monarch", line: LINE.lit },
    { name: "ClinVar", line: LINE.gene },
    { name: "ClinicalTrials.gov", line: LINE.trial },
    { name: "Open Targets", line: LINE.treat },
    { name: "PubMed", line: LINE.lit },
  ];
  return (
    <div className="mt-16 rounded-panel-lg border border-rule bg-canvas p-5 sm:p-8">
      <h3 className="text-2xl">{t.title}</h3>

      {/* today: seven dead-end stubs */}
      <div className="mt-8 grid gap-5 md:grid-cols-[200px_minmax(0,1fr)] md:items-center lg:grid-cols-[240px_minmax(0,1fr)]">
        <div>
          <p className="font-display text-xl font-extrabold">{t.today}</p>
          <p className="mt-1 font-mono text-[0.875rem] text-ink-2">
            {t.todayTime}
          </p>
          <Hyp label={t.hypothesis} />
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 lg:grid-cols-7">
          {SOURCES.map((s) => (
            <li key={s.name} className="flex flex-col gap-1.5">
              <svg width={64} height={20} viewBox="0 0 64 20" aria-hidden>
                <path d="M10 10 H50" className="route" stroke={s.line} strokeWidth={5} />
                <circle cx={10} cy={10} r={6} fill={s.line} stroke="var(--ink)" strokeWidth={2} />
                <path d="M57 3 V17" stroke="var(--ink)" strokeWidth={4} strokeLinecap="round" />
              </svg>
              <span className="text-[0.9375rem] leading-snug text-ink-2">{s.name}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Nedamex: one continuous route */}
      <div className="mt-10 grid gap-5 border-t border-rule pt-8 md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <div>
          <p className="font-display text-xl font-extrabold">{t.ned}</p>
          <p className="mt-1 font-mono text-[0.875rem] text-ink-2">
            {t.nedTime}
          </p>
          <Hyp label={t.hypothesis} />
        </div>
        <div className="relative">
          <span aria-hidden className="absolute bottom-3 left-[8px] top-3 w-[7px] rounded-full bg-ink md:bottom-auto md:left-[11px] md:right-[11px] md:top-[19px] md:h-[7px] md:w-auto" />
          <ol className="relative flex flex-col gap-4 md:flex-row md:justify-between md:gap-4">
            {t.steps.map((step, i) => (
              <li key={step} className="flex items-center gap-3 md:w-[9rem] md:flex-col md:items-start md:gap-3 lg:w-[10.5rem]">
                <span
                  aria-hidden
                  className={`size-[23px] shrink-0 rounded-full border-[2.5px] border-ink md:mt-[11px] ${i === t.steps.length - 1 ? "bg-ink" : "bg-canvas"}`}
                />
                <span className="text-[1.0625rem] leading-snug">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <details className="group mt-8 border-t border-rule pt-2">
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 font-display font-bold text-ink-2 hover:text-ink">
          {t.assumptionsLabel}
        </summary>
        <p className="max-w-[70ch] pb-1 text-[0.9375rem] text-ink-2">{t.assumptions}</p>
      </details>
    </div>
  );
}

export function Connections() {
  const t = useCopy(copy).connections;
  return (
    <Section id="connections" tone="panel">
      <div className={wrap}>
        <Head id="connections" title={t.title} lead={t.lead} />
        <div className="mt-12">
          <WideMap />
          <CompactMap />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link href="/atlas?d=ORPHA:505652" className="btn btn-primary max-sm:w-full max-sm:justify-center">
            {t.cta}
            <ArrowRight />
          </Link>
          <p className="font-mono text-[0.8125rem] text-ink-3">{t.live}</p>
        </div>
        <Routes />
      </div>
    </Section>
  );
}
