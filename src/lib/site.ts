/** Brand + links. OWNER: brand lane. Videos accept YouTube (watch or embed), Vimeo or a direct .mp4 URL. */
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

export const site = {
  name: "Nexmed",            // product
  company: "Nedamex",        // company behind the product (footer, legal, metadata, agent tags)
  logo: "/brand/nexmed-logo.png",
  tagline: "The rare disease atlas where every connection shows its source.",
  taglineShort: "Rare disease, connected. Every link sourced.",
  description:
    "Evidence knowledge graph for rare diseases: shared mechanisms, reusable assets, collaborators and a next step — every edge with its source, relationship type and confidence. Hack-Nation 7 · Challenge 05.",
  challenge: "Hack-Nation 7 · Challenge 05 · AI Atlas for Rare Diseases · Buffalo Initiative × OpenAI",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000"),
  github: process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect",
  videos: {
    demo: process.env.NEXT_PUBLIC_VIDEO_DEMO ?? "",
    tech: process.env.NEXT_PUBLIC_VIDEO_TECH ?? "",
    team: process.env.NEXT_PUBLIC_VIDEO_TEAM ?? "",
  },
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

export function toEmbed(url: string) {
  if (!url) return "";
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}
