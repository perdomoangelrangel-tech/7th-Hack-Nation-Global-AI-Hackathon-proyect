"use client";
/**
 * Glossary tooltips for the Patient view, built on brand's glossary data (`@/components/ui/glossary`).
 * Same look and behavior as brand's <Glossed>. Local copy only because, on Windows, `ui/Glossary.tsx` and
 * `ui/glossary.ts` collide case-insensitively and `@/components/ui/Glossary` resolves to the data file
 * (HANDOFF NEED(brand): rename one). Swap back to brand's component once renamed.
 */
import { useId, useState } from "react";
import { splitGlossary, type GlossaryEntry } from "@/components/ui/glossary";

function Term({ entry, text }: { entry: GlossaryEntry; text: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button type="button" aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        className="cursor-help rounded-sm text-inherit underline decoration-brand decoration-dotted decoration-2 underline-offset-[3px] hover:decoration-brand-deep">
        {text}
      </button>
      {open && (
        <span id={id} role="tooltip" className="absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[16rem] -translate-x-1/2 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-normal leading-snug text-ink-2 shadow-md">
          <span className="font-semibold text-brand-ink">{entry.term}</span>: {entry.definition}
        </span>
      )}
    </span>
  );
}

export function Glossed({ text, active = true }: { text: string; active?: boolean }) {
  if (!active) return <>{text}</>;
  return <>{splitGlossary(text).map((part, i) => (typeof part === "string" ? <span key={i}>{part}</span> : <Term key={i} entry={part.entry} text={part.match} />))}</>;
}
