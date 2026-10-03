import type { ReactNode } from "react";

/** Page container: 16px gutter on phones, 1280px max. */
export const wrap = "mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10";

export function Section({
  id,
  children,
  className = "",
  tone = "canvas",
}: {
  id: string;
  children: ReactNode;
  className?: string;
  tone?: "canvas" | "panel";
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-16 border-t border-rule py-16 sm:py-20 lg:py-28 ${tone === "panel" ? "bg-panel" : "bg-canvas"} ${className}`}
    >
      {children}
    </section>
  );
}

/** Section heading: ≤ 4 words + one support line. No kicker, no chip. */
export function Head({ id, title, lead, className = "" }: { id: string; title: string; lead?: string; className?: string }) {
  return (
    <div className={className}>
      <h2 id={`${id}-title`} className="text-[clamp(2.1rem,4.6vw,3.6rem)]">
        {title}
      </h2>
      {lead ? <p className="mt-4 max-w-[46ch] text-lg text-ink-2 sm:text-xl">{lead}</p> : null}
    </div>
  );
}
