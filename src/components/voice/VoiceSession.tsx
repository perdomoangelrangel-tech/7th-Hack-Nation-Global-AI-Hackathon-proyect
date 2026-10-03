"use client";
/**
 * Live ElevenLabs conversation (loaded on demand by VoiceDock). OWNER: voice lane.
 * Status: connecting → listening / speaking → ended. Sends the focused disease as dynamic variables
 * and as a contextual update when the user switches disease mid-call.
 */
import { useEffect, useRef } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import type { PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";
import { agentVariables } from "@/lib/voice/agents";
import type { VoiceCopy } from "@/lib/voice/copy";

export interface Line { who: "user" | "agent"; text: string; id: number }
export type LiveState = "connecting" | "listening" | "speaking" | "ended" | "error";

export interface VoiceSessionProps {
  agentId: string; persona: PersonaId; locale: Locale; disease: string | null; diseaseName?: string;
  copy: VoiceCopy;
  onState: (s: LiveState, problem?: string) => void;
  onLine: (l: Line) => void;
  /** Bumped by the dock to end the call. */
  endSignal: number;
  muted: boolean;
}

export default function VoiceSession(props: VoiceSessionProps) {
  return (
    <ConversationProvider>
      <Session {...props} />
    </ConversationProvider>
  );
}

function Session({ agentId, persona, locale, disease, diseaseName, copy, onState, onLine, endSignal, muted }: VoiceSessionProps) {
  const lineId = useRef(0);
  const started = useRef(false);
  const { status, isSpeaking, startSession, endSession, sendContextualUpdate, setMuted } = useConversation({
    onMessage: (m) => { if (m.message?.trim()) onLine({ who: m.role === "user" ? "user" : "agent", text: m.message, id: ++lineId.current }); },
    onError: () => onState("error", copy.error),
  });

  // Start once on mount (the dock mounts us from the user's click, after mic permission).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startSession({ agentId, connectionType: "webrtc", dynamicVariables: agentVariables({ persona, locale, disease, diseaseName }) });
    return () => { started.current = false; endSession(); }; // StrictMode remount starts a fresh session
    // Disease changes go through sendContextualUpdate below, not a restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSession, endSession, agentId]);

  // "disconnected" is also the status before the session starts: only report "ended" after we were live.
  const wasLive = useRef(false);
  useEffect(() => {
    if (status === "connecting") { wasLive.current = true; onState("connecting"); }
    else if (status === "connected") { wasLive.current = true; onState(isSpeaking ? "speaking" : "listening"); }
    else if (status === "disconnected" && wasLive.current) onState("ended");
    else if (status === "error") onState("error", copy.error);
  }, [status, isSpeaking, onState, copy.error]);

  useEffect(() => { if (status === "connected") setMuted(muted); }, [muted, status, setMuted]);

  // Tell a running agent when the atlas switches disease.
  const lastDisease = useRef(disease);
  useEffect(() => {
    if (status === "connected" && lastDisease.current !== disease && disease) {
      sendContextualUpdate(`The user is now viewing ${diseaseName ?? disease} (id ${disease}) in the Nexmed atlas. Use it as the default disease.`);
    }
    lastDisease.current = disease;
  }, [disease, diseaseName, status, sendContextualUpdate]);

  const firstEnd = useRef(endSignal);
  useEffect(() => { if (endSignal !== firstEnd.current) endSession(); }, [endSignal, endSession]);

  return null;
}
