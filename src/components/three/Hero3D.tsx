"use client";
/**
 * Landing hero visual. The Cycles poster (public/models/nexmed-hero.png) paints instantly and is the LCP;
 * the 3D scene loads lazily behind it and cross-fades in at the same pose. Reduced motion, low-power
 * devices and no-WebGL keep the poster only.
 */
import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { POSTERS } from "./palette";
import { useCan3D } from "./useCan3D";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), { ssr: false });

export function Hero3D({ className = "", alt }: { className?: string; alt: string }) {
  const can3d = useCan3D();
  const [ready, setReady] = useState(false);
  const [replay, setReplay] = useState(0);
  const live = can3d === "3d";
  return (
    <div className={`relative aspect-square ${className}`}>
      <Image
        src={POSTERS.hero}
        alt={alt}
        fill
        priority
        sizes="(min-width: 1024px) 560px, 92vw"
        className={`object-contain select-none transition-opacity duration-700 ${live && ready ? "opacity-0" : "opacity-100"}`}
      />
      {live && (
        <HeroCanvas
          replay={replay}
          onReady={() => setReady(true)}
          className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {live && ready && (
        <button
          type="button"
          onClick={() => setReplay((n) => n + 1)}
          className="absolute bottom-2 right-2 chip hover:border-brand hover:text-brand-deep focus-visible:outline-2 focus-visible:outline-brand"
        >
          <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-brand" />
          Grow it again
        </button>
      )}
    </div>
  );
}
