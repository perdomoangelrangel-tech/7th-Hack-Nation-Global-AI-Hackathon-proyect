"use client";
import { useState } from "react";
import Link from "next/link";

type Audience = "family" | "clinical" | "research";
interface Citation { id: string; source: string; external_id: string; url: string; quote: string | null; published_on: string | null; retrieved_at: string }
interface Answer { agent: string; spoken: string; verified: boolean; dropped: { text: string; reason: string }[]; claims: { text: string; citations: Citation[] }[]; next_steps: { kind: string; label: string; ref?: string }[]; disease: string | null }

const AUD: { id: Audience; label: string; hint: string }[] = [
  { id: "family", label: "Soy familiar o paciente", hint: "Guía de familias" },
  { id: "clinical", label: "Soy médico", hint: "Analista clínico" },
  { id: "research", label: "Investigo", hint: "Analista de investigación" },
];
const EXAMPLES = ["¿Qué tratamientos hay para el síndrome de Rett?", "¿Hay ensayos activos para Dravet?", "¿Qué genes están asociados con Angelman?", "¿Qué huecos de investigación hay en CDKL5?"];

export default function Atlas() {
  const [audience, setAudience] = useState<Audience>("family");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [a, setA] = useState<Answer | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function ask(question: string) {
    setLoading(true); setErr(null); setA(null); setQ(question);
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, audience, locale: "es" }) });
      if (!r.ok) throw new Error(`${r.status}`);
      setA(await r.json());
    } catch { setErr("No pude consultar el atlas. Revisa que Supabase esté configurado (ver /api/health)."); }
    finally { setLoading(false); }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/" className="text-sm text-ink-3 hover:text-ink">← Inicio</Link>
      <h1 className="serif text-4xl text-navy mt-3">Pregunta al atlas</h1>
      <p className="text-ink-2 mt-2">Cada frase que recibas tiene una fuente. Lo que no la tiene, no aparece.</p>

      <div className="mt-6 flex flex-wrap gap-2" role="radiogroup" aria-label="Quién pregunta">
        {AUD.map((x) => (
          <button key={x.id} role="radio" aria-checked={audience === x.id} onClick={() => setAudience(x.id)}
            className={`rounded-full px-4 py-2 text-sm border ${audience === x.id ? "bg-navy text-paper border-navy" : "border-line hover:bg-paper-2"}`}>
            {x.label} <span className="opacity-60">· {x.hint}</span>
          </button>
        ))}
      </div>

      <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) ask(q.trim()); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribe tu pregunta (o usa el micrófono del agente de voz)" aria-label="Pregunta"
          className="flex-1 rounded-xl border border-line bg-paper-2 px-4 py-3 outline-none focus:border-teal" />
        <button disabled={loading} className="rounded-xl bg-teal text-white px-5 font-medium disabled:opacity-50">{loading ? "…" : "Preguntar"}</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => <button key={e} onClick={() => ask(e)} className="chip hover:bg-paper-2">{e}</button>)}
      </div>

      {/* Espacio para el widget de voz de ElevenLabs */}
      <div id="voice-agent" className="mt-6 card p-4 text-sm text-ink-3">
        Agente de voz: aquí va el widget <code>&lt;elevenlabs-convai agent-id=&quot;…&quot;&gt;</code> del perfil seleccionado (ver docs/AGENTS.md).
      </div>

      {err && <p className="mt-6 no-evidence p-3 rounded-r-md text-sm">{err}</p>}

      {a && (
        <section className="mt-8 space-y-4" aria-live="polite">
          <div className="flex items-center gap-2 text-xs text-ink-3">
            <span className="chip">{a.agent}</span>
            <span className={`chip ${a.verified ? "" : "no-evidence"}`}>{a.verified ? "todas las frases con fuente" : `${a.dropped.length} frase(s) eliminada(s) sin evidencia`}</span>
          </div>
          <p className="serif text-xl leading-relaxed">{a.spoken}</p>

          {a.claims.map((c, i) => (
            <div key={i} className="evidence pl-3 py-1">
              <p className="text-sm">{c.text}</p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {c.citations.map((ct) => (
                  <li key={ct.id}><a href={ct.url} target="_blank" rel="noreferrer" className="chip hover:bg-paper-2">{ct.source} · {ct.external_id}{ct.published_on ? ` · ${ct.published_on}` : ""}</a></li>
                ))}
              </ul>
            </div>
          ))}

          {a.dropped.length > 0 && (
            <div className="no-evidence pl-3 py-2 rounded-r-md text-sm">
              <p className="font-medium">Sin evidencia en nuestras fuentes (no se dijo):</p>
              <ul className="list-disc ml-5 text-ink-2">{a.dropped.map((d, i) => <li key={i}>{d.text}</li>)}</ul>
            </div>
          )}

          {a.next_steps.length > 0 && (
            <div className="card p-4">
              <p className="text-xs uppercase tracking-widest text-ink-3">Siguientes pasos</p>
              <ul className="mt-2 flex flex-wrap gap-2">{a.next_steps.map((s, i) => <li key={i} className="chip">{s.kind} · {s.label}</li>)}</ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
