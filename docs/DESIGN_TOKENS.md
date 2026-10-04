# Nedamex design tokens — for the Lovable MVP

Owner: brand lane. Source of truth: `src/app/globals.css` (website) and `DESIGN.md` (rules). This file is the copy-paste kit so the Lovable app (TanStack Start + Vite + React 19 + Tailwind 4) looks exactly like the website: light only, logo blues, same type, same evidence grammar, same Blender 3D.

## 1. `src/styles.css` (Tailwind 4)

Paste below `@import "tailwindcss";`. It is `globals.css` with the `next/font` variables replaced by plain font families.

```css
:root {
  --brand: #3a86bf;        /* logo blue */
  --brand-deep: #1f5f94;   /* primary buttons, links, focus — AA on white */
  --brand-ink: #0e2c47;    /* headings, body ink */
  --brand-light: #8dbde3;  /* secondary strokes, inferred hints */
  --brand-soft: #e4f0f9;   /* tinted panels, chips */
  --brand-mist: #f3f8fc;   /* page wash */
  --paper: #ffffff;
  --paper-2: #f3f8fc;
  --ink: #0e2c47;
  --ink-2: #33506b;
  --ink-3: #5f7a92;
  --line: #d3e3f0;
  --amber: #b45309;        /* RESERVED: gap / no evidence */
  --amber-soft: #fdebd2;
  --radius: 14px;
  --focus: #1f5f94;
  --shadow-soft: 0 1px 2px rgb(14 44 71 / 6%), 0 8px 24px -12px rgb(14 44 71 / 18%);
  color-scheme: light;
}
[data-contrast="high"] {
  --ink: #061a2c; --ink-2: #102f4b; --ink-3: #23445f; --line: #8fb3cf;
  --brand: #1f6aa5; --brand-deep: #0f4a7a; --brand-light: #5f9ccc; --focus: #061a2c;
}
@theme inline {
  --color-brand: var(--brand); --color-brand-deep: var(--brand-deep); --color-brand-ink: var(--brand-ink);
  --color-brand-light: var(--brand-light); --color-brand-soft: var(--brand-soft); --color-brand-mist: var(--brand-mist);
  --color-paper: var(--paper); --color-paper-2: var(--paper-2);
  --color-ink: var(--ink); --color-ink-2: var(--ink-2); --color-ink-3: var(--ink-3);
  --color-line: var(--line); --color-amber: var(--amber); --color-amber-soft: var(--amber-soft);
  --font-sans: "Atkinson Hyperlegible", ui-sans-serif, "Segoe UI", Roboto, Arial, sans-serif;
  --font-display: "Fraunces", "Iowan Old Style", Georgia, serif;
  --font-serif: "Fraunces", "Iowan Old Style", Georgia, serif;
  --font-mono: "Atkinson Hyperlegible Mono", ui-monospace, Menlo, Consolas, monospace;
}
body { background: var(--paper); color: var(--ink); font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
h1, h2, h3 { letter-spacing: -0.015em; }
.display, .serif { font-family: var(--font-display); font-optical-sizing: auto; }
.mono, code, kbd { font-family: var(--font-mono); }
.card { background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius); }
.chip { display: inline-flex; align-items: center; gap: .4rem; padding: .25rem .6rem; border-radius: 999px; font-size: .78rem; border: 1px solid var(--line); background: var(--paper); color: var(--ink-2); }
.eyebrow { font-size: .75rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); font-weight: 700; }
.evidence { border-left: 3px solid var(--brand-deep); }
.no-evidence { border-left: 3px solid var(--amber); background: var(--amber-soft); }
.kind-observed { border-top: 3px solid var(--brand-deep); }
.kind-inferred { border-top: 3px dashed var(--brand); }
.kind-extracted { border-top: 3px dotted var(--brand); }
.kind-proposed { border-top: 3px dashed var(--line); }
:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 6px; }
@media (prefers-reduced-motion: no-preference) {
  .pulse { animation: pulse 2.4s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
  .float-y { animation: float-y 6s ease-in-out infinite; }
  @keyframes float-y { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
  .helix-spin { animation: helix-spin var(--helix-speed, 2.4s) linear infinite; }
  @keyframes helix-spin { to { transform: rotateY(360deg); } }
}
[data-motion="reduce"] *, [data-motion="reduce"] *::before, [data-motion="reduce"] *::after {
  animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important;
}
```

