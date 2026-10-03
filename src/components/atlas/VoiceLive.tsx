"use client";
/** Live ElevenLabs session (loaded on demand). Status: idle → connecting → listening / speaking → ended. */
import { useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { AUDIENCE_META } from "./lines";
import { MicIcon, StopIcon } from "./Icons";
import type { VoiceProps } from "./VoiceAgent";

export default function VoiceLive(props: VoiceProps) {
  return (
    <ConversationProvider>
      <Session {...props} />
    </ConversationProvider>
  );
}

function Session({ agentId, audience, disease, lang, copy }: VoiceProps) {
  const [caption, setCaption] = useState<{ who: "user" | "agent"; text: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { status, isSpeaking, startSession, endSession, sendContextualUpdate } = useConversation({
    onMessage: (m) => setCaption({ who: m.role === "user" ? "user" : "agent", text: m.message }),
    onError: () => setProblem(copy.voice.error),
  });
  const aud = AUDIENCE_META[audience];
  const live = status === "connected";
  const busy = status === "connecting";
  const agent = copy.audiences[audience].agent;

  // Tell a running agent when the map switches disease.
  const lastOrpha = useRef(disease.orpha);
  useEffect(() => {
    if (live && lastOrpha.current !== disease.orpha) sendContextualUpdate(`The user is now viewing ${disease.name} (${disease.orpha}) in the atlas.`);
    lastOrpha.current = disease.orpha;
  }, [disease.orpha, disease.name, live, sendContextualUpdate]);

  async function start() {
    setProblem(null);
    setCaption(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setProblem(copy.voice.micDenied);
      return;
    }
    startSession({
      agentId,
      dynamicVariables: { disease_orpha: disease.orpha, disease_name: disease.name, locale: lang, audience },
    });
  }

  const label = busy ? copy.voice.connecting : live ? (isSpeaking ? copy.voice.speaking : copy.voice.listening) : problem ?? copy.voice.idle;

  return (
    <>
      <button type="button" onClick={live || busy ? () => endSession() : start} aria-pressed={live}
        aria-label={live || busy ? copy.voice.end : copy.voice.start}
        className={`grid size-14 shrink-0 place-items-center rounded-full transition-colors duration-200 ${live ? `${aud.bg} text-on-ink` : "bg-ink text-on-ink hover:bg-ink-2"}`}>
        {live || busy ? <StopIcon size={22} /> : <MicIcon size={22} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`font-display text-base font-bold ${aud.text}`}>{copy.voice.title(agent)}</p>
        <p className="flex items-center gap-2 text-sm text-ink-2" role="status">
          {(live || busy) && (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><circle cx="5" cy="5" r="4" fill={busy ? "var(--gap)" : isSpeaking ? aud.stroke : "var(--ink)"} /></svg>
          )}
          {label}
        </p>
        {caption && live && (
          <p className="mt-1 line-clamp-2 text-xs text-ink-3"><span className="font-bold">{caption.who === "user" ? copy.voice.you : copy.voice.agent}:</span> {caption.text}</p>
        )}
      </div>
      {(live || busy) && (
        <button type="button" onClick={() => endSession()} className="btn btn-ghost shrink-0 !min-h-11 !px-4 text-sm">{copy.voice.end}</button>
      )}
    </>
  );
}
