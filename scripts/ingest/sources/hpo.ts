/**
 * HPO (JAX): enriquece cada fenotipo ya en el grafo con definición, nombre en español, sinónimos,
 * ancestros y especificidad. La especificidad sale de cuántas enfermedades anota HPO con el término:
 * "convulsión" la tienen miles (poco informativa); un signo raro, pocas (muy informativa).
 * Los ancestros permiten comparar fenotipos a distinta granularidad (similitud semántica tipo Resnik):
 * "convulsión tónico-clónica generalizada" y "convulsión" comparten el ancestro "convulsión".
 */
import { type GraphWriter, getJSON, sleep } from "../graph";

const TERMS = "https://ontology.jax.org/api/hp/terms";
const ANNOT = "https://ontology.jax.org/api/network/annotation";
const ROOT = "HP:0000118"; // Phenotypic abnormality
// Ancestros demasiado generales no aportan señal (y casi todas las enfermedades los comparten).
const STOP = new Set(["HP:0000001", "HP:0000118"]);

type Json = any;

const annotCache = new Map<string, number | null>();
async function annotated(id: string) {
  if (annotCache.has(id)) return annotCache.get(id)!;
  const ann = await getJSON<Json>(`${ANNOT}/${id}`).catch(() => null);
  const n = ann?.diseases?.length ?? null;
  annotCache.set(id, n);
  await sleep(60);
  return n;
}
const es = (t: Json) => (t?.translations ?? []).find((x: Json) => x.language === "ES")?.name as string | undefined;

export async function ingestHPO(g: GraphWriter) {
  const totalDiseases = (await annotated(ROOT)) ?? 0;
  const terms = await g.listEntities("phenotype");
  let n = 0;
  for (const t of terms) {
    if (t.props?.ancestors && t.props?.annotated_diseases) continue; // ya enriquecido
    const [info, ancestors] = await Promise.all([
      getJSON<Json>(`${TERMS}/${t.canonical_id}`).catch(() => null),
      getJSON<Json[]>(`${TERMS}/${t.canonical_id}/ancestors`).catch(() => []),
    ]);
    const anc = [];
    for (const a of (ancestors ?? []).filter((x) => !STOP.has(x.id))) anc.push({ id: a.id, name: a.name, name_es: es(a), n: await annotated(a.id) });
    const id = await g.upsertEntity({
      type: "phenotype", canonicalId: t.canonical_id, name: info?.name ?? t.name,
      props: {
        name_es: es(info), definition: info?.definition ?? "", synonyms: (info?.synonyms ?? []).slice(0, 8),
        annotated_diseases: await annotated(t.canonical_id), hpo_total_diseases: totalDiseases || null,
        ancestors: anc, hpo_url: `https://hpo.jax.org/browse/term/${t.canonical_id}`,
      },
    });
    for (const s of (info?.synonyms ?? []).slice(0, 8)) await g.addAlias(id, s);
    if (es(info)) await g.addAlias(id, es(info)!, "es");
    if (++n % 25 === 0) console.log(`    hpo ${n}/${terms.length} (${annotCache.size} términos con conteo)`);
    await sleep(80);
  }
  await g.markSynced("hpo");
}
