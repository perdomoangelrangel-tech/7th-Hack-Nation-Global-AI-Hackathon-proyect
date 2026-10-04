/** One props contract for both canvases (3D default, 2D fallback): AtlasApp can swap them freely. */
import type { GLink, GNode, GraphView } from "@/lib/atlas/store";

export interface GraphCanvasProps {
  view: GraphView | null;
  highlightNodes: Set<string>;
  highlightEdges: Set<string>;
  selected: string | null;
  clusterFilter: string | null;
  /** Height (px) covered by the narration bar: framing centers above it. */
  bottomInset: number;
  /** Visible edge kinds (legend toggles). Missing = all visible. */
  hiddenKinds?: Set<string>;
  /** Freeze all motion (reduced motion / low power). */
  still?: boolean;
  /** Label policy: when set, only these ids (plus hovered / lit nodes) get a label. Null = every disease. */
  labelIds?: Set<string> | null;
  /** Floating controls → canvas (zoom / fit). `n` increments so the same command can repeat. */
  command?: GraphCommand | null;
  /** 3D idle rotation (off by default). */
  spin?: boolean;
  onNode: (n: GNode) => void;
  onLink: (l: GLink) => void;
  onLinkHover?: (edgeId: string | null) => void;
  /** Click on empty canvas clears the selection. */
  onBackground?: () => void;
}

export interface GraphCommand { kind: "zoomIn" | "zoomOut" | "fit"; n: number }

/** Node radius budget (WAVE 5B: 6–14 px at fit zoom; layouts set sizes per ring). */
export const nodeSize = (size: number) => Math.min(18, Math.max(3, size));

export const endId = (v: unknown) => (typeof v === "object" && v ? String((v as { id: string }).id) : String(v));
export const trim = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
