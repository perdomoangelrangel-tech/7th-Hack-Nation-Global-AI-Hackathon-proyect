"use client";
/**
 * Delivery videos from site.videos (YouTube / Vimeo / mp4 via toEmbed). Demo leads at double size;
 * an empty URL shows an honest "coming soon" frame, drawn as a dashed line to a hollow station.
 */
import { site, toEmbed } from "@/lib/site";
import { useCopy } from "@/lib/i18n";
import { copy } from "./copy";
import { Play } from "./icons";
import { Head, Section, wrap } from "./Section";

type Key = "demo" | "tech" | "team";

function Frame({ url, title, soon, big }: { url: string; title: string; soon: string; big?: boolean }) {
  const src = toEmbed(url);
  const isFile = /\.(mp4|webm)(\?|$)/i.test(src);
  if (src) {
    return isFile ? (
      <video src={src} controls preload="metadata" className="aspect-video w-full rounded-panel-lg bg-ink" aria-label={title} />
    ) : (
      <iframe
        src={src}
        title={title}
        loading="lazy"
        className="aspect-video w-full rounded-panel-lg border-0 bg-ink"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return (
    <div className="grid aspect-video w-full place-items-center rounded-panel-lg border border-rule bg-panel">
      <div className="flex flex-col items-center gap-3 text-ink-3">
        <svg width={big ? 168 : 120} height={36} viewBox="0 0 120 36" aria-hidden>
          <path d="M6 18 H92" className="route route-gap" strokeWidth={5} />
          <circle cx={6} cy={18} r={6} fill="var(--ink-3)" />
          <circle cx={104} cy={18} r={11} fill="var(--canvas)" stroke="var(--gap)" strokeWidth={2.5} strokeDasharray="3 3" />
        </svg>
        <p className="flex items-center gap-2 font-display text-lg font-bold text-ink-2">
          <Play className="text-ink-3" />
          {soon}
        </p>
      </div>
    </div>
  );
}

export function Videos() {
  const t = useCopy(copy).videos;
  const items: { key: Key; url: string }[] = [
    { key: "demo", url: site.videos.demo },
    { key: "tech", url: site.videos.tech },
    { key: "team", url: site.videos.team },
  ];
  return (
    <Section id="videos" tone="panel">
      <div className={wrap}>
        <Head id="videos" title={t.title} lead={t.lead} />
        <div className="mt-12 grid gap-8 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-6">
          {items.map(({ key, url }, i) => {
            const it = t.items[key];
            const big = i === 0;
            return (
              <figure key={key} className={`m-0 ${big ? "lg:col-span-2 lg:row-span-2" : ""}`}>
                <Frame url={url} title={`${it.title}: ${it.purpose}`} soon={t.soon} big={big} />
                <figcaption className="mt-3 flex flex-wrap items-baseline gap-x-3">
                  <span className={`font-display font-extrabold ${big ? "text-2xl" : "text-xl"}`}>{it.title}</span>
                  <span className="text-ink-2">{it.purpose}</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
