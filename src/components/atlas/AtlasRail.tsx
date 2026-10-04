"use client";
/**
 * Left icon rail (UX_WAVE4 S2): 56 px of icons — Clusters · How to read · Community — that opens a 280 px panel.
 * Closed by default for Patient and Family, open on Clusters for Researcher and Pharma (Pharma ranks clusters).
 * Every section explains itself: icon, title, one-line purpose and an (i) with the details.
 */
import { useState, type ReactNode } from "react";
import { BookOpen, HandHeart, Info, Orbit, PanelLeftClose, type LucideIcon } from "lucide-react";
import type { GraphView } from "@/lib/atlas/store";
import type { PersonaId } from "@/lib/agents/profiles";
import type { Dict } from "@/lib/i18n";
import { CANVAS, KIND_STYLE, KINDS, TYPE_COLOR, type LinkKind } from "./colors";
import { playSfx } from "@/lib/sfx";
import { TypeIcon } from "./icons";

export type RailTab = "clusters" | "legend" | "community";

interface SectionProps {
  t: Dict;
  persona: PersonaId;
  view: GraphView | null;
  clusterFilter: string | null;
  onCluster: (id: string | null) => void;
  hiddenKinds: Set<string>;
  onToggleKind: (k: LinkKind) => void;
  onHover: (nodes: string[], edges: string[]) => void;
  presentKinds: Set<string>;
  centrality: Record<string, number>;
  onInspect: (edgeId: string) => void;
}

const LEGEND_KIND_KEY: Record<LinkKind, keyof Dict> = { observed: "legend_observed", inferred: "legend_inferred", extracted: "legend_extracted", proposed: "legend_proposed" };
const SHAPES = ["gene", "pathway", "mechanism", "phenotype", "organization", "trial", "investigator"] as const;
const TABS: { id: RailTab; icon: LucideIcon }[] = [{ id: "clusters", icon: Orbit }, { id: "legend", icon: BookOpen }, { id: "community", icon: HandHeart }];

export const defaultRailTab = (p: PersonaId): RailTab | null => (p === "osei" || p === "priya" ? "clusters" : null);

/** Desktop rail: icons + the open section. */
export function LeftRail({ tab, onTab, ...p }: SectionProps & { tab: RailTab | null; onTab: (t: RailTab | null) => void }) {
  const { t } = p;
  return (
    <div className="hidden lg:flex h-full min-h-0 border-r border-line bg-paper">
      <nav aria-label={t.rail_label} className="w-14 shrink-0 flex flex-col items-center gap-1 py-3 border-r border-line">
        {TABS.map(({ id, icon: I }) => (
          <button key={id} type="button" onClick={() => { playSfx(tab === id ? "close" : "open"); onTab(tab === id ? null : id); }} aria-pressed={tab === id} aria-label={t.rail[id].title} title={t.rail[id].title}
            className={`grid place-items-center w-10 h-10 rounded-xl transition-colors ${tab === id ? "bg-brand-soft text-brand-deep" : "text-ink-2 hover:bg-brand-mist"}`}>
            <I aria-hidden size={20} strokeWidth={1.75} />
          </button>
        ))}
      </nav>
      {tab && (
        <div className="w-[280px] min-h-0 overflow-y-auto p-4">
          <div className="flex justify-end -mt-1 -mr-1">
            <button type="button" onClick={() => { playSfx("close"); onTab(null); }} aria-label={t.rail_close} className="grid place-items-center w-8 h-8 rounded-lg text-ink-3 hover:bg-brand-mist hover:text-ink">
              <PanelLeftClose aria-hidden size={18} strokeWidth={1.75} />
            </button>
          </div>
          <RailSection tab={tab} {...p} />
        </div>
      )}
    </div>
  );
}

export function RailSection({ tab, ...p }: SectionProps & { tab: RailTab }) {
  return tab === "clusters" ? <ClusterSection {...p} /> : tab === "legend" ? <LegendSection {...p} /> : <CommunitySection {...p} />;
}

