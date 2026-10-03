# Nedamex · video/

Remotion project for the hackathon videos, drawn in the Nedamex transit-map style. Everything lives in this folder and never touches the app.

| File | What |
|---|---|
| `SCRIPTS.md` | Demo, Tech and Team scripts (≤ 60 s each, per the Hack-Nation limits), with timecodes, VO/captions, visuals, SFX, recording cues and a Spanish rehearsal version |
| `SFX.md` | 14 ElevenLabs sound-effect prompts (10 essential) with file names and durations |
| `TEAM_VIDEO_GUIDE.md` | Team video (≤ 60 s): placeholders, structure, lower thirds, shot list, phone tips, ES summary |
| `src/cuts/timeline.ts` | **The edit list**: durations, VO/caption lines, recording files, trims, team names and roles for `Demo60`, `Tech60` and `Team60` |
| `src/scenes/*` | 15 scenes (each speed-scales to whatever duration a cut gives it) |
| `out/` | Renders: `<Scene>.mp4` (1080p), `<Cut>-draft.mp4` (half-res drafts with guides), `stills/` |

## Preview

```bash
cd video
npm i
npx remotion studio        # http://localhost:3000
```

In Studio, **Cuts/** holds `Demo60`, `Tech60` and `Team60`, and **Scenes/** holds each scene at its natural length. Props: `guides` shows the small draft tag at the top right (cut, item, timecode, VO slot status), and `captions` turns the burned-in captions on or off (on by default; judges may watch muted).

Chrome: Remotion downloads its own headless shell on first render. To use a local Chrome or Chromium instead, set `REMOTION_BROWSER=/path/to/chrome` (the hackathon container uses `/opt/pw-browsers/...` automatically; see `remotion.config.ts`).

## Drop in your media (no code changes needed)

Files are picked up by name. Anything missing is skipped, and recordings show a labelled placeholder.

| What | Where | Name |
|---|---|---|
| Screen recordings | `public/rec/` | `demo-atlas-angelman.mp4`, `demo-voice-diet.mp4`, `research-portal.mp4` (steps in SCRIPTS.md → *Recording shot list*) |
| Team clip | `public/rec/` | `team.mp4` (one 55 s edit) **or** `team-1.mp4`, `team-2.mp4`, `team-3.mp4` (see TEAM_VIDEO_GUIDE.md) |
| Voice-over, one take per cut | `public/audio/` | `vo-demo60.mp3`, `vo-tech60.mp3`, `vo-team60.mp3` (starts at 0:00; team audio usually comes from `team.mp4` itself) |
| …or one file per scene | `public/audio/` | `vo-<cut>-<itemId>.mp3`, e.g. `vo-demo60-d03.mp3` (starts when that scene starts) |
| Sound effects | `public/sfx/` | `<name>.mp3` from SFX.md, e.g. `station-chime.mp3` |
| Music bed (optional) | `public/audio/` | `music.mp3` (loops at volume 0.12) |

Studio picks new files up live; refresh if a placeholder doesn't switch.

**Fitting recordings:** in `src/cuts/timeline.ts`, change `sec` (slot length), `trimStart` (seconds to skip at the start) or `volume` (the agent's voice inside the recording) for that item. Scenes before and after shift automatically.

**Fitting VO and captions:** captions come from each item's `vo` text, timed by word count. If your read runs long, raise that item's `sec` (and lower another one) so the total stays at **60 s**. For recordings with dialogue, set exact caption timings in the item's `captions` array, as `d04` does. Scenes stretch or compress to match. Keep each scene at or above about 40% of its natural length.

## Render

```bash
npm run render:stills                         # out/stills/*.png (one key frame per scene)
npm run render:scenes                         # out/<Scene>.mp4, 1080p
npm run render:cuts                           # out/{Demo60,Tech60,Team60}-draft.mp4, half-res, guides + captions on
node scripts/render.mjs final                 # out/<Cut>.mp4, 1080p, guides OFF ← the deliverables
node scripts/render.mjs final --only=Demo60   # just one
```

Or one cut through the CLI:

```bash
npx remotion render Demo60 out/Demo60.mp4 --props='{"guides":false}'
```

Before the final render, check:
- [ ] All recordings are in `public/rec/` (no "SCREEN RECORDING" placeholders left; scrub the cut in Studio).
- [ ] VO is in `public/audio/` and lines up with the scenes (adjust `sec` if needed).
- [ ] SFX are in `public/sfx/`, and the mix doesn't fight the VO (`sfxVolume` prop or per-cue `volume`).
- [ ] The URL on the EndCard is the real one (`EndCard` prop `url`, default `nedamex.vercel.app`).
- [ ] Team placeholders `[Name]`, `[major]` and `[role]` are filled in `TEAM_60`.
- [ ] Render with `guides:false` (captions stay on).

## Scene list (natural length → seconds used in each 60 s cut)

| Scene | Natural | Demo60 | Tech60 | Team60 |
|---|---|---|---|---|
| Hook (Maria → Angelman → no approved treatment) | 6 s | 6 | — | — |
| Connections (Angelman ↔ Rett studies/symptoms/researchers · ↔ CDKL5 symptoms) | 17 s | 17 | — | — |
| NextStep (next-step board) | 11 s | 12 | — | — |
| Architecture | 24 s | — | 13 | — |
| VerifierGate | 10 s | — | 9 | — |
| Lessons (what didn't work) | 16 s | — | 18 | — |
| Stack (key tools + what's next) | 12 s | — | 11 | — |
| TitleCard | 5 s | — | — | 2 |
| EndCard | 6 s | 5 | 3 | 3 |
| Recording slots | — | 10 + 10 | 6 | 55 (team clip) |
| *Not in the cuts, kept for reuse:* OdysseyRoute, MapBuild, AskAnswer, DataModel, RidersAndFares, ScaleNetwork | | | | |

## Content rules (from CLAUDE.md)

Only real identifiers from the graph, each with its source on screen: ORPHA:72 / 778 / 505652, NCT06139172, NCT03836300 and NCT03655223 (Demo); the other ORPHA codes, HGNC:10585 and the HP terms appear in the reuse scenes. Maria is an illustrative family, labeled on screen. Answer surfaces carry "Not medical advice". No PMID or people are invented.
