"use client";
/**
 * Landing hero visual (F9). The Blender/Cycles poster paints instantly: an inline 24 px blur first, then a
 * pre-encoded WebP (66–172 KB, srcset, fetchpriority=high, preloaded by the page) — it is the LCP.
 * The 3D scene loads lazily behind it and cross-fades in at the exact same camera once its first frame
 * has rendered. Reduced motion, low-power devices and no-WebGL keep the poster only.
 */
import dynamic from "next/dynamic";
import { useState } from "react";
import { HERO_POSTER } from "./heroPoster";
import { useCan3D } from "./useCan3D";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), { ssr: false });

export function Hero3D({ className = "", alt }: { className?: string; alt: string }) {
  const can3d = useCan3D();
  const [ready, setReady] = useState(false);
  const [replay, setReplay] = useState(0);
  const live = can3d === "3d";
  return (
    <div
      className={`relative aspect-square bg-contain bg-center bg-no-repeat ${className}`}
      style={{ backgroundImage: `url("${HERO_POSTER.lqip}")` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-encoded WebP srcset served from the CDN: no optimizer round trip on the LCP */}
      <img
        src={HERO_POSTER.src}
        srcSet={HERO_POSTER.srcSet}
        sizes={HERO_POSTER.sizes}
        width={HERO_POSTER.width}
        height={HERO_POSTER.height}
        alt={alt}
        fetchPriority="high"
        decoding="async"
        className={`absolute inset-0 h-full w-full select-none object-contain transition-opacity duration-700 ${live && ready ? "opacity-0" : "opacity-100"}`}
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
          className="absolute bottom-2 right-2 chip hover:border-brand hover:text-brand-deep"
        >
          <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-brand" />
          Grow it again
        </button>
      )}
    </div>
  );
}
