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
  onNode: (n: GNode) => void;
  onLink: (l: GLink) => void;
}

export const endId = (v: unknown) => (typeof v === "object" && v ? String((v as { id: string }).id) : String(v));
export const trim = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
