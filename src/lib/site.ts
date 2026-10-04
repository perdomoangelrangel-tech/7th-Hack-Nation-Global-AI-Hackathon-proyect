/** Brand + links. OWNER: brand lane. Videos accept YouTube (watch or embed), Vimeo or a direct .mp4 URL. */
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

export const site = {
  name: "Nedamex",           // product (WAVE 3: the product is called Nedamex too)
  company: "Nedamex",        // company behind the product (footer, legal, metadata, agent tags)
  logo: "/brand/nexmed-logo.png",
  tagline: "The rare disease atlas where every connection shows its source.",
  taglineShort: "Rare disease, connected. Every link sourced.",
  description:
    "Evidence knowledge graph for rare diseases: shared mechanisms, reusable assets, collaborators and a next step — every edge with its source, relationship type and confidence. Hack-Nation 7 · Challenge 05.",
  challenge: "Hack-Nation 7 · Challenge 05 · AI Atlas for Rare Diseases · Buffalo Initiative × OpenAI",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000"),
  github: process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect",
  /** Deep links into the atlas (mode cards, "Explore it"): programHref({ p, d }). Prod env = https://nedamex.lovable.app/atlas. */
  programUrl: (process.env.NEXT_PUBLIC_PROGRAM_URL ?? "/atlas").replace(/\/$/, ""),
  /** WAVE 5B: "Open Nedamex" (nav, hero, how-to strip, footer) lands on the app home, where you pick your role. */
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "https://nedamex.lovable.app").replace(/\/$/, "") || "/",
  /** The two submission videos (form: Demo ≤ 60 s · Tech ≤ 60 s). Final URLs come from env. */
  videos: {
    pitch: process.env.NEXT_PUBLIC_VIDEO_PITCH ?? "",
    demo: process.env.NEXT_PUBLIC_VIDEO_DEMO ?? "",
    tech: process.env.NEXT_PUBLIC_VIDEO_TECH ?? "",
  },
  /** Fallbacks until the env URLs exist: the Demo storyboard draft and our Remotion Tech video (draft = Tech60 storyboard). */
  draftVideos: {
    pitch: { src: "/videos/nedamex-pitch.mp4", poster: "/videos/nedamex-pitch.jpg" },
    demo: { src: "/videos/nedamex-demo.mp4", poster: "/videos/nedamex-demo.jpg" },
    tech: { src: "/videos/nedamex-tech-final.mp4", poster: "/videos/nedamex-tech-final.jpg" },
    techStoryboard: { src: "/videos/nedamex-tech-final.mp4", poster: "/videos/nedamex-tech-final.jpg" },
  },
  /** Team cards (names and roles given by the team, 4 Oct 2026). */
  team: [
    { name: "Ángel Perdomo Rangel", role: "CEO & Founder" },
    { name: "Yves Du Solier López", role: "Executive Creative Director & Co-founder" },
    { name: "Jhoel Francisco Velasco Bazan", role: "Chief Marketing Officer" },
  ],
  /** Data licenses shown in the footer (see docs/DATA_SOURCES.md). */
  licenses: [
    { name: "Orphanet", license: "CC BY 4.0" },
    { name: "HPO", license: "HPO license (attribution)" },
    { name: "Monarch Initiative", license: "CC BY 4.0 / BSD" },
    { name: "ClinVar · PubMed · ClinicalTrials.gov", license: "public domain (NLM / NIH)" },
    { name: "Open Targets", license: "CC0" },
    { name: "Reactome", license: "CC BY 4.0" },
  ],
};

/** Link into the Nedamex app: programHref() → "/atlas", programHref({ p: "maria", d: "disease:ORPHA:599373" }) → "/atlas?p=maria&d=…". */
export function programHref(params: Record<string, string | undefined> = {}) {
  const q = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!).replace(/%3A/gi, ":")}`).join("&");
  return q ? `${site.programUrl}?${q}` : site.programUrl;
}

export function toEmbed(url: string) {
  if (!url) return "";
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}
