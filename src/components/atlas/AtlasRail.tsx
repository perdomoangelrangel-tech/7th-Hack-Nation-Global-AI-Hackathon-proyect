"use client";
/**
 * Left rail: mechanism clusters, how to read the map (edge kinds are toggles) and the community.
 * The mode (persona) changes the order: Pharma sees ranked clusters first, Patient / Family see the community first,
 * Researcher sees the evidence legend first.
 */
import type { ReactNode } from "react";
import type { GraphView, Journey } from "@/lib/atlas/store";
import type { PersonaId } from "@/lib/agents/profiles";
import type { Dict } from "@/lib/i18n";
import { CANVAS, KIND_STYLE, KINDS, TYPE_COLOR, type LinkKind } from "./colors";

interface Props {
  t: Dict;
  persona: PersonaId;
  view: GraphView | null;
  journey: Journey | null;
  clusterFilter: string | null;
  onCluster: (id: string | null) => void;
  hiddenKinds: Set<string>;
  onToggleKind: (k: LinkKind) => void;
  onHover: (nodes: string[], edges: string[]) => void;
  /** Kinds present in the current view (others are shown but marked "none here"). */
  presentKinds: Set<string>;
  centrality: Record<string, number>;
  onInspect: (edgeId: string) => void;
}

const LEGEND_KIND_KEY: Record<LinkKind, keyof Dict> = { observed: "legend_observed", inferred: "legend_inferred", extracted: "legend_extracted", proposed: "legend_proposed" };
const SHAPES = ["gene", "pathway", "phenotype", "organization", "trial", "investigator"] as const;

