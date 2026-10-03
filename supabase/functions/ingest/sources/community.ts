// Researcher community derived from literature: first + last author of each PubMed paper already
// linked to the disease become research_community rows (source 'pubmed_author', source_ref 'PMID:x').
// Public profile only with data PubMed already publishes; open_to_contact stays false.
import type { Ctx, SeedDisease } from "../types.ts";
import type { Author } from "./pubmed.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

export async function community(ctx: Ctx, d: SeedDisease) {
  const { data: dis, error: e1 } = await ctx.db.from("entities").select("id").eq("type", "disease").eq("canonical_id", d.orpha).maybeSingle();
  if (e1) throw e1;
  if (!dis) { ctx.note(`community: disease ${d.orpha} not in graph yet (run orphanet first)`); return; }

  const { data: rows, error } = await ctx.db.from("edge_evidence")
    .select("from_canonical_id, from_name, from_props, evidence")
    .eq("relation", "studies").eq("to_id", dis.id).eq("from_type", "study").limit(500);
  if (error) throw error;

  // newest paper first, one row per (disease, name, source)
  const papers = (rows ?? []).map((r: Any) => ({ ...r, date: r.from_props?.pub_date ?? r.evidence?.[0]?.published_on ?? "" }))
    .sort((a: Any, b: Any) => String(b.date).localeCompare(String(a.date)));
  const people = new Map<string, Any>();
  for (const p of papers) {
    const pairs: [Author | undefined, string][] = [[p.from_props?.first_author, "first author"], [p.from_props?.last_author, "senior author"]];
    for (const [a, position] of pairs) {
      if (!a?.name || people.has(a.name)) continue;
      people.set(a.name, {
        disease_id: dis.id, name: a.name.slice(0, 200), affiliation: a.affiliation ?? null, country: a.country ?? null,
        role: "researcher", focus: `${position}: ${String(p.from_name).slice(0, 220)}`, orcid: a.orcid ?? null,
        public_profile: true, open_to_contact: false, source: "pubmed_author", source_ref: p.from_canonical_id,
      });
    }
  }
  const list = [...people.values()];
  ctx.sample("community.rows", list.slice(0, 3));
  if (ctx.dry || !list.length) { ctx.extra.researchers = list.length; return; }
  const { error: upErr, count } = await ctx.db.from("research_community")
    .upsert(list, { onConflict: "disease_id,name,source", count: "exact" });
  if (upErr) throw upErr;
  ctx.extra.researchers = count ?? list.length;
}
