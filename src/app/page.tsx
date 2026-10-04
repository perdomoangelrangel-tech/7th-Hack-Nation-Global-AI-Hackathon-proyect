import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import { Nav } from "@/components/landing/Nav";
import { GuidePreview } from "@/components/landing/GuidePreview";
import { AtlasPreview } from "@/components/landing/AtlasPreview";
import { StoryPlayer } from "@/components/landing/StoryPlayer";
import { neighborhood } from "@/components/landing/neighborhood";
import { Logo } from "@/components/brand/Logo";
import { Hero3D } from "@/components/three/Hero3D";
import { NodeOrb, type OrbKind } from "@/components/three/NodeOrb";
import { atlas, loadAtlas, stats } from "@/lib/atlas/store";
import type { Edge } from "@/lib/atlas/types";
import { PERSONAS, type PersonaId } from "@/lib/agents/profiles";
import { programHref, site, toEmbed } from "@/lib/site";

export const revalidate = 3600;

const MODE_ORDER: PersonaId[] = ["devon", "maria", "osei", "priya"];
// Blender glyph icon per mode (public/models/glyphs, built by blender/build_glyphs.py --icons).
const MODE_GLYPH: Record<PersonaId, string> = { devon: "investigator", maria: "organization", osei: "study", priya: "treatment" };
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

const STEPS = [
  { title: "Open sources", body: "Orphanet, HPO, Monarch, ClinVar, Reactome, ClinicalTrials.gov, PubMed, Open Targets, NIH RePORTER. Every row keeps its URL and the date we read it.", tone: "light" as const, glyph: "study" },
  { title: "Evidence graph", body: "Diseases, genes, variants, symptoms, pathways, trials, papers, treatments, patient groups and researchers. Each edge carries its source, relation type and confidence — and contradicting evidence when there is any.", tone: "brand" as const, glyph: "gene" },
  { title: "Mechanism clusters", body: "Louvain communities over shared symptoms (weighted by how informative they are), Reactome pathways and genes — diseases that may share biology even when their names differ.", tone: "deep" as const, glyph: "pathway" },
  { title: "Action", body: `For each mode: the connection, a reusable asset and what differs, a collaborator, and a next step this week. When there is no route, ${site.name} says so.`, tone: "ink" as const, glyph: "organization" },
];

const MODE_COPY: Record<string, string> = {
  devon: "Plain-language answers about the diagnosis, documented treatments, trials and patient groups — read aloud.",
  maria: "From her disease to a shared mechanism, a reusable registry or trial, the researcher who bridges both, and a step for this week.",
  osei: "Mechanism clusters, similarity explanations with their evidence, counterexamples and evidence gaps.",
  priya: "Unmet need, reusable assets and who already works on the mechanism — with every claim traceable.",
};

const KINDS: { kind: OrbKind; title: string; body: string; line: string }[] = [
  { kind: "observed", title: "Observed", body: "A source states it. Solid line.", line: "kind-observed" },
  { kind: "inferred", title: "Inferred", body: `${site.name} analysis, with its score and basis. Dashed line.`, line: "kind-inferred" },
  { kind: "extracted", title: "AI-extracted", body: "OpenAI pulled it from a cited paper. Dotted line — needs expert review.", line: "kind-extracted" },
  { kind: "proposed", title: "Community draft", body: "Proposed by a family or researcher. Ghost line — never counted as evidence.", line: "kind-proposed" },
];

