/** HPO (JAX): enriquece cada fenotipo ya en el grafo con definición, sinónimos y padre (is_a). */
import { createClient } from "@supabase/supabase-js";
import { Graph, getJSON, sleep } from "../graph";

const BASE = "https://ontology.jax.org/api/hp/terms";

export async function ingestHPO(g: Graph) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: terms } = await db.from("entities").select("id, canonical_id, name, props").eq("type", "phenotype");
  for (const t of terms ?? []) {
    if (t.props?.definition) continue; // ya enriquecido
    const info = await getJSON<any>(`${BASE}/${t.canonical_id}`).catch(() => null);
    if (!info) continue;
    await g.upsertEntity({ type: "phenotype", canonicalId: t.canonical_id, name: info.name ?? t.name, props: { definition: info.definition, synonyms: info.synonyms ?? [] } });
    for (const s of info.synonyms ?? []) await g.addAlias(t.id, s);
    const parents = await getJSON<any>(`${BASE}/${t.canonical_id}/parents`).catch(() => []);
    for (const p of (parents ?? []).slice(0, 3)) {
      await g.upsertEdge({
        from: { type: "phenotype", canonicalId: t.canonical_id, name: info.name ?? t.name },
        to: { type: "phenotype", canonicalId: p.id, name: p.name },
        relation: "is_a", confidence: 1, confidenceBasis: "ontology",
        evidence: [{ source: "hpo", externalId: t.canonical_id, url: `https://hpo.jax.org/browse/term/${t.canonical_id}`, quote: "HPO is_a relation" }],
      });
    }
    await sleep(120);
  }
  await g.markSynced("hpo");
}
