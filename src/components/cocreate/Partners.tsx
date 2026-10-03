"use client";
/** Suggested partners (matchmaking, P1). Renders nothing until GET /api/match ships. */
import type { PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";
import type { JourneyV2 } from "@/lib/journey/build";
import type { Draft } from "@/lib/journey/prefill";

export function Partners(props: { persona: PersonaId; locale: Locale; disease: string; journey: JourneyV2; onPropose: (d: Partial<Draft>) => void }) {
  void props;
  return null;
}
