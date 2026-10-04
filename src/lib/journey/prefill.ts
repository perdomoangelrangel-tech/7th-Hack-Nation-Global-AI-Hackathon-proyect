/**
 * Prefills a co-creation draft from the current journey: the disease, the lead neighbor, the reusable
 * asset, the collaborator and the edges that back them. The text says plainly that it is a draft.
 */
import type { JourneyV2 } from "./build";
import type { ProposalKind } from "./proposals";
import { tr } from "./graph";

export interface Draft { kind: ProposalKind; title: string; body: string; entities: string[]; edges: string[] }

export function prefillDraft(kind: ProposalKind, j: JourneyV2, extraEdges: string[] = []): Draft {
  const l = j.locale;
  const d = j.disease;
  const nb = j.connections.neighbors[0];
  const steps = j.next.steps;
  const connect = steps.find((s) => s.kind === "connect");
  const reuse = steps.find((s) => s.kind === "reuse");
  const asset = j.assets.own.find((a) => a.shared_with.length) ?? j.assets.reusable[0] ?? j.assets.own[0];
  const partner = j.people.collaborators.find((c) => c.kind === "patient_org" && nb && c.diseases.some((x) => x.id === nb.disease)) ?? j.people.collaborators.find((c) => c.bridges);
  const ownOrg = j.people.collaborators.find((c) => c.kind === "patient_org" && c.diseases.some((x) => x.id === d.id));
  const uniq = (xs: (string | undefined | null)[]) => [...new Set(xs.filter((x): x is string => !!x))];

  if (kind === "hypothesis") {
    const symptoms = nb?.shared.phenotypes.slice(0, 4).map((p) => p.name).join(", ");
    return {
      kind,
      title: nb ? tr(l, `${d.name} and ${nb.name} may respond to a shared strategy`, `${d.name} y ${nb.name} podrían responder a una estrategia compartida`) : tr(l, `A testable question about ${d.name}`, `Una pregunta comprobable sobre ${d.name}`),
      body: nb
        ? tr(l,
          `Community hypothesis (a draft, not evidence): ${d.name} and ${nb.name} share ${symptoms}. The atlas links them by inference (${nb.strength.label}).\n\nWhat would test it: an expert review of whether the shared symptoms reflect a shared mechanism${nb.variant_effect.match === false ? " — note the variant effects differ" : ""}.\n\nWhat must be checked first: ${nb.needs_review.join(" ")}`,
          `Hipótesis de la comunidad (borrador, no evidencia): ${d.name} y ${nb.name} comparten ${symptoms}. El atlas las relaciona por inferencia (${nb.strength.label}).\n\nQué la pondría a prueba: una revisión experta de si los síntomas compartidos reflejan un mecanismo compartido${nb.variant_effect.match === false ? " — ojo: el efecto de variante es distinto" : ""}.\n\nQué revisar primero: ${nb.needs_review.join(" ")}`)
        : tr(l, `Community hypothesis (a draft, not evidence) about ${d.name}: `, `Hipótesis de la comunidad (borrador, no evidencia) sobre ${d.name}: `),
      entities: uniq([d.id, nb?.disease]),
      edges: uniq([nb?.edge, ...extraEdges]),
    };
  }
  if (kind === "collaboration") {
    const who = [ownOrg?.name, partner?.name].filter(Boolean).join(" × ");
    return {
      kind,
      title: tr(l, `Collaboration proposal: ${who || d.name}${asset ? ` around ${asset.nct}` : ""}`, `Propuesta de colaboración: ${who || d.name}${asset ? ` en torno a ${asset.nct}` : ""}`),
      body: tr(l,
        `Proposed collaboration (a draft, not evidence).\n\nWhat we share: ${nb ? `${d.name} and ${nb.name} share ${nb.shared.phenotypes.slice(0, 3).map((p) => p.name).join(", ")} (inferred).` : `—`}\n${asset ? `What already exists: ${asset.nct} — ${asset.title} (${asset.status.replace(/_/g, " ").toLowerCase()}).\n` : ""}What we ask: ${[connect?.title, reuse?.title].filter(Boolean).join("; ") || "a first conversation"}.\nWhat must be checked first: eligibility and biology by an expert.`,
        `Colaboración propuesta (borrador, no evidencia).\n\nQué compartimos: ${nb ? `${d.name} y ${nb.name} comparten ${nb.shared.phenotypes.slice(0, 3).map((p) => p.name).join(", ")} (inferido).` : `—`}\n${asset ? `Qué existe ya: ${asset.nct} — ${asset.title} (${asset.status.replace(/_/g, " ").toLowerCase()}).\n` : ""}Qué pedimos: ${[connect?.title, reuse?.title].filter(Boolean).join("; ") || "una primera conversación"}.\nQué revisar primero: elegibilidad y biología, por un experto.`),
      entities: uniq([d.id, nb?.disease, ownOrg?.id, partner?.id, asset?.id]),
      edges: uniq([...(connect?.cite.edges ?? []), ...(reuse?.cite.edges ?? []), ...(asset?.cite.edges ?? []), ...(ownOrg?.cite.edges ?? []), ...extraEdges]).slice(0, 100),
    };
  }
  const gap = j.gaps[0];
  return {
    kind,
    title: gap ? tr(l, `Missing evidence for ${d.name}: ${gap.title}`, `Evidencia que falta para ${d.name}: ${gap.title}`) : tr(l, `Missing evidence for ${d.name}`, `Evidencia que falta para ${d.name}`),
    body: tr(l,
      `Evidence contribution (a draft until an expert reviews it).\n\n${gap ? `Gap: ${gap.title}\nWhat would change it: ${gap.what_would_change_it}\n\n` : ""}What we can add (source, link or description): `,
      `Aporte de evidencia (borrador hasta que lo revise un experto).\n\n${gap ? `Hueco: ${gap.title}\nQué lo cambiaría: ${gap.what_would_change_it}\n\n` : ""}Qué podemos aportar (fuente, enlace o descripción): `),
    entities: [d.id],
    edges: uniq(extraEdges),
  };
}
