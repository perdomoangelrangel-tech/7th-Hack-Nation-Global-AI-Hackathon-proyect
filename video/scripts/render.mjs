// Batch renderer: bundles once, then renders stills / scenes / cuts.
//   node scripts/render.mjs stills              → out/stills/<Scene>.png (one key frame per scene)
//   node scripts/render.mjs scenes              → out/<Scene>.mp4 at full 1080p
//   node scripts/render.mjs cuts [--scale=0.5]  → out/<Cut>-draft.mp4 (Demo60 · Tech60 · Team60, guides + captions on)
//   node scripts/render.mjs cut-stills          → out/stills/<Cut>-<n>.png (a few frames of each cut, half size)
//   node scripts/render.mjs final               → out/<Cut>.mp4 at 1080p, guides off (use once VO/recordings are in)
//   add --only=MapBuild,Pitch60 to limit, --concurrency=N to tune.
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const mode = args[0] ?? "all";
const flag = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split("=")[1] : d;
};
const scale = Number(flag("scale", mode === "cuts" ? "0.5" : "1"));
const only = flag("only", "")?.split(",").filter(Boolean);
const concurrency = Number(flag("concurrency", "2"));

const browserExecutable = [
  process.env.REMOTION_BROWSER,
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
].find((p) => p && fs.existsSync(p));

const SCENE_STILLS = {
  TitleCard: 120,
  OdysseyRoute: 450,
  MapBuild: 330,
  AskAnswer: 330,
  VerifierGate: 255,
  Architecture: 660,
  DataModel: 340,
  RidersAndFares: 360,
  ScaleNetwork: 280,
  Stack: 300,
  EndCard: 120,
  Hook: 150,
  Connections: 420,
  NextStep: 200,
  Lessons: 430,
  TitleCardTech: 120,
  ScaleNetworkTech: 280,
};
const CUTS = ["Demo60", "Tech60", "Team60"];
const pick = (ids) => (only?.length ? ids.filter((i) => only.includes(i)) : ids);

fs.mkdirSync("out/stills", { recursive: true });
console.log("Bundling…");
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });

async function still(id, frame) {
  const composition = await selectComposition({ serveUrl, id, browserExecutable });
  const output = `out/stills/${id}.png`;
  await renderStill({ serveUrl, composition, frame, output, browserExecutable });
  console.log("still", output);
}

async function video(id, { output, inputProps = {}, sc = 1 }) {
  const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable });
  const t0 = Date.now();
  let last = -1;
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    crf: sc < 1 ? 23 : 18,
    pixelFormat: "yuv420p",
    imageFormat: "jpeg",
    jpegQuality: 90,
    scale: sc,
    concurrency,
    outputLocation: output,
    inputProps,
    browserExecutable,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 10);
      if (p !== last) {
        last = p;
        process.stdout.write(`  ${id} ${p * 10}%\n`);
      }
    },
  });
  console.log(`video ${output} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

if (mode === "stills" || mode === "all") for (const id of pick(Object.keys(SCENE_STILLS))) await still(id, SCENE_STILLS[id]);
if (mode === "scenes" || mode === "all")
  for (const id of pick(Object.keys(SCENE_STILLS).filter((x) => !x.endsWith("Tech")))) await video(id, { output: `out/${id}.mp4` });
if (mode === "cuts" || mode === "all")
  for (const id of pick(CUTS)) await video(id, { output: `out/${id}-draft.mp4`, inputProps: { guides: true }, sc: mode === "all" ? 0.5 : scale });
if (mode === "cut-stills")
  for (const id of pick(CUTS)) {
    const composition = await selectComposition({ serveUrl, id, inputProps: { guides: true }, browserExecutable });
    for (const f of [90, 400, 800, 1250, 1500, 1700]) {
      const output = `out/stills/${id}-${String(f).padStart(4, "0")}.png`;
      await renderStill({ serveUrl, composition, frame: f, output, inputProps: { guides: true }, scale: 0.5, browserExecutable });
      console.log("still", output);
    }
  }
if (mode === "final")
  for (const id of pick(CUTS)) await video(id, { output: `out/${id}.mp4`, inputProps: { guides: false }, sc: Number(flag("scale", "1")) });
