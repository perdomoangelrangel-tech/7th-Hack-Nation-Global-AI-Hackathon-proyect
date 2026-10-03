"use client";
/**
 * Lienzo del grafo (canvas, d3-force). Se carga solo en el cliente (dynamic ssr:false desde AtlasApp).
 * - Enfermedades = estrellas con el color de su cluster; tamaño = centralidad.
 * - Aristas observadas sólidas; inferidas punteadas (nunca se confunden).
 * - Narración: los nodos citados se encienden, el resto se atenúa y viajan partículas por las aristas citadas.
 * - Las posiciones se conservan entre focos para que el mapa no "salte" (continuidad espacial).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import type { GLink, GNode, GraphView } from "@/lib/atlas/store";
import { prefersReducedMotion } from "@/lib/motion";
import { TYPE_COLOR } from "./colors";

type N = NodeObject<GNode>;

/** Posiciones entre focos: viven fuera de React (un solo lienzo por página). */
const positions = new Map<string, { x: number; y: number }>();
type L = LinkObject<GNode, GLink>;

interface Props {
  view: GraphView | null;
  highlightNodes: Set<string>;
  highlightEdges: Set<string>;
  selected: string | null;
  clusterFilter: string | null;
  /** Alto (px) que tapa la barra de narración: el encuadre centra por encima. */
  bottomInset: number;
  onNode: (n: GNode) => void;
  onLink: (l: GLink) => void;
}

