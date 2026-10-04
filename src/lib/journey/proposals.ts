/**
 * Community drafts (hypothesis · collaboration · missing evidence). Shared by the client dialog and the API.
 * A draft is NEVER evidence: the graph renders it as a ghost node/edge labeled "community draft".
 * Contact details are only accepted with explicit consent and are never returned by the API.
 */
import { z } from "zod";

export const PROPOSAL_KINDS = ["hypothesis", "collaboration", "evidence"] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export const ProposalInput = z.object({
  kind: z.enum(PROPOSAL_KINDS),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(4000),
  persona: z.enum(["devon", "maria", "osei", "priya"]).nullable().optional(),
  disease: z.string().max(120).nullable().optional(),
  entities: z.array(z.string().max(160)).max(50).default([]),
  edges: z.array(z.string().max(80)).max(100).default([]),
  contact: z.string().trim().max(200).nullable().optional(),
  consent: z.boolean().default(false),
});
export type ProposalInput = z.infer<typeof ProposalInput>;

/** What GET /api/proposals returns (no contact column, ever). */
export interface ProposalPublic {
  id: string;
  kind: ProposalKind;
  title: string;
  body: string;
  persona: string | null;
  disease: string | null;
  entities: string[];
  edges: string[];
  status: "draft" | "under_review" | "accepted" | "rejected";
  created_at: string;
  /** Where it is stored: the shared database, or this server's memory (demo fallback). */
  stored: "supabase" | "local";
  /** Always "proposed": a community draft, not evidence. */
  edge_kind: "proposed";
}

export interface ProposalSaved { ok: true; id: string; stored: "supabase" | "local"; proposal: ProposalPublic; dropped_edges: string[] }

/** Browser event fired after a draft is saved, so other panels (graph ghost layer) can refresh. */
export const PROPOSAL_EVENT = "nexmed:proposal";