function SectionHeader({ icon: I, title, subtitle, info }: { icon: LucideIcon; title: string; subtitle: string; info: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="mb-3">
      <div className="flex items-center gap-2">
        <I aria-hidden size={18} strokeWidth={1.75} className="text-brand-deep" />
        <h2 className="text-sm font-semibold text-ink flex-1">{title}</h2>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${title}: info`} className="grid place-items-center w-7 h-7 rounded-full text-ink-3 hover:bg-brand-mist hover:text-ink">
          <Info aria-hidden size={15} strokeWidth={1.75} />
        </button>
      </div>
      <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>
      {open && <p className="mt-2 rounded-lg bg-brand-mist px-3 py-2 text-xs text-ink-2">{info}</p>}
    </header>
  );
}

export function ClusterSection({ t, persona, view, clusterFilter, onCluster, onHover, centrality }: SectionProps) {
  const ranked = persona === "priya";
  const clusters = [...(view?.clusters ?? [])].map((c) => ({ ...c, score: c.diseases.reduce((s, d) => s + (centrality[d] ?? 0), 0) / Math.max(1, c.diseases.length) }));
  if (ranked) clusters.sort((a, b) => b.score - a.score);
  return (
    <section>
      <SectionHeader icon={Orbit} title={ranked ? t.ranked_clusters : t.rail.clusters.title} subtitle={t.rail.clusters.subtitle} info={t.rail.clusters.info} />
      {clusters.length === 0 ? <Skeleton /> : (
        <ul className="space-y-1">
          {clusters.map((c, i) => (
            <li key={c.id}>
              <button type="button" onClick={() => onCluster(clusterFilter === c.id ? null : c.id)} aria-pressed={clusterFilter === c.id}
                onMouseEnter={() => onHover(c.diseases, [])} onMouseLeave={() => onHover([], [])} onFocus={() => onHover(c.diseases, [])} onBlur={() => onHover([], [])}
                className={`w-full text-left rounded-lg px-2 py-1.5 text-sm flex gap-2 items-start transition-colors ${clusterFilter === c.id ? "bg-brand-soft" : "hover:bg-brand-mist"}`}>
                {ranked && <span className="mt-0.5 w-4 text-xs tabular-nums text-ink-3">{i + 1}</span>}
                <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug text-ink">{c.label}</span>
                  <span className="text-xs text-ink-3">{t.n_diseases.replace("{n}", String(c.diseases.length))}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LegendSection({ t, hiddenKinds, onToggleKind, presentKinds }: SectionProps) {
  return (
    <section>
      <SectionHeader icon={BookOpen} title={t.rail.legend.title} subtitle={t.rail.legend.subtitle} info={t.rail.legend.info} />
      <ul className="space-y-1">
        {KINDS.map((k) => {
          const off = hiddenKinds.has(k); const here = presentKinds.has(k);
          return (
            <li key={k}>
              <button type="button" onClick={() => onToggleKind(k)} aria-pressed={!off}
                className={`w-full flex items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition-colors hover:bg-brand-mist ${off ? "opacity-45" : ""}`}>
                <LineSwatch k={k} />
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
        {SHAPES.map((k) => <li key={k} className="flex items-center gap-2"><TypeIcon type={k} size={14} />{t.types[k]}</li>)}
      </ul>
      <p className="text-[11px] text-ink-3 mt-2 px-2">{t.legend_size}</p>
    </section>
  );
}

export function CommunitySection({ t, view, onHover, onInspect }: SectionProps) {
  // Organization nodes on screen and the edges tying them to diseases (focus first). Clicking opens the evidence.
  const focus = view?.focus || null;
  const end = (v: unknown) => (typeof v === "object" && v ? (v as { id: string }).id : String(v));
  const diseaseName = new Map((view?.nodes ?? []).filter((x) => x.type === "disease").map((x) => [x.id, x.name]));
  const groups = (view?.nodes ?? []).filter((x) => x.type === "organization" && !x.draft).map((o) => {
    const links = (view?.links ?? []).filter((l) => end(l.source) === o.id && diseaseName.has(end(l.target)));
    const diseases = [...new Set(links.map((l) => end(l.target)))];
    return { id: o.id, name: o.name, diseases, edges: links.map((l) => l.id), own: !!focus && diseases.includes(focus) };
  }).filter((g) => g.edges.length).sort((a, b) => Number(b.own) - Number(a.own) || a.name.localeCompare(b.name));
  return (
    <section>
      <SectionHeader icon={HandHeart} title={t.rail.community.title} subtitle={t.rail.community.subtitle} info={t.rail.community.info} />
      {!focus ? <p className="text-sm text-ink-3">{t.community_pick}</p> : groups.length === 0 ? <p className="text-sm text-ink-3">{t.community_empty}</p> : (
        <ul className="space-y-1">
          {groups.slice(0, 8).map((g) => (
            <li key={g.id}>
              <button type="button" onClick={() => onInspect(g.edges[0])} onMouseEnter={() => onHover([g.id, ...g.diseases], g.edges)} onMouseLeave={() => onHover([], [])}
                onFocus={() => onHover([g.id, ...g.diseases], g.edges)} onBlur={() => onHover([], [])}
                className="w-full text-left rounded-lg px-2 py-1.5 text-sm hover:bg-brand-mist">
                <span className="flex items-center gap-2"><TypeIcon type="organization" size={14} /><span className="text-ink leading-snug">{g.name}</span></span>
                <span className="block text-xs text-ink-3 pl-6">{g.diseases.map((d) => diseaseName.get(d)).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Compact floating legend on the canvas: the line styles present in the view (+ bridges). */
export function MiniLegend({ t, presentKinds, hasBridges }: { t: Dict; presentKinds: Set<string>; hasBridges: boolean }) {
  const kinds = KINDS.filter((k) => presentKinds.has(k));
  if (!kinds.length) return null;
  return (
    <ul aria-label={t.rail.legend.title} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-line bg-paper/90 px-3 py-1 text-[11px] text-ink-2 shadow-sm">
      {kinds.map((k) => <li key={k} className="flex items-center gap-1.5"><LineSwatch k={k} w={20} />{t.status[k]}</li>)}
      {hasBridges && <li className="flex items-center gap-1.5"><svg width="20" height="8" aria-hidden><line x1="1" y1="4" x2="19" y2="4" stroke={CANVAS.bridge} strokeWidth="2" strokeLinecap="round" /></svg>{t.bridge_short}</li>}
    </ul>
  );
}

function LineSwatch({ k, w = 28 }: { k: LinkKind; w?: number }) {
  const s = KIND_STYLE[k];
  return <svg width={w} height="8" aria-hidden className="shrink-0"><line x1="1" y1="4" x2={w - 1} y2="4" stroke={s.color} strokeOpacity={Math.max(0.55, s.opacity)} strokeWidth={k === "inferred" ? 2.4 : 1.8} strokeDasharray={s.dash?.join(" ")} strokeLinecap="round" /></svg>;
}

function Skeleton(): ReactNode {
  return <div className="space-y-2" aria-busy>{[0, 1, 2].map((i) => <div key={i} className="h-8 rounded-lg bg-paper-2 pulse" />)}</div>;
}

// Re-exported for search rows and legend chips elsewhere.
export { TYPE_COLOR };
