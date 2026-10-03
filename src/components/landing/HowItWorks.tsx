"use client";
/**
 * THE authored motion moment: the route draws itself as you scroll.
 * Seven source lines fan into the evidence graph, one trunk runs through the tools and the verifier gate
 * to the voice answer; a dashed branch leaves the gate for "no evidence in our sources".
 *
 * Progressive enhancement: server HTML and reduced-motion users get the map fully drawn.
 * Only after hydration, and only without reduced motion, is pathLength tied to scroll.
 */
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useCopy } from "@/lib/i18n";
import { copy, LINE, type LineKey } from "./copy";
import { Label, Station } from "./map";
import { Head, Section, wrap } from "./Section";

const SOURCES: { name: string; line: LineKey }[] = [
  { name: "Orphanet", line: "comm" },
  { name: "HPO", line: "pheno" },
  { name: "Monarch", line: "lit" },
  { name: "ClinVar", line: "gene" },
  { name: "ClinicalTrials.gov", line: "trial" },
  { name: "Open Targets", line: "treat" },
  { name: "PubMed", line: "lit" },
];

const noop = () => () => {};
function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** A route whose stroke is drawn by `progress` (0→1). Static path when not animating. */
function Drawn({
  d,
  progress,
  animate,
  stroke,
  strokeWidth,
}: {
  d: string;
  progress: MotionValue<number>;
  animate: boolean;
  stroke: string;
  strokeWidth?: number;
}) {
  if (!animate) return <path d={d} className="route" stroke={stroke} strokeWidth={strokeWidth} />;
  return <motion.path d={d} className="route" stroke={stroke} strokeWidth={strokeWidth} style={{ pathLength: progress }} />;
}

/** Dashed gap route revealed through a mask (pathLength would break the dash pattern). */
function DrawnGap({ d, progress, animate, width = 6 }: { d: string; progress: MotionValue<number>; animate: boolean; width?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <g>
      {animate ? (
        <defs>
          <mask id={`m${id}`} maskUnits="userSpaceOnUse">
            <motion.path d={d} fill="none" stroke="white" strokeWidth={width + 10} strokeLinecap="round" style={{ pathLength: progress }} />
          </mask>
        </defs>
      ) : null}
      <path d={d} className="route route-gap" strokeWidth={width} mask={animate ? `url(#m${id})` : undefined} />
    </g>
  );
}

function useDraw(offset: [string, string]) {
  const ref = useRef<HTMLDivElement>(null);
  // motion's offset type is a template-literal union; our strings are valid edge pairs.
  const { scrollYProgress } = useScroll({ target: ref, offset: offset as never });
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  return { ref, p: scrollYProgress, animate: hydrated && reduce !== true };
}

function Wide() {
  const t = useCopy(copy).how;
  const { ref, p, animate } = useDraw(["start 0.85", "end 0.6"]);
  const feeders = useTransform(p, [0, 0.3], [0, 1]);
  const trunk = useTransform(p, [0.28, 0.86], [0, 1]);
  const branch = useTransform(p, [0.63, 0.8], [0, 1]);

  const feeder = (i: number) => {
    const y = 260 + (i - 3) * 52;
    const b = 260 + (i - 3) * 9;
    return `M190 ${y} H250 L${250 + Math.abs(b - y)} ${b} H426`;
  };

  return (
    <div ref={ref} className="mt-14 hidden md:block">
      <svg viewBox="0 0 1200 470" className="h-auto w-full" aria-hidden="true">
        <Label x={172} y={66} anchor="end" lines={[t.sources]} size={13} muted />
        {SOURCES.map((s, i) => (
          <g key={s.name}>
            <Drawn d={feeder(i)} progress={feeders} animate={animate} stroke={LINE[s.line]} />
            <Station x={190} y={260 + (i - 3) * 52} r={7} color={LINE[s.line]} />
            <Label x={172} y={260 + (i - 3) * 52 + 5} anchor="end" lines={[s.name]} size={15} />
          </g>
        ))}

        <DrawnGap d="M840 260 L900 320 V384" progress={branch} animate={animate} />
        <Drawn d="M458 260 H1080" progress={trunk} animate={animate} stroke="var(--ink)" strokeWidth={8} />

        {/* evidence graph interchange */}
        <rect x={414} y={218} width={44} height={84} rx={22} fill="var(--canvas)" stroke="var(--ink)" strokeWidth={5} />
        <Station x={640} y={260} r={11} />
        <path d="M840 240 L860 260 L840 280 L820 260 Z" fill="var(--l-pheno)" stroke="var(--ink)" strokeWidth={3} strokeLinejoin="round" />
        <circle cx={1080} cy={260} r={16} fill="var(--ink)" />
        <circle cx={1080} cy={260} r={6} fill="var(--canvas)" />
        <Station x={900} y={394} r={10} gap />

        <Label x={436} y={178} anchor="middle" lines={[t.graph[0]]} code={<Sub>{t.graph[1]}</Sub>} size={18} codeSize={14} />
        <Label x={640} y={212} anchor="middle" lines={[t.tools[0]]} code={<Sub>{t.tools[1]}</Sub>} size={18} codeSize={14} />
        <Label x={840} y={212} anchor="middle" lines={[t.gate[0]]} code={<GateSub text={t.gate[1]} />} size={18} codeSize={14} />
        <Label x={1080} y={212} anchor="middle" lines={[t.answer[0]]} code={<Sub>{t.answer[1]}</Sub>} size={18} codeSize={14} />
        <Label x={922} y={390} lines={t.none} size={17} />
      </svg>
    </div>
  );
}

