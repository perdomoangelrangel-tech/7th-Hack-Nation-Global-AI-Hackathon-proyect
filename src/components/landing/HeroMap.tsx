"use client";
/**
 * Hero visual: a sample transit map of Dravet syndrome (ORPHA:33069).
 * Two hand-laid compositions: wide (md+) and compact (<md) so labels stay ≥ 11px at 390px.
 * Only IDs we are sure of are printed; everything else carries a plain label.
 */
import { useCopy } from "@/lib/i18n";
import { copy, LINE } from "./copy";
import { Hub, Label, Station } from "./map";

const W = 7; // route stroke width

function Route({ d, color, gap = false }: { d: string; color?: string; gap?: boolean }) {
  return gap ? (
    <path d={d} className="route route-gap" strokeWidth={W - 1} />
  ) : (
    <path d={d} className="route" stroke={color} strokeWidth={W} />
  );
}

export function HeroMap() {
  const t = useCopy(copy).hero;
  return (
    <figure className="relative m-0 w-full">
      <svg viewBox="0 0 640 545" className="hidden h-auto w-full md:block" role="img" aria-label={t.mapLabel}>
        {/* routes */}
        <Route d="M260 250 V160 L200 100" color={LINE.gene} />
        <Route d="M260 250 L340 170 H620" color={LINE.pheno} />
        <Route d="M400 460 V524" gap />
        <Route d="M260 250 H340 L400 310 V460" color={LINE.treat} />
        <Route d="M260 250 L190 320 H100" color={LINE.trial} />
        <Route d="M260 250 V430" color={LINE.comm} />

        {/* stations */}
        <Station x={200} y={100} color={LINE.gene} />
        <Station x={410} y={170} color={LINE.pheno} />
        <Station x={550} y={170} color={LINE.pheno} />
        <Station x={400} y={330} color={LINE.treat} />
        <Station x={400} y={395} color={LINE.treat} />
        <Station x={400} y={460} color={LINE.treat} />
        <Station x={400} y={526} gap r={10} />
        <Station x={100} y={320} color={LINE.trial} />
        <Station x={260} y={430} color={LINE.comm} />
        <Hub x={260} y={250} />

        {/* plaques */}
        <Label x={232} y={243} anchor="end" lines={t.hub} code="ORPHA:33069" size={20} codeSize={13} />
        <Label x={182} y={97} anchor="end" lines={["SCN1A"]} code={t.gene} size={17} />
        <Label x={410} y={127} anchor="middle" lines={[t.seizure]} code="HP:0001250" />
        <Label x={550} y={127} anchor="middle" lines={[t.febrile]} code="HP:0002373" />
        {t.treatments.map((name, i) => (
          <Label key={name} x={420} y={[330, 395, 460][i] - 3} lines={[name]} code={t.approved} size={16} />
        ))}
        <Label x={422} y={521} lines={t.gap} size={14} muted />
        <Label x={100} y={350} anchor="middle" lines={[t.trials]} code="ClinicalTrials.gov" />
        <Label x={242} y={426} anchor="end" lines={t.community} code={t.org} />
      </svg>

      <svg viewBox="0 0 360 440" className="h-auto w-full md:hidden" role="img" aria-label={t.mapLabel}>
        <Route d="M170 190 V130 L120 80" color={LINE.gene} />
        <Route d="M170 190 L230 130 H352" color={LINE.pheno} />
        <Route d="M250 350 V402" gap />
        <Route d="M170 190 H210 L250 230 V350" color={LINE.treat} />
        <Route d="M170 190 L120 240 H66" color={LINE.trial} />
        <Route d="M170 190 V340" color={LINE.comm} />

        <Station x={120} y={80} color={LINE.gene} r={8} />
        <Station x={284} y={130} color={LINE.pheno} r={8} />
        <Station x={250} y={250} color={LINE.treat} r={8} />
        <Station x={250} y={300} color={LINE.treat} r={8} />
        <Station x={250} y={350} color={LINE.treat} r={8} />
        <Station x={250} y={404} gap r={9} />
        <Station x={66} y={240} color={LINE.trial} r={8} />
        <Station x={170} y={340} color={LINE.comm} r={8} />
        <Hub x={170} y={190} r={15} />

        <Label x={142} y={167} anchor="end" lines={t.hubShort} code="ORPHA:33069" size={15} codeSize={11} />
        <Label x={104} y={80} anchor="end" lines={["SCN1A"]} code={t.geneShort} size={15} codeSize={11} />
        <Label x={284} y={99} anchor="middle" lines={[t.seizure]} code="HP:0001250" size={14} codeSize={11} />
        {t.treatments.map((name, i) => (
          <Label key={name} x={265} y={[250, 300, 350][i] - 2} lines={[name]} code={t.approvedShort} size={14} codeSize={11} />
        ))}
        <Label x={266} y={400} lines={t.gap} size={13} muted />
        <Label x={66} y={268} anchor="middle" lines={[t.trials]} code="ClinicalTrials.gov" size={14} codeSize={10} />
        <Label x={154} y={336} anchor="end" lines={t.communityShort} code={t.org} size={14} codeSize={11} />
      </svg>

      <figcaption className="mt-1 font-mono text-[0.8125rem] text-ink-3 md:absolute md:bottom-1 md:left-0 md:mt-0">
        {t.sample}
      </figcaption>
    </figure>
  );
}
