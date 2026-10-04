# Porting /atlas to the Lovable program ("Nexmed")

Lead: explorer lane. With: action lane (journey, co-creation, /plan). Spec: `../nexmed-shared/ORDERS_WAVE2.md`.
Target: Lovable project "Nedamex Navigator" (`4ce45bdb-819e-4682-9078-2fbe7d11465e`) → renamed **Nexmed**, cloned to `../nexmed-lovable` once the human posts `CONTRACT lovable-repo`.

## 1. What the target is (read 2026-10-03 via the Lovable API)

- TanStack Start 1.168 + TanStack Router 1.170 (file routes in `src/routes`, `routeTree.gen.ts` generated — never edit), Vite 8, React 19.2, Tailwind 4 (`src/styles.css`), shadcn/ui in `src/components/ui`, `@tanstack/react-query`, **Bun** (`bun.lock`), **zod 3** (we use zod 4), vitest 4, **SSR on** (`src/server.ts`, `src/start.ts`).
- Existing pages: `/` (index), `/disease/$orpha`, `/join`, plus `src/components/{brand,connections}.tsx`, `src/lib/{data,connections,i18n}.ts`. These move to `/research/*`.
- `__root.tsx` wraps every page in `Header` + `<main class="max-w-6xl px-4 py-8">` + `Footer` → the atlas needs a **full-bleed layout**: move the research chrome into a pathless layout route `src/routes/_research.tsx` and give the atlas its own `src/routes/_app.tsx`.
- `AGENTS.md`: never force-push or rewrite pushed history; every pushed commit syncs to the Lovable editor → keep the default branch building.

## 2. Dependencies to add (`package.json`, explorer owns it in the Lovable repo)

`three@^0.186` · `@types/three` · `react-force-graph-2d@^1.29` · `react-force-graph-3d@^1.29` · `three-spritetext@^1.10` · `motion@^14` · `@elevenlabs/react@^1.16` · (optional, brand glyphs) `three/examples` loaders come with `three`.
Install with `bun add …` so `bun.lock` stays the source of truth. Zod: AI-lane components only import **types** from `src/lib/ai/contract.ts`; if they import zod at runtime, keep the program on zod 3 and copy only the types.

## 3. File map (Vercel `nexmed/` main → `../nexmed-lovable`)

| From (main) | To (Lovable) | Owner | Notes |
|---|---|---|---|
| `src/app/globals.css` tokens (`:root`, `[data-contrast]`, `@theme inline`, `.chip`, `.evidence`, `.no-evidence`, `.pulse`) | `src/styles.css` (append; keep shadcn vars) | explorer | Light only. Map shadcn `--primary` → `--brand-deep`, `--background` → `--paper`. |
| `public/brand/*`, `public/models/*` (agent + glyphs), `public/draco/` | `public/` | explorer | |
| `src/components/atlas/{AtlasApp,AtlasRail,EdgeInspector,SearchBox,PrefsPanel,GraphCanvas,GraphCanvas3D,graphProps,colors,links,proposals,useGraphMode,api}.ts(x)` | `src/components/atlas/` | explorer | see §4 replacements |
| `src/lib/prefs/index.tsx`, `src/lib/motion.ts`, `src/lib/i18n.ts`, `src/lib/site.ts` (client fields only), `src/lib/agents/profiles.ts` (PERSONAS: id/name/mode/role only) | `src/lib/` | explorer | Lovable already has `src/lib/i18n.tsx` (research pages) → ours becomes `src/lib/atlas-i18n.ts`. |
| **Types only**: `GNode/GLink/GraphView/SearchHit/Journey` from `src/lib/atlas/store.ts`, `src/lib/atlas/types.ts`, `edgeDetail` return type | `src/lib/atlas/types.ts` | explorer | `store.ts` is server-only (reads files) → export the view types into a plain module; never port `store.ts`, `source.ts`, `analyze.ts`. |
| `src/components/atlas/{JourneyPanel}.tsx`, `src/components/cocreate/**`, `src/components/journey/**`, `src/lib/journey/*` (client/pure parts) , `/plan` page | same paths, `src/routes/plan.tsx` | action | |
| `src/components/voice/**`, `src/components/atlas/{NarrationBar,useNarration}.tsx`, `src/lib/voice/client.ts`, `src/lib/voice/prefs.ts` | same | explorer copies (voice owns content) | must take `apiBase`; no `/api/speak` key client-side |
| `src/components/ai/**`, `src/lib/ai/contract.ts` (types) | same | explorer copies (ai owns content) | pass `apiBase={API}` |
| `src/components/three/*` except `Hero3D`/`HeroCanvas`/`HeroModel` (website only) — AgentOrb, AgentCanvas, AgentModel, Scene3D, useCan3D, palette, glyphs | same | explorer copies (brand owns content) | no Next-only imports (brand CONTRACT); assets `public/models/nexmed-agent.*`, `public/models/nexmed-glyphs.glb`, `public/draco/` |

