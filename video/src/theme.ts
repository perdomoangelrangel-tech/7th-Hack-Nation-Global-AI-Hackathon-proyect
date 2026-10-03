/**
 * Nedamex tokens, mirrored from src/app/globals.css (light theme).
 * Videos always render on the enamel-white panel. Keep these in sync with the app.
 */
export const C = {
  canvas: "oklch(0.985 0.003 250)",
  panel: "oklch(0.958 0.006 250)",
  panel2: "oklch(0.93 0.008 250)",
  ink: "oklch(0.21 0.025 265)",
  ink2: "oklch(0.37 0.025 265)",
  ink3: "oklch(0.49 0.02 265)",
  rule: "oklch(0.885 0.008 250)",
  onInk: "oklch(0.985 0.003 250)",

  // lines = evidence types
  gene: "oklch(0.6 0.21 32)",
  pheno: "oklch(0.84 0.165 88)",
  treat: "oklch(0.57 0.14 158)",
  trial: "oklch(0.49 0.17 262)",
  comm: "oklch(0.54 0.21 342)",
  lit: "oklch(0.45 0.02 265)",
  gap: "oklch(0.66 0.02 265)",

  // text-safe variants
  tGene: "oklch(0.5 0.19 32)",
  tTreat: "oklch(0.45 0.12 158)",
  tTrial: "oklch(0.45 0.17 262)",
  tComm: "oklch(0.47 0.2 342)",
  tPheno: "oklch(0.47 0.1 80)",
} as const;

export type LineKey = "gene" | "pheno" | "treat" | "trial" | "comm" | "lit" | "gap";

export const F = {
  display: "Overpass, ui-sans-serif, system-ui, sans-serif",
  body: "'Atkinson Hyperlegible Next', ui-sans-serif, system-ui, sans-serif",
  mono: "'Overpass Mono', ui-monospace, Menlo, monospace",
} as const;

export const FPS = 30;
export const W = 1920;
export const H = 1080;

/** Stroke sizes scaled for 1080p (the site uses 6px routes / 2.5px rings at ~1x). */
export const S = {
  route: 14,
  ring: 5,
  station: 17,
} as const;
