"use client";
/**
 * 2D graph canvas — the default view (WAVE 5B). Static: positions come precomputed from the Route / Constellation
 * layouts (fx/fy), so the simulation never runs (warmup only if something is unpositioned, then cooldownTicks=0): no
 * drift, no reheat on hover / click / resize, no drag, no idle animation. The camera moves only on a focus change or
 * "Fit" (≤ 600 ms, none under reduced motion). Same props contract as GraphCanvas3D.
 * - Shapes by type; diseases colored by cluster. Edge style carries the evidence kind (solid / dashed / dotted / ghost),
 *   base opacity ~0.35, highlighted 1.0; bridges across clusters as soft curves.
 * - Labels 13 px on a white pill with collision avoidance (focus, ring 1–2 and hovered); sector / region headers always.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import type { GLink, GNode } from "@/lib/atlas/store";
import { prefersReducedMotion } from "@/lib/motion";
import { CANVAS, KIND_STYLE, TYPE_COLOR, hexA, kindOf } from "./colors";
import { DOUBLE_CLICK_MS, endId, nodeSize, trim, type GraphCanvasProps } from "./graphProps";

type N = NodeObject<GNode>;
type L = LinkObject<GNode, GLink>;

const LABEL_PX = 13;
/** Narrow canvases (phones): short sector headers — "Symptoms · +8 more" → "Symptoms +8", "… · none in our sources" → "… —". */
const compactHeader = (name: string) => {
  const [head, rest = ""] = name.split(" · ");
  const n = rest.match(/\+?\d+/)?.[0];
  return n ? `${head} ${n}` : rest ? `${head} —` : head;
};
const BASE_EDGE_ALPHA = 0.35;

