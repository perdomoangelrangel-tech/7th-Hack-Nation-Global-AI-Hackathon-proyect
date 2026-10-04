/**
 * The 10× view: milestone "launch a shared natural-history study", typical route vs Nedamex route.
 * Every duration is an ASSUMPTION with its rationale (no source measures these times for this disease).
 * Nedamex only shortens discovery (who shares our mechanism, what exists, who bridges us); it does not
 * shorten protocol, ethics or recruitment — the view says so instead of inflating the gain.
 */
import type { JourneyV2 } from "./build";
import { tr, type Cite } from "./graph";

export interface Span { min: number; max: number; rationale: string }   // weeks
export interface Phase {
  id: "neighbors" | "assets" | "partner" | "protocol";
  label: string;
  discovery: boolean;
  typical: Span;
  nexmed: Span & { what: string; cite: Cite | null };
}
export interface TenX {
  milestone: string;
  phases: Phase[];
  discovery: { typical: [number, number]; nexmed: [number, number]; ratio: [number, number] };
  total: { typical: [number, number]; nexmed: [number, number] };
  validate_next: string[];
  assumption_note: string;
}

export function tenX(j: JourneyV2): TenX {
  const l = j.locale;
  const d = j.disease.name;
  const nb = j.connections.neighbors[0];
  const shared = j.assets.own.find((a) => a.shared_with.length && a.active);
  const reuse = j.assets.reusable.find((a) => a.active) ?? j.assets.reusable[0];
  const asset = shared ?? reuse;
  const partner = j.people.collaborators.find((c) => c.bridges && c.kind === "investigator") ?? j.people.collaborators.find((c) => c.bridges) ?? j.people.collaborators[0];
  const A = (en: string, es: string) => tr(l, en, es);

  const phases: Phase[] = [
    {
      id: "neighbors", discovery: true,
      label: A("Find diseases that share our mechanism", "Encontrar enfermedades que comparten nuestro mecanismo"),
      typical: { min: 26, max: 52, rationale: A("Assumption: without a cross-disease map, families hear about related diagnoses through conferences, clinicians and case reports, one at a time.", "Supuesto: sin un mapa entre enfermedades, las familias conocen diagnósticos relacionados por congresos, clínicos y casos publicados, uno a la vez.") },
      nexmed: { min: 0.2, max: 1, what: nb ? A(`The atlas already links ${d} to ${nb.name} (inferred · ${nb.strength.label}).`, `El atlas ya relaciona ${d} con ${nb.name} (inferido · ${nb.strength.label}).`) : A("No supported neighbor — the atlas says so on day one.", "Sin vecina respaldada — el atlas lo dice el primer día."),
        rationale: A("Assumption: a search plus a week for an expert to sanity-check the inferred link.", "Supuesto: una búsqueda y una semana para que un experto revise el vínculo inferido."), cite: nb?.cite ?? null },
    },
    {
      id: "assets", discovery: true,
      label: A("Find studies and registries we could reuse", "Encontrar estudios y registros reutilizables"),
      typical: { min: 12, max: 26, rationale: A("Assumption: registry searches by hand across ClinicalTrials.gov and each neighbor community, then emails to learn who runs what.", "Supuesto: búsquedas a mano en ClinicalTrials.gov y en cada comunidad vecina, y correos para saber quién lleva qué.") },
      nexmed: { min: 1, max: 2, what: asset ? A(`${asset.nct}${shared ? ` already enrolls ${d} and ${shared.shared_with[0].name}` : ` (${asset.disease_name}) could be reused`}; eligibility is flagged for expert review.`, `${asset.nct}${shared ? ` ya incluye ${d} y ${shared.shared_with[0].name}` : ` (${asset.disease_name}) podría reutilizarse`}; la elegibilidad queda marcada para revisión experta.`) : A("No reusable study found — shown as a gap.", "Sin estudio reutilizable — se muestra como hueco."),
        rationale: A("Assumption: reading the cited records and confirming eligibility with the study team.", "Supuesto: leer los registros citados y confirmar la elegibilidad con el equipo del estudio."), cite: asset?.cite ?? null },
    },
    {
      id: "partner", discovery: true,
      label: A("Find a collaborator who bridges both communities", "Encontrar un colaborador que conecte ambas comunidades"),
      typical: { min: 12, max: 26, rationale: A("Assumption: warm introductions through clinicians and conferences, usually after the first two phases.", "Supuesto: presentaciones a través de clínicos y congresos, normalmente después de las dos primeras fases.") },
      nexmed: { min: 2, max: 4, what: partner ? A(`${partner.name}: ${partner.why}`, `${partner.name}: ${partner.why}`) : A("No bridging collaborator in our sources.", "Sin colaborador puente en nuestras fuentes."),
        rationale: A("Assumption: a sourced intro message and two to four weeks to get a reply.", "Supuesto: un mensaje de presentación con fuentes y de dos a cuatro semanas para una respuesta."), cite: partner?.cite ?? null },
    },
    {
      id: "protocol", discovery: false,
      label: A("Agree the protocol, ethics and first enrollment", "Acordar protocolo, ética y primera inscripción"),
      typical: { min: 26, max: 52, rationale: A("Assumption: protocol, consent, ethics review and site setup.", "Supuesto: protocolo, consentimiento, revisión ética y puesta en marcha del sitio.") },
      nexmed: shared
        ? { min: 8, max: 26, what: A(`Joining ${shared.nct}, which already enrolls ${d}, may avoid writing a new protocol.`, `Sumarse a ${shared.nct}, que ya incluye ${d}, puede evitar escribir un protocolo nuevo.`), rationale: A("Assumption: an amendment or enrollment in an existing study, if the team agrees. Must be validated with the study team.", "Supuesto: una enmienda o inscripción en un estudio existente, si el equipo acepta. Debe validarse con el equipo del estudio."), cite: shared.cite }
        : { min: 26, max: 52, what: A("Unchanged: Nedamex does not shorten ethics or protocol work.", "Sin cambio: Nedamex no acorta el trabajo ético ni de protocolo."), rationale: A("Same assumption as the typical route.", "Mismo supuesto que la ruta típica."), cite: null },
    },
  ];
  const sum = (ps: Phase[], k: "typical" | "nexmed") => [ps.reduce((s, p) => s + p[k].min, 0), ps.reduce((s, p) => s + p[k].max, 0)] as [number, number];
  const disc = phases.filter((p) => p.discovery);
  // Name the community the shared study already spans; otherwise the strongest neighbor.
  const with_ = shared?.shared_with[0]?.name ?? nb?.name ?? null;
  const dt = sum(disc, "typical"), dn = sum(disc, "nexmed");
  return {
    milestone: A(`Launch a shared natural-history study for ${d}${with_ ? ` with the ${with_} community` : ""}`, `Lanzar un estudio compartido de historia natural para ${d}${with_ ? ` con la comunidad de ${with_}` : ""}`),
    phases,
    discovery: { typical: dt, nexmed: dn, ratio: [Math.round(dt[0] / dn[0]), Math.round(dt[1] / dn[1])] },
    total: { typical: sum(phases, "typical"), nexmed: sum(phases, "nexmed") },
    validate_next: [
      ...(nb ? [A(`An expert confirms that ${d} and ${nb.name} share a mechanism, not only symptoms.`, `Un experto confirma que ${d} y ${nb.name} comparten mecanismo, no solo síntomas.`)] : []),
      ...(asset ? [A(`The ${asset.nct} team confirms eligibility and capacity for ${d} families.`, `El equipo de ${asset.nct} confirma elegibilidad y capacidad para familias con ${d}.`)] : []),
      A("Patient groups check these duration assumptions against their own experience.", "Los grupos de pacientes contrastan estos supuestos de duración con su propia experiencia."),
    ],
    assumption_note: A("All durations are assumptions (labeled, with rationale), not measured outcomes. Only the links and studies are sourced.", "Todas las duraciones son supuestos (etiquetados, con su razón), no resultados medidos. Solo los vínculos y estudios tienen fuente."),
  };
}
