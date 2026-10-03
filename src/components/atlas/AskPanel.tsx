"use client";
/**
 * Ask the atlas: question → POST /api/ask → answer drawn as a route.
 * Sourced claims are solid stations with plaques; dropped claims are dashed gap stations;
 * next steps are transfer signs. Every answer ends with the disclaimer.
 */
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import type { EvidenceRef } from "@/lib/atlas-data";
import type { Lang } from "@/lib/i18n";
import type { AtlasCopy } from "./copy";
import { AUDIENCE_META, type Audience } from "./lines";
import { CitationChip, day } from "./Plaque";
import { ArrowIcon, ExternalIcon, SpeakerIcon, StopIcon } from "./Icons";
import styles from "./atlas.module.css";

export interface AskResponse {
  agent: string;
  mode: "demo" | "llm";
  source: "live" | "snapshot" | "none";
  conversation_id: string | null;
  disease: { orpha: string; name: string; name_es: string | null } | null;
  spoken: string;
  verified: boolean;
  dropped: { text: string; reason: string }[];
  claims: { text: string; citations: EvidenceRef[] }[];
  next_steps: { kind: string; label: string; ref?: string }[];
  retrieved_at: string;
}

type State = { kind: "idle" } | { kind: "loading"; question: string } | { kind: "error"; question: string } | { kind: "done"; question: string; answer: AskResponse };

