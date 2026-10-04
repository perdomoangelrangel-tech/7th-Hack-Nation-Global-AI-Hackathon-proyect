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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-3d";
import * as THREE from "three";
import SpriteText from "three-spritetext";
import type { GLink, GNode } from "@/lib/atlas/store";
import { CANVAS, KIND_STYLE, TYPE_COLOR, kindOf } from "./colors";
import { endId, nodeSize, trim, type GraphCanvasProps } from "./graphProps";
import { useGlyphGeometries } from "@/components/three/glyphs";

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
      mechanism: new THREE.DodecahedronGeometry(1.15, 0),
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

interface StyleState { highlightNodes: Set<string>; highlightEdges: Set<string>; selected: string | null; hover: string | null; clusterFilter: string | null; narrating: boolean; still?: boolean; labelIds: Set<string> | null }

function styleNode(n: N, p: NodeParts, st: StyleState) {
  const id = String(n.id);
  const lit = st.highlightNodes.has(id) || n.id === st.selected || n.id === st.hover;
  const dim = st.narrating ? !st.highlightNodes.has(id) : !!st.clusterFilter && n.type === "disease" && n.cluster !== st.clusterFilter;
  const isDisease = n.type === "disease";
  p.mat.opacity = dim ? CANVAS.dimAlpha : n.draft ? 0.35 : 1;
  p.mat.emissive.set(lit && !dim ? p.mat.color : 0x000000).multiplyScalar(lit ? 0.25 : 0);
  (p.halo.material as THREE.SpriteMaterial).opacity = dim ? 0 : lit ? 0.45 : isDisease ? 0.28 : 0;
  (p.ring.material as THREE.SpriteMaterial).opacity = dim ? 0 : n.focus || n.id === st.selected ? 0.9 : n.bridge ? 0.7 : 0;
  p.label.visible = !dim && (lit || (st.labelIds ? st.labelIds.has(id) : isDisease));
  // Hover lift (P2 micro-interaction): the hovered node grows.
  p.mesh.scale.setScalar(p.base * (n.id === st.hover && !st.still ? 1.25 : 1));
}

function styleLink(l: L, p: LinkParts, st: StyleState) {
  const s = KIND_STYLE[kindOf(l.kind)];
  const lit = st.highlightEdges.has((l as GLink).id);
  p.mat.color.set(lit ? CANVAS.ink : l.bridge ? CANVAS.bridge : s.color);
  p.mat.opacity = st.narrating && !lit ? 0.05 : lit ? 1 : l.bridge ? 0.9 : s.opacity;
}

const radiusOf = (n: GNode) => nodeSize(n.size) * (n.type === "disease" ? 0.95 : 0.85);

