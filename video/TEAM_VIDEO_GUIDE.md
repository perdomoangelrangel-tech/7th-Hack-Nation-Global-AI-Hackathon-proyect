# Nedamex · Team video guide (≤ 60 s, "explain who you are")

Three people, about 18 s each, shot on phones. Remotion adds the intro card, a name/role **lower third** for each person, **burned-in captions** and the end card (`Team60` composition). Use real names, majors and roles only.

## Before you shoot: fill the placeholders

In `video/src/cuts/timeline.ts` → `TEAM_60`, replace in each `lowerThird` and `vo`:

| Person | `[Name]` | Lower-third role (exact text) | `[…]` in the line |
|---|---|---|---|
| P1 | | `[major] · Tecnológico de Monterrey` | `[major]` |
| P2 | | `built [the evidence graph / the voice agents]` (pick one) | same |
| P3 | | `leads [product and business]` | same |

The `vo` text is also the caption, so make it match what each person actually says, word for word.

## Structure (60 s)

| Time | Who | Shot | Line (EN) |
|---|---|---|---|
| 0:00–0:02 | — | Card: logo + "The team behind the map." | — |
| 0:02–0:20 | **P1** | Medium close-up, eye level. Lower third: name + major | "Hi, I'm [Name], [major] at Tecnológico de Monterrey, Mexico. Families with a rare disease wait almost five years for a confirmed diagnosis, and researchers lose weeks searching separate databases. We're the NEDAMEX team, and we want to give them that time back." |
| 0:20–0:39 | **P2** | Same framing (or over-the-shoulder with the laptop showing `/atlas`). Lower third: name + what they built | "I'm [Name], I built [the evidence graph / the voice agents]. NEDAMEX connects genes, symptoms, treatments, trials and patient groups from seven verified databases. You can ask by text or voice and see the source behind every answer. If there isn't enough evidence, it says so." |
| 0:39–0:57 | **P3** | Same framing. Optional last 2 s: all three in a wide shot. Lower third: name + role | "I'm [Name], I lead [product and business]. Families use it for free; hospitals, biotech companies and research institutions pay for licenses. With this prize we'll cover more diseases and test it with research teams. We're looking for partners for that next step." |
| 0:57–1:00 | — | End card (logo, tagline, URL) | — |

The "almost five years" line shows its source on screen: *4.7 years to a confirmed diagnosis · EURORDIS Rare Barometer*.

## Deliver the clip

- **Preferred:** one edited clip, `video/public/rec/team.mp4`, **exactly 55 s**: P1 0–18.3 s, P2 18.3–36.6 s, P3 36.6–55 s. It plays from 0:02 to 0:57.
- **Or:** three clips, `team-1.mp4`, `team-2.mp4` and `team-3.mp4` (about 18 s each). Each fills its own slot.
- If your timing differs, change the three `sec` values in `TEAM_60` (they must add up to 55) so the lower thirds and captions line up.
- Preview with `npx remotion studio` → `Team60`, then render with `node scripts/render.mjs final --only=Team60`.

## Shot list

1. P1 solo, medium close-up. 2–3 takes.
2. P2 solo, same spot and same framing. 2–3 takes (plus an optional over-the-shoulder take with `/atlas` on the laptop).
3. P3 solo, same spot. 2–3 takes.
4. Group wide shot, all three, 3 s of smiling or nodding. Optional; it can close P3's segment.
5. Room tone: 10 s of silence in the same room.

## Phone recording tips

**Light**: face a window or lamp, with the light in front and slightly to one side. Never stand with a window behind you. Tap and hold on the face to lock exposure and focus.
**Audio**: a quiet room with soft surfaces. Keep the phone 30–50 cm away, or use wired earbuds or a lav mic. Turn fans and AC off and switch the phone to airplane mode. Do a 5 s test and listen back with headphones.
**Framing**: **landscape 16:9**, 1080p at 30 fps, with the main (1×) lens and a tripod or a stack of books. Keep the camera at eye level with a little headroom, and keep the lower-left of the frame clear (lower third). Leave the bottom 15% free of important things (captions). Use a plain background 1–2 m behind you. Look at the lens, and clean it first.
**Delivery**: short sentences, pause one beat before and after the line, solid-colored clothes. Say your name the same way in every take.
**Files**: `team-<n>-<take>.mov`. Trim, join and export at 1920×1080, 30 fps, H.264, as `team.mp4`.

## Rules

- Only true facts about the team. The only number is "almost five years", which is 4.7 years per the EURORDIS Rare Barometer and carries its source on screen.
- No patient names or stories, and no medical promises ("cures", "diagnoses").

---

## Resumen en español

**Formato:** 60 s, tres personas (~18 s cada una), grabado con celular. Remotion pone la tarjeta inicial, el **cintillo con nombre y rol** de cada persona, los **subtítulos** y la tarjeta final (`Team60`).
**Antes de grabar:** llenen `[Nombre]`, `[carrera]` y `[rol]` en `TEAM_60` (`src/cuts/timeline.ts`). El texto `vo` es el subtítulo, así que debe coincidir con lo que dicen.
**Entrega:** un solo clip editado `video/public/rec/team.mp4` de **55 s** (P1 0–18.3 s, P2 18.3–36.6 s, P3 36.6–55 s), o tres clips `team-1/2/3.mp4`. Si los tiempos cambian, ajusten los tres `sec`.
**Luz:** de frente a una ventana, nunca a contraluz. **Audio:** cuarto callado, celular a 30–50 cm o con audífonos con micrófono. **Encuadre:** horizontal 16:9, 1080p y 30 fps, cámara a la altura de los ojos, la esquina inferior izquierda libre para el cintillo y el 15% de abajo libre para los subtítulos.
**Reglas:** solo datos reales del equipo; el "casi cinco años" lleva su fuente en pantalla (EURORDIS: 4.7 años).