function Compact() {
  const t = useCopy(copy).how;
  const { ref, p, animate } = useDraw(["start 0.8", "end 0.75"]);
  const feeders = useTransform(p, [0, 0.22], [0, 1]);
  const trunk = useTransform(p, [0.2, 0.9], [0, 1]);
  const branch = useTransform(p, [0.52, 0.68], [0, 1]);

  return (
    <div ref={ref} className="mt-10 md:hidden">
      <svg viewBox="0 0 360 800" className="h-auto w-full" aria-hidden="true">
        {SOURCES.map((s, i) => {
          const x = 22 + i * 10;
          const y = 26 + i * 34;
          return (
            <g key={s.name}>
              <Drawn d={`M${x} ${y} V300`} progress={feeders} animate={animate} stroke={LINE[s.line]} strokeWidth={5} />
              <Station x={x} y={y} r={4.5} color={LINE[s.line]} />
              <Label x={104} y={y + 5} lines={[s.name]} size={15} />
            </g>
          );
        })}
        <DrawnGap d="M52 550 L112 610 V666" progress={branch} animate={animate} />
        <Drawn d="M52 326 V766" progress={trunk} animate={animate} stroke="var(--ink)" strokeWidth={7} />

        <rect x={10} y={290} width={84} height={36} rx={18} fill="var(--canvas)" stroke="var(--ink)" strokeWidth={4.5} />
        <Station x={52} y={430} r={10} />
        <path d="M52 532 L70 550 L52 568 L34 550 Z" fill="var(--l-pheno)" stroke="var(--ink)" strokeWidth={3} strokeLinejoin="round" />
        <circle cx={52} cy={770} r={14} fill="var(--ink)" />
        <circle cx={52} cy={770} r={5} fill="var(--canvas)" />
        <Station x={112} y={676} r={9} gap />

        <Label x={110} y={304} lines={[t.graph[0]]} code={<Sub>{t.graph[1]}</Sub>} size={16} codeSize={13} />
        <Label x={80} y={426} lines={[t.tools[0]]} code={<Sub>{t.tools[1]}</Sub>} size={16} codeSize={13} />
        <Label x={86} y={546} lines={[t.gate[0]]} code={<GateSub text={t.gate[1]} />} size={16} codeSize={13} />
        <Label x={80} y={766} lines={[t.answer[0]]} code={<Sub>{t.answer[1]}</Sub>} size={16} codeSize={13} />
        <Label x={132} y={672} lines={t.none} size={15} />
      </svg>
    </div>
  );
}

/** Descriptive sub-line in the body face (mono is reserved for codes). */
function Sub({ children }: { children: ReactNode }) {
  return (
    <tspan className="font-sans" fill="var(--ink-2)" fontWeight={500}>
      {children}
    </tspan>
  );
}

/** "no evidence_id → dropped": the identifier stays in mono. */
function GateSub({ text }: { text: string }) {
  const [a, b] = text.split("evidence_id");
  return (
    <tspan className="font-sans" fill="var(--ink-2)" fontWeight={500}>
      {a}
      <tspan className="font-mono" fill="var(--ink)">evidence_id</tspan>
      {b}
    </tspan>
  );
}

export function HowItWorks() {
  const t = useCopy(copy).how;
  return (
    <Section id="how">
      <div className={wrap}>
        <Head id="how" title={t.title} lead={t.lead} />
        <ol className="sr-only">
          {t.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <Wide />
        <Compact />
      </div>
    </Section>
  );
}
