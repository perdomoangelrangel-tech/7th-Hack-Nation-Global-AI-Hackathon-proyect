/**
 * Which evidence is "returned by the tools in this turn" for /api/ask. The audience profile names its
 * tools; topics detected in the question add theirs. Only evidence ids from these slices are allowed
 * through the verifier.
 */
import type { DiseaseMap, EvidenceRef, Station } from "../atlas-data";
import type { Connections } from "./connections";
import { pairEvidence } from "./connections";
import type { AgentOutput } from "../verifier";
import type { Intent } from "./detect";
import { communitiesTool, connectionsTool, diseaseTool, gapsTool, literatureTool, treatmentsTool, trialsTool } from "./tools";

const INTENT_TOOL: Record<Intent, string> = {
  connections: "connections", cure: "treatments", genes: "disease", symptoms: "disease", treatments: "treatments", trials: "trials",
  community: "communities", literature: "literature", gaps: "gaps",
};

export function turnTools(profileTools: string[], intents: Intent[]) {
  const names = new Set(profileTools.map((t) => (t === "phenotype-match" ? "disease" : t)));
  for (const i of intents) names.add(INTENT_TOOL[i]);
  return [...names];
}

const all = (list: Station[]) => list.flatMap((s) => s.evidence);

export function toolsForTurn(map: DiseaseMap, profileTools: string[], intents: Intent[], connections?: Connections | null) {
  const names = turnTools(profileTools, intents);
  const tools: Record<string, unknown> = {};
  const evidence: EvidenceRef[] = [];
  const index = new Map<string, EvidenceRef>();
  for (const line of Object.values(map.lines)) for (const e of all(line)) index.set(e.id, e);
  for (const t of names) {
    if (t === "disease") { tools.disease = diseaseTool(map); evidence.push(...all(map.lines.genes), ...all(map.lines.phenotypes)); }
    else if (t === "treatments") { tools.treatments = treatmentsTool(map); evidence.push(...all(map.lines.treatments)); }
    else if (t === "trials") { tools.trials = trialsTool(map); evidence.push(...all(map.lines.trials)); }
    else if (t === "literature") { tools.literature = literatureTool(map); evidence.push(...all(map.lines.literature)); }
    else if (t === "communities") { tools.communities = communitiesTool(map); evidence.push(...all(map.lines.community)); }
    else if (t === "connections" && connections) {
      tools.connections = connectionsTool(connections);
      for (const n of connections.neighbors) evidence.push(...pairEvidence(n));
    }
    else if (t === "gaps") {
      tools.gaps = gapsTool(map);
      for (const g of map.gaps) for (const id of g.evidence_ids) { const e = index.get(id); if (e) evidence.push(e); }
    }
  }
  const seen = new Set<string>();
  return { tools, evidence: evidence.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))) };
}

/**
 * Drafter hygiene: a demo claim citing evidence outside this turn's tools is the drafter's own slip,
 * not an unsourced statement, so it is removed before verification. Claims with NO evidence stay:
 * the verifier must drop them and say so.
 */
export function onlyAllowed(draft: AgentOutput, allowed: Set<string>): AgentOutput {
  return { ...draft, claims: draft.claims.filter((c) => !c.evidence_ids.length || c.evidence_ids.every((id) => allowed.has(id))) };
}
