"use client";
/**
 * Landing: a real slice of the atlas around one disease, in 3D with the Blender glyphs.
 * Static fallback (reduced motion / low power / no WebGL): the same layout as a flat SVG.
 */
import dynamic from "next/dynamic";
import type { Neighborhood } from "./neighborhood";
import { useCan3D } from "@/components/three/useCan3D";

const GlyphGraph = dynamic(() => import("@/components/three/GlyphGraph"), { ssr: false });

const DASH: Record<string, string | undefined> = { observed: undefined, inferred: "6 5", extracted: "2 4", proposed: "5 6" };

function FlatGraph({ data }: { data: Neighborhood }) {
  const pos = new Map(data.nodes.map((n) => [n.id, n.pos]));
  const X = (x: number) => 50 + x * 13;
  const Y = (y: number) => 50 - y * 13;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={`Graph neighbourhood of ${data.centerName}`}>
      {data.edges.map((e) => {
        const a = pos.get(e.from), b = pos.get(e.to);
        if (!a || !b) return null;
        return <line key={e.id} x1={X(a[0])} y1={Y(a[1])} x2={X(b[0])} y2={Y(b[1])} stroke={e.kind === "inferred" ? "var(--brand)" : "var(--brand-deep)"} strokeOpacity={e.kind === "observed" ? 0.5 : 0.9} strokeWidth={0.35} strokeDasharray={DASH[e.kind]} />;
      })}
      {data.nodes.map((n) => (
        <circle key={n.id} cx={X(n.pos[0])} cy={Y(n.pos[1])} r={n.size * 6} fill={n.center ? "var(--brand)" : n.type === "disease" ? "var(--brand-light)" : "var(--brand-deep)"} stroke="var(--paper)" strokeWidth={0.4}>
          <title>{`${n.name} · ${n.type}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export function AtlasPreview({ data }: { data: Neighborhood }) {
  const can3d = useCan3D();
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl sm:aspect-[4/3] border border-line bg-[radial-gradient(70%_70%_at_50%_45%,var(--paper),var(--brand-mist))]">
      {can3d === "3d" ? (
        <GlyphGraph data={data} className="absolute inset-0" />
      ) : (
        <div className="absolute inset-0 p-4"><FlatGraph data={data} /></div>
      )}
      <p className="pointer-events-none absolute bottom-3 left-4 text-xs text-ink-3">{can3d === "3d" ? "Hover or tap a shape to see what it is" : "Static view"}</p>
    </div>
  );
}
