import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import { preload } from "react-dom";
import { HERO_POSTER } from "@/components/three/heroPoster";
import { Nav } from "@/components/landing/Nav";
import { GuidePreview } from "@/components/landing/GuidePreview";
import { AtlasPreview } from "@/components/landing/AtlasPreview";
import { StoryPlayer } from "@/components/landing/StoryPlayer";
import { neighborhood } from "@/components/landing/neighborhood";
import { platformTeasers } from "@/components/landing/platform";
import { sourceRows } from "@/components/landing/sources";
import { Logo } from "@/components/brand/Logo";
import { Hero3D } from "@/components/three/Hero3D";
import { NodeOrb, type OrbKind } from "@/components/three/NodeOrb";
import { atlas, loadAtlas, stats } from "@/lib/atlas/store";
import type { Edge } from "@/lib/atlas/types";
import type { PersonaId } from "@/lib/agents/profiles";
import { ACTION_ICON, ICON, MODE_COPY, MODE_ICON, NAV_ICON, NODE_ICON, STEP_ICON } from "@/lib/icons";
import { programHref, site, toEmbed } from "@/lib/site";

export const revalidate = 3600;

// Website story (WAVE 6): hero → problem → how Nedamex works → two ways to start → Medicines bank → Community →
// videos → data & licenses → team → footer. Every "Open Nedamex" → site.appUrl (the platform home, pick your role).

const ROLE_ORDER: PersonaId[] = ["devon", "maria", "osei", "priya"];
// Website narration from the voice lane (ElevenLabs). The player shows up as soon as the file is in public/audio.
const STORY = { src: "/audio/nedamex-story-en.mp3", vtt: "/audio/nedamex-story-en.vtt" };
const publicFile = (url: string) => existsSync(join(process.cwd(), "public", url));
const MARIA_DISEASE = "disease:ORPHA:599373"; // STXBP1-related developmental and epileptic encephalopathy

// Hack-Nation Challenge 05 brief (the only source for these figures).
const FACTS = [
  { n: "~10,000", t: "rare diseases are known" },
  { n: "~80%", t: "have a genetic cause" },
  { n: "~5,000", t: "are monogenic — one gene" },
  { n: "~350M", t: "people live with one" },
  { n: "<5%", t: "have an approved treatment" },
];

const KINDS: { kind: OrbKind; title: string; body: string; line: string }[] = [
  { kind: "observed", title: "Observed", body: "A source states it. Solid line.", line: "kind-observed" },
  { kind: "inferred", title: "Inferred", body: `${site.name} analysis, with its basis. Dashed line — needs expert review.`, line: "kind-inferred" },
  { kind: "extracted", title: "AI-extracted", body: "OpenAI pulled it from a cited paper. Dotted line — needs expert review.", line: "kind-extracted" },
  { kind: "proposed", title: "Community draft", body: "Proposed by a family or researcher. Ghost line — never counted as evidence.", line: "kind-proposed" },
];

