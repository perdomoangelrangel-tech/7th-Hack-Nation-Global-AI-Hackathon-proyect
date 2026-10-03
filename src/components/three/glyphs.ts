/**
 * Blender-made graph glyphs (public/models/nexmed-glyphs.glb, built by blender/build_glyphs.py):
 * one small 3D symbol per entity type — disease (cell), gene (double helix), variant (crystal),
 * phenotype (drop), pathway (cycle ring), trial (flask), study (paper), treatment (capsule),
 * organization (group of people), investigator (person).
 *
 * Geometry only: each is centred with bounding radius 1 and smooth normals, so it drops into any
 * per-type geometry map and takes the caller's material/colour:
 *
 *   const glyphs = await loadGlyphGeometries();           // cached, ~125 KB, no Draco needed
 *   const geo = glyphs[node.type] ?? fallbackSphere;      // then new THREE.Mesh(geo, material)
 *
 * React: `const glyphs = useGlyphGeometries()` (null until loaded).
 */
import { useEffect, useState } from "react";
import type * as THREE from "three";
import type { EntityType } from "@/lib/atlas/types";
import { MODELS } from "./palette";

export const GLYPH_TYPES = ["disease", "gene", "variant", "phenotype", "pathway", "trial", "study", "treatment", "organization", "investigator"] as const satisfies readonly EntityType[];

export type GlyphGeometries = Partial<Record<EntityType, THREE.BufferGeometry>>;

/** Extract normalised GLYPH_<type> geometries from a loaded glTF scene. */
export function glyphsFromScene(scene: THREE.Object3D): GlyphGeometries {
  const out: GlyphGeometries = {};
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.name.startsWith("GLYPH_")) return;
    const type = mesh.name.slice(6) as EntityType;
    if (!(GLYPH_TYPES as readonly string[]).includes(type)) return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    geo.computeBoundingSphere();
    const bs = geo.boundingSphere!;
    geo.translate(-bs.center.x, -bs.center.y, -bs.center.z);
    const k = 1 / (bs.radius || 1);
    geo.scale(k, k, k);
    geo.computeBoundingSphere();
    out[type] = geo;
  });
  return out;
}

let cache: Promise<GlyphGeometries> | null = null;

export function loadGlyphGeometries(url: string = MODELS.glyphs): Promise<GlyphGeometries> {
  if (!cache) {
    cache = import("three/examples/jsm/loaders/GLTFLoader.js")
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(url))
      .then((gltf) => glyphsFromScene(gltf.scene))
      .catch((err) => {
        cache = null; // allow a retry
        throw err;
      });
  }
  return cache;
}

export function useGlyphGeometries(): GlyphGeometries | null {
  const [glyphs, setGlyphs] = useState<GlyphGeometries | null>(null);
  useEffect(() => {
    let alive = true;
    loadGlyphGeometries().then((g) => { if (alive) setGlyphs(g); }).catch(() => { /* keep the caller's primitives */ });
    return () => { alive = false; };
  }, []);
  return glyphs;
}
