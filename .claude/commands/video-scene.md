---
description: Render one Remotion scene/composition from video/ to video/out/scenes/<Id>.mp4, with a still for quick visual review
argument-hint: "<CompositionId>"
allowed-tools: Bash(npx remotion *), Bash(npm --prefix video run *), Bash(ls *), Read
---

Scene: `$ARGUMENTS`. Work inside `video/` (`cd video && …`). Delegate to the **video-producer** subagent for anything beyond rendering.

1. **Entry point:** read `video/scripts/render.mjs` and `video/remotion.config.ts` and use the same entry file they use.
2. **List:** `cd video && npx remotion compositions <entry>`. If `$ARGUMENTS` is empty or not in the list, show the list (id · duration · fps · size) and stop. Suggest the closest id if there was a typo.
3. **Still first:** `cd video && npx remotion still <entry> $0 out/stills/$0.png --frame=30`. Open the PNG with Read and check tokens and colors, legibility, safe margins, and that numbers carry sources and that there are no invented names.
4. **Render:** `cd video && npx remotion render <entry> $0 out/scenes/$0.mp4`.
5. **Typecheck:** `npm --prefix video run typecheck`.

Report: output path · duration · size · a one-line visual review of the still · any issue for video-producer.
