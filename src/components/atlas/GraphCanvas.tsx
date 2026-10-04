"use client";
/**
 * 2D graph canvas (d3-force) — the fallback for reduced motion, low power, no WebGL and small screens.
 * Client only (dynamic ssr:false from AtlasApp). Same props contract as GraphCanvas3D.
 * - Diseases = discs colored by mechanism cluster, size = centrality. Other entities: shape + color by type.
 * - Edge style carries the evidence kind: observed solid · inferred dashed · extracted dotted · proposed ghost.
 * - Narration: cited nodes light up, the rest dims, particles travel along cited edges.
 * - Positions persist across focus changes so the map does not jump (spatial continuity).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import type { GLink, GNode } from "@/lib/atlas/store";
import { prefersReducedMotion } from "@/lib/motion";
import { CANVAS, KIND_STYLE, TYPE_COLOR, hexA, kindOf } from "./colors";
import { endId, nodeSize, trim, type GraphCanvasProps } from "./graphProps";

type N = NodeObject<GNode>;
type L = LinkObject<GNode, GLink>;

/** Positions between focuses live outside React (one canvas per page). */
const positions = new Map<string, { x: number; y: number }>();

export default function GraphCanvas({ view, highlightNodes, highlightEdges, selected, clusterFilter, bottomInset, hiddenKinds, still, labelIds = null, command = null, onNode, onLink, onLinkHover, onBackground }: GraphCanvasProps) {
  const fg = useRef<ForceGraphMethods<N, L> | undefined>(undefined);
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<string | null>(null);
  const reduced = useMemo(() => !!still || prefersReducedMotion(), [still]);

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
      return { ...n, ...(p ? { x: p.x, y: p.y } : {}) };
    });
    return { nodes, links };
  }, [view, hiddenKinds]);

  /** Bounded zoom (one node never fills the screen), centered above the narration bar. */
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
    const link = g.d3Force("link") as unknown as { distance?: (fn: (l: L) => number) => void } | undefined;
    link?.distance?.((l) => (l.relation === "similar_to" ? 120 : l.relation === "has_phenotype" ? 50 : 70));
    g.d3ReheatSimulation();
    const t = setTimeout(() => fitTo(null, reduced ? 0 : 900), reduced ? 50 : 1300);
    return () => clearTimeout(t);
    // Re-frame only when the data changes (fitTo changes with size).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, reduced]);

  // While narrating: frame what is being said (and go back to the whole when it ends).
  useEffect(() => {
    if (!data.nodes.length) return;
    fitTo(highlightNodes.size ? highlightNodes : null, reduced ? 0 : 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightNodes, reduced]);

  // Floating controls: zoom in / out / fit.
  useEffect(() => {
    const g = fg.current; if (!g || !command) return;
    if (command.kind === "fit") fitTo(null, reduced ? 0 : 500);
    else g.zoom(g.zoom() * (command.kind === "zoomIn" ? 1.3 : 0.77), reduced ? 0 : 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  const narrating = highlightNodes.size > 0;
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
    const color = isDisease ? node.color ?? CANVAS.fallbackDisease : TYPE_COLOR[node.type] ?? TYPE_COLOR.study;
    const r = nodeSize(node.size);
    const time = performance.now() / 1000;
    ctx.globalAlpha = dim ? CANVAS.dimAlpha : node.draft ? 0.45 : 1;
    const shape = () => (node.draft ? ctx.stroke() : ctx.fill());

    // Soft halo (diseases and lit nodes)
    if (isDisease || lit) {
      const pulse = lit && !reduced ? 1 + 0.2 * Math.sin(time * 4) : 1;
      const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * (isDisease ? 2.6 : 2.2) * pulse);
      g.addColorStop(0, hexA(color, lit ? 0.35 : 0.18)); g.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.8 * pulse, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 1.2 / scale;
    if (node.draft) ctx.setLineDash([3 / scale, 3 / scale]);
    ctx.beginPath();
    switch (node.type) {
      case "gene": roundRect(ctx, x - r, y - r, 2 * r, 2 * r, r * 0.35); shape(); break;
      case "pathway": ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.2, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r * 1.2, y); ctx.closePath(); shape(); break;
      case "organization": ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.lineWidth = 2 / scale; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, 2 * Math.PI); ctx.fill(); break;
      case "trial": ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); shape(); break;
      case "investigator": ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.lineWidth = 1.8 / scale; ctx.stroke(); break;
      default: ctx.arc(x, y, r, 0, 2 * Math.PI); shape();
    }
    ctx.setLineDash([]);
    // White rim keeps overlapping discs readable on the light canvas.
    if (isDisease && !node.draft) { ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.5 / scale; ctx.stroke(); }
    if (node.focus || node.id === selected) { ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, 2 * Math.PI); ctx.strokeStyle = CANVAS.ink; ctx.lineWidth = 1.8 / scale; ctx.stroke(); }
    if (node.bridge) { ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 2 * Math.PI); ctx.strokeStyle = CANVAS.bridge; ctx.lineWidth = 1.4 / scale; ctx.setLineDash([2 / scale, 2 / scale]); ctx.stroke(); ctx.setLineDash([]); }

    // Labels: diseases always; the rest when zoomed in, lit or hovered.
    if (lit || (labelIds ? labelIds.has(node.id) : isDisease) || scale > 2.6) {
      const fs = (isDisease ? 12 : 10) / scale;
      ctx.font = `${isDisease ? 600 : 500} ${fs}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      const label = trim(node.name, isDisease ? 28 : 34);
      const w = ctx.measureText(label).width;
      ctx.fillStyle = CANVAS.labelBg;
      ctx.beginPath(); roundRect(ctx, x - w / 2 - 4 / scale, y + r + 3 / scale, w + 8 / scale, fs + 5 / scale, 4 / scale); ctx.fill();
      ctx.fillStyle = CANVAS.ink;
      ctx.fillText(label, x, y + r + 5.5 / scale);
    }
    ctx.globalAlpha = 1;
  }, [highlightNodes, selected, hover, dimmed, reduced, labelIds]);

  const paintArea = useCallback((node: N, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(node.x ?? 0, node.y ?? 0, nodeSize(node.size) + 4, 0, 2 * Math.PI); ctx.fill();
  }, []);

  const isLit = (l: L) => highlightEdges.has((l as GLink).id);

  return (
    <div ref={wrap} className="absolute inset-0" aria-label="Knowledge graph (2D)" role="img">
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
          const s = KIND_STYLE[kindOf(l.kind)];
          const lit = isLit(l);
          if (narrating && !lit) return hexA(s.color, 0.06);
          if (lit) return CANVAS.ink;
          if (l.bridge) return hexA(CANVAS.bridge, 0.85);
          return hexA(s.color, s.opacity);
        }}
        linkWidth={(l) => (isLit(l) ? 2.6 : l.kind === "inferred" ? 1.2 + 3 * l.confidence : l.bridge ? 1.8 : 0.9)}
        linkLineDash={(l) => KIND_STYLE[kindOf(l.kind)].dash}
        linkDirectionalParticles={(l) => (reduced ? 0 : isLit(l) ? 4 : l.kind === "inferred" && !narrating ? 1 : 0)}
        linkDirectionalParticleWidth={(l) => (isLit(l) ? 3.2 : 1.8)}
        linkDirectionalParticleSpeed={(l) => (isLit(l) ? 0.012 : 0.004)}
        linkDirectionalParticleColor={(l) => (isLit(l) ? CANVAS.ink : KIND_STYLE[kindOf(l.kind)].color)}
        linkHoverPrecision={6}
        onNodeHover={(n) => setHover(n ? String(n.id) : null)}
        onNodeClick={(n) => onNode(n as GNode)}
        onLinkClick={(l) => onLink({ ...(l as GLink), source: endId(l.source), target: endId(l.target) })}
        onLinkHover={(l) => onLinkHover?.(l ? (l as GLink).id : null)}
        onBackgroundClick={() => onBackground?.()}
        cooldownTicks={reduced ? 60 : 220}
        d3VelocityDecay={0.32}
        autoPauseRedraw={false}
        enableNodeDrag
      />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
