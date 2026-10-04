/**
 * The Nedamex icon map (UX_WAVE4 §1). OWNER: brand lane. Every lane imports icons from here, never ad hoc,
 * so one meaning = one icon across the website and /atlas.
 *
 * Rules: 20 px in the UI, 16 px in chips, 24 px on role cards, strokeWidth 1.75 (`ICON`), colour = currentColor.
 * Never an icon alone: always visible text or an aria-label; decorative icons get aria-hidden.
 * Node types use the same metaphor as the Blender glyphs, so the legend is learned once.
 *
 *   import { NODE_ICON, ICON } from "@/lib/icons";
 *   const Icon = NODE_ICON[entity.type]; <Icon size={ICON.ui} strokeWidth={ICON.stroke} aria-hidden />
 */
import {
  Accessibility, AudioLines, BadgeCheck, BookOpen, Box, ChevronLeft, ChevronRight, CircleCheck, CircleDashed,
  CircleDot, CircleHelp, ClipboardList, CloudOff, Command, Copy, Dna, Download, ExternalLink, FastForward,
  FilePlus2, FileText, Flag, FlaskConical, Focus, Footprints, GitCompareArrows, GraduationCap, Handshake,
  HandHeart, HeartHandshake, History, Info, Landmark, Languages, Lightbulb, Link2, ListChecks, Map as MapIcon,
  Maximize2, Mic, MicOff, Microscope, Network, Orbit, PanelLeftClose, PanelLeftOpen, PanelRightClose, Pause,
  PencilLine, Pill, Printer, Recycle, RefreshCw, Rotate3d, Search, Share2, Sigma, Sparkles, Square, Table2,
  Target, TriangleAlert, UserRound, Users, Volume2, Waypoints, ZoomIn, ZoomOut, Droplet, Asterisk,
  type LucideIcon,
} from "lucide-react";
import type { EdgeKind, EntityType } from "@/lib/atlas/types";
import type { PersonaId } from "@/lib/agents/profiles";

export type { LucideIcon };

/** Sizes + stroke (UX_WAVE4 §1). */
export const ICON = { ui: 20, chip: 16, card: 24, stroke: 1.75 } as const;

/** §1.1 Global and navigation. */
export const NAV_ICON = {
  search: Search,
  command: Command,
  help: CircleHelp,
  readingMotion: Accessibility,
  language: Languages,
  guide: AudioLines,
  mic: Mic,
  micOff: MicOff,
  listen: Volume2,
  pause: Pause,
  panelLeftClose: PanelLeftClose,
  panelLeftOpen: PanelLeftOpen,
  panelRightClose: PanelRightClose,
  back: ChevronLeft,
  next: ChevronRight,
} as const satisfies Record<string, LucideIcon>;

/** §1.2 Modes (role selector). Titles/subtitles are the exact UI copy. */
export const MODE_ICON: Record<PersonaId, LucideIcon> = { devon: UserRound, maria: HeartHandshake, osei: Microscope, priya: Target };
export const MODE_COPY: Record<PersonaId, { title: string; subtitle: string }> = {
  devon: { title: "Patient or caregiver", subtitle: "e.g. Devon" },
  maria: { title: "Family & patient group", subtitle: "e.g. Maria" },
  osei: { title: "Researcher & clinician", subtitle: "e.g. Dr. Osei" },
  priya: { title: "Pharma & biotech", subtitle: "e.g. Priya" },
};

/** §1.3 Node types (= Blender glyphs = TYPE_COLOR). `registry` and `funding` are display sub-types. */
export const NODE_ICON: Record<EntityType | "registry" | "funding", LucideIcon> = {
  disease: CircleDot,
  gene: Dna,
  variant: Asterisk,
  pathway: Waypoints,
  mechanism: Sigma,
  phenotype: Droplet,
  trial: FlaskConical,
  registry: ClipboardList,
  study: FileText,
  organization: Users,
  investigator: GraduationCap,
  treatment: Pill,
  funding: Landmark,
};

/** Human labels for node types (singular), shared by legend, search groups and chips. */
export const NODE_LABEL: Record<EntityType | "registry" | "funding", string> = {
  disease: "Disease", gene: "Gene", variant: "Variant", pathway: "Mechanism", mechanism: "Variant effect", phenotype: "Symptom", trial: "Study",
  registry: "Registry", study: "Paper", organization: "Patient group", investigator: "Researcher", treatment: "Treatment", funding: "Funding",
};

/** §1.4 Evidence kind (line style leads; the icon accompanies). Badge = exact UI copy. */
export const KIND_ICON: Record<EdgeKind, LucideIcon> = { observed: BadgeCheck, inferred: Sigma, extracted: Sparkles, proposed: PencilLine };
export const KIND_BADGE: Record<EdgeKind, string> = {
  observed: "Observed · a source states it",
  inferred: "Inferred · needs expert review",
  extracted: "AI-extracted · needs expert review",
  proposed: "Community draft · not evidence",
};
export const SIGNAL_ICON = {
  contradicting: TriangleAlert, // "Contradicting evidence" (amber)
  bridge: Link2, // "Bridge across clusters"
  gap: CircleDashed, // "No supported route yet" (amber)
} as const satisfies Record<string, LucideIcon>;
export const SIGNAL_LABEL = { contradicting: "Contradicting evidence", bridge: "Bridge across clusters", gap: "No supported route yet" } as const;

/** §1.5 Route steps (exact copy) — step 4 is a recommendation, never "observed". */
export const STEP_ICON = [GitCompareArrows, Recycle, Handshake, Footprints] as const;
export const STEP_COPY = [
  "Who shares our disease characteristics?",
  "What useful work already exists?",
  "Who could help?",
  "What should we do together next?",
] as const;

/** §1.5 Actions and states. */
export const ACTION_ICON = {
  tenX: FastForward,
  proposeHypothesis: Lightbulb,
  proposeCollaboration: Handshake,
  addEvidence: FilePlus2,
  explain: Sparkles,
  external: ExternalLink,
  copyCitation: Copy,
  flag: Flag,
  share: Share2,
  export: Download,
  print: Printer,
  plan: ListChecks,
  viewMap: MapIcon,
  viewTable: Table2,
  view2d: Square,
  view3d: Box,
  focus: Focus,
  all: Network,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  fit: Maximize2,
  rotate: Rotate3d,
  clusters: Orbit,
  howToRead: BookOpen,
  community: HandHeart,
  error: CloudOff,
  retry: RefreshCw,
  snapshot: History,
  info: Info,
  done: CircleCheck,
  evidence: BadgeCheck,
  coCreate: PencilLine,
  route: Footprints,
} as const satisfies Record<string, LucideIcon>;

/** Exact UI copy for actions/states (verb + object). */
export const ACTION_LABEL = {
  tenX: "See the 10× route",
  proposeHypothesis: "Propose a hypothesis",
  proposeCollaboration: "Propose a collaboration",
  addEvidence: "Add missing evidence",
  explain: "Explain in plain words",
  copyCitation: "Copy citation",
  flag: "Flag as wrong",
  share: "Share link",
  export: "Export CSV",
  print: "Print plan",
  plan: "Save my plan",
  viewMap: "Map",
  viewTable: "Table",
  view2d: "2D",
  view3d: "3D",
  focus: "Focus",
  all: "All",
  clusters: "Clusters",
  howToRead: "How to read",
  community: "Community",
  loading: "Following the evidence…",
  error: "We couldn't load this. Try again.",
  info: "Not medical advice",
  done: "Your route is ready",
  search: "Search a disease, gene, symptom or patient group",
} as const;