export default function GraphCanvas3D({ view, highlightNodes, highlightEdges, selected, clusterFilter, bottomInset, hiddenKinds, still, labelIds = null, command = null, spin = false, onNode, onLink, onLinkHover, onBackground }: GraphCanvasProps) {
  const fg = useRef<ForceGraphMethods<N, L> | undefined>(undefined);
  const wrap = useRef<HTMLDivElement>(null);
  const nodeParts = useRef(new Map<string, NodeParts>());
  const linkParts = useRef(new Map<string, LinkParts>());
  const narrating = highlightNodes.size > 0;
  // Latest styling inputs, read by the object builders (the library may build objects after the restyle effect).
  const styleState = useRef<StyleState>({ highlightNodes, highlightEdges, selected, hover: null, clusterFilter, narrating, still, labelIds });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<string | null>(null);
  // Blender glyphs per entity type (brand lane); procedural primitives until loaded / if loading fails.
  const glyphs = useGlyphGeometries();
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
    // Diseases stay spheres (cluster color + centrality read best); other types use the glyph when available.
    const glyph = !isDisease ? glyphs?.[n.type] : undefined;
    const mesh = new THREE.Mesh(glyph ?? geo[n.type] ?? geo.default, mat);
    mesh.scale.setScalar(glyph ? r * 1.7 : r);
    if (n.type === "trial" && !glyph) mesh.rotation.x = Math.PI;
    const haloSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color, transparent: true, opacity: isDisease ? 0.28 : 0, depthWrite: false }));
    haloSprite.scale.setScalar(r * 5);
    const ringSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ring, color: new THREE.Color(n.bridge ? CANVAS.bridge : CANVAS.ink), transparent: true, opacity: 0, depthWrite: false }));
    ringSprite.scale.setScalar(r * 3.1);
    // Constant on-screen size (sizeAttenuation off): readable whatever the camera distance, never giant up close.
    const label = new SpriteText(trim(n.name, isDisease ? 24 : 30), isDisease ? 0.013 : 0.0105, CANVAS.ink);
    label.fontWeight = isDisease ? "600" : "500";
    label.fontFace = "ui-sans-serif, system-ui, sans-serif";
    label.backgroundColor = CANVAS.labelBg;
    // padding/borderRadius are in the same units as textHeight (large values blow up the label canvas).
    label.padding = [0.004, 0.002];
    label.borderRadius = 0.0025;
    label.position.y = -(r + 1.5);
    label.center.set(0.5, 1);
    label.visible = isDisease;
    // Labels always draw on top of spheres (never hidden behind their own or a neighbor's node).
    const lm = label.material as THREE.SpriteMaterial; lm.depthWrite = false; lm.depthTest = false; lm.sizeAttenuation = false;
    label.renderOrder = 10;
    group.add(haloSprite, mesh, ringSprite, label);
    nodeParts.current.get(String(n.id))?.mat.dispose();
    const parts = { group, mesh, mat, halo: haloSprite, ring: ringSprite, label, base: glyph ? r * 1.7 : r };
    nodeParts.current.set(String(n.id), parts);
    styleNode(n, parts, styleState.current);
    return group;
  }, [glyphs]);

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
    styleLink(l, { line, mat }, styleState.current);
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
  // The library may (re)build three objects after this effect runs (new data, glyphs loaded), so the styling lives in
  // functions that read the latest state from a ref and run both here and inside nodeObject/linkObject.
  useLayoutEffect(() => {
    styleState.current = { highlightNodes, highlightEdges, selected, hover, clusterFilter, narrating, still, labelIds };
    for (const n of data.nodes) { const p = nodeParts.current.get(String(n.id)); if (p) styleNode(n, p, styleState.current); }
    for (const l of data.links) { const p = linkParts.current.get((l as GLink).id); if (p) styleLink(l, p, styleState.current); }
  }, [data, highlightNodes, highlightEdges, selected, hover, clusterFilter, narrating, still, labelIds]);

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

  /** With a focus: the story = the focus, the diseases it links to directly and every non-disease node (genes, pathways,
   *  groups… all belong to the focus or its neighbors). The rest of the constellation stays visible around it. */
  const focusComponent = useMemo(() => {
    const f = view?.focus; if (!f) return null;
    const set = new Set([f]);
    for (const n of data.nodes) if (n.type !== "disease") set.add(String(n.id));
    for (const l of data.links) { const a = endId(l.source), b = endId(l.target); if (a === f) set.add(b); if (b === f) set.add(a); }
    return set;
  }, [data, view]);

  const frameStory = useCallback((ms: number) => frame(focusComponent, ms), [frame, focusComponent]);
  /** After the layout settles: frame what is lit (a narrated claim, a picked cluster), else the story. */
  const frameSettled = useCallback((ms: number) => {
    const lit = styleState.current.highlightNodes;
    if (lit.size) frame(lit, ms); else frameStory(ms);
  }, [frame, frameStory]);

  useEffect(() => {
    settled.current = false; stopFramed.current = false;
    // Fallback framing in case the engine is slow to stop (software WebGL).
    const tm = setTimeout(() => { if (!settled.current) { settled.current = true; frameSettled(800); } }, 2600);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const onEngineStop = useCallback(() => {
    for (const n of data.nodes) if (Number.isFinite(n.x)) positions.set(String(n.id), { x: n.x!, y: n.y!, z: n.z ?? 0 });
    // Frame once when the layout has settled (the early fallback may have framed a still-expanding layout).
    if (stopFramed.current) return;
    stopFramed.current = true; settled.current = true;
    frameSettled(still ? 0 : 1000);
  }, [data, frameSettled, still]);

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

  // Floating controls: zoom toward / away from the orbit target, or re-frame the story.
  useEffect(() => {
    const g = fg.current; if (!g || !command) return;
    if (command.kind === "fit") { frameStory(still ? 0 : 600); return; }
    const cam = g.camera(); const ctl = g.controls() as { target?: THREE.Vector3 };
    const target = ctl.target ?? new THREE.Vector3();
    const k = command.kind === "zoomIn" ? 0.75 : 1.33;
    const p = cam.position.clone().sub(target).multiplyScalar(k).add(target);
    g.cameraPosition({ x: p.x, y: p.y, z: p.z }, { x: target.x, y: target.y, z: target.z }, still ? 0 : 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

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
        onLinkHover={(l) => { onLinkHover?.(l ? (l as GLink).id : null); if (wrap.current) wrap.current.style.cursor = l ? "pointer" : ""; }}
        onBackgroundClick={() => onBackground?.()}
        onEngineStop={onEngineStop}
        cooldownTicks={still ? 60 : 200}
        cooldownTime={4000}
        d3VelocityDecay={0.32}
        enableNodeDrag={false}
      />
    </div>
  );
}
