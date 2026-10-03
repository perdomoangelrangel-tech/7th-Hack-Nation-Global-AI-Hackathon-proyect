// HPO (JAX ontology API): enrich every phenotype linked to a disease with definition, synonyms and
// parent terms (is_a). Skips terms already enriched; stops before the deadline (call again to resume).
import type { Ctx } from "../types.ts";
import { getJSON, sleep, today, trunc } from "../http.ts";

const BASE = "https://ontology.jax.org/api/hp/terms";
// deno-lint-ignore no-explicit-any
type Any = any;

export async function hpo(ctx: Ctx, limit = 400) {
  const data: Any[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data: page, error } = await ctx.db.from("edge_evidence")
      .select("to_canonical_id, to_name, to_props").eq("relation", "has_phenotype").range(from, from + 999);
    if (error) throw error;
    data.push(...(page ?? []));
    if ((page ?? []).length < 1000) break;
  }
  const todo = new Map<string, string>();
  for (const r of data) if (!(r.to_props as Any)?.definition && !(r.to_props as Any)?.hpo_checked) todo.set(r.to_canonical_id, r.to_name);
  const ids = [...todo.keys()].filter((x) => x.startsWith("HP:")).slice(0, ctx.dry ? 2 : limit);
  let done = 0;

  const worker = async (queue: string[]) => {
    for (const id of queue) {
      if (Date.now() > ctx.deadline - 8000) return;
      const info = await getJSON<Any>(`${BASE}/${encodeURIComponent(id)}`).catch((e) => { ctx.note(`hpo ${id}: ${e?.message ?? e}`); return null; });
      if (!info) continue;
      const parents = await getJSON<Any>(`${BASE}/${encodeURIComponent(id)}/parents`).catch(() => []);
      if (done === 0) { ctx.sample("hpo.term", info); ctx.sample("hpo.parents", parents); }
      const name = info.name ?? todo.get(id) ?? id;
      const ref = { type: "phenotype" as const, canonicalId: id, name };
      ctx.batch.entity({
        ...ref,
        props: {
          definition: info.definition, comment: trunc(info.comment, 500),
          synonyms: (info.synonyms ?? []).slice(0, 10), hpo_checked: today(),
          hpo_url: `https://hpo.jax.org/browse/term/${id}`,
        },
      });
      for (const s of (info.synonyms ?? []).slice(0, 10)) ctx.batch.alias(ref, typeof s === "string" ? s : s?.name, "en");
      for (const p of (Array.isArray(parents) ? parents : parents?.items ?? []).slice(0, 3)) {
        if (!p?.id) continue;
        ctx.batch.edge({
          from: ref, to: { type: "phenotype", canonicalId: p.id, name: p.name ?? p.id },
          relation: "is_a", confidence: 1, confidenceBasis: "ontology",
          evidence: [{ source: "hpo", externalId: `${id}/is_a/${p.id}`, url: `https://hpo.jax.org/browse/term/${id}`, quote: `${name} is a ${p.name ?? p.id}`, publishedOn: today() }],
        });
      }
      done++;
      await sleep(50);
    }
  };
  const lanes = 4;
  await Promise.all(Array.from({ length: lanes }, (_, i) => worker(ids.filter((_, j) => j % lanes === i))));
  ctx.extra.hpo_enriched = done;
  ctx.extra.hpo_remaining = Math.max(0, todo.size - done);
}
