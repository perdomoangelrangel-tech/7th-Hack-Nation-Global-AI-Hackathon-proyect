"use client";
/**
 * 3D graph canvas (react-force-graph-3d) — the default view. Client only (dynamic ssr:false from AtlasApp).
 * Same props contract as the 2D GraphCanvas.
 * - Nodes = shapes by type (disease sphere colored by cluster, gene cube, pathway octahedron, study cone,
 *   patient group torus, researcher icosahedron), sized by centrality; labels with three-spritetext.
 * - Edges = lines whose style carries the evidence kind: observed solid · inferred dashed · extracted dotted · proposed ghost.
 * - Soft camera fly-to on focus; narration frames the cited nodes; hover lifts a node; idle spin off by default.
 * Three objects are built once per node/link and restyled in place (no rebuild on every highlight).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-3d";
import * as THREE from "three";
import SpriteText from "three-spritetext";
import type { GLink, GNode } from "@/lib/atlas/store";
import { CANVAS, KIND_STYLE, TYPE_COLOR, kindOf } from "./colors";
import { endId, trim, type GraphCanvasProps } from "./graphProps";

type N = NodeObject<GNode>;
type L = LinkObject<GNode, GLink>;

interface NodeParts { group: THREE.Group; mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; halo: THREE.Sprite; ring: THREE.Sprite; label: SpriteText; base: number }
interface LinkParts { line: THREE.Line; mat: THREE.LineBasicMaterial | THREE.LineDashedMaterial }

/** Positions between focuses (spatial continuity, like the 2D canvas). */
const positions = new Map<string, { x: number; y: number; z: number }>();

