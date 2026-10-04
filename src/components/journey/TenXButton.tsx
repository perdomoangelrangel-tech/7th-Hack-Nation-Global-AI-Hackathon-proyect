"use client";
/** Opens the 10× view for the current journey in a dialog. */
import { useEffect, useMemo, useRef, useState } from "react";
import type { JourneyV2 } from "@/lib/journey/build";
import type { Locale } from "@/lib/i18n";
import { tenX } from "@/lib/journey/tenx";
import { journeyCopy } from "./copy";
import { TenX } from "./TenX";

export function TenXButton({ journey, locale }: { journey: JourneyV2; locale: Locale }) {
  const c = journeyCopy[locale];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const data = useMemo(() => tenX(journey), [journey]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (open && !el.open) el.showModal(); else if (!open && el.open) el.close();
  }, [open]);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-full bg-brand-deep px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-ink">{c.tenx_cta} →</button>
      <dialog ref={ref} onClose={() => setOpen(false)} aria-label={c.tenx_cta}
        className="m-auto w-[min(760px,calc(100vw-24px))] max-h-[calc(100dvh-24px)] rounded-2xl border border-line bg-paper p-0 text-ink shadow-2xl backdrop:bg-brand-ink/30 backdrop:backdrop-blur-sm">
        {open && (
          <div className="flex flex-col max-h-[calc(100dvh-24px)]">
            <header className="px-5 pt-4 pb-3 border-b border-line flex items-center justify-between gap-3">
              <h2 className="serif text-xl text-brand-ink">{c.tenx_cta}</h2>
              <button onClick={() => setOpen(false)} className="rounded-full w-8 h-8 grid place-items-center text-ink-3 hover:bg-paper-2" aria-label="Close">✕</button>
            </header>
            <div className="px-5 py-4 overflow-y-auto"><TenX data={data} locale={locale} /></div>
            <p className="px-5 py-2.5 border-t border-line text-[11px] text-ink-3">{journey.disclaimer}</p>
          </div>
        )}
      </dialog>
    </>
  );
}
