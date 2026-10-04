/**
 * "Draft an intro message" for a suggested partner: a templated, sourced proposal — what we share
 * (with numbered sources), what already exists, what we ask, and what must be checked first.
 * No invented facts: every sentence is built from the journey / match payloads.
 */
import type { JourneyV2 } from "./build";
import type { Partner } from "./match";
import { tr } from "./graph";

export interface IntroDraft { subject: string; body: string; sources: { n: number; label: string; url: string }[]; edges: string[] }

export function draftIntro(j: JourneyV2, p: Partner): IntroDraft {
  const l = j.locale;
  const d = j.disease.name;
  const sources: IntroDraft["sources"] = [];
  const ref = (s: { label: string; url: string }) => {
    let hit = sources.find((x) => x.url === s.url);
    if (!hit) { hit = { n: sources.length + 1, ...s }; sources.push(hit); }
    return `[${hit.n}]`;
  };
  const shareLines = p.reasons.slice(0, 3).map((r) => `- ${r.text} ${r.sources.map(ref).join("")}`.trim());
  const ownOrg = j.people.collaborators.find((c) => c.kind === "patient_org" && c.diseases.some((x) => x.id === j.disease.id));
  const asset = j.assets.own.find((a) => a.shared_with.length) ?? j.assets.reusable[0];
  const assetLine = asset ? `${asset.nct} — ${asset.title} ${ref({ label: asset.nct, url: asset.url })}` : null;
  // The caveat that matters is the one for the neighbor this partner works on, not the strongest neighbor overall.
  const nb = j.connections.neighbors.find((n) => p.diseases.some((x) => x.id === n.disease)) ?? j.connections.neighbors[0];
  const review = nb?.needs_review ?? [];
  const ask = p.kind === "patient_org"
    ? tr(l, "a first call between our two communities to compare what we each collect and whether a shared registry or study visit makes sense", "una primera llamada entre nuestras dos comunidades para comparar lo que cada una recoge y si tiene sentido un registro o visita de estudio compartidos")
    : p.kind === "investigator"
      ? tr(l, `your expert view on whether the link between ${d} and the diseases you work on is a shared mechanism or only shared symptoms`, `su opinión experta sobre si el vínculo entre ${d} y las enfermedades en las que trabaja es un mecanismo compartido o solo síntomas compartidos`)
      : tr(l, `whether ${d} families could be included in, or learn from, the studies you already run`, `si familias con ${d} podrían incluirse en los estudios que ya realizan, o aprender de ellos`);

  const body = tr(l,
    `Dear ${p.name},\n\nI am writing on behalf of ${ownOrg ? ownOrg.name : `a patient community for ${d}`}. A sourced evidence atlas (Nexmed) suggested we contact you, for these reasons:\n${shareLines.join("\n")}\n${assetLine ? `\nWhat already exists: ${assetLine}\n` : ""}\nWhat we ask: ${ask}.\n\nWhat must be checked first: ${review.join(" ") || "the connection above is computed, not established."}\n\nSources:\n${sources.map((s) => `[${s.n}] ${s.label} — ${s.url}`).join("\n")}\n\nThis is not medical advice; inferred links are hypotheses for experts to test.\n`,
    `Estimado/a ${p.name}:\n\nLe escribo en nombre de ${ownOrg ? ownOrg.name : `una comunidad de pacientes de ${d}`}. Un atlas de evidencia con fuentes (Nexmed) sugirió contactarle, por estas razones:\n${shareLines.join("\n")}\n${assetLine ? `\nQué existe ya: ${assetLine}\n` : ""}\nQué pedimos: ${ask}.\n\nQué revisar primero: ${review.join(" ") || "la conexión anterior es calculada, no establecida."}\n\nFuentes:\n${sources.map((s) => `[${s.n}] ${s.label} — ${s.url}`).join("\n")}\n\nNo es consejo médico; las conexiones inferidas son hipótesis para que las prueben expertos.\n`);
  return {
    subject: tr(l, `${d} community × ${p.name}: a sourced question`, `Comunidad de ${d} × ${p.name}: una pregunta con fuentes`),
    body, sources, edges: p.cite.edges,
  };
}
