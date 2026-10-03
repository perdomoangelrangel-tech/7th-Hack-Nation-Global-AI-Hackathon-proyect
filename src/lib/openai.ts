/**
 * Cliente de OpenAI. Una sola clave (OPENAI_API_KEY) cubre:
 *   - Explicar: convertir un camino del grafo en lenguaje claro, citando cada paso (Responses API + Structured Outputs)
 *   - Voz: leer esa explicación con la personalidad de cada perfil (gpt-4o-mini-tts)
 *   - Extraer (scripts/extract.ts): relaciones y activos desde abstracts citados
 * Sin clave todo sigue funcionando con plantillas deterministas y la voz del navegador.
 */
import "server-only";
import OpenAI from "openai";

export const TEXT_MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";
export const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";

let client: OpenAI | null | undefined;
export function openai(): OpenAI | null {
  if (client !== undefined) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  client = apiKey ? new OpenAI({ apiKey, timeout: 45_000, maxRetries: 1 }) : null;
  return client;
}

/** Los modelos de razonamiento aceptan `reasoning.effort`; los anteriores (gpt-4o, gpt-4.1) lo rechazan. */
const supportsReasoning = (m: string) => /^(gpt-5|gpt-6|o\d)/.test(m);

/** Respuesta en JSON validado por esquema (strict). Devuelve null si no hay clave o si el modelo falla. */
export async function structured<T>(opts: { name: string; system: string; input: string; schema: Record<string, unknown> }): Promise<T | null> {
  const c = openai(); if (!c) return null;
  try {
    const r = await c.responses.create({
      model: TEXT_MODEL,
      instructions: opts.system,
      input: opts.input,
      ...(supportsReasoning(TEXT_MODEL) ? { reasoning: { effort: "low" as const } } : {}),
      text: { format: { type: "json_schema", name: opts.name, schema: opts.schema, strict: true } },
    });
    return JSON.parse(r.output_text) as T;
  } catch (e) {
    console.error(`[openai] ${opts.name}:`, (e as Error).message);
    return null;
  }
}
