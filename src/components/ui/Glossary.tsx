"use client";
/**
 * Patient glossary tooltips (UX_WAVE4 §3): dotted underline, definition on hover, focus or tap; Esc closes.
 * OWNER: brand lane. Portable (no Next-only imports).
 *
 *   <Term k="registry">registry</Term>                       one term
 *   <Glossed text={sentence} active={persona === "devon" || prefs.simpleLanguage} />   auto-wraps known terms
 */
import { useId, useState, type ReactNode } from "react";
import { lookupTerm, splitGlossary } from "./glossary";

export function Term({ k, children }: { k: string; children?: ReactNode }) {
  const entry = lookupTerm(k);
  const id = useId();
  const [open, setOpen] = useState(false);
  if (!entry) return <>{children ?? k}</>;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        className="cursor-help rounded-sm text-inherit underline decoration-brand-light decoration-dotted decoration-2 underline-offset-[3px] hover:decoration-brand-deep"
      >
        {children ?? entry.term}
      </button>
      {open && (
        <span id={id} role="tooltip" className="absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[16rem] -translate-x-1/2 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-normal leading-snug text-ink-2 shadow-[var(--shadow-soft)]">
          <span className="font-semibold text-brand-ink">{entry.term}</span>: {entry.definition}
        </span>
      )}
    </span>
  );
}

/** Wraps the first occurrence of each glossary term in `text`. `active=false` renders plain text. */
export function Glossed({ text, active = true }: { text: string; active?: boolean }) {
  if (!active) return <>{text}</>;
  return (
    <>
      {splitGlossary(text).map((part, i) => (typeof part === "string" ? <span key={i}>{part}</span> : <Term key={i} k={part.entry.term}>{part.match}</Term>))}
    </>
  );
}
