/** Line metadata: one evidence type = one transit line color (tokens only, see DESIGN.md). */
import type { LineKey } from "@/lib/atlas-data";

export type Audience = "family" | "clinical" | "research";

export interface LineMeta {
  key: LineKey;
  stroke: string; // SVG stroke/fill value
  bg: string; // Tailwind background class
  text: string; // Tailwind text-safe color class
  fill: string; // Tailwind SVG text fill class
}

export const LINE_META: Record<LineKey, LineMeta> = {
  genes: { key: "genes", stroke: "var(--l-gene)", bg: "bg-gene", text: "text-t-gene", fill: "fill-t-gene" },
  phenotypes: { key: "phenotypes", stroke: "var(--l-pheno)", bg: "bg-pheno", text: "text-t-pheno", fill: "fill-t-pheno" },
  treatments: { key: "treatments", stroke: "var(--l-treat)", bg: "bg-treat", text: "text-t-treat", fill: "fill-t-treat" },
  trials: { key: "trials", stroke: "var(--l-trial)", bg: "bg-trial", text: "text-t-trial", fill: "fill-t-trial" },
  literature: { key: "literature", stroke: "var(--l-lit)", bg: "bg-lit", text: "text-ink-2", fill: "fill-ink-2" },
  community: { key: "community", stroke: "var(--l-comm)", bg: "bg-comm", text: "text-t-comm", fill: "fill-t-comm" },
};

export const AUDIENCE_META: Record<Audience, { stroke: string; bg: string; text: string; border: string; rail: string }> = {
  family: { stroke: "var(--l-treat)", bg: "bg-treat", text: "text-t-treat", border: "border-treat", rail: "before:bg-treat" },
  clinical: { stroke: "var(--l-trial)", bg: "bg-trial", text: "text-t-trial", border: "border-trial", rail: "before:bg-trial" },
  research: { stroke: "var(--l-comm)", bg: "bg-comm", text: "text-t-comm", border: "border-comm", rail: "before:bg-comm" },
};

export const AUDIENCES: Audience[] = ["family", "clinical", "research"];
export const isAudience = (v: unknown): v is Audience => v === "family" || v === "clinical" || v === "research";
