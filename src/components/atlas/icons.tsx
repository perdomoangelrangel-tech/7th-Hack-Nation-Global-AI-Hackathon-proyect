/**
 * Icons for node types and evidence kinds (UX_WAVE4 §1.3–1.4). Same metaphors as the Blender glyphs so the legend is
 * learned once. Icons never carry meaning alone: callers always render a visible label or an aria-label.
 */
import {
  Asterisk, BadgeCheck, CircleDot, ClipboardList, Dna, Droplet, FileText, FlaskConical, GraduationCap, Landmark, Link2,
  Orbit, PencilLine, Pill, Sigma, Sparkles, TriangleAlert, Users, Waypoints, type LucideIcon,
} from "lucide-react";
import { TYPE_COLOR, type LinkKind } from "./colors";

export const TYPE_ICON: Record<string, LucideIcon> = {
  disease: CircleDot, gene: Dna, variant: Asterisk, pathway: Waypoints, cluster: Orbit, phenotype: Droplet,
  trial: FlaskConical, registry: ClipboardList, study: FileText, organization: Users, investigator: GraduationCap,
  treatment: Pill, funding: Landmark,
};

export const KIND_ICON: Record<LinkKind | "contradicting" | "bridge", LucideIcon> = {
  observed: BadgeCheck, inferred: Sigma, extracted: Sparkles, proposed: PencilLine, contradicting: TriangleAlert, bridge: Link2,
};

export function TypeIcon({ type, size = 16, className = "" }: { type: string; size?: number; className?: string }) {
  const I = TYPE_ICON[type] ?? CircleDot;
  const color = type === "cluster" ? TYPE_COLOR.pathway : TYPE_COLOR[type] ?? TYPE_COLOR.study;
  return <I aria-hidden size={size} strokeWidth={1.75} className={`shrink-0 ${className}`} style={{ color }} />;
}
