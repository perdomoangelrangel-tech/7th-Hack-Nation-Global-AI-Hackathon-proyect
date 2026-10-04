/**
 * The honest answer when a family asks about a disease the atlas cannot route: say so, show what was
 * checked (sources + counts), what evidence would change the answer, and the next question to test.
 */
import { ANALYSIS_LABEL, diseasesOf, isAnalysisSource, nameOf, tr, type GraphIndex, type Locale } from "./graph";
import { DISCLAIMER, type JourneyV2, type NoneFound } from "./build";

export interface NoRouteAnswer {
  version: 2;
  kind: "no_route";
  query: string;
  no_route: NoneFound;
  coverage: { sources: { id: string; name: string; last_synced_at: string | null }[]; counts: { atlas_diseases: number; entities: number; edges: number; evidence: number } };
  /** Diseases the atlas does cover, so the family can see the boundary of the search. */
  atlas_diseases: { id: string; name: string }[];
  disclaimer: string;
}

export function noRouteForQuery(g: GraphIndex, query: string, l: Locale = "en"): NoRouteAnswer {
  const q = query.trim().slice(0, 120);
  const sources = Object.values(g.snap.sources).filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => (isAnalysisSource(s.id) ? { ...s, name: ANALYSIS_LABEL[l] } : s));
  const ds = diseasesOf(g);
  return {
    version: 2, kind: "no_route", query: q,
    no_route: {
      title: tr(l, `No supported route for “${q}” yet`, `Aún no hay una ruta respaldada para “${q}”`),
      detail: tr(l,
        `“${q}” is not one of the ${ds.length} diseases in this atlas slice, so we cannot show a shared mechanism, a reusable study or a collaborator without inventing one. We searched names and synonyms across ${sources.map((s) => s.name).join(", ")}.`,
        `“${q}” no es una de las ${ds.length} enfermedades de este corte del atlas, así que no podemos mostrar un mecanismo compartido, un estudio reutilizable ni un colaborador sin inventarlo. Buscamos nombres y sinónimos en ${sources.map((s) => s.name).join(", ")}.`),
      missing_evidence: [
        tr(l, "An Orphanet code (ORPHA) for the disease, so it can be ingested with its symptoms (HPO).", "Un código Orphanet (ORPHA) de la enfermedad, para ingerirla con sus síntomas (HPO)."),
        tr(l, "The causal gene, so pathways (Reactome) and variant effects (ClinVar) can be compared.", "El gen causal, para comparar vías (Reactome) y efectos de variante (ClinVar)."),
        tr(l, "Studies (ClinicalTrials.gov) and patient organizations that name it.", "Estudios (ClinicalTrials.gov) y organizaciones de pacientes que la nombren."),
      ],
      next_question: tr(l, "Which gene and which symptoms define your community's diagnosis? With those two, the atlas can test whether any of its diseases shares a mechanism.", "¿Qué gen y qué síntomas definen el diagnóstico de su comunidad? Con esos dos datos el atlas puede probar si alguna de sus enfermedades comparte mecanismo."),
    },
    coverage: {
      sources: sources.map((s) => ({ id: s.id, name: s.name, last_synced_at: s.last_synced_at })),
      counts: { atlas_diseases: ds.length, entities: g.snap.entities.length, edges: g.snap.edges.length, evidence: g.snap.edges.reduce((n, e) => n + e.evidence.length, 0) },
    },
    atlas_diseases: ds.map((d) => ({ id: d.id, name: nameOf(d, l) })),
    disclaimer: DISCLAIMER[l],
  };
}

export const isNoRoute = (j: JourneyV2 | NoRouteAnswer | null): j is NoRouteAnswer => !!j && "kind" in j && j.kind === "no_route";
