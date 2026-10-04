"use client";
/**
 * Step 3 · "Researchers who share the mechanism": NIH RePORTER grant holders (GET /api/community) who work on this
 * disease AND one of its neighbors — each project links to its RePORTER record (the evidence). Self-submitted
 * profiles for this disease follow, always badged "Self-submitted · not verified" (never evidence).
 */
import { useEffect, useState } from "react";
import { ExternalLink, GraduationCap, UserRound } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { JourneyV2 } from "@/lib/journey/build";
import type { CommunityProfile, CommunityResult } from "@/lib/journey/community";
import { journeyCopy } from "./copy";
import { openCoCreate } from "./events";

export function SharedResearchers({ journey, locale, max = 3 }: { journey: JourneyV2; locale: Locale; max?: number }) {
  const c = journeyCopy[locale];
  const d = journey.disease.id;
  const [res, setRes] = useState<{ d: string; profiles: CommunityProfile[] } | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/api/community?d=${encodeURIComponent(d)}&limit=200`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null)).then((b: CommunityResult | null) => setRes({ d, profiles: b?.profiles ?? [] })).catch(() => {});
    return () => ctl.abort();
  }, [d]);
  if (!res || res.d !== d) return null;
  const nb = new Map(journey.connections.neighbors.map((n) => [n.disease, n.name]));
  const shared = res.profiles.filter((p) => p.kind === "nih_record" && p.diseases.some((x) => nb.has(x.disease_id))).slice(0, max);
  const self = res.profiles.filter((p) => p.kind === "self_submitted").slice(0, 2);
  if (!shared.length && !self.length) return null;

  return (
    <section className="mt-3" aria-label={c.sharing_researchers}>
      {shared.length > 0 && (
        <>
          <p className="text-[11px] uppercase tracking-wider text-ink-3">{c.sharing_researchers}</p>
          <p className="text-[11px] text-ink-3">{c.sharing_hint}</p>
          <ul className="mt-1.5 space-y-1.5">
            {shared.map((p) => {
              const others = p.diseases.filter((x) => nb.has(x.disease_id)).map((x) => nb.get(x.disease_id)!);
              const proj = p.projects.find((x) => x.url);
              return (
                <li key={p.id} className="rounded-lg border border-line bg-paper px-2.5 py-2 text-xs">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-ink"><GraduationCap size={14} className="text-brand-deep shrink-0" aria-hidden />{p.name}</p>
                  {p.institution && <p className="text-ink-3">{p.institution}</p>}
                  <p className="text-ink-2 mt-0.5">{journey.disease.name} + {others.join(", ")}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {proj && <a href={proj.url!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-deep hover:underline" title={proj.title ?? ""}>{p.badge} · {proj.project}<ExternalLink size={12} aria-hidden /></a>}
                    <button onClick={() => openCoCreate("collaboration", { entities: [d, p.id] })} className="text-brand-deep hover:underline">{c.draft_collab}</button>
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {self.length > 0 && (
        <>
          <p className="mt-3 text-[11px] uppercase tracking-wider text-ink-3">{c.self_profiles}</p>
          <ul className="mt-1.5 space-y-1.5">
            {self.map((p) => (
              <li key={p.id} className="rounded-lg border border-dashed border-ink-3/40 bg-paper px-2.5 py-2 text-xs">
                <p className="flex items-center gap-1.5 text-sm text-ink"><UserRound size={14} className="text-ink-3 shrink-0" aria-hidden />{p.name}{p.role ? <span className="text-ink-3"> · {p.role.replace("_", " ")}</span> : null}</p>
                <p className="mt-0.5 inline-flex rounded-full border border-dashed border-ink-3/50 px-2 py-0.5 text-[11px] text-ink-3">{p.badge}</p>
                {p.focus && <p className="mt-1 text-ink-2 line-clamp-2">{p.focus}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