export default function GraphCanvas({ view, highlightNodes, highlightEdges, selected, clusterFilter, bottomInset = 0, hiddenKinds, still, labelIds = null, command = null, onNode, onLink, onLinkHover, onBackground }: GraphCanvasProps) {
  const fg = useRef<ForceGraphMethods<N, L> | undefined>(undefined);
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  // No fit until the real canvas size is known (an early animated fit at the default size would win the race).
  const sized = useRef(false);
  const [hover, setHover] = useState<string | null>(null);
  const reduced = useMemo(() => !!still || prefersReducedMotion(), [still]);
  const narrow = size.w < 600;
  const insetRef = useRef(bottomInset);
  const lastClick = useRef<{ id: string; t: number } | null>(null);
  const narrowRef = useRef(narrow);
  useEffect(() => { narrowRef.current = narrow; }, [narrow]);
  /** Label rectangles already drawn this frame (screen px) — greedy collision avoidance. */
  const drawn = useRef<{ x: number; y: number; w: number; h: number }[]>([]);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => { sized.current = true; setSize({ w: Math.max(200, e.contentRect.width), h: Math.max(240, e.contentRect.height) }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    if (!view) return { nodes: [] as N[], links: [] as L[] };
    const links: L[] = view.links.filter((l) => !hiddenKinds?.has(kindOf(l.kind))).map((l) => ({ ...l }));
    const nodes: N[] = view.nodes.filter((n) => !(n.draft && hiddenKinds?.has("proposed"))).map((n) => ({ ...n }));
    return { nodes, links };
  }, [view, hiddenKinds]);
  const unpositioned = useMemo(() => data.nodes.some((n) => n.fx == null), [data]);

  /** Fit everything with a bounded zoom. */
  const fitAll = useCallback((ms: number) => {
    const g = fg.current; if (!g || !sized.current || !wrap.current) return;
    // Measure now (state can lag one render behind the ResizeObserver; two fits must never disagree).
    const box = wrap.current.getBoundingClientRect(), size = { w: Math.max(200, box.width), h: Math.max(240, box.height) };
    const ns = data.nodes.filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y));
    if (!ns.length) return;
    // Header pills have a fixed on-screen width (13 px text): half ≈ (7 px per char + 18) / 2, in graph units = px / zoom.
    // Two passes: estimate the zoom, then include the pills at that zoom.
    const padX = 20, padTop = 100, padBottom = 44 + insetRef.current; // clear of the toolbar + breadcrumb (top), legend / bottom sheet (bottom)
    const ys = ns.map((n) => n.y!);
    const [minY, maxY] = [Math.min(...ys) - 12, Math.max(...ys) + 24];
    const halfPx = (n: N) => (n.header ? ((size.w < 600 && n.header !== "region" ? compactHeader(n.name) : n.name).length * 7 + 18) / 2 : 0);
    let k = 1, minX = 0, maxX = 0;
    for (let pass = 0; pass < 2; pass++) {
      minX = Math.min(...ns.map((n) => n.x! - halfPx(n) / k)); maxX = Math.max(...ns.map((n) => n.x! + halfPx(n) / k));
      k = Math.min(2.5, Math.max(0.3, Math.min((size.w - padX * 2) / Math.max(maxX - minX, 160), (size.h - padTop - padBottom) / Math.max(maxY - minY, 160))));
    }
    g.zoom(k, ms);
    g.centerAt((minX + maxX) / 2, (minY + maxY) / 2 - (padTop - padBottom) / 2 / k, ms);
  }, [data]);

  // Always call the latest fit (current size + data): the first layout can arrive before the real canvas size.
  const fitRef = useRef(fitAll);
  useEffect(() => { fitRef.current = fitAll; }, [fitAll]);
  // New layout (focus / view change) → frame it once. No physics, no reheat.
  useEffect(() => {
    const t = setTimeout(() => fitRef.current(reduced ? 0 : 500), 30);
    return () => clearTimeout(t);
  }, [data, reduced]);
  // Bottom sheet resized (phones) → re-frame above it.
  useEffect(() => { insetRef.current = bottomInset; fitRef.current(reduced ? 0 : 300); }, [bottomInset, reduced]);
  // Resize → re-frame without animation (never reheats).
  useEffect(() => { fitRef.current(0); }, [size.w, size.h]);
  // Zoom control: + / − (300 ms), Fit / Reset (re-frame the whole layout).
  useEffect(() => {
    if (!command) return;
    if (command.kind === "fit" || command.kind === "reset") fitAll(reduced ? 0 : 500);
    else fg.current?.zoom(Math.min(4, Math.max(0.3, fg.current.zoom() * (command.kind === "zoomIn" ? 1.35 : 0.74))), reduced ? 0 : 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  const narrating = highlightNodes.size > 0;
  const dimmed = useCallback((n: N) => {
    if (n.header) return false;
    if (narrating) return !highlightNodes.has(n.id);
    return !!clusterFilter && n.type === "disease" && n.cluster !== clusterFilter;
  }, [narrating, highlightNodes, clusterFilter]);

  const paintNode = useCallback((node: N, ctx: CanvasRenderingContext2D, scale: number) => {
    const x = node.x ?? 0, y = node.y ?? 0;
    const t = ctx.getTransform();
    const toScreen = (gx: number, gy: number) => ({ x: gx * t.a + t.e, y: gy * t.d + t.f });

    // Sector / region headers: always-visible text pills (sector headers are buttons: "+N more").
    if (node.header) {
      const text = narrow && node.header !== "region" ? compactHeader(node.name) : node.name;
      const fs = LABEL_PX / scale;
      ctx.font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const w = ctx.measureText(text).width + 18 / scale, h = fs + 12 / scale;
      ctx.fillStyle = node.header === "region" ? hexA(node.color ?? CANVAS.ink, 0.1) : "rgba(255,255,255,0.96)";
      ctx.strokeStyle = node.header === "region" ? hexA(node.color ?? CANVAS.ink, 0.5) : hexA(CANVAS.ink, node.id === hover ? 0.7 : 0.25);
      ctx.lineWidth = 1 / scale;
      ctx.beginPath(); roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = CANVAS.ink; ctx.fillText(text, x, y + 0.5 / scale);
      const s = toScreen(x - w / 2, y - h / 2); drawn.current.push({ x: s.x, y: s.y, w: w * t.a, h: h * t.d });
      return;
    }

    const isDisease = node.type === "disease";
    const lit = highlightNodes.has(node.id) || node.id === selected || node.id === hover;
    const dim = dimmed(node);
    const color = isDisease ? node.color ?? CANVAS.fallbackDisease : TYPE_COLOR[node.type] ?? TYPE_COLOR.study;
    const r = nodeSize(node.size);
    ctx.globalAlpha = dim ? CANVAS.dimAlpha : node.draft ? 0.45 : 1;
    const shape = () => (node.draft ? ctx.stroke() : ctx.fill());

    // Soft static halo (no pulse: the canvas stays still)
    if (isDisease || lit) {
      const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4);
      g.addColorStop(0, hexA(color, lit ? 0.32 : 0.16)); g.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 1.2 / scale;
    if (node.draft) ctx.setLineDash([3 / scale, 3 / scale]);
    ctx.beginPath();
    switch (node.type as string) {
      case "gene": roundRect(ctx, x - r, y - r, 2 * r, 2 * r, r * 0.35); shape(); break;
      case "pathway": ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.2, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r * 1.2, y); ctx.closePath(); shape(); break;
      case "organization": ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.lineWidth = 2 / scale; ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, 2 * Math.PI); ctx.fill(); break;
      case "trial": ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); shape(); break;
      case "investigator": ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.lineWidth = 1.8 / scale; ctx.stroke(); break;
      case "mechanism": for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; const px = x + r * 1.15 * Math.cos(a), py = y + r * 1.15 * Math.sin(a); if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath(); shape(); break;
      default: ctx.arc(x, y, r, 0, 2 * Math.PI); shape();
    }
    ctx.setLineDash([]);
    if (isDisease && !node.draft) { ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.5 / scale; ctx.stroke(); }
    if (node.focus || node.id === selected) { ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, 2 * Math.PI); ctx.strokeStyle = CANVAS.ink; ctx.lineWidth = 1.8 / scale; ctx.stroke(); }
    if (node.bridge) { ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 2 * Math.PI); ctx.strokeStyle = CANVAS.bridge; ctx.lineWidth = 1.4 / scale; ctx.setLineDash([2 / scale, 2 / scale]); ctx.stroke(); ctx.setLineDash([]); }

    // Labels: 13 px pill; focus / ring 1–2 (labelIds) and hovered / lit; skipped if it would overlap one already drawn.
    // Focus / ring 1–2 keep their label even when dimmed (faded with the node); others only when not dimmed.
    const listed = labelIds ? labelIds.has(node.id) : isDisease;
    if (lit || (listed && (!dim || labelIds))) {
      const fs = LABEL_PX / scale;
      ctx.font = `${isDisease || node.focus ? 600 : 500} ${fs}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      const label = trim(node.name, size.w < 600 ? 20 : 40); // narrow canvases: shorter pills
      const w = ctx.measureText(label).width + 10 / scale, h = fs + 6 / scale;
      const lx = x - w / 2;
      const ring = (node as { ring?: number }).ring ?? 9;
      const isFocus = !!node.focus || ring === 0;
      // Try below the node, then above; the focus label always wins (QA-53), others move or drop out on collision.
      const spots = [y + r + 4 / scale, y - r - 4 / scale - h];
      const rectAt = (ly: number) => { const sc = toScreen(lx, ly); return { x: sc.x, y: sc.y, w: w * t.a, h: h * t.d }; };
      const collides = (rc: { x: number; y: number; w: number; h: number }) => drawn.current.some((o) => rc.x < o.x + o.w && rc.x + rc.w > o.x && rc.y < o.y + o.h && rc.y + rc.h > o.y);
      let ly: number | null = null;
      if (isFocus || node.id === hover) ly = spots[0];
      else for (const cand of spots) if (!collides(rectAt(cand))) { ly = cand; break; }
      if (ly !== null) {
        ctx.fillStyle = CANVAS.labelBg;
        ctx.beginPath(); roundRect(ctx, lx, ly, w, h, 4 / scale); ctx.fill();
        ctx.fillStyle = CANVAS.ink;
        ctx.fillText(label, x, ly + 3 / scale);
        drawn.current.push(rectAt(ly));
      }
    }
    ctx.globalAlpha = 1;
  }, [highlightNodes, selected, hover, dimmed, labelIds, size.w, narrow]);

  const paintArea = useCallback((node: N, color: string, ctx: CanvasRenderingContext2D, scale: number) => {
    ctx.fillStyle = color; ctx.beginPath();
    if (node.header) { ctx.font = `600 ${LABEL_PX / scale}px ui-sans-serif`; const w = ctx.measureText(narrowRef.current && node.header !== "region" ? compactHeader(node.name) : node.name).width + 18 / scale, h = (LABEL_PX + 12) / scale; roundRect(ctx, (node.x ?? 0) - w / 2, (node.y ?? 0) - h / 2, w, h, h / 2); ctx.fill(); return; }
    // Hit target ≥ 14 px on screen whatever the zoom.
    ctx.arc(node.x ?? 0, node.y ?? 0, Math.max(nodeSize(node.size) + 4, 14 / scale), 0, 2 * Math.PI); ctx.fill();
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
        nodeLabel={(n) => (n.header ? "" : `${n.name}`)}
        onRenderFramePre={() => { drawn.current = []; }}
        linkColor={(l) => {
          const s = KIND_STYLE[kindOf(l.kind)];
          const lit = isLit(l);
          if (narrating && !lit) return hexA(s.color, 0.06);
          if (lit) return CANVAS.ink;
          if (l.bridge) return hexA(CANVAS.bridge, 0.6);
          return hexA(s.color, l.kind === "proposed" ? 0.25 : BASE_EDGE_ALPHA);
        }}
        linkWidth={(l) => (isLit(l) ? 2.6 : l.kind === "inferred" ? 1.2 + 2 * l.confidence : l.bridge ? 1.6 : 1)}
        linkLineDash={(l) => KIND_STYLE[kindOf(l.kind)].dash}
        linkCurvature={(l) => (l.bridge ? 0.25 : 0)}
        linkHoverPrecision={6}
        onNodeHover={(n) => { setHover(n ? String(n.id) : null); if (wrap.current) wrap.current.style.cursor = n ? "pointer" : ""; }}
        onNodeClick={(n) => {
          // Double-click = zoom to the node; single click = focus / open its evidence (handled by the parent).
          const now = performance.now(), last = lastClick.current;
          lastClick.current = { id: String(n.id), t: now };
          if (last && last.id === String(n.id) && now - last.t < DOUBLE_CLICK_MS) {
            fg.current?.centerAt(n.x, n.y, reduced ? 0 : 600); fg.current?.zoom(Math.max(2.2, fg.current.zoom()), reduced ? 0 : 600); return;
          }
          onNode(n as GNode);
        }}
        onLinkClick={(l) => onLink({ ...(l as GLink), source: endId(l.source), target: endId(l.target) })}
        onLinkHover={(l) => onLinkHover?.(l ? (l as GLink).id : null)}
        onBackgroundClick={() => onBackground?.()}
        warmupTicks={unpositioned ? 120 : 0}
        cooldownTicks={0}
        minZoom={0.3}
        maxZoom={4}
        autoPauseRedraw={false}
        enableNodeDrag={false}
      />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
