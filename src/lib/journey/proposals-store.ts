/**
 * Proposal persistence: Supabase RPC `submit_proposal` + view `proposals_public` (data lane, migration 0011).
 * If the RPC/view is not live yet, drafts go to an in-memory list on this server instance and are
 * labeled `stored: "local"` ("saved locally (demo)") — never presented as shared.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { publicClient } from "@/lib/supabase/server";
import type { GraphIndex } from "./graph";
import type { ProposalInput, ProposalPublic, ProposalSaved } from "./proposals";

const MEMORY: ProposalPublic[] = [];
const MEMORY_CAP = 300;

/** Keep only ids that exist in the graph: a draft may cite evidence, never invent it. */
export function sanitizeRefs(g: GraphIndex, input: ProposalInput) {
  const edges = [...new Set(input.edges)].filter((id) => g.edgeById.has(id));
  const dropped_edges = input.edges.filter((id) => !g.edgeById.has(id));
  const entities = [...new Set(input.entities)].filter((id) => g.byId.has(id));
  const disease = input.disease && g.byId.get(input.disease)?.type === "disease" ? input.disease : null;
  return { edges, entities, disease, dropped_edges };
}

export async function saveProposal(g: GraphIndex, input: ProposalInput): Promise<ProposalSaved> {
  const { edges, entities, disease, dropped_edges } = sanitizeRefs(g, input);
  const contact = input.consent && input.contact ? input.contact : null; // no consent → never stored
  const base = { kind: input.kind, title: input.title, body: input.body, persona: input.persona ?? null, disease, entities, edges };
  try {
    const { data, error } = await publicClient().rpc("submit_proposal", {
      p_kind: base.kind, p_title: base.title, p_body: base.body, p_persona: base.persona, p_disease: base.disease,
      p_entities: base.entities, p_edges: base.edges, p_contact: contact,
    });
    if (error) throw new Error(error.message);
    const id = String(data);
    return { ok: true, id, stored: "supabase", dropped_edges, proposal: { ...base, id, status: "draft", created_at: new Date().toISOString(), stored: "supabase", edge_kind: "proposed" } };
  } catch (e) {
    console.warn("[proposals] RPC submit_proposal unavailable, keeping the draft in memory:", (e as Error).message);
    const proposal: ProposalPublic = { ...base, id: `local-${randomUUID()}`, status: "draft", created_at: new Date().toISOString(), stored: "local", edge_kind: "proposed" };
    MEMORY.unshift(proposal);
    MEMORY.length = Math.min(MEMORY.length, MEMORY_CAP);
    return { ok: true, id: proposal.id, stored: "local", dropped_edges, proposal };
  }
}

export async function listProposals(disease: string | null, limit = 50): Promise<{ proposals: ProposalPublic[]; sources: ("supabase" | "local")[] }> {
  const local = MEMORY.filter((p) => !disease || p.disease === disease);
  let remote: ProposalPublic[] = [];
  let remoteOk = false;
  try {
    let q = publicClient().from("proposals_public").select("id,kind,title,body,persona,disease,entities,edges,status,created_at").order("created_at", { ascending: false }).limit(limit);
    if (disease) q = q.eq("disease", disease);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    remote = (data ?? []).map((r) => ({ ...(r as Omit<ProposalPublic, "stored" | "edge_kind">), entities: r.entities ?? [], edges: r.edges ?? [], stored: "supabase" as const, edge_kind: "proposed" as const }));
    remoteOk = true;
  } catch (e) {
    console.warn("[proposals] view proposals_public unavailable:", (e as Error).message);
  }
  const sources: ("supabase" | "local")[] = [...(remoteOk ? ["supabase" as const] : []), ...(local.length || !remoteOk ? ["local" as const] : [])];
  return { proposals: [...local, ...remote].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit), sources };
}
