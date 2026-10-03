import { Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { FPS } from "../theme";

export const eOut = Easing.bezier(0.16, 1, 0.3, 1);
export const eInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const eIn = Easing.bezier(0.5, 0, 0.75, 0);

/** 0→1 between scene-seconds a and b (clamped, eased). */
export function prog(s: number, a: number, b: number, easing: (t: number) => number = eOut) {
  return interpolate(s, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}

/** Map p in [0,1] to [from,to]. */
export const mix = (p: number, from: number, to: number) => from + (to - from) * p;

/**
 * Scene time in "natural seconds". Every scene is authored at a natural length; when a cut gives it
 * fewer (or more) frames via `dur`, the whole scene plays proportionally faster (or slower).
 * This is what makes the 60 s and 2 min cuts share the same scenes.
 */
export function useSceneTime(natural: number, dur?: number) {
  const frame = useCurrentFrame();
  const total = dur ?? natural * FPS;
  return (frame / total) * natural;
}

/** Spring evaluated in scene-seconds (so it also scales with `dur`). */
export function pop(s: number, at: number, damping = 13) {
  if (s < at) return 0;
  return spring({ frame: (s - at) * FPS, fps: FPS, config: { damping, stiffness: 170, mass: 0.7 } });
}

export type SceneProps = {
  /** Frames this scene gets inside a cut. Omit for the standalone composition (natural length). */
  dur?: number;
};

/** Fade-in/out envelope at the edges of a scene (in natural seconds). */
export function edgeFade(s: number, natural: number, inS = 0.25, outS = 0.3) {
  return Math.min(prog(s, 0, inS, eOut), 1 - prog(s, natural - outS, natural, eIn));
}

/** Scene-second at which prog(s, t0, t1, easing) first reaches f (binary search). */
export function reachTime(t0: number, t1: number, f: number, easing: (t: number) => number = eInOut) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (easing(m) < f) lo = m;
    else hi = m;
  }
  return t0 + (t1 - t0) * hi;
}

/** Back-out pop (0→1 with overshoot) between scene-seconds a and a+len. */
export function popAt(s: number, a: number, len = 0.35) {
  const t = Math.min(1, Math.max(0, (s - a) / len));
  const c1 = 1.9;
  const c3 = c1 + 1;
  return t <= 0 ? 0 : t >= 1 ? 1 : 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
