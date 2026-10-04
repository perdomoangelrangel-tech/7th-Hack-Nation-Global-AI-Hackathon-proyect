"use client";
/* eslint-disable react-hooks/immutability -- three.js vectors and DOM label nodes are mutated per frame by design. */
/**
 * Lazy chunk: the website's "Inside the atlas" graph — an ordered radial diagram (centre disease · ring 1 mechanism ·
 * ring 2 similar diseases with their lead strength · ring 3 labelled sectors) drawn with the Blender glyphs.
 * Calm by design (WAVE 5B): positions are fixed, nodes never move; the whole diagram only sways ±10° in a slow
 * cyclic loop (max 3.5°/s) and holds still while you hover. Line style = edge kind. Labels are DOM pills placed
 * from the projected 3D positions each frame (no React re-render): centre, rings 1–2, sector headers, hovered node.
 */
import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { RING_R, type Neighborhood, type PreviewNode } from "@/components/landing/neighborhood";
import type { EdgeKind, EntityType } from "@/lib/atlas/types";
import { Scene3D } from "./Scene3D";
import { useGlyphGeometries } from "./glyphs";
import { palette3d as c } from "./palette";

const TYPE_COLOR: Partial<Record<EntityType, string>> = {
  disease: c.brand, gene: c.brandDeep, variant: c.brandLight, phenotype: c.brandLight, pathway: c.brandDeep,
  trial: c.brand, study: c.brandLight, treatment: c.brand, organization: c.brandInk, investigator: c.brandInk,
};
const LINE: Record<EdgeKind, { color: string; dashed: boolean; dash: number; gap: number }> = {
  observed: { color: c.brandDeep, dashed: false, dash: 1, gap: 0 },
  inferred: { color: c.brand, dashed: true, dash: 0.16, gap: 0.11 },
  extracted: { color: c.brand, dashed: true, dash: 0.03, gap: 0.07 },
  proposed: { color: c.brandLight, dashed: true, dash: 0.1, gap: 0.12 },
};
const TYPE_LABEL: Record<string, string> = { study: "paper", trial: "study", organization: "patient group", investigator: "researcher", pathway: "pathway", phenotype: "symptom" };
const LEAD: Record<string, string> = { strong: "Strong lead", possible: "Possible lead", weak: "Weak lead" };
const SWAY = 0.17; // rad (≈10°)
const SWAY_RATE = 0.35; // rad/s → max angular speed 0.06 rad/s ≈ 3.4°/s (≤ 6°/s)
const TILT = -0.28; // rad: the plane leans back a little so the glyphs read as 3D

const nodeLabel = (n: PreviewNode) =>
  n.center ? n.label : n.strength ? `${n.label} · ${LEAD[n.strength]}` : `${n.label} · ${TYPE_LABEL[n.type] ?? n.type}`;

function Node({ n, geo, dim, onHover, register }: { n: PreviewNode; geo: THREE.BufferGeometry; dim: boolean; onHover: (id: string | null) => void; register: (id: string, m: THREE.Mesh | null) => void }) {
  return (
    <mesh
      ref={(m) => register(n.id, m)}
      geometry={geo}
      position={n.pos}
      scale={n.size}
      rotation={[0.2, 0.45, 0]}
      onPointerOver={(e) => { e.stopPropagation(); onHover(n.id); }}
      onPointerOut={() => onHover(null)}
    >
      <meshStandardMaterial color={TYPE_COLOR[n.type] ?? c.brand} roughness={0.35} metalness={0.05} transparent opacity={dim ? 0.3 : 1} emissive={n.center ? c.brand : "black"} emissiveIntensity={n.center ? 0.25 : 0} />
    </mesh>
  );
}

type LabelRefs = { nodes: Map<string, HTMLSpanElement>; sectors: Map<string, HTMLSpanElement>; hover: RefObject<HTMLSpanElement | null> };

