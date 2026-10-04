"use client";
/** Lazy chunk for the voice agent: its own small transparent canvas. Camera = the Blender poster camera. */
import { Suspense, useState } from "react";
import { Scene3D } from "./Scene3D";
import { AgentModel, type AgentState } from "./AgentModel";

// blender/build_agent.py: camera (0, -4.5, 0.3) -> origin, 60 mm on 36 mm. Z-up -> Y-up.
const FOV = (2 * Math.atan(18 / 60) * 180) / Math.PI;

export interface AgentCanvasProps {
  state: AgentState;
  getLevel?: () => number;
  className?: string;
  onReady?: () => void;
}

export default function AgentCanvas({ state, getLevel, className, onReady }: AgentCanvasProps) {
  // Render loop sleeps once the dismiss animation has finished; wakes on the next visible state.
  const [asleep, setAsleep] = useState(state === "hidden");
  const [prev, setPrev] = useState(state);
  if (state !== prev) {
    setPrev(state);
    if (state !== "hidden") setAsleep(false);
  }
  return (
    <Scene3D className={className} camera={{ position: [0, 0.3, 4.5], fov: FOV, near: 0.1, far: 30 }} paused={state === "hidden" && asleep}>
      <Suspense fallback={null}>
        <AgentModel state={state} getLevel={getLevel} onReady={onReady} onHidden={() => setAsleep(true)} />
      </Suspense>
    </Scene3D>
  );
}
