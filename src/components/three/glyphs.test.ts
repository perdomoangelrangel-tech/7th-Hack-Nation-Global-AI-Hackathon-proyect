import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLYPH_TYPES, glyphsFromScene } from "./glyphs";

const models = join(process.cwd(), "public", "models");

function parse(file: string) {
  const buf = readFileSync(join(models, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise<{ scene: import("three").Group; animations: import("three").AnimationClip[] }>((resolve, reject) => new GLTFLoader().parse(ab, "", resolve, reject));
}

function glbJson(file: string) {
  const buf = readFileSync(join(models, file));
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + len).toString()) as { nodes: { name: string; scale?: number[] }[]; animations?: { name: string; channels: unknown[] }[] };
}

describe("Blender assets", () => {
  it("graph glyphs: one normalised geometry per entity type", async () => {
    const gltf = await parse("nexmed-glyphs.glb");
    const glyphs = glyphsFromScene(gltf.scene);
    for (const t of GLYPH_TYPES) {
      const geo = glyphs[t];
      expect(geo, t).toBeDefined();
      expect(geo!.boundingSphere!.radius).toBeCloseTo(1, 1);
      expect(geo!.getAttribute("normal")).toBeDefined();
    }
  });

  it("hero + agent GLBs stay inside the web budget and keep their clips", () => {
    expect(statSync(join(models, "nexmed-hero.glb")).size).toBeLessThan(2 * 1024 * 1024);
    expect(statSync(join(models, "nexmed-agent.glb")).size).toBeLessThan(512 * 1024);
    const hero = glbJson("nexmed-hero.glb");
    expect(hero.animations?.map((a) => a.name).sort()).toEqual(["Idle", "Intro"]);
    const agent = glbJson("nexmed-agent.glb");
    expect(agent.animations?.map((a) => a.name).sort()).toEqual(["Appear", "Idle", "Listen", "Speak", "Think"]);
  });

  it("rest pose is not baked at scale 0 (regression: NLA export at the first frame of Appear/Intro)", () => {
    for (const file of ["nexmed-hero.glb", "nexmed-agent.glb"]) {
      const zero = glbJson(file).nodes.filter((n) => n.scale && n.scale.every((v) => v === 0)).map((n) => n.name);
      expect(zero, file).toEqual([]);
    }
  });
});
