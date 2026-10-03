# Nedamex · Sound effects (ElevenLabs)

Generate each cue with **ElevenLabs → Sound Effects** (text to sound effects). Use the prompt and duration below, set prompt influence to about 0.5, pick the best of the generations, and export as **MP3**. Save it as `video/public/sfx/<name>.mp3`, with exactly this name.

The cuts (`Demo60`, `Tech60` and `Team60`) place every cue automatically: each scene has its cue list, and cues scale with the scene's duration. A missing file is skipped, so drafts render fine without audio. Master level: `sfxVolume` prop (default 1). Per-cue volume is set in the scene's `*_SFX` array.

**Sonic world:** calm, warm and precise, like a modern transit system crossed with a quiet clinic. Soft mallets, felt, glass, paper, gentle mechanics. Nothing harsh or sci-fi, no alarms. "No evidence" is a *soft* low tone, never an error buzzer: we're being honest, not scolding.

## Core cues (8 used by the 60 s cuts + 2 beds for reuse scenes)

| # | File name | Duration | ElevenLabs prompt | Used in |
|---|---|---|---|---|
| 1 | `station-chime` | 0.8 s | Soft two-note transit station chime, warm marimba and glass, gentle and clean, short decay, no reverb tail, modern metro announcement tone | stations popping (Hook, Connections, NextStep, Lessons fixes, Architecture, Stack) |
| 2 | `route-draw` | 1.2 s | Smooth felt-tip marker drawing a long line on paper, light airy whoosh, satisfying and quick, no music | routes drawing, whoosh into every screen recording |
| 3 | `gate-verified` | 0.7 s | Soft mechanical turnstile click followed by a gentle rubber stamp, positive and precise, quiet office ambience, no beep | claim passes the verifier gate |
| 4 | `no-evidence` | 1.0 s | Soft low two-note descending tone on a muted felt piano, calm and honest, not an error buzzer, gentle fade | dashed line / "none in our sources" (Hook), the validate row (NextStep), what broke (Lessons) |
| 5 | `claim-drop` | 0.8 s | A small paper card sliding off a table and landing softly, light swish then a muted tap | rejected claim falls off the track |
| 6 | `hospital-ambience` | 10 s | Muffled hospital corridor ambience, distant footsteps, faint monitor beeps far away, soft fluorescent hum, slightly tense, no voices | optional bed for the OdysseyRoute reuse scene (not in the 60 s cuts) |
| 7 | `calm-transition` | 4 s | Ambient swell that resolves from tense hospital hum into a warm calm major pad, gentle airy release, hopeful, no drums | OdysseyRoute reuse scene (not in the 60 s cuts) |
| 8 | `voice-on` | 0.5 s | Soft microphone activation blip, two gentle rising tones, warm, friendly UI sound | voice stop in Architecture (Tech60) |
| 9 | `split-flap` | 2.5 s | Vintage train station split-flap departure board flipping rapidly then settling, crisp mechanical clatter, close mic | fare board (RidersAndFares reuse scene) |
| 10 | `logo-sting` | 2.0 s | Short warm logo sting, three soft glass and marimba notes rising, ends on an open hopeful chord, clean and minimal | EndCard (all three cuts) |

## Optional (nice to have)

| # | File name | Duration | ElevenLabs prompt | Used in |
|---|---|---|---|---|
| 11 | `clock-tick` | 3 s | Quiet clock ticking, slightly accelerating, soft and close, no alarm | Odyssey year counter, Architecture pg_cron clock |
| 12 | `number-thud` | 0.6 s | Deep soft felt thud, like a heavy sign placed gently on a table, low and warm | the three numbers landing |
| 13 | `zoom-swell` | 3 s | Airy rising whoosh with a soft shimmer, a camera pulling back to reveal a huge city map, smooth, no impact | ScaleNetwork zoom-out |
| 14 | `data-pulse` | 1.5 s | Soft rhythmic digital blips traveling left to right, light and clean, like data flowing through a network, subtle | Architecture data pulses |

## Optional music bed

`video/public/audio/music.mp3`, if present, loops under every cut at volume 0.12. Prompt idea (ElevenLabs Music or any royalty-free library): *"Minimal warm electronic, soft marimba arpeggio, 90 BPM, hopeful and calm, no vocals, light pulse, documentary underscore."* If the VO is busy, leave music out.

## Mixing notes

- Speech first: VO at 0 dB, recordings with the agent's voice at about −2 dB, SFX at about −10 dB (volume 0.55), beds at about −14 dB.
- Don't stack more than 2 cues at once. If a scene feels busy, delete a cue from its `*_SFX` array (e.g. `MAPBUILD_SFX` in `src/scenes/MapBuild.tsx`).
- ElevenLabs also makes the in-app agent voices (Family Guide, Clinical Analyst, Research Analyst). Those reach the video through the screen recordings, so record them with system audio on.
