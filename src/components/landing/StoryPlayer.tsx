"use client";
/**
 * Website story narration (ElevenLabs voice-over made by the voice lane: public/audio/nedamex-story-en.mp3 + .vtt).
 * Press play → the Blender voice agent pops in and speaks with the real audio level (WebAudio analyser);
 * captions from the VTT show under it; pause/end → the agent bows out. Reduced motion → static orb, same captions.
 * Rendered by the page only when the audio file exists.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentOrb } from "@/components/three/AgentOrb";

interface Cue { start: number; end: number; text: string }

const toSec = (t: string) => {
  const p = t.trim().split(":").map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
};

export function parseVtt(vtt: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of vtt.replace(/\r/g, "").split(/\n\n+/)) {
    const lines = block.split("\n").filter(Boolean);
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->");
    cues.push({ start: toSec(a), end: toSec(b.trim().split(" ")[0]), text: lines.slice(i + 1).join(" ").replace(/<[^>]+>/g, "") });
  }
  return cues;
}

export function StoryPlayer({ src, vtt, label = "Listen to the story" }: { src: string; vtt?: string; label?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const buf = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false); // the agent pops in with the voice, stays while paused, leaves at the end
  const [cues, setCues] = useState<Cue[]>([]);
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (!vtt) return;
    let alive = true;
    fetch(vtt).then((r) => (r.ok ? r.text() : "")).then((t) => { if (alive) setCues(parseVtt(t)); }).catch(() => {});
    return () => { alive = false; };
  }, [vtt]);

  const ensureAnalyser = () => {
    const el = audio.current;
    if (!el || analyser.current) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const node = ctx.createAnalyser();
      node.fftSize = 512;
      ctx.createMediaElementSource(el).connect(node);
      node.connect(ctx.destination);
      analyser.current = node;
      buf.current = new Uint8Array(new ArrayBuffer(node.fftSize));
      void ctx.resume();
    } catch { /* no WebAudio: the agent still animates with its Speak clip */ }
  };

  const getLevel = useCallback(() => {
    const node = analyser.current, data = buf.current;
    if (!node || !data) return 0;
    node.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
    return Math.min(1, Math.sqrt(sum / data.length) * 4);
  }, []);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    ensureAnalyser();
    if (el.paused) void el.play(); else el.pause();
  };

  return (
    <div className="mt-6 flex items-center gap-4">
      <div className="grid h-[88px] w-[88px] shrink-0 place-items-center">
        <AgentOrb state={playing ? "speaking" : started ? "idle" : "hidden"} size={88} getLevel={getLevel} />
      </div>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={toggle} aria-pressed={playing} className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-sm font-semibold text-brand-ink hover:border-brand-deep">
          <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-brand-deep text-[10px] text-white">{playing ? "❚❚" : "▶"}</span>
          {playing ? "Pause the story" : label}
        </button>
        <p className="mt-2 min-h-[2.5em] text-sm text-ink-2" aria-live="polite">{playing ? caption : ""}</p>
      </div>
      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlay={() => { setPlaying(true); setStarted(true); }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setStarted(false); setCaption(""); }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          const cue = cues.find((c) => t >= c.start && t <= c.end);
          setCaption(cue?.text ?? "");
        }}
      >
        {vtt && <track kind="captions" src={vtt} srcLang="en" label="English" default />}
      </audio>
    </div>
  );
}
