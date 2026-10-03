/** Brand + links. Videos accept YouTube (watch or embed), Vimeo or a direct .mp4 URL. */
export const site = {
  name: "Nexmed",
  logo: "/brand/nexmed-logo.png",
  tagline: "The rare disease atlas where every connection shows its source.",
  taglineShort: "Rare disease, connected. Every link sourced.",
  challenge: "Hack-Nation 7 · Challenge 5 · AI Atlas for Rare Diseases · Buffalo Initiative × OpenAI",
  github: process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/",
  videos: {
    demo: process.env.NEXT_PUBLIC_VIDEO_DEMO ?? "",
    tech: process.env.NEXT_PUBLIC_VIDEO_TECH ?? "",
    team: process.env.NEXT_PUBLIC_VIDEO_TEAM ?? "",
  },
};

export function toEmbed(url: string) {
  if (!url) return "";
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}
