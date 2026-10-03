# Nedamex · video/

Remotion project for the hackathon videos, drawn in the Nedamex transit-map style. Everything lives in this folder and never touches the app.

| File | What |
|---|---|
| `SCRIPTS.md` | Pitch and Tech scripts (2 min + 60 s), with timecodes, VO, visuals, SFX and recording cues, plus a Spanish rehearsal version |
| `SFX.md` | 14 ElevenLabs sound-effect prompts (10 essential) with file names and durations |
| `TEAM_VIDEO_GUIDE.md` | 60–90 s team video: structure, shot list, phone tips, ES summary |
| `src/cuts/timeline.ts` | **The edit list**: durations, VO lines, recording files and trims for all four cuts |
| `src/scenes/*` | The 11 scenes (each speed-scales to whatever duration a cut gives it) |
| `out/` | Renders: `<Scene>.mp4` (1080p), `<Cut>-draft.mp4` (half-res drafts with guides), `stills/` |

## Preview

```bash
cd video
npm i
npx remotion studio        # http://localhost:3000
```

In Studio, **Cuts/** holds `Pitch60`, `Pitch120`, `Tech60` and `Tech120`, and **Scenes/** holds each scene at its natural length. The `guides` prop shows the draft overlay at the bottom (cut id, scene id, timecode, VO line). Turn it off in the props panel to see the clean frame.

Chrome: Remotion downloads its own headless shell on first render. To use a local Chrome or Chromium instead, set `REMOTION_BROWSER=/path/to/chrome` (the hackathon container uses `/opt/pw-browsers/...` automatically; see `remotion.config.ts`).

## Drop in your media (no code changes needed)

Files are picked up by name. Anything missing is skipped, and recordings show a labelled placeholder.

| What | Where | Name |
|---|---|---|
| Screen recordings | `public/rec/` | `atlas-family-treatments.mp4`, `atlas-diet-no-evidence.mp4`, `atlas-research-gaps.mp4`, `landing-scroll.mp4`, `api-tools-treatments.mp4`, `verifier-tests.mp4`, `research-portal.mp4` (steps in SCRIPTS.md → *Recording shot list*) |
| Voice-over, one take per cut | `public/audio/` | `vo-pitch120.mp3`, `vo-pitch60.mp3`, `vo-tech120.mp3`, `vo-tech60.mp3` (starts at 0:00) |
| …or one file per scene | `public/audio/` | `vo-<cut>-<itemId>.mp3`, e.g. `vo-pitch120-p03.mp3` (starts when that scene starts) |
| Sound effects | `public/sfx/` | `<name>.mp3` from SFX.md, e.g. `station-chime.mp3` |
| Music bed (optional) | `public/audio/` | `music.mp3` (loops at volume 0.12) |

Studio picks new files up live; refresh if a placeholder doesn't switch.

**Fitting recordings:** in `src/cuts/timeline.ts`, change `sec` (slot length), `trimStart` (seconds to skip at the start) or `volume` (the agent's voice inside the recording) for that item. Scenes before and after shift automatically.

**Fitting VO:** if your read runs long, raise that item's `sec` (and lower another one) so the total stays at 60 s or 120 s. Scenes stretch or compress to match. Keep each scene at or above about 40% of its natural length.

## Render

```bash
npm run render:stills                         # out/stills/*.png (one key frame per scene)
npm run render:scenes                         # out/<Scene>.mp4, 1080p
npm run render:cuts                           # out/<Cut>-draft.mp4, half-res, guides on
node scripts/render.mjs final                 # out/<Cut>.mp4, 1080p, guides OFF ← the deliverables
node scripts/render.mjs final --only=Pitch120 # just one
```

Or one cut through the CLI:

```bash
npx remotion render Pitch120 out/Pitch120.mp4 --props='{"guides":false}'
```

Before the final render, check:
- [ ] All recordings are in `public/rec/` (no "SCREEN RECORDING" placeholders left; scrub the cut in Studio).
- [ ] VO is in `public/audio/` and lines up with the scenes (adjust `sec` if needed).
- [ ] SFX are in `public/sfx/`, and the mix doesn't fight the VO (`sfxVolume` prop or per-cue `volume`).
- [ ] The URL on the EndCard is the real one (`EndCard` prop `url`, default `nedamex.vercel.app`).
- [ ] Render with `guides:false`.

## Scene list (natural length → 2 min / 60 s cut)

| Scene | Natural | Pitch120 | Pitch60 | Tech120 | Tech60 |
|---|---|---|---|---|---|
| TitleCard | 5 s | 4 | 3 | 4 (tech) | 3 (tech) |
| OdysseyRoute | 18 s | 18 | 11 | — | — |
| MapBuild | 12 s | 12 | 7 | — | — |
| AskAnswer | 12 s | 10 | — | — | — |
| VerifierGate | 10 s | 8 | — | 14 | 9 |
| Architecture | 24 s | — | — | 28 | 16 |
| DataModel | 14 s | — | — | 16 | 8 |
| RidersAndFares | 14 s | 14 | 9 | — | — |
| ScaleNetwork | 10 s | 9 | 6 | 12 (tech) | 7 (tech) |
| Stack | 10 s | — | — | 10 | 5 |
| EndCard | 6 s | 5 | 6 | 6 | 4 |
| Recording slots | — | 16+10+10+4 | 10+8 | 14+10+6 | 8 |

## Content rules (from CLAUDE.md)

Only the sourced numbers listed in SCRIPTS.md, each with its source on screen. The only real identifiers shown are ORPHA:33069 / 778 / 505652 / 72 / 228354, HGNC:10585 (SCN1A) and HP:0002373, HP:0001336, HP:0002133, HP:0001263. No NCT, PMID or people are invented. The map scenes are labeled "sample view", and answer scenes carry "Not medical advice".
