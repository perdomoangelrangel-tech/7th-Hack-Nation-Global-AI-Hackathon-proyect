"use client";
/**
 * <AgentOrb> — the Blender-made Nexmed voice agent. Mount it wherever an AI agent speaks (voice dock,
 * narration bar). It pops in when it becomes visible, idles, leans in while listening, spins its helix
 * halo while thinking and opens its voice petals while speaking (driven by the live audio level).
 *
 *   <AgentOrb state={speaking ? "speaking" : live ? "listening" : "idle"} size={96}
 *             getLevel={() => (speaking ? conversation.getOutputVolume() : conversation.getInputVolume())} />
 *
 * Props are a superset of the voice lane's CSS orb (`state`, `reduce`, `size`). `state="hidden"` plays the
 * appear clip backwards and then stops rendering. Reduced motion / low power / no WebGL → the static Cycles
 * poster with a calm ring that still shows the state. three.js is code-split and only loads in 3D mode.
 */
import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import type { AgentState } from "./AgentModel";
import { POSTERS } from "./palette";
import { useCan3D } from "./useCan3D";

export type { AgentState };

const AgentCanvas = dynamic(() => import("./AgentCanvas"), { ssr: false });

export interface AgentOrbProps {
  state: AgentState | "connecting";
  /** px, square. 3D reads best from ~72px; below that it still works but details get small. */
  size?: number;
  /** Force the static fallback (e.g. prefs.reduceMotion). OS reduced motion is detected automatically. */
  reduce?: boolean;
  /** Live audio level 0..1, polled every frame while listening/speaking. */
  getLevel?: () => number;
  className?: string;
  /** Accessible name; omit when a visible label already says who is talking (then it is aria-hidden). */
  label?: string;
}

export function AgentOrb({ state, size = 96, reduce, getLevel, className = "", label }: AgentOrbProps) {
  const can3d = useCan3D();
  const [ready, setReady] = useState(false);
  const s: AgentState = state === "connecting" ? "thinking" : state;
  const live = can3d === "3d" && !reduce;
  const hidden = s === "hidden";
  const a11y = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };

  if (!live) {
    if (hidden) return null;
    const ring = s === "speaking" ? "border-brand" : s === "listening" ? "border-brand-light" : s === "thinking" ? "border-dashed border-brand" : "border-transparent";
    return (
      <span {...a11y} className={`relative inline-grid place-items-center shrink-0 ${className}`} style={{ width: size, height: size }}>
        <span className={`absolute inset-[4%] rounded-full border-2 ${ring}`} />
        <Image src={POSTERS.agent} alt="" width={size} height={size} className="select-none" />
      </span>
    );
  }

  return (
    <span
      {...a11y}
      className={`relative inline-block shrink-0 transition-opacity duration-300 ${hidden && ready ? "pointer-events-none" : ""} ${className}`}
      style={{ width: size, height: size }}
    >
      {!ready && !hidden && <Image src={POSTERS.agent} alt="" width={size} height={size} className="absolute inset-0 select-none" />}
      <AgentCanvas state={s} getLevel={getLevel} onReady={() => setReady(true)} className="absolute inset-0" />
    </span>
  );
}

export default AgentOrb;
