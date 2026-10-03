/**
 * Public ElevenLabs conversational agent ids, one per Nexmed mode. OWNER: voice lane.
 * Agents are public (no signed URL needed), so their ids are safe in the browser.
 * Env `NEXT_PUBLIC_ELEVENLABS_AGENT_*` overrides the defaults (configured via the ElevenLabs MCP on 2026-10-03,
 * all tagged `nedamex`): LLM gpt-4o-mini (OpenAI inside ElevenLabs), TTS eleven_flash_v2, server tools nexmed_*.
 * Each agent expects these dynamic variables at session start: disease_name, disease_id, persona, locale.
 */
import type { PersonaId } from "../agents/profiles";

export const DEFAULT_AGENTS: Record<PersonaId, string> = {
  devon: "agent_9301m41nb4xre85a4scph5fpbe2q", // Nexmed · Patient Guide
  maria: "agent_9801m420vwjcf5ctav4x33asvd2w", // Nexmed · Family & Patient-Group Navigator
  osei: "agent_2301m41nbtczeshvbyxaaknksgga",  // Nexmed · Research Analyst
  priya: "agent_6001m41nbk5redqsx3hj321mb4my", // Nexmed · Pharma Scout
};

export const AGENT_NAMES: Record<PersonaId, string> = {
  devon: "Nexmed · Patient Guide",
  maria: "Nexmed · Family & Patient-Group Navigator",
  osei: "Nexmed · Research Analyst",
  priya: "Nexmed · Pharma Scout",
};

const valid = (v: string | undefined) => (v && /^agent_[a-z0-9]{20,}$/i.test(v.trim()) ? v.trim() : undefined);

/** Env names must be written literally so Next inlines them in client bundles. "off" disables an agent. */
export function agentIds(): Record<PersonaId, string | null> {
  const env: Record<PersonaId, string | undefined> = {
    devon: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_PATIENT,
    maria: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_FAMILY,
    osei: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_RESEARCHER,
    priya: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_PHARMA,
  };
  const out = {} as Record<PersonaId, string | null>;
  for (const p of Object.keys(DEFAULT_AGENTS) as PersonaId[]) {
    out[p] = env[p]?.trim() === "off" ? null : valid(env[p]) ?? DEFAULT_AGENTS[p];
  }
  return out;
}

/** Dynamic variables every Nexmed agent's prompt references (missing ones make the session fail). */
export function agentVariables(o: { persona: PersonaId; locale: string; disease: string | null; diseaseName?: string }) {
  return {
    persona: o.persona,
    locale: o.locale,
    disease_id: o.disease ?? "",
    disease_name: o.diseaseName ?? (o.disease ? o.disease : "a rare disease"),
  };
}
