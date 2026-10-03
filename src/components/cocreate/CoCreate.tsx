"use client";
/**
 * Co-creation & matchmaking entry point ("Propose a hypothesis / collaboration").
 * OWNER: action lane. Mounted by AtlasApp (explorer lane) — keep this props contract stable.
 * Proposals are DRAFTS: never evidence, always rendered dashed and labeled "community draft".
 */
import type { PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";

export interface CoCreateProps { persona: PersonaId; locale: Locale; disease: string | null; diseaseName?: string; edgeIds?: string[] }

export function CoCreate(props: CoCreateProps) {
  void props; // TODO(action lane): propose dialog + matchmaking suggestions -> POST /api/proposals.
  return null;
}
