/**
 * <NodeOrb> — a small shaded sphere for legends, mode cards and inline markers. Pure CSS (no WebGL
 * context), so dozens can sit on one page; it reads as 3D through a lit radial gradient + soft shadow.
 * `kind` mirrors edge kinds: observed (solid) · inferred (dashed ring) · extracted (dotted ring) · proposed (ghost).
 */
import type { CSSProperties } from "react";

export type OrbKind = "observed" | "inferred" | "extracted" | "proposed";
export type OrbTone = "brand" | "deep" | "light" | "ink";

const TONE: Record<OrbTone, string> = { brand: "var(--brand)", deep: "var(--brand-deep)", light: "var(--brand-light)", ink: "var(--brand-ink)" };

export function NodeOrb({ size = 20, tone = "brand", kind = "observed", float = false, className = "", label }: { size?: number; tone?: OrbTone; kind?: OrbKind; float?: boolean; className?: string; label?: string }) {
  const c = TONE[tone];
  const ghost = kind === "proposed";
  const sphere: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "999px",
    background: ghost
      ? "transparent"
      : `radial-gradient(circle at 34% 30%, var(--paper) 0%, color-mix(in srgb, ${c} 35%, white) 22%, ${c} 62%, color-mix(in srgb, ${c} 70%, var(--brand-ink)) 100%)`,
    boxShadow: ghost ? "none" : `0 ${Math.max(1, size / 10)}px ${Math.max(2, size / 4)}px -1px color-mix(in srgb, var(--brand-ink) 28%, transparent)`,
    border: ghost ? `1.5px dashed var(--ink-3)` : undefined,
  };
  const ring = kind === "inferred" ? "dashed" : kind === "extracted" ? "dotted" : null;
  return (
    <span
      className={`relative inline-grid place-items-center shrink-0 ${float ? "float-y" : ""} ${className}`}
      style={{ width: size + (ring ? 8 : 0), height: size + (ring ? 8 : 0) }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {ring && <span className="absolute inset-0 rounded-full" style={{ border: `1.5px ${ring} ${c}` }} />}
      <span style={sphere} />
    </span>
  );
}
