"use client";
/* eslint-disable react-hooks/immutability -- three.js scene graph, mixer and clipping plane are imperative objects mutated every frame by design. */
/**
 * The Blender hero (public/models/nexmed-hero.glb, built by blender/build_hero.py) inside R3F.
 * Starts in the exact pose of the poster PNG so the poster -> 3D swap is invisible, then idles:
 * Blender "Idle" clip (a pulse climbing the graph crown) + a slow sway. `replay` re-runs the growth:
 * the helix rises out of the forest (clipping plane) while Blender's "Intro" clip pops the nodes in.
 */
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { DRACO_PATH, MODELS } from "./palette";

// Growth replay: the helix rises first, the graph edges follow once their nodes have popped in.
const HELIX_GROW = [0, 1.7] as const;
const EDGE_GROW = [1.0, 2.6] as const;
const MODEL_TOP = 2.35; // metres, Blender z -> three y

export interface HeroModelProps {
  /** Increment to replay the growth animation. */
  replay?: number;
  /** Called once the model is on screen (first frame rendered). */
  onReady?: () => void;
  /** Pointer parallax strength (0 = off). */
  parallax?: number;
}

export function HeroModel({ replay = 0, onReady, parallax = 0.12 }: HeroModelProps) {
  const { scene, animations } = useGLTF(MODELS.hero, DRACO_PATH);
  const group = useRef<THREE.Group>(null);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const helixPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), MODEL_TOP), []);
  const edgePlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), MODEL_TOP), []);
  const grow = useRef<number | null>(null); // seconds into the growth, null = idle
  const ready = useRef(false);

  // Helix, base pairs and graph edges are revealed by the rising clipping plane during a replay.
  useEffect(() => {
    const helix = new Set(["MAT-strand", "MAT-rung-a", "MAT-rung-b"]);
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (helix.has(m.name)) m.clippingPlanes = [helixPlane];
        if (m.name === "MAT-edge") m.clippingPlanes = [edgePlane];
      }
    });
  }, [scene, helixPlane, edgePlane]);

  const idleAction = useMemo(() => {
    const clip = THREE.AnimationClip.findByName(animations, "Idle");
    return clip ? mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity) : null;
  }, [animations, mixer]);
  const introAction = useMemo(() => {
    const clip = THREE.AnimationClip.findByName(animations, "Intro");
    if (!clip) return null;
    const a = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    return a;
  }, [animations, mixer]);

  useEffect(() => {
    idleAction?.play();
    return () => { mixer.stopAllAction(); };
  }, [idleAction, mixer]);

  useEffect(() => {
    if (!replay || !introAction) return;
    grow.current = 0;
    idleAction?.fadeOut(0.2);
    introAction.reset().setEffectiveWeight(1).play();
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action !== introAction) return;
      idleAction?.reset().fadeIn(0.5).play();
      introAction.fadeOut(0.5);
    };
    mixer.addEventListener("finished", onFinished);
    return () => mixer.removeEventListener("finished", onFinished);
  }, [replay, introAction, idleAction, mixer]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    mixer.update(dt);
    if (grow.current !== null) {
      grow.current += dt;
      const rise = (plane: THREE.Plane, [from, to]: readonly [number, number]) => {
        const t = Math.min(1, Math.max(0, (grow.current! - from) / (to - from)));
        plane.constant = 0.12 + (MODEL_TOP - 0.12) * (1 - Math.pow(1 - t, 3));
      };
      rise(helixPlane, HELIX_GROW);
      rise(edgePlane, EDGE_GROW);
      if (grow.current >= EDGE_GROW[1]) grow.current = null;
    }
    const g = group.current;
    if (g) {
      const time = state.clock.elapsedTime;
      const sway = Math.sin(time * 0.22) * 0.32;
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, sway + state.pointer.x * parallax, 0.05);
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -state.pointer.y * parallax * 0.25, 0.05);
    }
    if (!ready.current) {
      ready.current = true;
      requestAnimationFrame(() => onReady?.());
    }
  });

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(MODELS.hero, DRACO_PATH);
