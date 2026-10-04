/**
 * Community (WAVE 6 · T5): researchers already in the graph (public NIH RePORTER grant records, view
 * `community_profiles_public`) + self-submitted clinician/researcher profiles (`profile_submissions`,
 * always badged "Self-submitted · not verified"). No contact data is ever returned.
 * Fallback: the NIH records rebuilt from the graph snapshot.
 */
import { z } from "zod";
import { inOf, type GraphIndex } from "./graph";

export interface CommunityProject { title: string | null; project: string | null; fiscal_year: string | null; institute: string | null; url: string | null }
export interface CommunityProfile {
  id: string;
  name: string;
  kind: "nih_record" | "self_submitted";
  /** Shown on every card: where the profile comes from and whether anyone verified it. */
  badge: string;
  role: string | null;
  institution: string | null;
  diseases: { disease_id: string; disease: string }[];
  projects: CommunityProject[];   // NIH records: each with its RePORTER link (the evidence)
  focus: string | null;
  orcid: string | null;
  link: string | null;
  verified: boolean;
}
export interface CommunityQuery { d?: string | null; q?: string | null; limit?: number }
export interface CommunityResult { profiles: CommunityProfile[]; total: number; sources: ("supabase" | "graph")[]; note: string }

export const BADGE = {
  nih_record: "Public NIH RePORTER grant record",
  self_submitted: "Self-submitted · not verified",
  verified: "Self-submitted · verified by the Nedamex team",
} as const;
export const COMMUNITY_NOTE = "Profiles help people find each other; they are never evidence. Self-submitted profiles are not verified unless marked.";

export const ProfileInput = z.object({
  display_name: z.string().trim().min(2).max(120),
  role: z.enum(["clinician", "researcher", "genetic_counselor", "other"]),
  institution: z.string().trim().max(200).nullable().optional(),
  diseases: z.array(z.string().max(120)).max(30).default([]),
  focus: z.string().trim().max(1000).nullable().optional(),
  orcid: z.string().trim().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, "ORCID looks like 0000-0002-1825-0097").nullable().optional().or(z.literal("").transform(() => null)),
  link: z.string().trim().regex(/^https:\/\//, "link must start with https://").max(300).nullable().optional().or(z.literal("").transform(() => null)),
  consent: z.literal(true, { message: "consent required" }),
});
export type ProfileInput = z.infer<typeof ProfileInput>;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const matchesProfile = (p: CommunityProfile, q: string) => {
  const n = norm(q.trim()); if (!n) return true;
  return [p.name, p.institution ?? "", p.focus ?? "", ...p.diseases.map((d) => d.disease), ...p.projects.map((x) => x.title ?? "")].some((x) => norm(x).includes(n));
};

/** NIH records rebuilt from the graph (investigator --researches--> disease edges with nih_reporter evidence). */
export function communityFromGraph(g: GraphIndex, query: CommunityQuery = {}): CommunityProfile[] {
  const byInv = new Map<string, CommunityProfile>();
  const diseases = query.d ? [query.d] : g.snap.entities.filter((e) => e.type === "disease").map((e) => e.id);
  for (const d of diseases) {
    for (const e of inOf(g, d).filter((x) => x.relation === "researches" && g.byId.get(x.from)?.type === "investigator")) {
      const ev = e.evidence.find((x) => x.source === "nih_reporter");
      if (!ev) continue; // the community lists public grant records only; PubMed authors stay in the graph
      const inv = g.byId.get(e.from)!;
      const p = byInv.get(inv.id) ?? {
        id: inv.id, name: inv.name, kind: "nih_record" as const, badge: BADGE.nih_record, role: null,
        institution: (inv.props.institution as string | undefined) ?? null, diseases: [], projects: [], focus: null, orcid: null, link: null, verified: true,
      };
      if (!p.diseases.some((x) => x.disease_id === d)) p.diseases.push({ disease_id: d, disease: g.byId.get(d)?.name ?? d });
      p.projects.push({ title: (e.props.title as string | undefined) ?? null, project: (e.props.project as string | undefined) ?? ev.external_id, fiscal_year: e.props.fiscal_year != null ? String(e.props.fiscal_year) : null, institute: (e.props.institute as string | undefined) ?? null, url: ev.url });
      byInv.set(inv.id, p);
    }
  }
  let out = [...byInv.values()];
  if (query.q) out = out.filter((p) => matchesProfile(p, query.q!));
  return out;
}

/** Map a `community_profiles_public` row. */
export function fromProfileView(r: Record<string, unknown>): CommunityProfile {
  return {
    id: String(r.entity_id), name: String(r.name), kind: "nih_record", badge: BADGE.nih_record, role: null,
    institution: (r.institution as string | null) ?? null,
    diseases: ((r.diseases as { disease_id: string; disease: string }[] | null) ?? []).filter((x) => x?.disease_id),
    projects: ((r.projects as CommunityProject[] | null) ?? []).filter((x) => x && (x.url || x.title)),
    focus: null, orcid: null, link: null, verified: true,
  };
}

/** Map a `profile_submissions` row (no contact column exists). */
export function fromSubmission(r: Record<string, unknown>, diseaseName: (id: string) => string): CommunityProfile {
  const verified = r.status === "verified";
  return {
    id: `profile:${r.id}`, name: String(r.display_name), kind: "self_submitted", badge: verified ? BADGE.verified : BADGE.self_submitted,
    role: (r.role as string | null) ?? null, institution: (r.institution as string | null) ?? null,
    diseases: ((r.diseases as string[] | null) ?? []).map((id) => ({ disease_id: id, disease: diseaseName(id) })),
    projects: [], focus: (r.focus as string | null) ?? null, orcid: (r.orcid as string | null) ?? null, link: (r.link as string | null) ?? null, verified,
  };
}

/** NIH records first (most diseases, most recent funding), then self-submitted profiles. */
export function rankProfiles(ps: CommunityProfile[]): CommunityProfile[] {
  const year = (p: CommunityProfile) => Math.max(0, ...p.projects.map((x) => Number(x.fiscal_year ?? 0)));
  return [...ps].sort((a, b) => Number(a.kind === "self_submitted") - Number(b.kind === "self_submitted") || b.diseases.length - a.diseases.length || year(b) - year(a) || a.name.localeCompare(b.name));
}
