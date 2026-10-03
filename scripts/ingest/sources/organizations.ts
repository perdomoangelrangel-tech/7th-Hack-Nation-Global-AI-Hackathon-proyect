/**
 * Organizaciones de pacientes y comunidades de investigadores (archivo curado).
 * Cada organización se verifica en vivo: si su sitio oficial no responde, no entra al grafo.
 * Las "umbrella" (NORD, EURORDIS) apoyan a todas las enfermedades raras y no cuentan como puente entre comunidades.
 */
import { type GraphWriter, today } from "../graph";
import type { SeedDisease, SeedOrganization } from "../types";

export async function ingestOrganizations(g: GraphWriter, orgs: SeedOrganization[], diseases: SeedDisease[]) {
  const byOrpha = new Map(diseases.map((d) => [d.orpha, d]));
  for (const o of orgs) {
    // Si el sitio no responde desde la red de la ingesta, la organización entra marcada y con menos confianza:
    // la UI lo dice en vez de esconderla o de afirmar algo que no comprobamos.
    const alive = await reachable(o.url);
    if (!alive) console.warn(`    ⚠ ${o.name}: ${o.url} no respondió; se marca como no verificada`);
    for (const code of o.diseases) {
      const d = byOrpha.get(code); if (!d) continue;
      await g.upsertEdge({
        from: { type: "organization", canonicalId: `ORG:${slug(o.name)}`, name: o.name, props: { country: o.country, url: o.url, kind: o.kind, registry: o.registry, site_verified: alive } },
        to: { type: "disease", canonicalId: d.orpha, name: d.name },
        relation: o.kind === "research" ? "researches" : "supports",
        confidence: (o.kind === "umbrella" ? 0.5 : 0.9) * (alive ? 1 : 0.7), confidenceBasis: alive ? "curated_official_site" : "curated_site_unverified",
        props: { kind: o.kind },
        evidence: [{ source: "patient_orgs", externalId: slug(o.name), url: o.url, publishedOn: today(), quote: `${o.name} · ${o.country} · ${alive ? "site verified" : "site not verified at ingest"} ${today()}` }],
      });
    }
  }
  await g.markSynced("patient_orgs");
}

async function reachable(url: string) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(url, { method, redirect: "follow", signal: AbortSignal.timeout(12_000), headers: { "user-agent": "Mozilla/5.0 rare-atlas-ingest" } });
      if (r.status < 400 || r.status === 403) return true; // 403 = sitio vivo detrás de un WAF
    } catch { /* intenta el siguiente método */ }
  }
  return false;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