function Graph({ data, labels }: { data: Neighborhood; labels: LabelRefs }) {
  const glyphs = useGlyphGeometries();
  const fallback = useMemo(() => new THREE.SphereGeometry(1, 20, 14), []);
  const group = useRef<THREE.Group>(null);
  const meshes = useRef(new Map<string, THREE.Mesh>());
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const [hover, setHover] = useState<string | null>(null);
  const phase = useRef(0);
  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);
  const pos = useMemo(() => new Map(data.nodes.map((n) => [n.id, n.pos])), [data]);
  const linked = useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]);
    for (const e of data.edges) if (e.from === hover || e.to === hover) { s.add(e.from); s.add(e.to); }
    return s;
  }, [hover, data]);
  const register = (id: string, m: THREE.Mesh | null) => { if (m) meshes.current.set(id, m); else meshes.current.delete(id); };

  const project = (local: [number, number, number] | THREE.Vector3) => {
    if (Array.isArray(local)) tmp.set(local[0], local[1], local[2]); else tmp.copy(local);
    group.current?.localToWorld(tmp);
    tmp.project(camera);
    return [((tmp.x + 1) / 2) * size.width, ((1 - tmp.y) / 2) * size.height] as const;
  };
  /** Place a label next to its anchor (side chosen from the angle) and keep the whole pill inside the canvas. */
  const put = (el: HTMLSpanElement, x: number, y: number, side: "left" | "right" | "above" | "below", gap = 14) => {
    const w = el.offsetWidth, h = el.offsetHeight, pad = 6;
    let left = side === "left" ? x - gap - w : side === "right" ? x + gap : x - w / 2;
    let top = side === "above" ? y - gap - h : side === "below" ? y + gap : y - h / 2;
    left = Math.min(Math.max(left, pad), size.width - w - pad);
    top = Math.min(Math.max(top, pad), size.height - h - pad);
    el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
  };
  const sideOf = (angle: number) => {
    const r = (angle * Math.PI) / 180;
    return Math.cos(r) < -0.35 ? "left" : Math.cos(r) > 0.35 ? "right" : Math.sin(r) > 0 ? "above" : "below";
  };

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    if (!hover) phase.current += Math.min(delta, 0.05) * SWAY_RATE;
    g.rotation.set(TILT, Math.sin(phase.current) * SWAY, 0);
    const compact = size.width < 520;
    // node labels: centre always; rings 1–2 unless compact
    labels.nodes.forEach((el, id) => {
      const n = byId.get(id);
      if (!n) return;
      const show = (n.center || (!compact && n.ring <= 2)) && (!linked || linked.has(id));
      el.style.opacity = show ? "1" : "0";
      if (!show) return;
      const [x, y] = project(n.pos);
      if (n.center) put(el, x, y, "below", compact ? 20 : 30);
      else put(el, x, y, sideOf(n.angle));
    });
    labels.sectors.forEach((el, key) => {
      const s = data.sectors.find((k) => k.key === key);
      if (!s) return;
      const [x, y] = project(s.pos);
      put(el, x, y, "above", -el.offsetHeight / 2);
      el.style.opacity = linked ? "0.45" : "1";
    });
    const h = labels.hover.current;
    if (h) {
      const n = hover ? byId.get(hover) : undefined;
      const already = n && (n.center || (!compact && n.ring <= 2));
      if (!n || already) { h.style.opacity = "0"; }
      else {
        if (h.dataset.id !== n.id) { h.dataset.id = n.id; h.textContent = nodeLabel(n); }
        const [x, y] = project(n.pos);
        put(h, x, y, sideOf(n.angle));
        h.style.opacity = "1";
      }
    }
  });

  return (
    <group ref={group} rotation={[TILT, 0, 0]}>
      {[1, 2, 3].map((r) => (
        <mesh key={r} position={[0, 0, r === 1 ? 0.15 : r === 2 ? 0.05 : -0.1]}>
          <ringGeometry args={[RING_R[r] - 0.004, RING_R[r] + 0.004, 128]} />
          <meshBasicMaterial color={c.brandLight} transparent opacity={0.28} />
        </mesh>
      ))}
      {data.edges.map((e) => {
        const a = pos.get(e.from), b = pos.get(e.to);
        if (!a || !b) return null;
        const st = LINE[e.kind];
        const on = !linked || (linked.has(e.from) && linked.has(e.to));
        return (
          <Line key={e.id} points={[a, b]} color={st.color} lineWidth={on && linked ? 2.6 : 1.5} dashed={st.dashed} dashSize={st.dash} gapSize={st.gap} transparent opacity={linked ? (on ? 1 : 0.08) : e.kind === "observed" ? 0.35 : 0.6} />
        );
      })}
      {data.nodes.map((n) => (
        <Node key={n.id} n={n} geo={glyphs?.[n.type] ?? fallback} dim={!!linked && !linked.has(n.id)} onHover={setHover} register={register} />
      ))}
    </group>
  );
}

const PILL = "pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full border border-line bg-paper/95 px-2.5 py-1 text-[12px] font-semibold text-brand-ink opacity-0 shadow-sm transition-opacity duration-150";
const SECTOR = "pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-brand-deep transition-opacity duration-150";

export default function GlyphGraph({ data, className = "" }: { data: Neighborhood; className?: string }) {
  const [nodes] = useState(() => new Map<string, HTMLSpanElement>());
  const [sectors] = useState(() => new Map<string, HTMLSpanElement>());
  const hover = useRef<HTMLSpanElement>(null);
  const reg = (map: Map<string, HTMLSpanElement>, key: string) => (el: HTMLSpanElement | null) => { if (el) map.set(key, el); else map.delete(key); };
  return (
    <div className={className}>
      <Scene3D className="absolute inset-0" camera={{ position: [0, 0, 12.4], fov: 40, near: 0.1, far: 60 }} target={[0, -0.1, 0]}>
        <Suspense fallback={null}>
          <Graph data={data} labels={{ nodes, sectors, hover }} />
        </Suspense>
      </Scene3D>
      {data.sectors.map((s) => (
        <span key={s.key} ref={reg(sectors, s.key)} aria-hidden className={`${SECTOR} opacity-0`}>{s.title} · {s.count}</span>
      ))}
      {data.nodes.filter((n) => n.ring <= 2).map((n) => (
        <span key={n.id} ref={reg(nodes, n.id)} aria-hidden className={`${PILL} ${n.center ? "text-[13px]" : ""}`}>{nodeLabel(n)}</span>
      ))}
      <span ref={hover} aria-hidden className={PILL} />
    </div>
  );
}
