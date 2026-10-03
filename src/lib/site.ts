/**
 * Configuración de marca y videos. Cambiar aquí el nombre cuando se decida; el logo entra después.
 * Los videos aceptan URL de YouTube (watch o embed), Vimeo o un .mp4 directo.
 */
export const site = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "Atlas",          // nombre tentativo
  tagline: "Cada respuesta rara, con su fuente.",
  taglineEn: "Every rare answer, traced to its source.",
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