/* Shared geometries and textures (built lazily on the client, reused by every node). */
let shared: { geo: Record<string, THREE.BufferGeometry>; halo: THREE.Texture; ring: THREE.Texture } | null = null;
function assets() {
  if (shared) return shared;
  const radial = (draw: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    draw(c.getContext("2d")!);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  shared = {
    geo: {
      disease: new THREE.SphereGeometry(1, 28, 20),
      gene: new THREE.BoxGeometry(1.5, 1.5, 1.5),
      pathway: new THREE.OctahedronGeometry(1.25),
      trial: new THREE.ConeGeometry(1, 1.8, 18),
      organization: new THREE.TorusGeometry(0.9, 0.32, 12, 28),
      investigator: new THREE.IcosahedronGeometry(1.05, 0),
      default: new THREE.SphereGeometry(0.9, 16, 12),
    },
    halo: radial((g) => {
      const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }),
    ring: radial((g) => { g.strokeStyle = "#ffffff"; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.stroke(); }),
  };
  return shared;
}

const radiusOf = (n: GNode) => n.size * (n.type === "disease" ? 0.95 : 0.85);

export default function GraphCanvas3D({ view, highlightNodes, highlightEdges, selected, clusterFilter, bottomInset, hiddenKinds, still, onNode, onLink }: GraphCanvasProps) {
  const fg = useRef<ForceGraphMethods<N, L> | undefined>(undefined);
  const wrap = useRef<HTMLDivElement>(null);
  const nodeParts = useRef(new Map<string, NodeParts>());
  const linkParts = useRef(new Map<string, LinkParts>());
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<string | null>(null);
  const [spin, setSpin] = useState(false);
  const settled = useRef(false);
  const stopFramed = useRef(false);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(200, e.contentRect.width), h: Math.max(240, e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    if (!view) return { nodes: [] as N[], links: [] as L[] };
    const links: L[] = view.links.filter((l) => !hiddenKinds?.has(kindOf(l.kind))).map((l) => ({ ...l }));
    const nodes: N[] = view.nodes.filter((n) => !(n.draft && hiddenKinds?.has("proposed"))).map((n) => {
      const p = positions.get(n.id);
      return { ...n, ...(p ? { x: p.x, y: p.y, z: p.z } : {}) };
    });
    return { nodes, links };
  }, [view, hiddenKinds]);

  /* ---------- Three objects (built once per id, restyled in place) ---------- */
  const nodeObject = useCallback((n: N) => {
    const { geo, halo, ring } = assets();
    const isDisease = n.type === "disease";
    const color = new THREE.Color(isDisease ? n.color ?? CANVAS.fallbackDisease : TYPE_COLOR[n.type] ?? TYPE_COLOR.study);
    const r = radiusOf(n);
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: n.draft ? 0.35 : 1, wireframe: !!n.draft });
    const mesh = new THREE.Mesh(geo[n.type] ?? geo.default, mat);
    mesh.scale.setScalar(r);
    if (n.type === "trial") mesh.rotation.x = Math.PI;
    const haloSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color, transparent: true, opacity: isDisease ? 0.28 : 0, depthWrite: false }));
    haloSprite.scale.setScalar(r * 5);
    const ringSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ring, color: new THREE.Color(n.bridge ? CANVAS.bridge : CANVAS.ink), transparent: true, opacity: 0, depthWrite: false }));
    ringSprite.scale.setScalar(r * 3.1);
    const label = new SpriteText(trim(n.name, isDisease ? 28 : 34), isDisease ? 6.5 : 4.6, CANVAS.ink);
    label.fontWeight = isDisease ? "600" : "500";
    label.fontFace = "ui-sans-serif, system-ui, sans-serif";
    label.backgroundColor = CANVAS.labelBg;
    label.padding = [2.4, 1.2];
    label.borderRadius = 3;
    label.position.y = -(r + (isDisease ? 6.5 : 5));
    label.visible = isDisease;
    (label.material as THREE.SpriteMaterial).depthWrite = false;
    group.add(haloSprite, mesh, ringSprite, label);
    nodeParts.current.get(String(n.id))?.mat.dispose();
    nodeParts.current.set(String(n.id), { group, mesh, mat, halo: haloSprite, ring: ringSprite, label, base: r });
    return group;
  }, []);

  const linkObject = useCallback((l: L) => {
    const s = KIND_STYLE[kindOf(l.kind)];
    const color = new THREE.Color(l.bridge ? CANVAS.bridge : s.color);
    const mat = s.dash
      ? new THREE.LineDashedMaterial({ color, transparent: true, opacity: s.opacity, dashSize: s.dash[0] * 0.9, gapSize: s.dash[1] * 0.9, depthWrite: false })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity: s.opacity, depthWrite: false });
    const geom = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geom, mat);
    line.renderOrder = -1;
    const id = (l as GLink).id;
    const prev = linkParts.current.get(id);
    if (prev) { prev.mat.dispose(); prev.line.geometry.dispose(); }
    linkParts.current.set(id, { line, mat });
    return line;
  }, []);

  const linkPositionUpdate = useCallback((obj: THREE.Object3D, { start, end }: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }) => {
    const line = obj as THREE.Line;
    const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    pos.setXYZ(0, start.x, start.y, start.z); pos.setXYZ(1, end.x, end.y, end.z); pos.needsUpdate = true;
    line.geometry.computeBoundingSphere();
    if (line.material instanceof THREE.LineDashedMaterial) line.computeLineDistances();
    return true;
  }, []);

  // Dispose GPU resources on unmount (shared geometries/textures stay for the next mount).
  useEffect(() => {
    const np = nodeParts.current, lp = linkParts.current;
    return () => {
      for (const p of np.values()) { p.mat.dispose(); (p.halo.material as THREE.Material).dispose(); (p.ring.material as THREE.Material).dispose(); p.label.material.dispose(); }
      for (const p of lp.values()) { p.mat.dispose(); p.line.geometry.dispose(); }
      np.clear(); lp.clear();
    };
  }, []);

  /* ---------- Restyle on highlight / hover / filter (no rebuild) ---------- */
  const narrating = highlightNodes.size > 0;
  useEffect(() => {
    for (const n of data.nodes) {
      const p = nodeParts.current.get(String(n.id)); if (!p) continue;
      const lit = highlightNodes.has(String(n.id)) || n.id === selected || n.id === hover;
      const dim = narrating ? !highlightNodes.has(String(n.id)) : !!clusterFilter && n.type === "disease" && n.cluster !== clusterFilter;
      const isDisease = n.type === "disease";
      p.mat.opacity = dim ? CANVAS.dimAlpha : n.draft ? 0.35 : 1;
      p.mat.emissive.set(lit && !dim ? p.mat.color : 0x000000).multiplyScalar(lit ? 0.25 : 0);
      (p.halo.material as THREE.SpriteMaterial).opacity = dim ? 0 : lit ? 0.45 : isDisease ? 0.28 : 0;
      (p.ring.material as THREE.SpriteMaterial).opacity = dim ? 0 : n.focus || n.id === selected ? 0.9 : n.bridge ? 0.7 : 0;
      p.label.visible = !dim && (isDisease || lit);
      // Hover lift (P2 micro-interaction): the hovered node grows.
      const lift = n.id === hover && !still ? 1.25 : 1;
      p.mesh.scale.setScalar(p.base * lift);
    }
    for (const l of data.links) {
      const p = linkParts.current.get((l as GLink).id); if (!p) continue;
      const s = KIND_STYLE[kindOf(l.kind)];
      const lit = highlightEdges.has((l as GLink).id);
      p.mat.color.set(lit ? CANVAS.ink : l.bridge ? CANVAS.bridge : s.color);
      p.mat.opacity = narrating && !lit ? 0.05 : lit ? 1 : l.bridge ? 0.9 : s.opacity;
    }
  }, [data, highlightNodes, highlightEdges, selected, hover, clusterFilter, narrating, still]);

  /* ---------- Camera ---------- */
  /** Fit a set of nodes (null = all) using the camera's FOV and aspect, centered above the narration bar. */
  const frame = useCallback((ids: Set<string> | null, ms: number) => {
    const g = fg.current; if (!g) return;
    const ns = data.nodes.filter((n) => (!ids || ids.has(String(n.id))) && Number.isFinite(n.x));
    if (!ns.length) return;
    const xs = ns.map((n) => n.x!), ys = ns.map((n) => n.y!), zs = ns.map((n) => n.z ?? 0);
    const [x0, x1, y0, y1, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), Math.max(...zs)];
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = zs.reduce((a, b) => a + b, 0) / zs.length;
    const cam = g.camera() as THREE.PerspectiveCamera;
    const visH = Math.max(120, size.h - bottomInset - 60), aspect = size.w / visH;
    const halfH = Math.max(40, (y1 - y0) / 2 + 14), halfW = Math.max(40, (x1 - x0) / 2 + 14);
    const tan = Math.tan(((cam.fov ?? 40) * Math.PI) / 360);
    const dist = (Math.max(halfH, halfW / aspect) / tan) * 1.08 + (z1 - cz);
    // Shift the target down by half the bar height (in world units at that distance) so the story sits above it.
    const off = (bottomInset / 2) * ((2 * dist * tan) / size.h);
    g.cameraPosition({ x: cx, y: cy - off, z: cz + dist }, { x: cx, y: cy - off, z: cz }, ms);
  }, [data, size, bottomInset]);

  const flyTo = useCallback((id: string, ms: number) => {
    const g = fg.current; const n = data.nodes.find((x) => x.id === id);
    if (!g || !n || !Number.isFinite(n.x)) return;
    const { x = 0, y = 0, z = 0 } = n;
    const dist = 170, ratio = 1 + dist / Math.max(1, Math.hypot(x, y, z));
    g.cameraPosition({ x: x * ratio, y: y * ratio, z: z * ratio }, { x, y, z }, ms);
  }, [data]);

  /** With a focus: its connected component (a far-away cluster should not shrink the story). */
  const focusComponent = useMemo(() => {
    const f = view?.focus; if (!f) return null;
    const adj = new Map<string, string[]>();
    for (const l of data.links) { const a = endId(l.source), b = endId(l.target); adj.set(a, [...(adj.get(a) ?? []), b]); adj.set(b, [...(adj.get(b) ?? []), a]); }
    const seen = new Set([f]); const q = [f];
    while (q.length) for (const x of adj.get(q.shift()!) ?? []) if (!seen.has(x)) { seen.add(x); q.push(x); }
    return seen;
  }, [data, view]);

  const frameStory = useCallback((ms: number) => frame(focusComponent, ms), [frame, focusComponent]);

  useEffect(() => {
    settled.current = false; stopFramed.current = false;
    // Fallback framing in case the engine is slow to stop (software WebGL).
    const tm = setTimeout(() => { if (!settled.current) { settled.current = true; frameStory(800); } }, 2600);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const onEngineStop = useCallback(() => {
    for (const n of data.nodes) if (Number.isFinite(n.x)) positions.set(String(n.id), { x: n.x!, y: n.y!, z: n.z ?? 0 });
    // Frame once when the layout has settled (the early fallback may have framed a still-expanding layout).
    if (stopFramed.current) return;
    stopFramed.current = true; settled.current = true;
    frameStory(still ? 0 : 1000);
  }, [data, frameStory, still]);

  useEffect(() => {
    const g = fg.current; if (!g) return;
    g.d3Force("charge")?.strength?.(-70);
    const link = g.d3Force("link") as unknown as { distance?: (fn: (l: L) => number) => void } | undefined;
    link?.distance?.((l) => (l.relation === "similar_to" ? 80 : l.relation === "has_phenotype" ? 32 : 46));
    // Gentle pull toward z = 0: keeps real depth (orbitable) but a shallow, readable slab instead of a ball.
    let nodes: N[] = [];
    const flatZ = Object.assign((alpha: number) => { for (const n of nodes) n.vz = (n.vz ?? 0) - (n.z ?? 0) * 0.06 * alpha; }, { initialize: (ns: N[]) => { nodes = ns; } });
    g.d3Force("flatZ", flatZ);
    g.d3ReheatSimulation();
  }, [data]);

  // Narration: frame what is being said; when it ends, frame the whole again.
  useEffect(() => {
    if (!data.nodes.length || !settled.current) return;
    if (highlightNodes.size) frame(highlightNodes, still ? 0 : 900); else frameStory(still ? 0 : 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightNodes]);

  // Soft fly-to when the user selects a node (not the disease focus, which re-frames the whole view).
  const lastSel = useRef<string | null>(null);
  useEffect(() => {
    if (!selected || selected === lastSel.current || selected === view?.focus) { lastSel.current = selected; return; }
    lastSel.current = selected;
    flyTo(selected, still ? 0 : 1200);
  }, [selected, view, flyTo, still]);

  // Idle rotation (orbit controls autoRotate) — off by default, user toggle.
  useEffect(() => {
    const c = fg.current?.controls() as { autoRotate?: boolean; autoRotateSpeed?: number } | undefined;
    if (c) { c.autoRotate = spin && !still; c.autoRotateSpeed = 0.6; }
  }, [spin, still]);

  // Lights tuned for a bright canvas: soft ambient + key light, no harsh shadows.
  useEffect(() => {
    const g = fg.current; if (!g) return;
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(80, 120, 160);
    g.lights([new THREE.AmbientLight(0xffffff, 2.1), key]);
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0" aria-label="Knowledge graph (3D)" role="img">
      <ForceGraph3D<GNode, GLink>
        ref={fg}
        width={size.w}
        height={size.h}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        controlType="orbit"
        nodeId="id"
        nodeThreeObject={nodeObject}
        nodeLabel={(n) => `${n.name}`}
        linkThreeObject={linkObject}
        linkPositionUpdate={linkPositionUpdate}
        linkDirectionalParticles={(l) => (still ? 0 : highlightEdges.has((l as GLink).id) ? 4 : l.kind === "inferred" && !narrating ? 1 : 0)}
        linkDirectionalParticleWidth={(l) => (highlightEdges.has((l as GLink).id) ? 2.4 : 1.4)}
        linkDirectionalParticleSpeed={(l) => (highlightEdges.has((l as GLink).id) ? 0.012 : 0.004)}
        linkDirectionalParticleColor={(l) => (highlightEdges.has((l as GLink).id) ? CANVAS.ink : KIND_STYLE[kindOf(l.kind)].color)}
        linkHoverPrecision={2}
        onNodeHover={(n) => { setHover(n ? String(n.id) : null); if (wrap.current) wrap.current.style.cursor = n ? "pointer" : ""; }}
        onNodeClick={(n) => onNode(n as GNode)}
        onLinkClick={(l) => onLink({ ...(l as GLink), source: endId(l.source), target: endId(l.target) })}
        onEngineStop={onEngineStop}
        cooldownTicks={still ? 60 : 200}
        cooldownTime={4000}
        d3VelocityDecay={0.32}
        enableNodeDrag={!still}
      />
      <button type="button" onClick={() => setSpin((s) => !s)} aria-pressed={spin} disabled={still}
        className="absolute right-3 top-3 z-10 rounded-full border border-line bg-paper/90 px-3 py-1 text-xs text-ink-2 shadow-sm hover:bg-brand-soft disabled:opacity-50">
        {spin ? "Stop rotation" : "Rotate"}
      </button>
    </div>
  );
}