const BUILT = [
  { name: "Vercel", what: "this website and the evidence API" },
  { name: "Lovable", what: `the ${site.name} platform` },
  { name: "Supabase", what: "the evidence graph (Postgres)" },
  { name: "OpenAI", what: "extraction from papers, grounded explanations" },
  { name: "ElevenLabs", what: "a voice for every agent" },
  { name: "Blender", what: "the 3D hero, voice guide and graph glyphs" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

const appPath = (path: string) => `${site.appUrl.replace(/\/$/, "")}${path}`;

function EdgeCard({ edge, from, to, sourceName, label }: { edge: Edge; from: string; to: string; sourceName: string; label: string }) {
  const ev = edge.evidence[0];
  const inferred = edge.kind === "inferred";
  return (
    <article className="rounded-xl border border-line bg-paper p-4 shadow-[var(--shadow-soft)]">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-[0.95rem] font-semibold text-brand-ink">
        {from} <span className="font-normal text-ink-3">→ {edge.relation.replace(/_/g, " ")} →</span> {to}
      </p>
      <div className={`mt-3 w-16 ${inferred ? "kind-inferred" : "kind-observed"}`} aria-hidden />
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm [&_dd]:break-words">
        <dt className="text-ink-3">Kind</dt><dd className="text-ink-2">{edge.kind}</dd>
        <dt className="text-ink-3">Source</dt>
        <dd className="text-ink-2">
          {ev?.url ? <a href={ev.url} target="_blank" rel="noreferrer" className="text-brand-deep underline decoration-brand-light underline-offset-2 hover:decoration-brand-deep">{sourceName}</a> : sourceName}
          {ev?.external_id && <span className="mono ml-1.5 break-all text-xs text-ink-3">{ev.external_id}</span>}
        </dd>
        {ev?.retrieved_at && (<><dt className="text-ink-3">Read on</dt><dd className="text-ink-2">{ev.retrieved_at.slice(0, 10)}</dd></>)}
      </dl>
    </article>
  );
}

function SectionHead({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="display mt-2 max-w-3xl text-3xl font-semibold text-brand-ink sm:text-4xl">{title}</h2>
      {children && <div className="mt-3 max-w-3xl text-ink-2">{children}</div>}
    </>
  );
}

export default async function Home() {
  preload(HERO_POSTER.src, { as: "image", fetchPriority: "high", imageSrcSet: HERO_POSTER.srcSet, imageSizes: HERO_POSTER.sizes });
  await loadAtlas();
  const [teasers] = await Promise.all([platformTeasers()]);
  const s = stats();
  const idx = atlas();
  const { snap, byId } = idx;
  const hood = neighborhood(idx, MARIA_DISEASE);
  const hoodCount = (pred: (t: string) => boolean) => hood?.nodes.filter((n) => !n.center && pred(n.type)).length ?? 0;
  const name = (id: string) => byId.get(id)?.name ?? id.split(":").slice(1).join(":");
  const causes = snap.edges.find((e) => e.to === MARIA_DISEASE && e.relation === "causes" && e.kind === "observed");
  const similar = snap.edges.filter((e) => e.relation === "similar_to" && (e.from === MARIA_DISEASE || e.to === MARIA_DISEASE)).sort((a, b) => b.confidence - a.confidence)[0];
  const srcName = (e?: Edge) => {
    const id = e?.evidence[0]?.source;
    if (!id) return "—";
    return id === "atlas_analysis" || id === "nexmed_analysis" ? `${site.name} analysis (inferred)` : snap.sources[id]?.name ?? id;
  };
  const sources = sourceRows(snap);
  const updated = s.generated_at ? new Date(s.generated_at).toISOString().slice(0, 10) : null;
  const counters = [
    { n: s.diseases, t: "diseases" },
    { n: s.genes, t: "genes" },
    { n: s.edges, t: "sourced links" },
    { n: s.evidence, t: "evidence records" },
    { n: s.clusters, t: "mechanism clusters" },
    { n: s.sources, t: "open sources" },
  ];
  const howSteps = [
    { glyph: "study", title: "Open sources", stat: `${s.sources} sources`, body: "Orphanet, HPO, Monarch, ClinVar, Reactome, ClinicalTrials.gov, PubMed, Open Targets, NIH RePORTER and official patient-group sites. Every record keeps its URL and the date we read it." },
    { glyph: "gene", title: "Evidence graph", stat: `${fmt(s.edges)} links`, body: "Diseases, genes, variants, symptoms, pathways, trials, papers, medicines, patient groups and researchers. Each link carries its source, relation type and how sure we are — and contradicting evidence when there is any." },
    { glyph: "pathway", title: "Your route", stat: "4 questions", body: `Diseases are grouped by shared biology — informative symptoms, Reactome pathways, genes — so the route finds neighbours even when names differ: who shares it, what already exists, who could help, what to do next. When there is no supported route, ${site.name} says so.` },
  ];
  // Real submission URLs from env; otherwise the storyboard drafts, labelled as drafts.
  const videos = ([
    ["Pitch", "Who we are, the problem and the ask", site.videos.pitch, site.draftVideos.pitch],
    ["Demo", "Maria's case, end to end", site.videos.demo, site.draftVideos.demo],
    ["Functionality", "Graph, evidence, verifier, agents, how it scales", site.videos.functionality, site.draftVideos.functionality],
  ] as const).map(([title, purpose, url, draft]) => ({ title, purpose, url: url || draft.src, poster: url ? undefined : draft.poster, draft: !url }));
  const Challenge = STEP_ICON[3];
  const Explore = NAV_ICON.search;
  const Pill = NODE_ICON.treatment;
  const People = NODE_ICON.investigator;
  const External = ACTION_ICON.external;
  const btn = "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold";

  return (
    <>
      <Nav />
      <main id="main">
        {/* 1 · Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_75%_45%,var(--brand-soft),transparent_70%),linear-gradient(180deg,var(--brand-mist),var(--paper)_75%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 pb-10 pt-10 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:gap-10 lg:pb-16 lg:pt-14">
            <div>
              <p className="chip">Hack-Nation 7 · Challenge 05 · OpenAI × Buffalo Initiative</p>
              <h1 className="display mt-5 text-[2.6rem] font-semibold leading-[1.02] text-brand-ink sm:text-6xl lg:text-7xl">
                Rare disease, <span className="text-brand-deep">connected.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-ink-2 sm:text-xl">
                One evidence graph from a diagnosis to a shared mechanism, a reusable asset, a collaborator and a next step — every link shows its source.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={site.appUrl} className="rounded-full bg-brand-deep px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-ink">Open {site.name}</Link>
                <a href="#videos" className="rounded-full border border-brand-light bg-paper px-6 py-3 font-semibold text-brand-ink hover:border-brand-deep">Watch the pitch</a>
              </div>
              <p className="mt-5 text-sm text-ink-3">Information with sources — not medical advice.</p>
              {publicFile(STORY.src) && <StoryPlayer src={STORY.src} vtt={publicFile(STORY.vtt) ? STORY.vtt : undefined} />}
            </div>
            <Hero3D alt={`A DNA double helix grows out of a small forest on a blue disc and opens into a network of connected nodes — the ${site.name} evidence graph.`} className="mx-auto w-full max-w-[560px]" />
          </div>
          <div className="relative border-y border-line bg-paper/80">
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
              <ul className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
                {counters.map((c) => (
                  <li key={c.t}>
                    <p className="display text-3xl font-semibold text-brand-ink">{fmt(c.n)}</p>
                    <p className="text-sm text-ink-3">{c.t}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-3">Live from the atlas{updated ? ` · snapshot ${updated}` : ""}. Coverage grows as diseases are ingested.</p>
            </div>
          </div>
        </section>

        {/* 2 · The problem */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="problem">
          <SectionHead id="problem" eyebrow="The problem" title="The knowledge exists. It is scattered across databases, papers and registries." />
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {FACTS.map((f) => (
              <li key={f.t} className="card p-5">
                <p className="display text-3xl font-semibold text-brand-deep">{f.n}</p>
                <p className="mt-1 text-sm text-ink-2">{f.t}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">Source: Hack-Nation Challenge 05 brief.</p>
        </section>

        {/* 3 · How Nedamex works: sources → evidence graph → route */}
        <section id="how" className="border-y border-line bg-brand-mist" aria-labelledby="how-title">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <SectionHead id="how-title" eyebrow={`How ${site.name} works`} title="From open sources to a route you can follow." />
            <ol className="relative mt-10 grid gap-5 md:grid-cols-3 [&>*]:min-w-0">
              <svg aria-hidden className="pointer-events-none absolute left-0 right-0 top-[30px] hidden h-2 w-full md:block" preserveAspectRatio="none" viewBox="0 0 100 2">
                <line x1="16" y1="1" x2="84" y2="1" stroke="var(--brand-light)" strokeWidth="0.6" className="flow-dash" vectorEffect="non-scaling-stroke" />
              </svg>
              {howSteps.map((st, i) => (
                <li key={st.title} className="relative rounded-xl border border-line bg-paper p-5 shadow-[var(--shadow-soft)]">
                  <div className="flex items-center gap-3">
                    <Image src={`/models/glyphs/${st.glyph}.png`} alt="" width={64} height={64} className="float-y -my-3 -ml-3 select-none" />
                    <span className="mono text-xs text-ink-3">0{i + 1}</span>
                    <span className="ml-auto rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-deep">{st.stat}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-brand-ink">{st.title}</h3>
                  <p className="mt-2 text-sm text-ink-2">{st.body}</p>
                </li>
              ))}
            </ol>

            {hood && (
              <div className="mt-14" aria-labelledby="inside-title">
                <div className="grid grid-cols-1 items-end gap-6 lg:grid-cols-[1.1fr_.9fr] [&>*]:min-w-0">
                  <div>
                    <h3 id="inside-title" className="display text-2xl font-semibold text-brand-ink sm:text-3xl">The evidence graph, around one disease.</h3>
                    <p className="mt-2 text-ink-2">
                      A live slice around <span className="font-semibold text-brand-ink">{hood.centerName}</span>: the gene and pathways behind it (ring 1), the diseases {site.name} infers may share its mechanism, ordered by how strong each lead is (ring 2), and the studies, people and symptoms around it (outer sectors).
                    </p>
                  </div>
                  <ul className="grid grid-cols-2 gap-2 text-sm text-ink-2">
                    <li><span className="font-bold text-brand-ink">{hoodCount((t) => t === "disease")}</span> similar diseases <span className="text-ink-3">(dashed · inferred)</span></li>
                    <li><span className="font-bold text-brand-ink">{hoodCount((t) => t === "pathway")}</span> pathways</li>
                    <li><span className="font-bold text-brand-ink">{hoodCount((t) => t === "trial" || t === "study")}</span> trials &amp; papers</li>
                    <li><span className="font-bold text-brand-ink">{hoodCount((t) => t === "organization" || t === "investigator")}</span> groups &amp; researchers</li>
                  </ul>
                </div>
                <div className="mt-6"><AtlasPreview data={hood} /></div>
                <p className="mt-3 text-xs text-ink-3">In the 3D view each shape is a type — cell = disease, helix = gene, ring = pathway, drop = symptom, flask = trial, page = paper, people = patient group or researcher — modelled in Blender. A sample of the real links, not the full graph.</p>
              </div>
            )}

            <div className="mt-14 grid grid-cols-1 items-center gap-8 lg:grid-cols-[.8fr_1.2fr] [&>*]:min-w-0" aria-labelledby="guide-title">
              <div>
                <h3 id="guide-title" className="display text-2xl font-semibold text-brand-ink sm:text-3xl">A guide that only says what it can cite.</h3>
                <p className="mt-2 text-ink-2">Ask by text or by voice (ElevenLabs). The guide answers only from the graph, through the same tools the platform uses. A deterministic verifier drops any sentence that does not cite a link before it is shown or spoken — and it says so when there is no evidence.</p>
              </div>
              <GuidePreview />
            </div>
          </div>
        </section>

        {/* 4 · Two ways to start */}
        <section id="start" className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="start-title">
          <SectionHead id="start-title" eyebrow="Two ways to start" title="Follow Maria's challenge, or explore freely.">
            Open {site.name} and pick your role first — the platform shapes the route for who is asking:
          </SectionHead>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Roles">
            {ROLE_ORDER.map((id) => {
              const Icon = MODE_ICON[id];
              return (
                <li key={id} className="chip !py-1.5 !text-sm">
                  <Icon size={ICON.chip} strokeWidth={ICON.stroke} aria-hidden className="text-brand-deep" />
                  {MODE_COPY[id].title}
                </li>
              );
            })}
          </ul>
          <div className="mt-8 grid gap-5 md:grid-cols-2 [&>*]:min-w-0">
            <article className="flex flex-col rounded-2xl border border-brand-light bg-brand-mist p-6">
              <span aria-hidden className="grid h-11 w-11 place-items-center rounded-xl bg-brand-deep text-white"><Challenge size={ICON.card} strokeWidth={ICON.stroke} /></span>
              <h3 className="mt-4 text-xl font-bold text-brand-ink">Start with the challenge</h3>
              <p className="mt-2 flex-1 text-ink-2">Follow Maria, who leads an STXBP1 family group, through four questions — from her disease to a shared mechanism, a reusable asset, a collaborator and a next step this week. Every step opens its evidence.</p>
              <div className="mt-5"><Link href={programHref({ p: "maria", d: MARIA_DISEASE, mode: "challenge" })} className={`${btn} bg-brand-deep text-white hover:bg-brand-ink`}>Start with the challenge</Link></div>
            </article>
            <article className="flex flex-col rounded-2xl border border-line bg-paper p-6">
              <span aria-hidden className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand-deep"><Explore size={ICON.card} strokeWidth={ICON.stroke} /></span>
              <h3 className="mt-4 text-xl font-bold text-brand-ink">Explore freely</h3>
              <p className="mt-2 flex-1 text-ink-2">Search any of the {fmt(s.diseases)} diseases by name, gene, symptom or synonym, and browse the constellation of mechanism clusters. Tap any line to see where it comes from.</p>
              <div className="mt-5"><Link href={programHref({ mode: "free" })} className={`${btn} border border-brand-light bg-paper text-brand-ink hover:border-brand-deep`}>Explore freely</Link></div>
            </article>
          </div>
        </section>

        {/* 5 · Medicines bank teaser */}
        <section id="medicines" className="border-y border-line bg-brand-mist" aria-labelledby="medicines-title">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1fr] [&>*]:min-w-0">
            <div>
              <SectionHead id="medicines-title" eyebrow="Medicines bank" title="Approved medicines — and exactly where that comes from.">
                {teasers.medicines
                  ? <>{fmt(teasers.medicines.total)} medicines linked to diseases in the atlas, {fmt(teasers.medicines.approved)} of them approved for one of those diseases. Search them and learn each one in depth: mechanism, targets, trial stages and the sources behind every indication.</>
                  : <>Search medicines linked to diseases in the atlas and learn each one in depth: mechanism, targets, trial stages and the sources behind every indication.</>}
              </SectionHead>
              <p className="mt-4 text-sm text-ink-3">No doses and no recommendations — whether a medicine fits a person is a decision for their clinician.</p>
              <div className="mt-6"><Link href={appPath("/medicines")} className={`${btn} bg-brand-deep text-white hover:bg-brand-ink`}><Pill size={ICON.chip} strokeWidth={ICON.stroke} aria-hidden />Open the Medicines bank</Link></div>
            </div>
            {teasers.medicines && teasers.medicines.examples.length > 0 && (
              <ul className="space-y-3 self-center" aria-label="Examples of approved medicines">
                {teasers.medicines.examples.map((m) => (
                  <li key={m.name} className="flex items-center gap-4 rounded-xl border border-line bg-paper p-4 shadow-[var(--shadow-soft)]">
                    <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-deep"><Pill size={ICON.ui} strokeWidth={ICON.stroke} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-brand-ink">{m.name}</p>
                      <p className="text-sm text-ink-2">approved for {m.disease}</p>
                    </div>
                    <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="chip shrink-0 hover:border-brand-deep hover:text-brand-deep">
                      {m.sourceLabel}<External size={12} strokeWidth={ICON.stroke} aria-hidden />
                    </a>
                  </li>
                ))}
                <li className="text-xs text-ink-3">Examples read live from the platform; each link opens the regulator&apos;s label.</li>
              </ul>
            )}
          </div>
        </section>

        {/* 6 · Community teaser (clinicians & researchers) */}
        <section id="community" className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="community-title">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_.9fr] [&>*]:min-w-0">
            <div>
              <SectionHead id="community-title" eyebrow="Community · for clinicians & researchers" title="Find who already works on your mechanism.">
                {teasers.community ? <>{fmt(teasers.community.total)} researchers from NIH RePORTER, each linked to the diseases and funded projects behind them.</> : <>Researchers from NIH RePORTER, each linked to the diseases and funded projects behind them.</>}{" "}
                Clinicians and researchers can add their own profile and start a research project with others who share the mechanism.
              </SectionHead>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href={appPath("/community")} className={`${btn} bg-brand-deep text-white hover:bg-brand-ink`}><People size={ICON.chip} strokeWidth={ICON.stroke} aria-hidden />Open Community</Link>
                <span className="text-sm text-ink-3">Opens in the <span className="font-semibold text-brand-ink">{MODE_COPY.osei.title}</span> role.</span>
              </div>
            </div>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-3 rounded-xl border border-line bg-paper p-4"><span aria-hidden className="kind-observed mt-2 w-10 shrink-0" /><span><span className="font-bold text-brand-ink">Profiles from NIH RePORTER</span> — public award records, with the link to each project.</span></li>
              <li className="flex gap-3 rounded-xl border border-line bg-paper p-4"><span aria-hidden className="kind-proposed mt-2 w-10 shrink-0" /><span><span className="font-bold text-brand-ink">Self-submitted profiles and projects</span> — marked &ldquo;not verified&rdquo;; they never count as evidence.</span></li>
            </ul>
          </div>
        </section>

        {/* 7 · Videos */}
        <section id="videos" className="border-y border-line bg-brand-mist" aria-labelledby="videos-title">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <SectionHead id="videos-title" eyebrow="See it" title="Pitch, demo and how it works." />
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {videos.map((v) => (
                <figure key={v.title} className="overflow-hidden rounded-xl border border-line bg-paper shadow-[var(--shadow-soft)]">
                  <div className="relative aspect-video bg-brand-soft">
                    {/\.mp4($|\?)/.test(v.url)
                      ? <video src={v.url} poster={v.poster} controls preload="none" playsInline className="h-full w-full object-cover" aria-label={`${v.title} video${v.draft ? " (draft)" : ""}`} />
                      : <iframe src={toEmbed(v.url)} title={v.title} className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />}
                    {v.draft && <span className="pointer-events-none absolute left-2 top-2 rounded-full border border-line bg-paper/95 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-ink-3">Draft</span>}
                  </div>
                  <figcaption className="p-4">
                    <p className="font-bold text-brand-ink">{v.title}</p>
                    <p className="text-sm text-ink-3">{v.purpose}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
            {videos.some((v) => v.draft) && <p className="mt-3 text-xs text-ink-3">Drafts: storyboards with placeholders. Final cuts replace them before submission.</p>}
          </div>
        </section>

        {/* 8 · Data & licenses */}
        <section id="data" className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="data-title">
          <SectionHead id="data-title" eyebrow="Data & licenses" title="Every link shows its source." />
          <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2 [&>*]:min-w-0">
            <div>
              <ul className="space-y-4">
                {KINDS.map((k) => (
                  <li key={k.kind} className="flex items-start gap-4">
                    <NodeOrb size={20} kind={k.kind} tone="brand" />
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-brand-ink">{k.title}</p>
                        <span aria-hidden className={`w-14 ${k.line}`} />
                      </div>
                      <p className="text-sm text-ink-2">{k.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-8 space-y-4">
                {causes && <EdgeCard edge={causes} from={name(causes.from)} to={name(causes.to)} sourceName={srcName(causes)} label="A real link from the atlas" />}
                {similar && <EdgeCard edge={similar} from={name(similar.from)} to={name(similar.to)} sourceName={srcName(similar)} label="An inferred link" />}
              </div>
            </div>
            <div>
              <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Sources behind the graph, with licenses and counts</caption>
                  <thead className="bg-brand-mist text-xs uppercase tracking-wider text-ink-3">
                    <tr><th scope="col" className="px-4 py-3 font-bold">Source</th><th scope="col" className="px-4 py-3 font-bold">License</th><th scope="col" className="px-4 py-3 text-right font-bold">Links</th><th scope="col" className="px-4 py-3 text-right font-bold">Evidence</th></tr>
                  </thead>
                  <tbody>
                    {sources.map((r) => (
                      <tr key={r.id} className="border-t border-line align-top">
                        <td className="px-4 py-2.5 font-semibold text-brand-ink">{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline">{r.name}</a> : r.name}</td>
                        <td className="px-4 py-2.5 text-ink-2">{r.license ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{fmt(r.edges)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{fmt(r.evidence)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-ink-3">Counted from the graph this page was built from{updated ? ` (snapshot ${updated})` : ""}. A link can have evidence from several sources.</p>
              <h3 className="eyebrow mt-8">Built with</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {BUILT.map((b) => (
                  <li key={b.name} className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-sm"><span className="font-bold text-brand-ink">{b.name}</span><span className="text-ink-3"> · {b.what}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 9 · Team */}
        <section className="border-t border-line bg-brand-mist" aria-labelledby="team-title">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <SectionHead id="team-title" eyebrow="The team" title={site.company} />
            <ul className="mt-8 grid gap-4 sm:grid-cols-3">
              {site.team.map((m, i) => (
                <li key={i} className="card flex items-center gap-4 bg-paper p-5">
                  <NodeOrb size={40} tone={(["brand", "deep", "light"] as const)[i % 3]} />
                  <div>
                    <p className="font-bold text-brand-ink">{m.name}</p>
                    <p className="text-sm text-ink-3">{m.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <Logo size="md" byline />
            <p className="mt-4 text-ink-2">{site.name} — the AI atlas for rare diseases.</p>
            <p className="mt-2 text-ink-3">Information with sources, not medical advice. Always talk to your care team before acting on anything you read here.</p>
          </div>
          <div>
            <p className="eyebrow">Data</p>
            <ul className="mt-3 space-y-1 text-ink-2">
              {site.licenses.map((l) => <li key={l.name}>{l.name} <span className="text-ink-3">· {l.license}</span></li>)}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Project</p>
            <ul className="mt-3 space-y-1">
              <li><Link href={site.appUrl} className="text-brand-deep hover:underline">Open {site.name}</Link></li>
              <li><Link href={appPath("/medicines")} className="text-brand-deep hover:underline">Medicines bank</Link></li>
              <li><Link href={appPath("/community")} className="text-brand-deep hover:underline">Community</Link></li>
              <li><a href={site.github} target="_blank" rel="noreferrer" className="text-brand-deep hover:underline">Source code on GitHub</a></li>
              <li className="text-ink-3">{site.challenge}</li>
            </ul>
          </div>
        </div>
        <p className="border-t border-line py-4 text-center text-xs text-ink-3">© {new Date().getFullYear()} {site.company}. 3D assets made in Blender from the {site.name} logo.</p>
      </footer>
    </>
  );
}
