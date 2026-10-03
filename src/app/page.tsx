import Link from "next/link";
import { site } from "@/lib/site";
import { journey, stats } from "@/lib/atlas/store";
import { FlowDiagram } from "@/components/FlowDiagram";
import { VideoSlot } from "@/components/VideoSlot";

const MARIA = "disease:ORPHA:599373";
const SOURCES = ["Orphanet", "HPO", "Monarch", "ClinVar", "ClinicalTrials.gov", "Open Targets", "Reactome", "PubMed", "NIH RePORTER", "Patient groups"];

const PERSONAS = [
  { name: "Maria", role: "Patient organization leader", need: "Which communities share our mechanism, what can we reuse, and who do we call this week?" },
  { name: "Devon", role: "Newly diagnosed caregiver", need: "Is there a group for my child's exact diagnosis — and if not, the closest one?" },
  { name: "Priya", role: "Biotech / pharma scout", need: "Which disease clusters could my mechanism treat, with active advocacy and assets?" },
  { name: "Dr. Osei", role: "Clinician-scientist", need: "Who works on my mechanism under a different gene name?" },
];

export default function Home() {
  const s = stats();
  const j = journey(MARIA, "en");
  const lead = j?.shares[0];
  const shared = j?.assets.own.find((a) => a.shared_with.length);
  const bridge = j?.collaborators.find((c) => c.kind === "investigator" && c.diseases.length > 1);
  const atlasHref = `/atlas?d=${encodeURIComponent(MARIA)}&p=maria`;

  return (
    <main>
      <header className="sticky top-0 z-20 backdrop-blur bg-paper/80 border-b border-line">
        <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
          <span className="font-semibold tracking-tight flex items-center gap-2">
            <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden><circle cx="9" cy="10" r="3" fill="var(--teal)" /><circle cx="23" cy="8" r="2.2" fill="#8b7cf6" /><circle cx="20" cy="23" r="3.4" fill="#d97706" /><path d="M9 10 23 8M9 10l11 13M23 8l-3 15" stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 2" /></svg>
            {site.name}
          </span>
          <nav className="flex items-center gap-5 text-sm text-ink-2">
            <a href="#journey" className="hover:text-ink hidden sm:inline">Journey</a>
            <a href="#evidence" className="hover:text-ink hidden sm:inline">Evidence</a>
            <a href="#moonshot" className="hover:text-ink hidden sm:inline">10×</a>
            <a href={site.github} className="hover:text-ink" target="_blank" rel="noreferrer">GitHub</a>
            <Link href="/atlas" className="rounded-full bg-navy text-paper px-4 py-1.5 font-medium">Open the atlas</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-12 grid lg:grid-cols-[1.1fr_.9fr] gap-10 items-center">
        <div>
          <p className="chip mb-5">{site.challenge}</p>
          <h1 className="serif text-5xl md:text-6xl leading-[1.05] text-navy">From an isolated diagnosis <br /><span className="text-teal">to a shared path.</span></h1>
          <p className="mt-6 text-lg text-ink-2 max-w-xl">
            Search a rare disease. The atlas follows it to a disrupted mechanism, a related disease, the community already working on it, a reusable asset and a concrete next step — and a voice walks you through it, citing the source of every sentence.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={atlasHref} className="rounded-full bg-teal text-white px-6 py-3 font-medium">Follow Maria’s case →</Link>
            <Link href="/atlas" className="rounded-full border border-line px-6 py-3 font-medium hover:bg-paper-2">Search any disease</Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Data sources">
            {SOURCES.map((x) => <li key={x} className="chip"><span className="w-1.5 h-1.5 rounded-full bg-teal" aria-hidden />{x}</li>)}
          </ul>
        </div>

        {/* Lo que el atlas encontró para STXBP1 (en vivo desde el grafo) */}
        {j && (
          <div className="card p-5 space-y-3" aria-label="What the atlas found for STXBP1">
            <p className="text-xs uppercase tracking-widest text-ink-3">Live from the graph · {j.disease.name}</p>
            {lead && (
              <div className="pl-3 py-1 border-l-[3px] border-dashed border-amber">
                <p className="text-sm"><b>Connection (inferred):</b> shares {lead.explanation.shared_phenotypes.slice(0, 3).map((p) => p.name.toLowerCase()).join(", ")} with {lead.name}{lead.explanation.shared_pathways[0] ? ` and the ${lead.explanation.shared_pathways[0].name} pathway` : ""}.</p>
                <p className="text-xs text-ink-3 mt-1">Orphanet · HPO · Reactome · similarity {lead.score.toFixed(2)}</p>
              </div>
            )}
            {shared && (
              <div className="evidence pl-3 py-1">
                <p className="text-sm"><b>Existing asset:</b> “{shared.title}” already includes {shared.shared_with.join(", ")}.</p>
                <p className="text-xs text-ink-3 mt-1">ClinicalTrials.gov · {shared.status.toLowerCase()}</p>
              </div>
            )}
            {bridge && (
              <div className="evidence pl-3 py-1">
                <p className="text-sm"><b>Collaborator:</b> {bridge.name}{bridge.institution ? ` (${bridge.institution.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())})` : ""} — {bridge.why.charAt(0).toLowerCase() + bridge.why.slice(1)}.</p>
                <p className="text-xs text-ink-3 mt-1">NIH RePORTER · PubMed</p>
              </div>
            )}
            {j.gaps.find((g) => g.kind === "no_approved_treatment") && (
              <div className="no-evidence pl-3 py-2 rounded-r-md">
                <p className="text-sm">{j.gaps.find((g) => g.kind === "no_approved_treatment")!.detail}</p>
              </div>
            )}
            <p className="text-xs text-ink-3">Sourced information, not a diagnosis. Inferred links are hypotheses for experts to test.</p>
          </div>
        )}
      </section>

      {/* El grafo en números */}
      <section className="border-y border-line bg-paper-2">
        <div className="mx-auto max-w-6xl px-5 py-10 grid grid-cols-2 md:grid-cols-5 gap-8">
          {[
            [s.diseases, "monogenic diseases (first cluster slice)"], [s.edges.toLocaleString(), "edges, none without evidence"], [s.evidence.toLocaleString(), "evidence records with source + date"],
            [s.clusters, "mechanism clusters found by the graph"], [s.inferred, "inferred links, always labelled as such"],
          ].map(([n, t]) => (
            <div key={String(t)}><p className="serif text-4xl text-navy">{n}</p><p className="text-ink-2 mt-1 text-sm">{t}</p></div>
          ))}
        </div>
      </section>

      {/* Personas */}
      <section id="journey" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="serif text-3xl text-navy">Four people, one graph, four voices</h2>
        <p className="mt-3 text-ink-2 max-w-2xl">Each persona hears the same evidence in a different order and tone — Maria gets strategy, Devon gets gentleness, Priya gets mechanisms, Dr. Osei gets skepticism.</p>
        <div className="mt-8 grid md:grid-cols-4 gap-5">
          {PERSONAS.map((p) => (
            <Link key={p.name} href={`/atlas?d=${encodeURIComponent(MARIA)}&p=${p.name === "Dr. Osei" ? "osei" : p.name.toLowerCase()}`} className="card p-5 hover:border-teal transition-colors">
              <p className="text-xs uppercase tracking-widest text-ink-3">{p.role}</p>
              <h3 className="mt-2 text-xl font-semibold">{p.name}</h3>
              <p className="mt-2 text-ink-2 text-sm">“{p.need}”</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Evidencia */}
      <section id="evidence" className="mx-auto max-w-6xl px-5 pb-16">
        <h2 className="serif text-3xl text-navy">No sentence reaches the voice without a source</h2>
        <p className="mt-3 text-ink-2 max-w-2xl">Every edge is <b>observed</b> (a source states it), <b>inferred</b> (computed by the atlas from observed edges, dashed in the map) or <b>extracted</b> (pulled by OpenAI from a cited abstract, with a verbatim quote checked against the text). The model writes only from numbered facts; a deterministic verifier deletes any sentence that cites a fact that does not exist.</p>
        <div className="card mt-8 p-4 md:p-8"><FlowDiagram /></div>
      </section>

      {/* 10x */}
      <section id="moonshot" className="border-t border-line bg-paper-2">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="serif text-3xl text-navy">The 10× milestone: a trial-ready, shared natural-history cohort</h2>
          <p className="mt-3 text-ink-2 max-w-3xl">For a disease with no approved treatment, a natural-history cohort with agreed outcome measures is the gate to any trial. Today a patient group builds it alone. The atlas shortens the steps that are about <i>finding</i>; the steps that are about <i>doing</i> still take real time. The numbers below are our working assumptions, to be validated with patient groups.</p>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className="text-left text-ink-3 border-b border-line"><th className="py-2 pr-4 font-medium">Step</th><th className="py-2 pr-4 font-medium">Alone (assumption)</th><th className="py-2 pr-4 font-medium">With the atlas</th><th className="py-2 font-medium">What makes it faster</th></tr></thead>
              <tbody className="align-top">
                {[
                  ["Find communities with the same mechanism", "months of cold outreach", "minutes", "phenotype + pathway clustering across gene names"],
                  ["Find an existing cohort or registry to join", "months; often missed", "minutes", "ClinicalTrials.gov assets mapped onto the cluster (e.g. a registry already spanning 4 of these diseases)"],
                  ["Find the researchers already bridging communities", "conferences, luck", "minutes", "NIH RePORTER + PubMed bridges"],
                  ["Agree outcome measures & eligibility", "1–2 years from scratch", "months: adapt, don’t invent", "reusable designs + explicit list of what differs"],
                  ["Enroll enough patients", "limited by one community", "pooled across the cluster", "shared protocol across communities"],
                ].map((r) => <tr key={r[0]} className="border-b border-line"><td className="py-3 pr-4 font-medium">{r[0]}</td><td className="py-3 pr-4 text-ink-2">{r[1]}</td><td className="py-3 pr-4 text-teal font-medium">{r[2]}</td><td className="py-3 text-ink-2">{r[3]}</td></tr>)}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-ink-3 max-w-3xl">What must be validated next: that clustered diseases really share endpoints (expert review of each inferred link), that eligibility can be widened, and that the bridging researchers agree. The atlas lists each of these as an explicit open question instead of hiding it.</p>
        </div>
      </section>

      {/* Videos */}
      <section id="videos" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="serif text-3xl text-navy">Submission videos</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-5">
          <VideoSlot index={1} title="1-minute walkthrough" purpose="Maria: from STXBP1 to a shared cohort and a next step" url={site.videos.demo} />
          <VideoSlot index={2} title="Technical" purpose="Graph, clustering, verifier, OpenAI and how it scales" url={site.videos.tech} />
          <VideoSlot index={3} title="Team" purpose="Who we are and why this problem" url={site.videos.team} />
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-10 text-sm text-ink-3 flex flex-wrap gap-4 justify-between">
          <p>{site.name} · {site.challenge}</p>
          <p>Sourced information, not medical advice. We never sell patient data.</p>
        </div>
      </footer>
    </main>
  );
}
