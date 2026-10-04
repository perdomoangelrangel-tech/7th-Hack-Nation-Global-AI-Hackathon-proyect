/**
 * <HelixLoader> — 3D loading indicator: a DNA double helix of shaded beads turning in CSS 3D
 * (perspective + preserve-3d, no WebGL context). Reduced motion (OS or in-app pref): a still helix.
 *   <HelixLoader />  ·  <HelixLoader size={64} label="Loading the atlas" />
 */
import type { CSSProperties } from "react";

export function HelixLoader({ size = 40, label = "Loading", className = "" }: { size?: number; label?: string; className?: string }) {
  const pairs = 9;
  const bead = Math.max(4, size * 0.16);
  const radius = size * 0.34;
  const step = (size * 1.1) / pairs;
  return (
    <span role="status" aria-label={label} className={`inline-grid place-items-center ${className}`} style={{ width: size, height: size * 1.25, perspective: size * 6 }}>
      <span className="helix-spin relative block" style={{ width: 0, height: step * (pairs - 1), transformStyle: "preserve-3d", ["--helix-speed" as string]: "2.6s" } as CSSProperties}>
        {Array.from({ length: pairs }, (_, i) => {
          const angle = i * 40;
          const y = i * step;
          return (
            <span key={i} className="absolute left-0" style={{ top: y, transformStyle: "preserve-3d", transform: `rotateY(${angle}deg)` }}>
              <span className="absolute block" style={{ width: radius * 2, height: 1.5, left: -radius, top: -0.75, background: "var(--brand-light)", opacity: 0.7 }} />
              {[1, -1].map((side) => (
                <span
                  key={side}
                  className="absolute block rounded-full"
                  style={{
                    width: bead,
                    height: bead,
                    left: -bead / 2,
                    top: -bead / 2,
                    transform: `translateX(${side * radius}px)`,
                    background: `radial-gradient(circle at 35% 30%, var(--paper), ${side > 0 ? "var(--brand)" : "var(--brand-deep)"} 70%)`,
                  }}
                />
              ))}
            </span>
          );
        })}
      </span>
    </span>
  );
}