Not ported (server): `src/app/api/**`, `store.ts`, `source.ts`, `analyze.ts`, `src/lib/ai/client.ts`, `src/lib/supabase/**` (writes), `verifier.ts`. The program calls `VITE_NEXMED_API_URL/api/*` (CORS on the Vercel side, brain).

## 4. Mechanical replacements

| Next.js | Lovable / TanStack |
|---|---|
| `import Link from "next/link"` / `<Link href="/">` | `import { Link } from "@tanstack/react-router"` / `<Link to="/">` (external website link: plain `<a href={WEBSITE}>`) |
| `import Image from "next/image"` | `<img src alt width height>` |
| `dynamic(() => import("./GraphCanvas3D"), { ssr: false })` | `const GraphCanvas3D = lazy(() => import("./GraphCanvas3D"))` inside a `<ClientOnly>` (`@tanstack/react-router` exports `ClientOnly`) + `<Suspense fallback={<Loading/>}>` — three / force-graph touch `window` at import time, so they must never run during SSR |
| `process.env.NEXT_PUBLIC_*` | `import.meta.env.VITE_*` (`api.ts`: `VITE_NEXMED_API_URL`; `site.ts`: `VITE_WEBSITE_URL`) |
| `src/app/atlas/page.tsx` server props (`initialDisease`, `personas`, `stats`, `maria`) | route `validateSearch` (zod 3) for `d,p,l,e`; `personas` from `PERSONAS`; `stats` via `GET /api/atlas/stats` in the route `loader` (react-query); validate `d`/`e` client-side (404 from the API → treat as empty) |
| `window.history.replaceState` URL sync in AtlasApp | keep as-is (works) or `navigate({ search, replace: true })` |
| `"use client"` | harmless, keep |
| `import "server-only"` anywhere in the import graph | must not appear → that is the signal a server module leaked |

## 5. Routes

| Route | Content |
|---|---|
| `src/routes/_app.tsx` | full-bleed layout: `PrefsProvider` + `<Outlet/>` (no research chrome) |
| `src/routes/_app/index.tsx` (`/`) | `<AtlasApp>` with no focus (Maria CTA, modes) |
| `src/routes/_app/atlas.tsx` (`/atlas`) | `<AtlasApp>` with `?d=&p=&l=&e=` |
| `src/routes/plan.tsx` | action lane |
| `src/routes/_research.tsx` + `_research/research.index.tsx`, `research.disease.$orpha.tsx`, `research.join.tsx` | existing pages moved under `/research` with their Header/Footer |
| header | "Nexmed by Nedamex" + link "Nexmed website" → `VITE_WEBSITE_URL` (Vercel `/`) |

## 6. Order of work (small commits, each one builds)

1. Clone, `bun install`, `bun run build` green before any change. Note Node/Bun versions.
2. Move research pages under `/research` (layout routes); build; push; check Lovable preview.
3. Tokens + brand assets + deps; `src/lib/api.ts` (`api(path)` = `VITE_NEXMED_API_URL + path`); build; push.
4. Explorer components + types + prefs/motion/i18n; `/atlas` with 2D canvas first, then the 3D canvas behind `ClientOnly`; build; push; preview: search "SMEI", STXBP1 focus, inspector.
5. Action lane ports JourneyPanel / CoCreate / TenX / plan (in parallel after step 3).
6. Copy voice + ai components (with `apiBase`), mount VoiceDock / NarrationBar / ExplainButton / ExtractPanel.
7. Verify Maria end to end in the preview at 1440 and 390 px, console clean → ask the human to **Publish** → post `CONTRACT program-url: …`.

## 7. Risks

- **SSR crashes** from three/force-graph at import → strictly `lazy` + `ClientOnly`. Test with `bun run build && bun run preview`, not only dev.
- **CORS**: until the brain ships the Vercel `/api/*` CORS proxy, local dev needs a Vite proxy (`server.proxy['/api'] = VITE_NEXMED_API_URL`) — keep `VITE_NEXMED_API_URL` empty in dev to use it.
- **Tailwind 4 class collisions** with shadcn tokens (`bg-background`, `text-foreground`): our components only use our token names (`bg-paper`, `text-ink`, `brand-*`), so keep both sets in `@theme inline`.
- **Bundle size**: three + force-graph ≈ 700 KB gz → keep them in the lazy chunk; the 2D fallback chunk is separate.
- **Plan B**: Vercel `/atlas` stays deployed and unlisted; if the port is not green at freeze, `site.programUrl` points to it.