export function AtlasRail({ t, persona, view, journey, clusterFilter, onCluster, hiddenKinds, onToggleKind, onHover, presentKinds, centrality, onInspect }: Props) {
  const ranked = persona === "priya";
  const clusters = [...(view?.clusters ?? [])].map((c) => ({ ...c, score: c.diseases.reduce((s, d) => s + (centrality[d] ?? 0), 0) / Math.max(1, c.diseases.length) }));
  if (ranked) clusters.sort((a, b) => b.score - a.score);

  const clusterSection = (
    <section key="clusters">
      <h2 className="text-xs uppercase tracking-widest text-ink-3">{ranked ? t.ranked_clusters : t.clusters}</h2>
      <ul className="mt-3 space-y-1">
        {clusters.map((c, i) => (
          <li key={c.id}>
            <button type="button" onClick={() => onCluster(clusterFilter === c.id ? null : c.id)} aria-pressed={clusterFilter === c.id}
              onMouseEnter={() => onHover(c.diseases, [])} onMouseLeave={() => onHover([], [])} onFocus={() => onHover(c.diseases, [])} onBlur={() => onHover([], [])}
              className={`w-full text-left rounded-lg px-2 py-1.5 text-sm flex gap-2 items-start transition-colors ${clusterFilter === c.id ? "bg-brand-soft" : "hover:bg-brand-mist"}`}>
              {ranked && <span className="mt-0.5 w-4 text-xs tabular-nums text-ink-3">{i + 1}</span>}
              <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block leading-snug text-ink">{c.label}</span>
                <span className="text-xs text-ink-3">{c.diseases.length} · {t.centrality.toLowerCase()} {Math.round(c.score)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-ink-3 mt-2 leading-relaxed">{t.clusters_hint}</p>
    </section>
  );

  const legendSection = (
    <section key="legend">
      <h2 className="text-xs uppercase tracking-widest text-ink-3">{t.legend}</h2>
      <ul className="mt-3 space-y-1">
        {KINDS.map((k) => {
          const s = KIND_STYLE[k]; const off = hiddenKinds.has(k); const here = presentKinds.has(k);
          return (
            <li key={k}>
              <button type="button" onClick={() => onToggleKind(k)} aria-pressed={!off}
                className={`w-full flex items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition-colors hover:bg-brand-mist ${off ? "opacity-45" : ""}`}>
                <svg width="28" height="8" aria-hidden className="shrink-0"><line x1="1" y1="4" x2="27" y2="4" stroke={s.color} strokeOpacity={Math.max(0.5, s.opacity)} strokeWidth={k === "inferred" ? 2.4 : 1.8} strokeDasharray={s.dash?.join(" ")} strokeLinecap="round" /></svg>
                <span className="flex-1 text-ink-2">{t[LEGEND_KIND_KEY[k]] as string}</span>
                {!here && <span className="text-[10px] text-ink-3">0</span>}
              </button>
            </li>
          );
        })}
        <li className="flex items-center gap-2 px-2 py-1 text-xs text-ink-2">
          <svg width="28" height="8" aria-hidden className="shrink-0"><line x1="1" y1="4" x2="27" y2="4" stroke={CANVAS.bridge} strokeWidth="2" strokeLinecap="round" /></svg>{t.legend_bridge}
        </li>
      </ul>
      <p className="text-[11px] text-ink-3 mt-1 px-2">{t.legend_toggle_hint}</p>
      <ul className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 px-2 text-xs text-ink-2" aria-label={t.legend_shapes}>
        {SHAPES.map((k) => (
          <li key={k} className="flex items-center gap-2"><Shape type={k} />{t.types[k]}</li>
        ))}
      </ul>
      <p className="text-[11px] text-ink-3 mt-2 px-2">{t.legend_size}</p>
    </section>
  );

  // Community = organization nodes on screen and the edges tying them to diseases (focus first). Clicking opens the evidence.
  const focus = view?.focus || null;
  const end = (v: unknown) => (typeof v === "object" && v ? (v as { id: string }).id : String(v));
  const diseaseName = new Map((view?.nodes ?? []).filter((x) => x.type === "disease").map((x) => [x.id, x.name]));
  const groups = (view?.nodes ?? []).filter((x) => x.type === "organization" && !x.draft).map((o) => {
    const links = (view?.links ?? []).filter((l) => end(l.source) === o.id && diseaseName.has(end(l.target)));
    const diseases = [...new Set(links.map((l) => end(l.target)))];
    return { id: o.id, name: o.name, diseases, edges: links.map((l) => l.id), own: !!focus && diseases.includes(focus) };
  }).filter((g) => g.edges.length).sort((a, b) => Number(b.own) - Number(a.own) || a.name.localeCompare(b.name));
  const communitySection = focus && journey ? (
    <section key="community">
      <h2 className="text-xs uppercase tracking-widest text-ink-3">{t.community}</h2>
      {groups.length === 0 ? <p className="mt-2 text-sm text-ink-3">{t.community_empty}</p> : (
        <ul className="mt-3 space-y-1">
          {groups.slice(0, 6).map((g) => (
            <li key={g.id}>
              <button type="button" onClick={() => onInspect(g.edges[0])} onMouseEnter={() => onHover([g.id, ...g.diseases], g.edges)} onMouseLeave={() => onHover([], [])}
                onFocus={() => onHover([g.id, ...g.diseases], g.edges)} onBlur={() => onHover([], [])}
                className="w-full text-left rounded-lg px-2 py-1.5 text-sm hover:bg-brand-mist">
                <span className="flex items-center gap-2"><Shape type="organization" /><span className="text-ink leading-snug">{g.name}</span></span>
                <span className="block text-xs text-ink-3 pl-5">{g.diseases.map((d) => diseaseName.get(d)).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  ) : null;

  const order: ReactNode[] = persona === "devon" || persona === "maria" ? [communitySection, clusterSection, legendSection]
    : persona === "osei" ? [legendSection, clusterSection, communitySection]
    : [clusterSection, communitySection, legendSection];
  return <>{order}</>;
}

export function Shape({ type }: { type: string }) {
  const c = TYPE_COLOR[type] ?? TYPE_COLOR.study;
  const s = 12;
  return (
    <svg width={s} height={s} viewBox="0 0 12 12" aria-hidden className="shrink-0">
      {type === "gene" && <rect x="1.5" y="1.5" width="9" height="9" rx="2.5" fill={c} />}
      {type === "pathway" && <path d="M6 0.8 11.2 6 6 11.2 0.8 6Z" fill={c} />}
      {type === "trial" && <path d="M6 1 11 10.5H1Z" fill={c} />}
      {type === "organization" && <><circle cx="6" cy="6" r="4.6" fill="none" stroke={c} strokeWidth="1.6" /><circle cx="6" cy="6" r="2" fill={c} /></>}
      {type === "investigator" && <circle cx="6" cy="6" r="4.6" fill="none" stroke={c} strokeWidth="1.8" />}
      {!["gene", "pathway", "trial", "organization", "investigator"].includes(type) && <circle cx="6" cy="6" r="4.5" fill={c} />}
    </svg>
  );
}
