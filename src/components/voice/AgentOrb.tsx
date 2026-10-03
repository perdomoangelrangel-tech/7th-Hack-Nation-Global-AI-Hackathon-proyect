"use client";
/**
 * Calm audio orb for the voice dock: idle · listening · speaking. OWNER: voice lane.
 * CSS-only and light (logo blues on white). Reduced motion (OS or prefs) = static orb, state shown by color/ring.
 * Swap for the brand lane's Blender `AgentOrb` (src/components/three) once it ships.
 */
import { useReducedMotion } from "motion/react";

export type OrbState = "idle" | "listening" | "speaking";

export function AgentOrb({ state, reduce, size = 40 }: { state: OrbState; reduce?: boolean; size?: number }) {
  const osReduce = useReducedMotion();
  const still = reduce || osReduce;
  const anim = still ? "" : state === "speaking" ? "animate-[orb-speak_0.9s_ease-in-out_infinite]" : state === "listening" ? "animate-[orb-breathe_2.4s_ease-in-out_infinite]" : "";
  return (
    <span className="relative shrink-0 grid place-items-center" style={{ width: size, height: size }} aria-hidden>
      {state !== "idle" && <span className={`absolute inset-0 rounded-full border-2 ${state === "speaking" ? "border-brand" : "border-brand-soft"}`} />}
      <span className={`rounded-full ${anim}`}
        style={{
          width: size * 0.78, height: size * 0.78,
          background: "radial-gradient(circle at 35% 30%, var(--paper) 0%, var(--brand-soft) 28%, var(--brand) 70%, var(--brand-deep) 100%)",
          boxShadow: state === "speaking" ? "0 0 0 6px color-mix(in srgb, var(--brand) 18%, transparent)" : "0 2px 8px color-mix(in srgb, var(--brand-ink) 18%, transparent)",
        }} />
      <style>{`@keyframes orb-breathe{0%,100%{transform:scale(.94)}50%{transform:scale(1)}}@keyframes orb-speak{0%,100%{transform:scale(.92)}35%{transform:scale(1.06)}70%{transform:scale(.97)}}`}</style>
    </span>
  );
}
