import { toEmbed } from "@/lib/site";

export function VideoSlot({ title, purpose, url, index }: { title: string; purpose: string; url: string; index: number }) {
  const src = toEmbed(url);
  const isFile = src.endsWith(".mp4") || src.endsWith(".webm");
  return (
    <figure className="card overflow-hidden">
      <div className="aspect-video bg-navy/5 relative">
        {src ? (
          isFile ? <video src={src} controls className="w-full h-full" />
                 : <iframe src={src} title={title} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        ) : (
          <div className="absolute inset-0 grid place-items-center grid-bg">
            <div className="text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full border border-line grid place-items-center text-ink-3 pulse" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </div>
              <p className="text-xs uppercase tracking-widest text-ink-3">Video {index} · pendiente</p>
            </div>
          </div>
        )}
      </div>
      <figcaption className="p-4">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-ink-3">{purpose}</p>
      </figcaption>
    </figure>
  );
}
