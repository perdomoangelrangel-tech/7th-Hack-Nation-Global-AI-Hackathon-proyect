"use client";
/** Landing preview of the Blender voice agent and its states (no audio, no AI call — a visual preview). */
import { useCallback, useState } from "react";
import { AgentOrb, type AgentState } from "@/components/three/AgentOrb";
import { site } from "@/lib/site";

const STATES: { id: AgentState; label: string; caption: string }[] = [
  { id: "idle", label: "Ready", caption: "Waiting for your question." },
  { id: "listening", label: "Listening", caption: "Leans in while you speak; the petals follow your voice." },
  { id: "thinking", label: "Checking sources", caption: "Looks things up in the graph before it says anything." },
  { id: "speaking", label: "Speaking", caption: "Answers out loud — only what the graph supports." },
];

export function GuidePreview() {
  const [state, setState] = useState<AgentState>("idle");
  const [shown, setShown] = useState(true);
  // Synthetic level so the preview moves like a voice (real app: ElevenLabs output / input volume).
  const getLevel = useCallback(() => {
    const t = performance.now() / 1000;
    return Math.max(0, 0.45 + 0.35 * Math.sin(t * 7.3) * Math.sin(t * 2.1) + 0.2 * Math.sin(t * 13.7));
  }, []);
  const current = STATES.find((s) => s.id === state)!;
  return (
    <div className="card grid items-center gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-8">
      <div className="mx-auto grid place-items-center rounded-full bg-paper p-2 shadow-[var(--shadow-soft)]" style={{ width: 232, height: 232 }}>
        <AgentOrb state={shown ? state : "hidden"} size={216} getLevel={getLevel} label={`${site.name} voice guide, ${shown ? current.label.toLowerCase() : "hidden"}`} />
      </div>
      <div>
        <div role="radiogroup" aria-label="Preview a state" className="flex flex-wrap gap-2">
          {STATES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={shown && state === s.id}
              onClick={() => { setShown(true); setState(s.id); }}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${shown && state === s.id ? "border-brand-deep bg-brand-deep text-white" : "border-line bg-paper text-ink-2 hover:border-brand hover:text-brand-ink"}`}
            >
              {s.label}
            </button>
          ))}
          <button type="button" onClick={() => setShown((v) => !v)} className="rounded-full border border-dashed border-line px-3.5 py-1.5 text-sm text-ink-3 hover:border-brand hover:text-brand-ink">
            {shown ? "Dismiss" : "Call the guide"}
          </button>
        </div>
        <p className="mt-4 text-ink-2" aria-live="polite">{shown ? current.caption : "The guide appears whenever an agent starts talking."}</p>
        <p className="mt-2 text-xs text-ink-3">Visual preview only — no audio here. Modelled and animated in Blender.</p>
      </div>
    </div>
  );
}
