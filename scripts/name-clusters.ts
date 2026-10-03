/**
 * "Built with OpenAI · Explain": nombra cada cluster en lenguaje claro (EN/ES) a partir SOLO de sus vías
 * y síntomas compartidos. El nombre técnico (vía Reactome) se conserva como base verificable.
 * Sin OPENAI_API_KEY no hace nada: la UI usa el nombre técnico.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true }); // misma clave que usa Next (.env.local)
import OpenAI from "openai";
import { FileGraph } from "./ingest/graph";

const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

async function main() {
  if (!process.env.OPENAI_API_KEY) { console.log("· name-clusters: sin OPENAI_API_KEY, se mantienen los nombres técnicos"); return; }
  const g = new FileGraph("data/atlas.json");
  const A = g.data.analytics; if (!A) throw new Error("Corre primero npm run analyze");
  const byId = new Map(g.allEntities().map((e) => [e.id, e]));
  const client = new OpenAI();
  for (const c of A.clusters) {
    const input = JSON.stringify({
      diseases: c.diseases.map((d) => byId.get(d)?.name),
      shared_pathways: c.shared_pathways.map((p) => p.name),
      shared_symptoms: c.shared_phenotypes.map((p) => p.name),
    });
    const r = await client.responses.create({
      model: MODEL,
      instructions: "Name this cluster of rare diseases for a patient-group leader with no science background. Use ONLY the pathways and symptoms given; do not add biology that is not in the input. 2-5 words, no disease names. Return English and Spanish.",
      input,
      ...(/^(gpt-5|gpt-6|o\d)/.test(MODEL) ? { reasoning: { effort: "low" as const } } : {}),
      text: { format: { type: "json_schema", name: "cluster_name", strict: true, schema: { type: "object", additionalProperties: false, required: ["en", "es"], properties: { en: { type: "string" }, es: { type: "string" } } } } },
    });
    const names = JSON.parse(r.output_text) as { en: string; es: string };
    (c as typeof c & { label_plain?: { en: string; es: string }; label_model?: string }).label_plain = names;
    (c as typeof c & { label_model?: string }).label_model = MODEL;
    console.log(`  ${c.id} · ${c.label} → ${names.en} / ${names.es}`);
  }
  await g.save();
}

main().catch((e) => { console.error(e); process.exit(1); });