export default function GraphCanvas({ view, highlightNodes, highlightEdges, selected, clusterFilter, bottomInset, onNode, onLink }: Props) {
  const fg = useRef<ForceGraphMethods<N, L> | undefined>(undefined);
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<string | null>(null);
  const reduced = useMemo(() => prefersReducedMotion(), []);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(200, e.contentRect.width), h: Math.max(240, e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Datos con posiciones previas: los nodos que ya estaban no se teletransportan.
  const data = useMemo(() => {
    if (!view) return { nodes: [] as N[], links: [] as L[] };
    const nodes: N[] = view.nodes.map((n) => {
      const p = positions.get(n.id);
      return { ...n, ...(p ? { x: p.x, y: p.y } : {}) };
    });
    const links: L[] = view.links.map((l) => ({ ...l }));
    return { nodes, links };
  }, [view]);

  /**
   * Encuadre propio: zoom acotado (un solo nodo no llena la pantalla) y centrado en el área visible
   * por encima de la barra de narración (bottomInset).
   */
  const fitTo = useCallback((ids: Set<string> | null, ms: number) => {
    const g = fg.current; if (!g) return;
    const ns = data.nodes.filter((n) => (!ids || ids.has(n.id)) && Number.isFinite(n.x) && Number.isFinite(n.y));
    if (!ns.length) return;
    const xs = ns.map((n) => n.x!), ys = ns.map((n) => n.y!);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = 70;
    const availW = Math.max(120, size.w - pad * 2), availH = Math.max(120, size.h - bottomInset - pad * 2);
    const k = Math.min(3, Math.max(0.35, Math.min(availW / Math.max(maxX - minX, 160), availH / Math.max(maxY - minY, 160))));
    g.zoom(k, ms);
    g.centerAt((minX + maxX) / 2, (minY + maxY) / 2 + bottomInset / 2 / k, ms);
  }, [data, size, bottomInset]);

  useEffect(() => {
    const g = fg.current; if (!g) return;
    g.d3Force("charge")?.strength?.(-140);
    g.d3Force("gravity", gravity(0.045)); // los componentes desconectados (p. ej. el cluster lisosomal) no se van a la deriva
    const link = g.d3Force("link") as unknown as { distance?: (fn: (l: L) => number) => void } | undefined;
    link?.distance?.((l) => (l.relation === "similar_to" ? 120 : l.relation === "has_phenotype" ? 50 : 70));
    g.d3ReheatSimulation();
    const t = setTimeout(() => fitTo(null, reduced ? 0 : 900), reduced ? 50 : 1300);
    return () => clearTimeout(t);
    // fitTo cambia con el tamaño; re-encuadrar solo cuando cambian los datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, reduced]);

  // Durante la narración: encuadrar lo que se está diciendo (y volver al conjunto al terminar).
  useEffect(() => {
    if (!data.nodes.length) return;
    fitTo(highlightNodes.size ? highlightNodes : null, reduced ? 0 : 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightNodes, reduced]);

  const narrating = highlightNodes.size > 0;
  // Atenuar: durante la narración, todo lo no citado; con un cluster elegido, las enfermedades de otros clusters.
  const dimmed = useCallback((n: N) => {
    if (narrating) return !highlightNodes.has(n.id);
    return !!clusterFilter && n.type === "disease" && n.cluster !== clusterFilter;
  }, [narrating, highlightNodes, clusterFilter]);

  const paintNode = useCallback((node: N, ctx: CanvasRenderingContext2D, scale: number) => {
    const x = node.x ?? 0, y = node.y ?? 0;
    positions.set(node.id, { x, y });
    const isDisease = node.type === "disease";
    const lit = highlightNodes.has(node.id) || node.id === selected || node.id === hover;
    const dim = dimmed(node);
    const color = isDisease ? node.color ?? "#e2e8f0" : TYPE_COLOR[node.type] ?? "#cbd5e1";
    const r = node.size;
    const time = performance.now() / 1000;
    ctx.globalAlpha = dim ? 0.18 : 1;

    // Halo (estrella)
    if (isDisease || lit) {
      const pulse = lit && !reduced ? 1 + 0.25 * Math.sin(time * 4) : 1;
      const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * (isDisease ? 3.2 : 2.6) * pulse);
      g.addColorStop(0, hexA(color, lit ? 0.55 : 0.35)); g.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.4 * pulse, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 1.2 / scale;
    ctx.beginPath();
    switch (node.type) {
      case "gene": roundRect(ctx, x - r, y - r, 2 * r, 2 * r, r * 0.35); ctx.fill(); break;
      case "pathway": ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.2, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r * 1.2, y); ctx.closePath(); ctx.fill(); break;
      case "organization": ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.lineWidth = 2 / scale; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, 2 * Math.PI); ctx.fill(); break;
      case "trial": ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); ctx.fill(); break;
      case "investigator": ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.lineWidth = 1.6 / scale; ctx.stroke(); break;
      default: ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
    }
    if (node.focus) { ctx.beginPath(); ctx.arc(x, y, r + 3, 0, 2 * Math.PI); ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 1.5 / scale; ctx.stroke(); }

    // Etiquetas: enfermedades siempre; el resto al acercar, al iluminar o al pasar el cursor.
    const show = isDisease || lit || scale > 2.2;
    if (show) {
      const fs = Math.max(isDisease ? 12 : 10, 0) / scale;
      ctx.font = `${isDisease ? 600 : 500} ${fs}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      const label = trim(node.name, isDisease ? 28 : 34);
      ctx.fillStyle = "rgba(6,12,24,.75)";
      const w = ctx.measureText(label).width;
      ctx.fillRect(x - w / 2 - 3 / scale, y + r + 3 / scale, w + 6 / scale, fs + 4 / scale);
      ctx.fillStyle = isDisease ? "#f8fafc" : "#e2e8f0";
      ctx.fillText(label, x, y + r + 5 / scale);
    }
    ctx.globalAlpha = 1;
  }, [highlightNodes, selected, hover, dimmed, reduced]);

  const paintArea = useCallback((node: N, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(node.x ?? 0, node.y ?? 0, node.size + 4, 0, 2 * Math.PI); ctx.fill();
  }, []);

  const linkId = (l: L) => (l as GLink).id;
  const endId = (v: unknown) => (typeof v === "object" && v ? String((v as N).id) : String(v));

  return (
    <div ref={wrap} className="absolute inset-0" aria-label="Knowledge graph" role="img">
      <ForceGraph2D<GNode, GLink>
        ref={fg}
        width={size.w}
        height={size.h}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        nodeId="id"
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={paintArea}
        nodeLabel={(n) => `${n.name}`}
        linkColor={(l) => {
          const lit = highlightNodes.size ? highlightEdges.has(linkId(l)) : false;
          const dim = narrating ? !lit : false;
          if (l.kind === "inferred") return dim ? "rgba(255,255,255,.05)" : lit ? "rgba(253,224,71,.95)" : "rgba(253,224,71,.45)";
          return dim ? "rgba(148,163,184,.05)" : lit ? "rgba(255,255,255,.9)" : "rgba(148,163,184,.28)";
        }}
        linkWidth={(l) => (highlightEdges.has(linkId(l)) ? 2.6 : l.kind === "inferred" ? 1.4 + 4 * l.confidence : 0.8)}
        linkLineDash={(l) => (l.kind === "inferred" ? [5, 4] : null)}
        linkDirectionalParticles={(l) => (reduced ? 0 : highlightEdges.has(linkId(l)) ? 4 : l.kind === "inferred" && !narrating ? 1 : 0)}
        linkDirectionalParticleWidth={(l) => (highlightEdges.has(linkId(l)) ? 3.2 : 1.6)}
        linkDirectionalParticleSpeed={(l) => (highlightEdges.has(linkId(l)) ? 0.012 : 0.004)}
        linkDirectionalParticleColor={(l) => (l.kind === "inferred" ? "#fde047" : "#ffffff")}
        linkHoverPrecision={6}
        onNodeHover={(n) => setHover(n ? String(n.id) : null)}
        onNodeClick={(n) => onNode(n as GNode)}
        onLinkClick={(l) => onLink({ ...(l as GLink), source: endId(l.source), target: endId(l.target) })}
        cooldownTicks={reduced ? 60 : 220}
        d3VelocityDecay={0.32}
        autoPauseRedraw={false}
        enableNodeDrag
      />
    </div>
  );
}

/** Fuerza de gravedad hacia el origen (d3: función de alpha con initialize). */
function gravity(strength: number) {
  let nodes: N[] = [];
  const force = (alpha: number) => {
    for (const n of nodes) { n.vx = (n.vx ?? 0) - (n.x ?? 0) * strength * alpha; n.vy = (n.vy ?? 0) - (n.y ?? 0) * strength * alpha; }
  };
  force.initialize = (ns: N[]) => { nodes = ns; };
  return force;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function hexA(hex: string, a: number) {
  const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const trim = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
