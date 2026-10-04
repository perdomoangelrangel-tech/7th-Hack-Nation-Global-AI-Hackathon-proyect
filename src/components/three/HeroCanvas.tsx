"use client";
/** Lazy chunk for the landing hero (three.js + the GLB). Camera = the Blender poster camera, so the swap is seamless. */
import { Suspense } from "react";
import { Scene3D } from "./Scene3D";
import { HeroModel } from "./HeroModel";

// blender/build_hero.py: camera (1.7, -5.05, 2.1) -> target (0, 0, 1.17), 58 mm on a 36 mm sensor. Z-up -> Y-up.
const FOV = (2 * Math.atan(18 / 58) * 180) / Math.PI;

export default function HeroCanvas({ className, replay, onReady }: { className?: string; replay?: number; onReady?: () => void }) {
  return (
    <Scene3D className={className} camera={{ position: [1.7, 2.1, 5.05], fov: FOV, near: 0.1, far: 50 }} target={[0, 1.17, 0]}>
      <Suspense fallback={null}>
        <HeroModel replay={replay} onReady={onReady} />
      </Suspense>
    </Scene3D>
  );
}
