"use client";
/**
 * <PersonaOrb> — the Blender AgentOrb (brand) wearing the current agent's identity. OWNER: voice lane.
 * One WebGL orb only; what changes between agents is an aura ring + name tag behind/below it:
 *  - switching agent cross-fades the old aura/tag out and the new one in (≈350 ms ease-in-out, no snaps);
 *  - the aura turns at constant angular velocity with a linear infinite keyframe, so the loop is seamless;
 *  - `cycle={ms}` rotates through the four agents in a loop (website "four voices", idle showcases).
 * Reduced motion (OS or prefs): no rotation; the cross-fade stays (opacity only). AgentOrb itself handles its
 * own state cross-fades (Idle/Listen/Think/Speak) and static poster fallback.
 */
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { AgentOrb } from "@/components/three/AgentOrb";
import { PERSONAS, type PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";
import { FADE_MS, PERSONA_ORDER, cycledPersona, nextLayers, type OrbLayer } from "@/lib/voice/orb";

type OrbState = Parameters<typeof AgentOrb>[0]["state"];

export { PERSONA_ORDER, FADE_MS };
/** One logo-blue per agent (tokens from globals.css), so the switch is visible but stays on brand. */
export const PERSONA_TINT: Record<PersonaId, string> = {
  devon: "var(--brand-light)",
  maria: "var(--brand)",
  osei: "var(--brand-deep)",
  priya: "var(--brand-ink)",
};
type Layer = OrbLayer;

export interface PersonaOrbProps {
  persona: PersonaId;
  state: OrbState;
  size?: number;
  reduce?: boolean;
  getLevel?: () => number;
  /** Auto-rotate through the four agents every `cycle` ms (ignores `persona` changes while set). */
  cycle?: number;
  /** Show the agent's mode under the orb. */
  showName?: boolean;
  locale?: Locale;
  className?: string;
}

export function PersonaOrb({ persona, state, size = 72, reduce, getLevel, cycle, showName, locale = "en", className = "" }: PersonaOrbProps) {
  const osReduce = useReducedMotion();
  const still = !!(reduce || osReduce);
  const [tick, setTick] = useState(0);
  const shown: PersonaId = cycle ? cycledPersona(persona, tick) : persona;

  // Cyclic showcase: advance one agent per period, forever (loops back to the first).
  useEffect(() => {
    if (!cycle) return;
    const id = window.setInterval(() => setTick((t) => t + 1), Math.max(cycle, FADE_MS * 3));
    return () => window.clearInterval(id);
  }, [cycle]);

  // Layer stack adjusted during render (React's "derive state from props" pattern; no effect + setState).
  const [layers, setLayers] = useState<Layer[]>([{ p: shown, k: 0 }]);
  const [prevShown, setPrevShown] = useState(shown);
  if (shown !== prevShown) {
    setPrevShown(shown);
    setLayers((ls) => nextLayers(ls, shown));
  }
  const top = layers[layers.length - 1];
  // Reduced motion: CSS animations are stopped app-wide, so never stack layers (instant, calm swap).
  const visible = still ? [top] : layers;
  const drop = (k: number) => setLayers((ls) => (ls.length > 1 ? ls.filter((l) => l.k !== k || l === ls[ls.length - 1]) : ls));

  return (
    <span className={`relative inline-flex flex-col items-center shrink-0 ${className}`} aria-hidden>
      <span className="relative grid place-items-center" style={{ width: size, height: size }}>
        {visible.map((l) => (
          <span key={l.k} className="absolute inset-0 rounded-full"
            onAnimationEnd={(e) => { if (e.animationName === "po-out") drop(l.k); }}
            style={{
              animation: still ? undefined : `${l === top ? "po-in" : "po-out"} ${FADE_MS}ms ease-in-out forwards`,
            }}>
            <span className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(from 0deg, transparent 0deg, ${PERSONA_TINT[l.p]} 120deg, transparent 240deg, ${PERSONA_TINT[l.p]} 330deg, transparent 360deg)`,
                WebkitMask: "radial-gradient(circle, transparent 57%, #000 60%, #000 71%, transparent 74%)",
                mask: "radial-gradient(circle, transparent 57%, #000 60%, #000 71%, transparent 74%)",
                animation: still ? undefined : "po-spin 9s linear infinite",
              }} />
            <span className="absolute inset-[10%] rounded-full" style={{ background: `radial-gradient(circle, color-mix(in srgb, ${PERSONA_TINT[l.p]} 24%, transparent) 0%, transparent 72%)` }} />
          </span>
        ))}
        <span className="relative">
          <AgentOrb state={state} size={Math.round(size * 0.86)} reduce={reduce} getLevel={getLevel} />
        </span>
      </span>
      {showName && (
        <span className="relative mt-1 h-4 w-full min-w-24 text-center text-[11px] font-semibold text-ink-2">
          {visible.map((l) => (
            <span key={l.k} className="absolute inset-0 whitespace-nowrap"
              style={{ animation: still ? undefined : `${l === top ? "po-in" : "po-out"} ${FADE_MS}ms ease-in-out forwards` }}>
              {PERSONAS[l.p].mode[locale]}
            </span>
          ))}
        </span>
      )}
      <style>{`@keyframes po-in{from{opacity:0}to{opacity:1}}@keyframes po-out{from{opacity:1}to{opacity:0}}@keyframes po-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </span>
  );
}
