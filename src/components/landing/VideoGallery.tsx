"use client";
/**
 * The two submission videos (Demo · Tech) as poster cards that open a modal player.
 * Sounds (WAVE 6B): `open` / `close` on the modal only. Esc, the close button or the backdrop close it;
 * focus moves into the dialog and back to the card.
 */
import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/sfx";
import { ICON } from "@/lib/icons";
import { Play, X } from "lucide-react";

export interface VideoItem { title: string; purpose: string; url: string; poster?: string; draft: boolean; embed?: string }

export function VideoGallery({ videos }: { videos: VideoItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  const close = () => { setOpen(null); playSfx("close"); requestAnimationFrame(() => opener.current?.focus()); };
  useEffect(() => {
    if (open === null) return;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  const v = open !== null ? videos[open] : null;
  return (
    <>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {videos.map((item, i) => (
          <figure key={item.title} className="overflow-hidden rounded-xl border border-line bg-paper shadow-[var(--shadow-soft)]">
            <button
              type="button"
              onClick={(e) => { opener.current = e.currentTarget; setOpen(i); playSfx("open"); }}
              className="group relative block aspect-video w-full bg-brand-soft"
              aria-label={`Play the ${item.title} video${item.draft ? " (draft)" : ""}`}
            >
              {item.poster && (
                // eslint-disable-next-line @next/next/no-img-element -- static poster frame
                <img src={item.poster} alt="" className="h-full w-full object-cover" loading="lazy" />
              )}
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-deep text-white shadow-lg transition-transform group-hover:scale-105">
                  <Play size={28} strokeWidth={ICON.stroke} aria-hidden className="translate-x-0.5" />
                </span>
              </span>
              {item.draft && <span className="pointer-events-none absolute left-2 top-2 rounded-full border border-line bg-paper/95 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-ink-3">Draft</span>}
            </button>
            <figcaption className="p-4">
              <p className="font-bold text-brand-ink">{item.title}</p>
              <p className="text-sm text-ink-3">{item.purpose}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      {v && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand-ink/40 p-4 backdrop-blur-sm" onClick={close}>
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label={`${v.title} video`}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl outline-none"
          >
            <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
              <p className="font-bold text-brand-ink">{v.title}{v.draft && <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Draft</span>}</p>
              <button type="button" onClick={close} aria-label="Close video" className="grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:bg-brand-mist hover:text-brand-ink">
                <X size={ICON.ui} strokeWidth={ICON.stroke} aria-hidden />
              </button>
            </div>
            <div className="aspect-video bg-brand-ink/5">
              {v.embed
                ? <iframe src={v.embed} title={v.title} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                : <video src={v.url} poster={v.poster} controls autoPlay playsInline className="h-full w-full bg-paper" />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
