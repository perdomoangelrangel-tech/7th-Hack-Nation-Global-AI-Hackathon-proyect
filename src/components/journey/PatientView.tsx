"use client";
/**
 * Patient mode (Devon, UX_WAVE4 S2): four plain cards instead of the stepper — "What is it?",
 * "People like you", "Research happening now", "What you can do this week". 17 px text, no variant
 * percentages, every card still opens its evidence.
 */
import { ExternalLink, Footprints, HeartHandshake, Info, Microscope, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { JourneyV2 } from "@/lib/journey/build";
import type { Locale } from "@/lib/i18n";
import { journeyCopy } from "./copy";
import { Glossed } from "./Glossed";

const C = {
  en: { what: "What is it?", people: "People like you", research: "Research happening now", week: "What you can do this week", visit: "Visit website", no_group: "We did not find a patient group for this exact diagnosis in our sources yet.", no_research: "No study is recruiting for this exact diagnosis in ClinicalTrials.gov right now.", recruiting: "looking for participants", soon: "opening soon", invite: "by invitation", evidence: "See evidence", plan: "Save my plan", study: "Study page" },
  es: { what: "¿Qué es?", people: "Personas como tú", research: "Investigación en marcha", week: "Qué puedes hacer esta semana", visit: "Visitar sitio web", no_group: "Aún no encontramos un grupo de pacientes para este diagnóstico exacto en nuestras fuentes.", no_research: "Ningún estudio está reclutando ahora para este diagnóstico exacto en ClinicalTrials.gov.", recruiting: "busca participantes", soon: "abrirá pronto", invite: "por invitación", evidence: "Ver evidencia", plan: "Guardar mi plan", study: "Página del estudio" },
};

export function PatientView({ x, locale, onInspect, onHover }: { x: JourneyV2; locale: Locale; onInspect: (e: string) => void; onHover: (nodes: string[], edges: string[]) => void }) {
  const c = C[locale]; const jc = journeyCopy[locale];
  const p = x.plain;
  const status = (s: string) => (s === "RECRUITING" ? c.recruiting : s === "NOT_YET_RECRUITING" ? c.soon : c.invite);
  return (
    <div className="mt-3 space-y-3 text-[17px] leading-relaxed">
      <Card icon={Info} title={c.what} edges={p.what_is_it.cite.edges} onInspect={onInspect} onHover={onHover} evidence={c.evidence}>
        <p className="text-ink"><Glossed text={p.what_is_it.text} active /></p>
      </Card>
      <Card icon={HeartHandshake} title={c.people} edges={p.people_like_you.cite.edges} onInspect={onInspect} onHover={onHover} evidence={c.evidence}>
        {p.people_like_you.groups.length === 0 && <p className="text-ink-2">{c.no_group}</p>}
        <ul className="space-y-2">
          {p.people_like_you.groups.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3">
              <span className="font-medium text-ink">{g.name}</span>
              {g.url && <a href={g.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-brand/50 px-3 py-1.5 text-sm text-brand-deep hover:bg-brand-soft min-h-10 shrink-0">{c.visit}<ExternalLink size={14} aria-hidden /></a>}
            </li>
          ))}
        </ul>
      </Card>
      <Card icon={Microscope} title={c.research} edges={p.research_now.cite.edges} onInspect={onInspect} onHover={onHover} evidence={c.evidence}>
        {p.research_now.studies.length === 0 && <p className="text-ink-2">{c.no_research}</p>}
        <ul className="space-y-2.5">
          {p.research_now.studies.map((s) => (
            <li key={s.id}>
              <p className="text-ink line-clamp-2">{s.title}</p>
              <p className="text-sm text-ink-3">{status(s.status)}{s.countries.length ? ` · ${s.countries.slice(0, 3).join(", ")}` : ""} · <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-brand-deep hover:underline">{c.study} ↗</a></p>
            </li>
          ))}
        </ul>
      </Card>
      <Card icon={Footprints} title={c.week} edges={p.this_week.flatMap((s) => s.cite.edges)} onInspect={onInspect} onHover={onHover} evidence={c.evidence}>
        <ol className="space-y-2.5 list-decimal pl-5">
          {p.this_week.map((s) => <li key={s.id}><p className="font-medium text-ink">{s.title}</p></li>)}
        </ol>
        <a href={`/plan?d=${encodeURIComponent(x.disease.id)}&p=devon&l=${locale}`} target="_blank" rel="noopener" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-deep px-4 py-2 text-sm font-semibold text-white hover:bg-brand-ink min-h-10"><ListChecks size={15} aria-hidden />{c.plan}</a>
        <p className="mt-2 text-sm text-ink-3">{jc.recommendation(new Set(p.this_week.flatMap((s) => s.cite.evidence)).size)}</p>
      </Card>
    </div>
  );
}

function Card({ icon: Icon, title, children, edges, onInspect, onHover, evidence }: { icon: LucideIcon; title: string; children: React.ReactNode; edges: string[]; onInspect: (e: string) => void; onHover: (n: string[], e: string[]) => void; evidence: string }) {
  return (
    <section className="rounded-2xl border border-line bg-paper p-4" onMouseEnter={() => onHover([], edges)} onMouseLeave={() => onHover([], [])}>
      <h3 className="flex items-center gap-2 text-base font-semibold text-brand-ink"><Icon size={18} className="text-brand-deep" aria-hidden />{title}</h3>
      <div className="mt-2">{children}</div>
      {edges[0] && <button onClick={() => onInspect(edges[0])} className="mt-2 text-sm font-medium text-brand-deep hover:underline">{evidence} →</button>}
    </section>
  );
}
