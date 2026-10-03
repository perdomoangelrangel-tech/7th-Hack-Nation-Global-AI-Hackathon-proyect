"use client";
/**
 * Live voice conversation with the persona's ElevenLabs agent ("Talk to Nexmed").
 * OWNER: voice lane. Mounted by AtlasApp (explorer lane) — keep this props contract stable.
 */
import type { PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";

export interface VoiceDockProps { persona: PersonaId; locale: Locale; disease: string | null; diseaseName?: string }

export function VoiceDock(props: VoiceDockProps) {
  void props; // TODO(voice lane): ElevenLabs conversational agent per persona + transcript/captions.
  return null;
}