const BUILT = [
  { name: "Vercel", what: "this website and the API" },
  { name: "Lovable", what: "the Nedamex app" },
  { name: "Supabase", what: "the evidence graph (Postgres)" },
  { name: "OpenAI", what: "extraction from papers, grounded explanations" },
  { name: "ElevenLabs", what: "a voice for every agent" },
  { name: "Blender", what: "the 3D hero, voice guide and graph glyphs" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

function EdgeCard({ edge, from, to, sourceName, label }: { edge: Edge; from: string; to: string; sourceName: string; label: string }) {
  const ev = edge.evidence[0];
  const inferred = edge.kind === "inferred";
  const p = edge.props as { phenotype_score?: number; pathway_score?: number };
  return (
    <article className="rounded-xl border border-line bg-paper p-4 shadow-[var(--shadow-soft)]">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-[0.95rem] font-semibold text-brand-ink">
        {from} <span className="font-normal text-ink-3">→ {edge.relation.replace(/_/g, " ")} →</span> {to}
      </p>
      <div className={`mt-3 w-16 ${inferred ? "kind-inferred" : "kind-observed"}`} aria-hidden />
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm [&_dd]:break-words">
        <dt className="text-ink-3">Kind</dt><dd className="text-ink-2">{edge.kind}</dd>
        <dt className="text-ink-3">Confidence</dt>
        <dd className="text-ink-2">
          {edge.confidence.toFixed(inferred ? 3 : 2)}
          {inferred && p.phenotype_score !== undefined && <span className="text-ink-3"> · symptoms {p.phenotype_score} · pathways {p.pathway_score ?? 0}</span>}
        </dd>
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

export default async function Home() {
  await loadAtlas();
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
    return snap.sources[id]?.name ?? (id === "atlas_analysis" ? `${site.name} analysis` : id);
  };
  const updated = s.generated_at ? new Date(s.generated_at).toISOString().slice(0, 10) : null;
  const stepStats = [`${s.sources} sources`, `${fmt(s.edges)} edges`, `${s.clusters} clusters`, "4 modes"];
  const counters = [
    { n: s.diseases, t: "diseases" },
    { n: s.genes, t: "genes" },
    { n: s.edges, t: "sourced edges" },
    { n: s.evidence, t: "evidence records" },
    { n: s.clusters, t: "mechanism clusters" },
    { n: s.sources, t: "open sources" },
  ];
  // Real submission URLs from env; otherwise the storyboard drafts, labelled as drafts.
  const videos = ([
    ["Pitch", "Who we are, the problem and the ask", site.videos.pitch, site.draftVideos.pitch],
    ["Demo", "Maria's case, end to end", site.videos.demo, site.draftVideos.demo],
    ["Functionality", "Graph, evidence, verifier, agents, how it scales", site.videos.functionality, site.draftVideos.functionality],
  ] as const).map(([title, purpose, url, draft]) => ({ title, purpose, url: url || draft.src, poster: url ? undefined : draft.poster, draft: !url }));

  return (
    <>
      <Nav />
      <main id="main">
        {/* Hero */}
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
                <a href={site.programUrl} className="rounded-full bg-brand-deep px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-ink">Open {site.name}</a>
                <a href="#videos" className="rounded-full border border-brand-light bg-paper px-6 py-3 font-semibold text-brand-ink hover:border-brand-deep">Watch the pitch</a>
              </div>
              <p className="mt-5 text-sm text-ink-3">Information with sources — not medical advice.</p>
              {publicFile(STORY.src) && <StoryPlayer src={STORY.src} vtt={publicFile(STORY.vtt) ? STORY.vtt : undefined} />}
            </div>
            <Hero3D alt={`A DNA double helix grows out of a small forest on a blue disc and opens into a network of connected nodes — the ${site.name} evidence graph.`} className="mx-auto w-full max-w-[560px]" />
          </div>
          {/* Live counters */}
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

        {/* The problem */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="problem">
          <p className="eyebrow">The problem</p>
          <h2 id="problem" className="display mt-2 max-w-3xl text-3xl font-semibold text-brand-ink sm:text-4xl">The knowledge exists. It is scattered across databases, papers and registries.</h2>
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

        {/* How it works */}
        <section id="how" className="border-y border-line bg-brand-mist" aria-labelledby="how-title">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="eyebrow">How it works</p>
            <h2 id="how-title" className="display mt-2 max-w-3xl text-3xl font-semibold text-brand-ink sm:text-4xl">From open data to a next step you can take this week.</h2>
            <ol className="relative mt-10 grid gap-5 md:grid-cols-4">
              <svg aria-hidden className="pointer-events-none absolute left-0 right-0 top-[30px] hidden h-2 w-full md:block" preserveAspectRatio="none" viewBox="0 0 100 2">
                <line x1="12" y1="1" x2="88" y2="1" stroke="var(--brand-light)" strokeWidth="0.6" className="flow-dash" vectorEffect="non-scaling-stroke" />
              </svg>
              {STEPS.map((st, i) => (
                <li key={st.title} className="relative rounded-xl border border-line bg-paper p-5 shadow-[var(--shadow-soft)]">
                  <div className="flex items-center gap-3">
                    <Image src={`/models/glyphs/${st.glyph}.png`} alt="" width={64} height={64} className="float-y -my-3 -ml-3 select-none" />
                    <span className="mono text-xs text-ink-3">0{i + 1}</span>
                    <span className="ml-auto rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-deep">{stepStats[i]}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-brand-ink">{st.title}</h3>
                  <p className="mt-2 text-sm text-ink-2">{st.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 max-w-3xl text-ink-2">
              The AI has no knowledge of its own here. It can only say what the graph supports: a deterministic verifier drops every sentence that does not cite an edge before it is shown or spoken.
            </p>
          </div>
        </section>

        {/* Inside the atlas: a real neighbourhood in 3D (Blender glyphs) */}
        {hood && (
          <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="inside-title">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.25fr_.75fr] [&>*]:min-w-0">
              <AtlasPreview data={hood} />
              <div>
                <p className="eyebrow">Inside the atlas</p>
                <h2 id="inside-title" className="display mt-2 text-3xl font-semibold text-brand-ink sm:text-4xl">One disease, in its neighbourhood.</h2>
                <p className="mt-3 text-ink-2">
                  A live slice around <span className="font-semibold text-brand-ink">{hood.centerName}</span>: the gene behind it, the pathways and variants that gene touches, the symptoms, trials, papers, patient groups and researchers — and the diseases {site.name} infers may share its mechanism.
                </p>
                <ul className="mt-5 grid grid-cols-2 gap-2 text-sm text-ink-2">
                  <li><span className="font-bold text-brand-ink">{hoodCount((t) => t === "disease")}</span> inferred neighbours <span className="text-ink-3">(dashed)</span></li>
                  <li><span className="font-bold text-brand-ink">{hoodCount((t) => t === "pathway")}</span> pathways</li>
                  <li><span className="font-bold text-brand-ink">{hoodCount((t) => t === "trial" || t === "study")}</span> trials &amp; papers</li>
                  <li><span className="font-bold text-brand-ink">{hoodCount((t) => t === "organization" || t === "investigator")}</span> groups &amp; researchers</li>
                </ul>
                <p className="mt-4 text-xs text-ink-3">In the 3D view each shape is a type — cell = disease, helix = gene, ring = pathway, drop = symptom, flask = trial, page = paper, people = patient group or researcher — modelled in Blender. A sample of the real edges, not the full graph.</p>
                <a href={programHref(`/atlas?p=maria&d=${MARIA_DISEASE}`)} className="mt-5 inline-block rounded-full border border-brand-light bg-paper px-5 py-2.5 text-sm font-semibold text-brand-ink hover:border-brand-deep">Explore it in {site.name} →</a>
              </div>
            </div>
          </section>
        )}

        {/* Modes */}
        <section id="modes" className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="modes-title">
          <p className="eyebrow">Four modes, one graph</p>
          <h2 id="modes-title" className="display mt-2 max-w-3xl text-3xl font-semibold text-brand-ink sm:text-4xl">The same evidence, ordered for who is asking.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODE_ORDER.map((id) => PERSONAS[id]).map((p) => (
              <a key={p.id} href={programHref(`/atlas?p=${p.id}${p.id === "maria" ? `&d=${MARIA_DISEASE}` : ""}`)} className="group card flex flex-col p-5 transition-colors hover:border-brand hover:bg-paper">
                <Image src={`/models/glyphs/${MODE_GLYPH[p.id]}.png`} alt="" width={84} height={84} className="-m-4 select-none" />
                <h3 className="mt-4 text-lg font-bold text-brand-ink">{p.mode.en}</h3>
                <p className="text-xs text-ink-3">{p.role.en}</p>
                <p className="mt-3 flex-1 text-sm text-ink-2">{MODE_COPY[p.id]}</p>
                <span className="mt-4 text-sm font-semibold text-brand-deep group-hover:underline">Open in {p.mode.en} mode →</span>
              </a>
            ))}
          </div>
        </section>

        {/* Every edge shows its source */}
        <section id="evidence" className="border-y border-line bg-brand-mist" aria-labelledby="evidence-title">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 [&>*]:min-w-0">
            <div>
              <p className="eyebrow">Every edge shows its source</p>
              <h2 id="evidence-title" className="display mt-2 text-3xl font-semibold text-brand-ink sm:text-4xl">Observed is never confused with inferred.</h2>
              <ul className="mt-8 space-y-4">
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
            </div>
            <div className="space-y-4">
              {causes && <EdgeCard edge={causes} from={name(causes.from)} to={name(causes.to)} sourceName={srcName(causes)} label="A real edge from the atlas" />}
              {similar && <EdgeCard edge={similar} from={name(similar.from)} to={name(similar.to)} sourceName={srcName(similar)} label="An inferred edge — and why" />}
              <p className="text-xs text-ink-3">Read directly from the current snapshot. Open the atlas and click any line to inspect it the same way.</p>
            </div>
          </div>
        </section>

        {/* Voice guide */}
        <section id="guide" className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="guide-title">
          <p className="eyebrow">Talk to {site.name}</p>
          <h2 id="guide-title" className="display mt-2 max-w-3xl text-3xl font-semibold text-brand-ink sm:text-4xl">A voice guide in every mode — that only says what it can cite.</h2>
          <p className="mt-3 max-w-2xl text-ink-2">Each mode has its own ElevenLabs voice agent. It answers only from the graph, through the same tools the app uses, and says so when there is no evidence.</p>
          <div className="mt-8"><GuidePreview /></div>
        </section>

        {/* 10x */}
        <section className="border-y border-line bg-brand-mist" aria-labelledby="tenx-title">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="eyebrow">Where this goes</p>
            <h2 id="tenx-title" className="display mt-2 max-w-3xl text-3xl font-semibold text-brand-ink sm:text-4xl">From {fmt(s.diseases)} diseases to all of them.</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="card bg-paper p-5"><h3 className="font-bold text-brand-ink">Every rare disease</h3><p className="mt-2 text-sm text-ink-2">The same ingestion runs per ORPHA code. Scaling to the ~10,000 known diseases is a loop, not a rewrite.</p></div>
              <div className="card bg-paper p-5"><h3 className="font-bold text-brand-ink">New papers, reviewed</h3><p className="mt-2 text-sm text-ink-2">OpenAI extracts claims from new papers as dotted edges labelled “needs expert review” — never shown as established fact.</p></div>
              <div className="card bg-paper p-5"><h3 className="font-bold text-brand-ink">Communities as co-authors</h3><p className="mt-2 text-sm text-ink-2">Patient groups propose links and collaborations as ghost drafts — visible to researchers, never counted as evidence.</p></div>
            </div>
          </div>
        </section>

        {/* Built with */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-labelledby="built-title">
          <h2 id="built-title" className="eyebrow">Built with</h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {BUILT.map((b) => (
              <li key={b.name} className="rounded-full border border-line bg-paper px-4 py-2 text-sm"><span className="font-bold text-brand-ink">{b.name}</span><span className="text-ink-3"> · {b.what}</span></li>
            ))}
          </ul>
        </section>

        {/* Videos */}
        <section id="videos" className="border-t border-line bg-brand-mist" aria-labelledby="videos-title">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="eyebrow">See it</p>
            <h2 id="videos-title" className="display mt-2 text-3xl font-semibold text-brand-ink sm:text-4xl">Pitch, demo and how it works.</h2>
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

        {/* Team */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="team-title">
          <p className="eyebrow">The team</p>
          <h2 id="team-title" className="display mt-2 text-3xl font-semibold text-brand-ink sm:text-4xl">{site.company}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {site.team.map((m, i) => (
              <li key={i} className="card flex items-center gap-4 p-5">
                <NodeOrb size={40} tone={(["brand", "deep", "light"] as const)[i % 3]} />
                <div>
                  <p className="font-bold text-brand-ink">{m.name}</p>
                  <p className="text-sm text-ink-3">{m.role}</p>
                </div>
              </li>
            ))}
          </ul>
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
              <li><a href={site.programUrl} className="text-brand-deep hover:underline">Open {site.name}</a></li>
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
