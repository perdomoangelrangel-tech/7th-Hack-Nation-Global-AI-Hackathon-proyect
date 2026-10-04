/**
 * The one raw-hex file for 3D (lights, fallbacks). Values mirror the CSS tokens in src/app/globals.css
 * and the Blender palette in blender/nexmed_lib.py — change all three together.
 */
export const palette3d = {
  brand: "#3a86bf",
  brandDeep: "#1f5f94",
  brandInk: "#0e2c47",
  ink2: "#33506b",
  brandSoft: "#e4f0f9",
  brandMist: "#f3f8fc",
  brandLight: "#8dbde3",
  pearl: "#fbfdff",
  keyLight: "#fff8ee",
  fillLight: "#eaf3ff",
  rimLight: "#cfe6ff",
  ground: "#d6e7f5",
} as const;

/** Blender-made assets (built by blender/*.py, see DESIGN.md). */
export const MODELS = {
  hero: "/models/nexmed-hero.glb",
  agent: "/models/nexmed-agent.glb",
  glyphs: "/models/nexmed-glyphs.glb",
} as const;

export const POSTERS = {
  hero: "/models/nexmed-hero.png",
  agent: "/models/nexmed-agent.png",
} as const;

/** Self-hosted Draco decoder (copied from three/examples/jsm/libs/draco/gltf) — no CDN at runtime. */
export const DRACO_PATH = "/draco/";
