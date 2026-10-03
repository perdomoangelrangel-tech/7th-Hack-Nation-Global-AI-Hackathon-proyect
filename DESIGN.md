# Nedamex · Design direction

```
THESIS:         The rare-disease evidence graph drawn as a transit map. Solid lines are sourced,
                dashed lines are research gaps, a station only exists if a source backs it.
                Refuses the health-tech default: stock doctor photo + teal cards + soft gradients.
WORLD:          Enamel-white signage panel, near-black ink, five saturated line colors (one per
                evidence type), round station markers, 45° routes, signage type (Overpass) and
                hyperlegible body (Atkinson Hyperlegible Next). Codes (ORPHA, HP, NCT, PMID) in mono.
STORY:          The diagnostic odyssey is a lost route (4.7 years) → Nedamex connects 7 silos into
                one map → ask in your own voice, every claim is a station with a plaque (source + date)
                → no source, no station → three riders (families free · clinics · research) → fare board.
FIRST VIEWPORT: Left: "Rare disease, mapped." + one line + [Open the map] [Watch demo]. Right/bleed:
                a live line map of Dravet syndrome (gene, symptoms, treatments, trials, community)
                with real IDs on station plaques. Language toggle EN/ES in the nav.
MOTION:         One authored moment: on scroll, the route draws itself station by station (SVG path
                length tied to scroll); a dashed segment stays dashed with "no evidence → we say so".
                Everything else still. Reduced motion: map renders fully drawn.
RISK:           A transit metaphor can feel playful for health; strict signage typography, real
                codes and the evidence plaques keep it serious.
```

## Tokens (src/app/globals.css)

| Role | Token | Use |
|---|---|---|
| Ground | `--canvas` | enamel white panel |
| Surface | `--panel` | raised panels, inputs |
| Ink | `--ink`, `--ink-2`, `--ink-3` | text levels |
| Rule | `--rule` | 1px hairlines |
| Line · genes | `--l-gene` (vermilion) | gene ↔ disease |
| Line · symptoms | `--l-pheno` (signal yellow) | disease ↔ phenotype (HPO) |
| Line · treatments | `--l-treat` (green) | treatments & management |
| Line · trials | `--l-trial` (cobalt) | clinical trials |
| Line · community | `--l-comm` (magenta) | patient orgs & researchers |
| Line · literature | `--l-lit` (graphite) | PubMed evidence |
| Gap | `--gap` | dashed lines, "no evidence" |
| Action | `--action` | primary CTA (ink on yellow is reserved for warnings) |

Audience colors reuse lines: Families = `--l-treat`, Clinicians = `--l-trial`, Research = `--l-comm`.

## Type

- Display: **Overpass** (Highway Gothic lineage, signage) · weights 700–900 · tracking −0.02em.
- Body/UI: **Atkinson Hyperlegible Next** (Braille Institute; chosen for low-vision readers, many rare diseases affect sight).
- Codes & data: **Overpass Mono**, tabular numerals.

## Components

- `Station` — round marker, 2px ink ring, fill = line color when sourced, hollow when gap.
- `Plaque` — station label: name + mono code + source · date.
- `Route` — SVG path, 45° bends, stroke 6px, round caps; dashed (`8 8`) when gap.
- `Logo` — the "N" drawn as a route with four stations, last one hollow (a gap we refuse to fill with guesses).

## Rules

- No eyebrow chips, no gradient text, no glow, no three equal cards.
- Copy: short. Headline ≤ 4 words. One line of support. Numbers always carry their source.
- Every claim on the page is real and sourced, or labeled as sample.
