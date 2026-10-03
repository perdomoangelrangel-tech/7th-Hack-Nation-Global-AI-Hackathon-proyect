/**
 * Brand, links and video URLs. Videos accept YouTube (watch/embed), Vimeo or a direct .mp4.
 */
export const site = {
  name: "Nedamex",
  tagline: { en: "Rare disease, mapped.", es: "Enfermedades raras, en un mapa." },
  promise: { en: "Every answer traced to its source. No source, no answer.", es: "Cada respuesta con su fuente. Sin fuente, no hay respuesta." },
  challenge: "Hack-Nation 7 · Challenge 5 · AI Atlas for Rare Diseases · Buffalo Initiative × OpenAI",
  github: process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect",
  portal: process.env.NEXT_PUBLIC_RESEARCH_PORTAL_URL ?? "",
  videos: {
    demo: process.env.NEXT_PUBLIC_VIDEO_DEMO ?? "",
    tech: process.env.NEXT_PUBLIC_VIDEO_TECH ?? "",
    team: process.env.NEXT_PUBLIC_VIDEO_TEAM ?? "",
  },
  elevenlabs: {
    // Public agent ids (auth disabled, safe in the browser). Env vars override them.
    family: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_FAMILY || "agent_9301m41nb4xre85a4scph5fpbe2q",
    clinical: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_CLINICAL || "agent_6001m41nbk5redqsx3hj321mb4my",
    research: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_RESEARCH || "agent_2301m41nbtczeshvbyxaaknksgga",
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
