/**
 * /plan?d=disease:ORPHA:599373&p=maria&l=en — one printable page for a patient-group meeting:
 * the route (four answers), this week's steps with owners, gaps, numbered sources and the disclaimer.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";
import { journeyFor, graph, parseLocale, parsePersona } from "@/lib/journey/server";
import { isNoRoute } from "@/lib/journey/noroute";
import { journeyCopy } from "@/components/journey/copy";
import { tenX } from "@/lib/journey/tenx";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: `Meeting plan · ${site.name}`, description: "A one-page, sourced plan for a patient-group meeting.", robots: { index: false } };

const L = {
  en: { title: "Meeting plan", for: "Prepared for a patient-group meeting", route: "Our route in four questions", week: "This week", later: "After that", owner: "Owner", gaps: "What is unknown", sources: "Sources", tenx: "Milestone", tenx_note: "Durations are assumptions, not measured outcomes.", print: "Print / save as PDF", back: "Back to the atlas", generated: "Generated", q: ["Who shares our disease characteristics?", "What useful work already exists?", "Who could help?", "What should we do together next?"] },
  es: { title: "Plan de reunión", for: "Preparado para una reunión del grupo de pacientes", route: "Nuestra ruta en cuatro preguntas", week: "Esta semana", later: "Después", owner: "Responsable", gaps: "Qué no se sabe", sources: "Fuentes", tenx: "Hito", tenx_note: "Las duraciones son supuestos, no resultados medidos.", print: "Imprimir / guardar PDF", back: "Volver al atlas", generated: "Generado", q: ["¿Quién comparte las características de nuestra enfermedad?", "¿Qué trabajo útil ya existe?", "¿Quién podría ayudar?", "¿Qué deberíamos hacer juntos después?"] },
};

export default async function PlanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const locale = parseLocale(one("l")); const persona = parsePersona(one("p"));
  const t = L[locale]; const c = journeyCopy[locale];
  const j = await journeyFor({ d: one("d") ?? null, q: one("q") ?? null, persona, locale });
  const g = await graph();
  const today = new Date().toISOString().slice(0, 10);

  if (isNoRoute(j)) {
    return (
      <Sheet back={t.back} print={t.print}>
        <h1 className="serif text-3xl text-brand-ink">{t.title}</h1>
        <div className="no-evidence rounded-r-lg px-4 py-3 mt-6">
          <p className="font-medium">{j.no_route.title}</p>
          <p className="text-sm text-ink-2 mt-1">{j.no_route.detail}</p>
          <ul className="list-disc pl-5 text-sm mt-2">{j.no_route.missing_evidence.map((m) => <li key={m}>{m}</li>)}</ul>
          <p className="text-sm mt-2"><b>{c.next_question}:</b> {j.no_route.next_question}</p>
        </div>
        <p className="mt-8 text-xs text-ink-3">{j.disclaimer}</p>
      </Sheet>
    );
  }

  // Numbered sources: every edge cited on this page, first evidence record each.
  const sources: { n: number; label: string; url: string }[] = [];
  const refs = (edges: string[]) => edges.slice(0, 4).map((id) => {
    const ev = g.edgeById.get(id)?.evidence[0]; if (!ev) return null;
    let s = sources.find((x) => x.url === ev.url);
    if (!s) { s = { n: sources.length + 1, url: ev.url, label: ev.source === "atlas_analysis" ? "Nexmed analysis — inferred, needs expert review" : `${ev.external_id}${ev.quote ? ` — ${ev.quote.slice(0, 90)}` : ""}` }; sources.push(s); }
    return s.n;
  }).filter((n): n is number => n !== null);
  // A plain function, not a component: it must run while this render builds `sources`, before the list below.
  const sup = (edges: string[]) => { const ns = [...new Set(refs(edges))]; return ns.length ? <sup className="text-brand-deep ml-0.5">[{ns.join(",")}]</sup> : null; };
  const order = ["connections", "assets", "people", "next"] as const;
  const x = tenX(j);

  return (
    <Sheet back={t.back} print={t.print} backHref={`/atlas?d=${encodeURIComponent(j.disease.id)}&p=${persona}&l=${locale}`}>
      <header className="flex items-start justify-between gap-6 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-ink-3">{t.for}</p>
          <h1 className="serif text-3xl text-brand-ink mt-1">{j.disease.full_name}</h1>
          <p className="text-sm text-ink-3 mt-1">{j.disease.canonical_id}{j.cluster ? ` · ${j.cluster.label}` : ""}</p>
        </div>
        <p className="text-right text-xs text-ink-3 shrink-0">{site.name} by {site.company}<br />{t.generated} {today}</p>
      </header>

      <section className="mt-5">
        <h2 className="text-xs uppercase tracking-widest text-ink-3">{t.route}</h2>
        <ol className="mt-2 space-y-2">
          {order.map((q, i) => (
            <li key={q} className="text-sm"><span className="text-ink-3">{i + 1}. {t.q[i]}</span><br /><span className="text-ink">{j.summary[q].text}</span>{sup(j.summary[q].cite.edges)}{j.summary[q].cite.kinds.includes("inferred") && <span className="ml-2 text-[11px] text-amber">({c.inferred_review})</span>}</li>
          ))}
        </ol>
      </section>

      <section className="mt-6 break-inside-avoid">
        <h2 className="text-xs uppercase tracking-widest text-ink-3">{t.week}</h2>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {j.next.steps.map((s, i) => (
              <tr key={s.id} className="border-t border-line align-top">
                <td className="py-2 pr-3 w-6 text-ink-3">{i + 1}</td>
                <td className="py-2 pr-3"><p className="font-medium">{s.title}{sup(s.cite.edges)}</p><p className="text-ink-2 text-xs mt-0.5">{s.detail}</p>{s.needs_review && <p className="text-[11px] text-amber mt-0.5">{c.needs_review}</p>}</td>
                <td className="py-2 w-32 text-xs text-ink-2"><span className="text-ink-3">{t.owner}: </span>{c.owner[s.owner]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {j.next.none && <p className="text-sm text-ink-2 mt-2">{j.next.none.title} — {j.next.none.next_question}</p>}
        {j.next.later.length > 0 && <p className="text-xs text-ink-3 mt-2"><b>{t.later}:</b> {j.next.later.map((s) => s.title).join(" · ")}</p>}
      </section>

      <section className="mt-6 break-inside-avoid">
        <h2 className="text-xs uppercase tracking-widest text-ink-3">{t.tenx}</h2>
        <p className="text-sm mt-1">{x.milestone}. {locale === "es" ? "Descubrimiento" : "Discovery"}: {Math.round(x.discovery.typical[0] / 4.345)}–{Math.round(x.discovery.typical[1] / 4.345)} {locale === "es" ? "meses → " : "months → "}{Math.round(x.discovery.nexmed[0])}–{Math.round(x.discovery.nexmed[1])} {locale === "es" ? "semanas" : "weeks"}. <span className="text-ink-3 text-xs">{t.tenx_note}</span></p>
      </section>

      {j.gaps.length > 0 && (
        <section className="mt-6 break-inside-avoid">
          <h2 className="text-xs uppercase tracking-widest text-ink-3">{t.gaps}</h2>
          <ul className="mt-1 text-sm list-disc pl-5 space-y-0.5">{j.gaps.map((g2) => <li key={g2.kind}>{g2.title} <span className="text-ink-3">— {g2.what_would_change_it}</span></li>)}</ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xs uppercase tracking-widest text-ink-3">{t.sources}</h2>
        <ol className="mt-1 text-[11px] text-ink-2 space-y-0.5">
          {sources.map((s) => <li key={s.n}>[{s.n}] {s.label} — <a href={s.url} className="underline break-all">{s.url}</a></li>)}
        </ol>
      </section>
      <p className="mt-6 border-t border-line pt-3 text-xs text-ink-3">{j.disclaimer}</p>
    </Sheet>
  );
}

function Sheet({ children, back, print, backHref = "/atlas" }: { children: React.ReactNode; back: string; print: string; backHref?: string }) {
  return (
    <main className="min-h-dvh bg-brand-mist print:bg-white px-4 py-6 print:p-0">
      <div className="mx-auto max-w-[820px] flex justify-between mb-3 print:hidden">
        <Link href={backHref} className="text-sm text-brand-deep hover:underline">← {back}</Link>
        <PrintButton label={print} />
      </div>
      <article className="mx-auto max-w-[820px] bg-white rounded-2xl border border-line p-6 sm:p-10 print:border-0 print:rounded-none print:p-0 text-ink">{children}</article>
    </main>
  );
}
