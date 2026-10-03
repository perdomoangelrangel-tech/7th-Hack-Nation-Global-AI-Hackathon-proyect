import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Loads the three brand fonts (variable woff2 copied from src/app/fonts) before any frame renders.
 */
const fonts = [
  { family: "Overpass", file: "fonts/overpass.woff2", weight: "100 900" },
  { family: "Atkinson Hyperlegible Next", file: "fonts/atkinson.woff2", weight: "200 800" },
  { family: "Overpass Mono", file: "fonts/overpass-mono.woff2", weight: "300 700" },
];

let started = false;

export function loadBrandFonts() {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("Loading brand fonts");
  Promise.all(
    fonts.map((f) =>
      new FontFace(f.family, `url(${staticFile(f.file)}) format('woff2')`, { weight: f.weight, display: "block" })
        .load()
        .then((face) => document.fonts.add(face)),
    ),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error("Font load failed", err);
      continueRender(handle);
    });
}
