"use client";
/* eslint-disable react-hooks/immutability -- three.js scene graph, mixer and clipping plane are imperative objects mutated every frame by design. */
/**
 * The Blender voice agent (public/models/nexmed-agent.glb, built by blender/build_agent.py).
 * Clips and the hierarchy layer each one drives (so they compose instead of fighting):
 *   Appear -> POP_*   (once; played backwards to dismiss)      Idle -> leaves (always on)
 *   Listen / Think / Speak -> STATE_* and PETAL_* (cross-faded on state change)
 * The live audio level (0..1) opens the voice petals and swells the core on top of the clips.
 */
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { DRACO_PATH, MODELS } from "./palette";

export type AgentState = "hidden" | "idle" | "listening" | "thinking" | "speaking";

const STATE_CLIP: Partial<Record<AgentState, string>> = { listening: "Listen", thinking: "Think", speaking: "Speak" };
const FADE = 0.35;

export interface AgentModelProps {
  state: AgentState;
  /** Live audio level 0..1, read every frame (e.g. ElevenLabs getOutputVolume / getInputVolume). */
  getLevel?: () => number;
  /** Called when the dismiss animation has finished (state === "hidden"). */
  onHidden?: () => void;
  onReady?: () => void;
}

export function AgentModel({ state, getLevel, onHidden, onReady }: AgentModelProps) {
  const { scene: source, animations } = useGLTF(MODELS.agent, DRACO_PATH);
  // Clone so several orbs can be on screen (geometry + materials stay shared).
  const scene = useMemo(() => source.clone(true), [source]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const actions = useMemo(() => {
    const get = (name: string) => {
      const clip = THREE.AnimationClip.findByName(animations, name);
      return clip ? mixer.clipAction(clip) : null;
    };
    const appear = get("Appear");
    if (appear) { appear.setLoop(THREE.LoopOnce, 1); appear.clampWhenFinished = true; }
    return { appear, idle: get("Idle"), Listen: get("Listen"), Think: get("Think"), Speak: get("Speak") } as Record<string, THREE.AnimationAction | null>;
  }, [animations, mixer]);

  const parts = useMemo(() => {
    const petals: { obj: THREE.Object3D; rest: number; i: number }[] = [];
    let core: THREE.Object3D | null = null;
    scene.traverse((o) => {
      if (o.name.startsWith("PETAL_")) petals.push({ obj: o, rest: o.scale.x, i: Number(o.name.slice(6)) });
      if (o.name === "CORE") core = o;
    });
    return { petals, core: core as THREE.Object3D | null };
  }, [scene]);

  const level = useRef(0);
  const current = useRef<THREE.AnimationAction | null>(null);
  const shown = useRef(false);
  const ready = useRef(false);

  // Always-on idle layer.
  useEffect(() => {
    actions.idle?.setLoop(THREE.LoopRepeat, Infinity).play();
    return () => { mixer.stopAllAction(); };
  }, [actions, mixer]);

  // Appear / dismiss.
  useEffect(() => {
    const appear = actions.appear;
    if (!appear) return;
    const visible = state !== "hidden";
    if (visible && !shown.current) {
      shown.current = true;
      scene.visible = true;
      appear.reset().setEffectiveTimeScale(1).play();
    } else if (!visible && !shown.current) {
      scene.visible = false; // mounted hidden: wait for the first appear
    } else if (!visible && shown.current) {
      shown.current = false;
      appear.paused = false;
      appear.setEffectiveTimeScale(-1.4);
      if (appear.time <= 0 || !appear.isRunning()) { appear.time = appear.getClip().duration; }
      appear.play();
      const onFinished = (e: { action: THREE.AnimationAction }) => {
        if (e.action !== appear) return;
        scene.visible = false;
        onHidden?.();
      };
      mixer.addEventListener("finished", onFinished);
      return () => mixer.removeEventListener("finished", onFinished);
    }
  }, [state, actions, mixer, scene, onHidden]);

  // State layer cross-fade.
  useEffect(() => {
    const name = STATE_CLIP[state];
    const next = name ? actions[name] : null;
    if (next === current.current) return;
    current.current?.fadeOut(FADE);
    if (next) next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(FADE).play();
    current.current = next;
  }, [state, actions]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    for (const p of parts.petals) p.obj.scale.x = p.rest; // the mixer overwrites these only while Speak plays
    mixer.update(dt);
    const target = state === "speaking" || state === "listening" ? Math.max(0, Math.min(1, getLevel?.() ?? 0)) : 0;
    level.current += (target - level.current) * (target > level.current ? 0.35 : 0.12);
    const l = level.current;
    if (l > 0.002) {
      const t = performance.now() / 1000;
      for (const p of parts.petals) {
        const wave = 0.65 + 0.35 * Math.sin(t * 9 + p.i * 0.9);
        p.obj.scale.x *= 1 + l * 1.5 * wave;
      }
      parts.core?.scale.multiplyScalar(1 + l * 0.06);
    }
    if (!ready.current) {
      ready.current = true;
      requestAnimationFrame(() => onReady?.());
    }
  });

  return <primitive object={scene} />;
}

useGLTF.preload(MODELS.agent, DRACO_PATH);
