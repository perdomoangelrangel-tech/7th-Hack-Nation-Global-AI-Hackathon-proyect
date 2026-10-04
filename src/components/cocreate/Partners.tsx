"use client";
/** Suggested partners (GET /api/match) + "Draft an intro message" (templated, sourced). */
import { useEffect, useRef, useState } from "react";
import type { PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";
import type { JourneyV2 } from "@/lib/journey/build";
import type { MatchResult, Partner } from "@/lib/journey/match";
import type { Draft } from "@/lib/journey/prefill";
import { draftIntro, type IntroDraft } from "@/lib/journey/outreach";
import { tr } from "@/lib/journey/graph";
import { coCopy } from "./copy";

export function Partners({ persona, locale, disease, journey, onPropose, defaultOpen = false }: { persona: PersonaId; locale: Locale; disease: string; journey: JourneyV2; onPropose: (d: Partial<Draft>) => void; defaultOpen?: boolean }) {
  const c = coCopy[locale];
  const [res, setRes] = useState<{ key: string; r: MatchResult | null }>({ key: "", r: null });
  const [intro, setIntro] = useState<{ draft: IntroDraft; ai: boolean } | null>(null);
  const key = `${disease}|${persona}|${locale}`;
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/api/match?d=${encodeURIComponent(disease)}&p=${persona}&l=${locale}&n=4`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null)).then((r: MatchResult | null) => setRes({ key: `${disease}|${persona}|${locale}`, r })).catch(() => {});
    return () => ctl.abort();
  }, [disease, persona, locale]);
  const partners = res.key === key ? res.r?.partners ?? [] : [];
  if (!partners.length) return null;

  const propose = (p: Partner) => onPropose({
    title: tr(locale, `Collaboration proposal: ${journey.disease.name} community × ${p.name}`, `Propuesta de colaboración: comunidad de ${journey.disease.name} × ${p.name}`),
    body: draftIntro(journey, p).body,
    entities: [...new Set([journey.disease.id, ...(p.id.startsWith("sponsor:") ? [] : [p.id]), ...p.diseases.map((x) => x.id)])],
    edges: p.cite.edges.slice(0, 100),
  });

  const openIntro = async (p: Partner) => {
    const draft = draftIntro(journey, p);
    setIntro({ draft, ai: false });
    // Optional polish by the ai lane: only if it answers in OpenAI mode and every sentence keeps edge ids.
    try {
      const r = await fetch("/api/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ edgeIds: p.cite.edges.slice(0, 12), persona, locale, simple: persona === "devon" || persona === "maria" }) });
      if (!r.ok) return;
      const b = (await r.json()) as { mode?: string; sentences?: { text: string; edge_ids: string[] }[] };
      const s = (b.sentences ?? []).filter((x) => x.edge_ids?.length && x.edge_ids.every((e) => p.cite.edges.includes(e)));
      if (b.mode !== "openai" || !s.length) return;
      const summary = s.map((x) => x.text).join(" ");
      setIntro({ ai: true, draft: { ...draft, body: draft.body.replace(/\n\n/, `\n\n${tr(locale, "In short", "En resumen")}: ${summary}\n\n`) } });
    } catch { /* the template stays */ }
  };

  return (
    <details className="mt-3 group" open={defaultOpen}>
      <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-ink-3" title={res.r?.method}>
        {c.partners} ({partners.length}) <span className="normal-case tracking-normal text-ink-2 group-open:hidden">· {partners[0].name}</span>
      </summary>
      <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
        {partners.map((p) => (
          <li key={p.id} className="rounded-lg border border-line bg-paper px-2.5 py-2">
            <p className="text-sm font-medium leading-snug">{p.name}</p>
            <p className="text-[11px] text-ink-3">{p.kind.replace("_", " ")} · {p.diseases.map((x) => x.name).join(", ")}</p>
            <p className="text-xs text-ink-2 mt-1 line-clamp-2" title={p.reasons.map((r) => r.text).join("\n")}>{p.reasons[0]?.text}</p>
            <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <button onClick={() => propose(p)} className="text-brand-deep font-medium hover:underline">{c.propose_with}</button>
              <button onClick={() => openIntro(p)} className="text-brand-deep hover:underline">{c.draft_intro}</button>
            </span>
          </li>
        ))}
      </ul>
      <IntroDialog intro={intro} locale={locale} onClose={() => setIntro(null)} />
    </details>
  );
}

function IntroDialog({ intro, locale, onClose }: { intro: { draft: IntroDraft; ai: boolean } | null; locale: Locale; onClose: () => void }) {
  const c = coCopy[locale];
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (intro && !el.open) el.showModal(); else if (!intro && el.open) el.close();
  }, [intro]);
  const text = intro ? `${intro.draft.subject}\n\n${intro.draft.body}` : "";
  return (
    <dialog ref={ref} onClose={() => { setCopied(false); onClose(); }} aria-labelledby="intro-title"
      className="m-auto w-[min(640px,calc(100vw-24px))] max-h-[calc(100dvh-24px)] rounded-2xl border border-line bg-paper p-0 text-ink shadow-2xl backdrop:bg-brand-ink/30 backdrop:backdrop-blur-sm">
      {intro && (
        <div className="flex flex-col max-h-[calc(100dvh-24px)]">
          <header className="px-5 pt-5 pb-3 border-b border-line flex items-start justify-between gap-3">
            <div>
              <h2 id="intro-title" className="serif text-xl text-brand-ink">{c.intro_title}</h2>
              <p className="text-xs text-ink-3 mt-1">{c.intro_note} {intro.ai ? c.polished : c.templated}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full w-8 h-8 grid place-items-center text-ink-3 hover:bg-paper-2" aria-label={c.cancel}>✕</button>
          </header>
          <div className="px-5 py-4 overflow-y-auto">
            <p className="text-sm font-medium">{intro.draft.subject}</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink-2 leading-relaxed">{intro.draft.body}</pre>
          </div>
          <footer className="px-5 py-3 border-t border-line flex justify-end gap-2">
            <a href={`mailto:?subject=${encodeURIComponent(intro.draft.subject)}&body=${encodeURIComponent(intro.draft.body)}`} className="rounded-full px-4 py-2 text-sm text-ink-2 hover:bg-paper-2">{c.open_mail}</a>
            <button onClick={() => { void navigator.clipboard?.writeText(text).then(() => setCopied(true)); }} className="rounded-full bg-brand-deep px-4 py-2 text-sm font-semibold text-white hover:bg-brand-ink">{copied ? c.copied : c.copy}</button>
          </footer>
        </div>
      )}
    </dialog>
  );
}