## 2. Fonts

In the root HTML `<head>` (or the TanStack root route `head()`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Atkinson+Hyperlegible+Mono&family=Fraunces:opsz,wght@9..144,500..700&display=swap" />
```

Body = Atkinson Hyperlegible (legibility first — many rare diseases affect sight). Headings and big numbers = Fraunces (`.display`). Codes (ORPHA, HP, NCT, PMID) = Atkinson Hyperlegible Mono (`.mono`).

Scale: h1 `text-[2.6rem] sm:text-6xl lg:text-7xl` · h2 `text-3xl sm:text-4xl` · h3 `text-lg font-bold` · body `text-base`/`text-lg` · small `text-sm` · caption `text-xs text-ink-3`. Buttons: primary `rounded-full bg-brand-deep text-white px-6 py-3 font-semibold hover:bg-brand-ink`; secondary `rounded-full border border-brand-light bg-paper text-brand-ink hover:border-brand-deep`.

## 3. Evidence grammar (identical everywhere)

| Kind | Meaning | Graph line | Label |
|---|---|---|---|
| observed | a source states it | solid `--brand-deep` | "Observed" |
| inferred | Nedamex analysis (score + basis) | dashed `--brand` | "Inferred" |
| extracted | OpenAI pulled it from a cited paper | dotted `--brand` | "AI-extracted · needs expert review" |
| proposed | community draft | ghost dashed `--line` | "Community draft — not evidence" |

Amber is only for gaps / "no evidence". Never for inferred.

## 4. Logo and icons

- Logo: `public/brand/nexmed-logo.png` (+ `-192`, `-512`), round mark, wordmark text "Nedamex" in `.display font-semibold text-brand-ink`.
- Entity-type icons rendered in Blender (256 px, transparent): `public/models/glyphs/{disease,gene,variant,phenotype,pathway,trial,study,treatment,organization,investigator}.png`. Suggested mode icons: Patient → `investigator`, Family & patient group → `organization`, Researcher → `study`, Pharma → `treatment`.

## 5. Blender 3D (copy as is — no Next-only imports)

Copy these from the `nexmed` repo (main):

| Copy | What |
|---|---|
| `src/components/three/AgentOrb.tsx`, `AgentCanvas.tsx`, `AgentModel.tsx` | the voice-agent avatar (`<AgentOrb state="hidden|idle|listening|thinking|connecting|speaking" size getLevel reduce />`) |
| `src/components/three/glyphs.ts` | `loadGlyphGeometries()` / `useGlyphGeometries()` → one unit-radius `BufferGeometry` per entity type for the 3D graph |
| `src/components/three/Scene3D.tsx`, `useCan3D.ts`, `palette.ts`, `NodeOrb.tsx`, `HelixLoader.tsx` | shared canvas (pauses off-screen), 3D capability check, palette, CSS orb, loading helix |
| `src/components/three/GlyphGraph.tsx` (+ `src/components/landing/neighborhood.ts` types) | optional: small real neighbourhood graph with glyphs |
| `public/models/nexmed-agent.glb`, `nexmed-agent.png`, `nexmed-glyphs.glb`, `nexmed-hero.glb`, `nexmed-hero.png`, `public/models/glyphs/*`, `public/draco/*` | Blender assets + self-hosted Draco decoder |

Dependencies: `three`, `@react-three/fiber`, `@react-three/drei` (same majors as the website). `useCan3D` imports `usePrefs` from `@/lib/prefs` (explorer ports it). `Hero3D.tsx` is website-only (uses `next/image` / `next/dynamic`); in Vite use `React.lazy(() => import("./HeroCanvas"))` + `<img src="/models/nexmed-hero.png">` as the poster.

Rules: lazy-load three.js, DPR ≤ 1.75, ≤ 60k tris per scene, every 3D element has a still fallback (reduced motion, low power, no WebGL), canvases are `aria-hidden` unless labelled.

## 6. Layout

Max width `max-w-6xl`, gutters `px-4 sm:px-6`, sections `py-16`, alternate `bg-paper` / `bg-brand-mist` with `border-y border-line`. Cards `rounded-xl border border-line bg-paper shadow-[var(--shadow-soft)]`. Test at 390 px and 1440 px; no horizontal scroll (give grid children `min-w-0`).
