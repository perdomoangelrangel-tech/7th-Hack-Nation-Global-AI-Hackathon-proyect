"use client";
/* eslint-disable react-hooks/immutability -- three.js vectors and DOM label nodes are mutated per frame by design. */
/**
 * Lazy chunk: a small real neighbourhood of the evidence graph drawn with the Blender glyphs.
 * Line style = edge kind (solid observed · dashed inferred · dotted AI-extracted · faint proposed).
 * Hover a node to see its name and light up its edges. Slow turntable; pauses while hovering.
 * Labels are plain DOM nodes placed from the projected 3D position each frame (no React re-render).
 */
import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { Neighborhood, PreviewNode } from "@/components/landing/neighborhood";
import type { EdgeKind, EntityType } from "@/lib/atlas/types";
import { Scene3D } from "./Scene3D";
import { useGlyphGeometries } from "./glyphs";
import { palette3d as c } from "./palette";

const TYPE_COLOR: Partial<Record<EntityType, string>> = {
  disease: c.brand, gene: c.brandDeep, variant: c.brandLight, phenotype: c.brandLight, pathway: c.brandDeep,
  trial: c.brand, study: c.brandLight, treatment: c.brand, organization: c.brandInk, investigator: c.brandInk,
};
const LINE: Record<EdgeKind, { color: string; dashed: boolean; dash: number; gap: number; opacity: number }> = {
  observed: { color: c.brandDeep, dashed: false, dash: 1, gap: 0, opacity: 0.55 },
  inferred: { color: c.brand, dashed: true, dash: 0.14, gap: 0.1, opacity: 0.9 },
  extracted: { color: c.brand, dashed: true, dash: 0.03, gap: 0.06, opacity: 0.9 },
  proposed: { color: c.brandLight, dashed: true, dash: 0.1, gap: 0.12, opacity: 0.45 },
};
const TYPE_LABEL: Record<string, string> = { study: "paper", organization: "patient group", investigator: "researcher", pathway: "pathway (mechanism)", phenotype: "symptom" };

const labelText = (n: PreviewNode) => `${n.name.length > 42 ? `${n.name.slice(0, 40)}…` : n.name} · ${TYPE_LABEL[n.type] ?? n.type}`;

function Node({ n, geo, active, dim, onHover, register }: { n: PreviewNode; geo: THREE.BufferGeometry; active: boolean; dim: boolean; onHover: (id: string | null) => void; register: (id: string, m: THREE.Mesh | null) => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const target = useMemo(() => new THREE.Vector3(), []);
  const setRef = (m: THREE.Mesh | null) => { ref.current = m; register(n.id, m); };
  const phase = useMemo(() => (n.pos[0] * 13.1 + n.pos[1] * 7.7) % (Math.PI * 2), [n.pos]);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    m.position.y = n.pos[1] + Math.sin(t * 0.9 + phase) * 0.035;
    m.rotation.y = t * 0.35 + phase;
    const s = n.size * (active ? 1.25 : 1);
    m.scale.lerp(target.set(s, s, s), 0.2);
  });
  return (
    <mesh
      ref={setRef}
      geometry={geo}
      position={n.pos}
      scale={n.size}
      onPointerOver={(e) => { e.stopPropagation(); onHover(n.id); }}
      onPointerOut={() => onHover(null)}
    >
      <meshStandardMaterial color={TYPE_COLOR[n.type] ?? c.brand} roughness={0.35} metalness={0.05} transparent opacity={dim ? 0.35 : 1} emissive={n.center ? c.brand : "black"} emissiveIntensity={n.center ? 0.25 : 0} />
    </mesh>
  );
}

type Labels = { center: RefObject<HTMLSpanElement | null>; hover: RefObject<HTMLSpanElement | null> };

function Graph({ data, labels }: { data: Neighborhood; labels: Labels }) {
  const glyphs = useGlyphGeometries();
  const fallback = useMemo(() => new THREE.SphereGeometry(1, 20, 14), []);
  const group = useRef<THREE.Group>(null);
  const meshes = useRef(new Map<string, THREE.Mesh>());
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const [hover, setHover] = useState<string | null>(null);
  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);
  const pos = useMemo(() => new Map(data.nodes.map((n) => [n.id, n.pos])), [data]);
  const linked = useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]);
    for (const e of data.edges) if (e.from === hover || e.to === hover) { s.add(e.from); s.add(e.to); }
    return s;
  }, [hover, data]);
  const register = (id: string, m: THREE.Mesh | null) => { if (m) meshes.current.set(id, m); else meshes.current.delete(id); };

  const place = (el: HTMLSpanElement | null, id: string | null) => {
    if (!el) return;
    const m = id ? meshes.current.get(id) : undefined;
    const node = id ? byId.get(id) : undefined;
    if (!id || !m || !node) { el.style.opacity = "0"; return; }
    m.getWorldPosition(tmp);
    tmp.y += node.size * 1.25;
    tmp.project(camera);
    const x = ((tmp.x + 1) / 2) * size.width;
    const y = ((1 - tmp.y) / 2) * size.height;
    if (el.dataset.id !== id) { el.dataset.id = id; el.textContent = labelText(node); }
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    el.style.opacity = "1";
  };

  useFrame((_, delta) => {
    const g = group.current;
    if (g && !hover) g.rotation.y += Math.min(delta, 0.05) * 0.12;
    const other = hover && hover !== data.center ? hover : null;
    place(labels.center.current, other ? null : data.center);
    place(labels.hover.current, other);
  });

  return (
    <group ref={group} rotation={[0.12, -0.35, 0]}>
      {data.edges.map((e) => {
        const a = pos.get(e.from), b = pos.get(e.to);
        if (!a || !b) return null;
        const st = LINE[e.kind];
        const on = !linked || (linked.has(e.from) && linked.has(e.to));
        return (
          <Line key={e.id} points={[a, b]} color={st.color} lineWidth={on && linked ? 2.6 : 1.6} dashed={st.dashed} dashSize={st.dash} gapSize={st.gap} transparent opacity={on ? st.opacity : 0.12} />
        );
      })}
      {data.nodes.map((n) => (
        <Node key={n.id} n={n} geo={glyphs?.[n.type] ?? fallback} active={hover === n.id} dim={!!linked && !linked.has(n.id)} onHover={setHover} register={register} />
      ))}
    </group>
  );
}

const LABEL = "pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full border border-line bg-paper/95 px-2.5 py-1 text-xs font-semibold text-brand-ink opacity-0 shadow-sm transition-opacity duration-150";

export default function GlyphGraph({ data, className = "" }: { data: Neighborhood; className?: string }) {
  const center = useRef<HTMLSpanElement>(null);
  const hover = useRef<HTMLSpanElement>(null);
  return (
    <div className={className}>
      <Scene3D className="absolute inset-0" camera={{ position: [0, 0.6, 7.4], fov: 38, near: 0.1, far: 60 }} target={[0, 0, 0]}>
        <Suspense fallback={null}>
          <Graph data={data} labels={{ center, hover }} />
        </Suspense>
      </Scene3D>
      <span ref={center} aria-hidden className={LABEL} />
      <span ref={hover} aria-hidden className={LABEL} />
    </div>
  );
}