export function AskPanel({ audience, disease, copy, lang, onNavigate, onShowDisease }: {
  audience: Audience;
  disease: { orpha: string; short: string };
  copy: AtlasCopy;
  lang: Lang;
  onNavigate: (anchor: string) => void;
  onShowDisease: (orpha: string) => void;
}) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [hint, setHint] = useState<string | null>(null);
  const conv = useRef<Partial<Record<Audience, string>>>({});
  const inflight = useRef<AbortController | null>(null);
  const aud = AUDIENCE_META[audience];

  async function ask(question: string) {
    const text = question.trim();
    if (text.length < 2) { setHint(copy.ask.tooShort); return; }
    setHint(null);
    setQ(text);
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    setState({ kind: "loading", question: text });
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({ question: text, audience, locale: lang, disease: disease.orpha, conversation_id: conv.current[audience] }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const answer = (await r.json()) as AskResponse;
      if (answer.conversation_id) conv.current[audience] = answer.conversation_id;
      setState({ kind: "done", question: text, answer });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setState({ kind: "error", question: text });
    }
  }

  const submit = (e: FormEvent) => { e.preventDefault(); ask(q); };
  const examples = copy.ask.examples[audience].map((t) => t.replaceAll("{d}", disease.short));
  const busy = state.kind === "loading";

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2" role="search">
        <label htmlFor="atlas-q" className="sr-only">{copy.ask.title}</label>
        <input id="atlas-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={copy.ask.placeholder} autoComplete="off" maxLength={500}
          aria-describedby={hint ? "atlas-q-hint" : undefined}
          className="min-h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-rule bg-canvas px-5 text-base text-ink placeholder:text-ink-3 transition-colors focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2" />
        <button type="submit" className="btn btn-primary shrink-0" disabled={busy} aria-disabled={busy}>{copy.ask.submit}</button>
      </form>
      {hint && <p id="atlas-q-hint" className="mt-2 text-sm text-t-gene">{hint}</p>}
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Examples">
        {examples.map((ex) => (
          <li key={ex}>
            <button type="button" onClick={() => ask(ex)} disabled={busy}
              className="min-h-10 rounded-full border border-rule bg-canvas px-3.5 text-left text-sm text-ink-2 transition-colors hover:border-ink-3 hover:text-ink disabled:opacity-50">
              {ex}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6" aria-live="polite" aria-busy={busy}>
        {state.kind === "idle" && <p className="border-l-[5px] border-dashed border-rule pl-4 text-sm text-ink-3">{copy.ask.empty}</p>}
        {state.kind === "loading" && (
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-panel-2"><div className={`loading-bar h-full w-full rounded-full ${aud.bg}`} /></div>
            <p className="mt-3 text-sm text-ink-2">{copy.ask.loading}</p>
          </div>
        )}
        {state.kind === "error" && (
          <div className="rounded-[var(--radius)] border border-rule bg-panel p-4">
            <p className="text-sm text-ink">{copy.ask.error}</p>
            <button type="button" onClick={() => ask(state.question)} className="btn btn-ghost mt-3">{copy.ask.retry}</button>
          </div>
        )}
        {state.kind === "done" && (
          <AnswerRoute key={state.answer.retrieved_at + state.question} answer={state.answer} audience={audience} copy={copy} lang={lang}
            currentOrpha={disease.orpha} onNavigate={onNavigate} onShowDisease={onShowDisease} />
        )}
      </div>
    </div>
  );
}

const noop = () => () => {};
function useSpeech() {
  return useSyncExternalStore(noop, () => typeof window !== "undefined" && "speechSynthesis" in window, () => false);
}

function AnswerRoute({ answer, audience, copy, lang, currentOrpha, onNavigate, onShowDisease }: {
  answer: AskResponse; audience: Audience; copy: AtlasCopy; lang: Lang; currentOrpha: string;
  onNavigate: (anchor: string) => void; onShowDisease: (orpha: string) => void;
}) {
  const aud = AUDIENCE_META[audience];
  const canSpeak = useSpeech();
  const [speaking, setSpeaking] = useState(false);
  const [open, setOpen] = useState(false);
  const name = answer.disease ? (lang === "es" && answer.disease.name_es ? answer.disease.name_es : answer.disease.name) : null;

  const speak = () => {
    if (!canSpeak) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(answer.spoken);
    u.lang = lang === "es" ? "es-MX" : "en-US";
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };

  if (!answer.disease) {
    return <p className="border-l-[5px] border-dashed border-gap pl-4 text-sm text-ink-2">{copy.ask.pickDisease}</p>;
  }

  return (
    <article className={`max-w-[72ch] ${styles.fade}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="font-display text-base font-bold text-ink">{copy.ask.about(name ?? "")}</h3>
        <span className={`font-mono text-xs ${answer.dropped.length ? "text-ink-2" : aud.text}`}>
          {answer.dropped.length ? copy.ask.someDropped(answer.claims.length, answer.dropped.length) : copy.ask.allSourced(answer.claims.length)}
        </span>
        {answer.disease.orpha !== currentOrpha && (
          <button type="button" onClick={() => onShowDisease(answer.disease!.orpha)} className="min-h-9 rounded-full border border-rule px-3 text-xs font-bold text-ink-2 hover:text-ink">
            {answer.disease.orpha} <ArrowIcon size={12} className="inline" />
          </button>
        )}
      </header>

      {/* What the voice says */}
      <div className="mt-3 rounded-[var(--radius)] bg-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-xs font-bold uppercase tracking-[0.06em] text-ink-3">{copy.ask.spoken}</p>
          {canSpeak && (
            <button type="button" onClick={speak} aria-pressed={speaking}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink">
              {speaking ? <StopIcon size={16} /> : <SpeakerIcon size={16} />}
              {speaking ? copy.ask.stop : copy.ask.readAloud}
            </button>
          )}
        </div>
        <p className={`mt-1.5 text-[17px] leading-relaxed text-ink ${open ? "" : "line-clamp-4"}`}>{answer.spoken}</p>
        {answer.spoken.length > 220 && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-1 min-h-9 text-sm font-bold text-ink-2 underline-offset-2 hover:text-ink hover:underline">
            {open ? copy.ask.less : copy.ask.more}
          </button>
        )}
      </div>

      {/* Evidence route */}
      <h4 className="mt-5 font-display text-xs font-bold uppercase tracking-[0.06em] text-ink-3">{copy.ask.route}</h4>
      <ol className="mt-2">
        {answer.claims.map((c, i) => (
          <li key={`c${i}`} className={`relative pb-4 pl-9 before:absolute before:bottom-0 before:left-[9px] before:top-0 before:w-[5px] ${aud.rail} ${i === 0 ? "before:top-2" : ""}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" className="absolute left-0 top-0" aria-hidden>
              <circle cx="12" cy="12" r="8" className="station" fill={aud.stroke} />
            </svg>
            <p className="text-[15px] leading-snug text-ink">{c.text}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {c.citations.slice(0, 4).map((e) => <li key={e.id} className="min-w-0 max-w-full"><CitationChip e={e} compact /></li>)}
              {c.citations.length > 4 && <li className="self-center font-mono text-xs text-ink-3">+{c.citations.length - 4}</li>}
            </ul>
          </li>
        ))}
        {answer.dropped.map((d, i) => (
          <li key={`d${i}`} className="relative pb-4 pl-9 before:absolute before:bottom-0 before:left-[9px] before:top-0 before:border-l-[5px] before:border-dashed before:border-gap">
            <svg width="24" height="24" viewBox="0 0 24 24" className="absolute left-0 top-0" aria-hidden>
              <circle cx="12" cy="12" r="8" className="station-gap" strokeWidth={2.5} />
            </svg>
            <p className="text-[15px] font-bold leading-snug text-ink-2">{copy.ask.noEvidence}</p>
            <p className="text-sm text-ink-3"><span className="font-mono text-xs uppercase">{copy.ask.notSaid}:</span> {d.text}</p>
          </li>
        ))}
      </ol>

      {/* Transfers */}
      {answer.next_steps.length > 0 && (
        <div className="mt-4">
          <h4 className="font-display text-xs font-bold uppercase tracking-[0.06em] text-ink-3">{copy.ask.next}</h4>
          <ul className="mt-2 flex flex-wrap gap-2">
            {answer.next_steps.map((s, i) => (
              <li key={i} className="max-w-full"><Transfer step={s} onNavigate={onNavigate} /></li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 border-t border-rule pt-3 text-sm text-ink-2">{copy.disclaimer}</p>
      <p className="mt-1 font-mono text-xs text-ink-3">{copy.ask.meta(answer.mode, answer.source, day(answer.retrieved_at) ?? "")}</p>
    </article>
  );
}

function Transfer({ step, onNavigate }: { step: AskResponse["next_steps"][number]; onNavigate: (anchor: string) => void }) {
  const cls = "inline-flex min-h-11 max-w-full items-center gap-2 rounded-md border-2 border-ink bg-canvas px-3 font-display text-sm font-bold text-ink transition-colors";
  const ref = step.ref ?? "";
  if (ref.startsWith("#")) {
    return <button type="button" onClick={() => onNavigate(ref.slice(1))} className={`${cls} hover:bg-panel`}><ArrowIcon size={16} /><span className="truncate">{step.label}</span></button>;
  }
  if (/^https?:\/\//.test(ref)) {
    return <a href={ref} target="_blank" rel="noreferrer" className={`${cls} hover:bg-panel`}><ArrowIcon size={16} /><span className="truncate">{step.label}</span><ExternalIcon size={14} className="text-ink-3" /></a>;
  }
  return <span className={`${cls} border-rule text-ink-2`}><ArrowIcon size={16} /><span className="truncate">{step.label}</span></span>;
}
