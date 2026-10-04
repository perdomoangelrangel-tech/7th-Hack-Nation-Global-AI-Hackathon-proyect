"use client";
/**
 * Landing: a real slice of the atlas around one disease, as an ordered radial diagram in 3D with the Blender glyphs.
 * Static fallback (reduced motion / low power / no WebGL): the same layout as a flat SVG with the sector headers.
 */
import dynamic from "next/dynamic";
import { RING_R, type Neighborhood } from "./neighborhood";
import { useCan3D } from "@/components/three/useCan3D";

const GlyphGraph = dynamic(() => import("@/components/three/GlyphGraph"), { ssr: false });

const DASH: Record<string, string | undefined> = { observed: undefined, inferred: "1.6 1.2", extracted: "0.5 1", proposed: "1.4 1.6" };
const X = (x: number) => 50 + x * 10.5;
const Y = (y: number) => 50 - y * 10.5;

function FlatGraph({ data }: { data: Neighborhood }) {
  const pos = new Map(data.nodes.map((n) => [n.id, n.pos]));
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={`Graph neighbourhood of ${data.centerName}`}>
      {RING_R.slice(1).map((r) => <circle key={r} cx={50} cy={50} r={r * 10.5} fill="none" stroke="var(--brand-light)" strokeOpacity={0.35} strokeWidth={0.2} />)}
      {data.edges.map((e) => {
        const a = pos.get(e.from), b = pos.get(e.to);
        if (!a || !b) return null;
        return <line key={e.id} x1={X(a[0])} y1={Y(a[1])} x2={X(b[0])} y2={Y(b[1])} stroke={e.kind === "inferred" ? "var(--brand)" : "var(--brand-deep)"} strokeOpacity={e.kind === "observed" ? 0.4 : 0.85} strokeWidth={0.3} strokeDasharray={DASH[e.kind]} />;
      })}
      {data.nodes.map((n) => (
        <circle key={n.id} cx={X(n.pos[0])} cy={Y(n.pos[1])} r={n.size * 5.5} fill={n.center ? "var(--brand)" : n.type === "disease" ? "var(--brand-light)" : "var(--brand-deep)"} stroke="var(--paper)" strokeWidth={0.4}>
          <title>{`${n.name} · ${n.type}`}</title>
        </circle>
      ))}
      {data.sectors.map((s) => (
        <text key={s.key} x={X(s.pos[0])} y={Y(s.pos[1])} textAnchor="middle" dominantBaseline="middle" fontSize={2.6} fontWeight={700} letterSpacing={0.3} fill="var(--brand-deep)">{s.title.toUpperCase()}</text>
      ))}
      <text x={50} y={Y(0) + 8} textAnchor="middle" fontSize={3} fontWeight={700} fill="var(--brand-ink)">{data.nodes[0]?.label ?? data.centerName}</text>
    </svg>
  );
}

export function AtlasPreview({ data }: { data: Neighborhood }) {
  const can3d = useCan3D();
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-line bg-[radial-gradient(70%_70%_at_50%_45%,var(--paper),var(--brand-mist))] sm:aspect-[16/9]">
      {can3d === "3d" ? (
        <GlyphGraph data={data} className="absolute inset-0" />
      ) : (
        <div className="absolute inset-0 p-3"><FlatGraph data={data} /></div>
      )}
      <p className="pointer-events-none absolute bottom-3 left-4 hidden text-xs text-ink-3 sm:block">{can3d === "3d" ? "Hover or tap a shape to see what it is" : "Static view"}</p>
    </div>
  );
}
