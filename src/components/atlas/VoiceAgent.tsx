"use client";
/**
 * Voice agent card. The ElevenLabs SDK only loads when the audience has an agent id configured
 * (site.elevenlabs[audience]); otherwise a disabled mic says the agent is coming online.
 * The microphone permission is requested only when the person presses Start.
 */
import dynamic from "next/dynamic";
import { site } from "@/lib/site";
import type { Lang } from "@/lib/i18n";
import type { AtlasCopy } from "./copy";
import { AUDIENCE_META, type Audience } from "./lines";
import { MicIcon } from "./Icons";

export interface VoiceProps {
  agentId: string;
  audience: Audience;
  disease: { orpha: string; name: string };
  lang: Lang;
  copy: AtlasCopy;
}

const VoiceLive = dynamic(() => import("./VoiceLive"), { ssr: false, loading: () => null });

export function VoiceAgent({ audience, disease, lang, copy }: Omit<VoiceProps, "agentId">) {
  const agentId = site.elevenlabs[audience];
  const agent = copy.audiences[audience].agent;
  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-rule bg-panel p-4">
      {agentId ? (
        <VoiceLive key={agentId} agentId={agentId} audience={audience} disease={disease} lang={lang} copy={copy} />
      ) : (
        <>
          <button type="button" disabled aria-disabled className="grid size-14 shrink-0 cursor-not-allowed place-items-center rounded-full border-2 border-dashed border-gap text-ink-3">
            <MicIcon size={22} />
            <span className="sr-only">{copy.voice.offline}</span>
          </button>
          <div className="min-w-0">
            <p className={`font-display text-base font-bold ${AUDIENCE_META[audience].text}`}>{copy.voice.title(agent)}</p>
            <p className="text-sm text-ink-2">{copy.voice.offline}</p>
            <p className="text-xs text-ink-3">{copy.voice.offlineHint}</p>
          </div>
        </>
      )}
    </div>
  );
}
