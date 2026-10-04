/**
 * Nexmed logo: the cyanotype mark (DNA helix rising from a forest) + wordmark. Server-safe.
 *   <Logo />                 mark + "Nexmed"
 *   <Logo size="lg" byline /> mark + "Nexmed" + "by Nedamex"
 *   <Logo wordmark={false} /> mark only (still labelled for screen readers)
 */
import Image from "next/image";
import { site } from "@/lib/site";

const SIZES = { sm: { mark: 28, text: "text-lg" }, md: { mark: 36, text: "text-xl" }, lg: { mark: 56, text: "text-3xl" } } as const;

export function Logo({ size = "md", wordmark = true, byline = false, className = "" }: { size?: keyof typeof SIZES; wordmark?: boolean; byline?: boolean; className?: string }) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image src="/brand/nexmed-logo-192.png" alt={wordmark ? "" : site.name} width={s.mark} height={s.mark} className="rounded-full shrink-0" priority={size !== "sm"} />
      {wordmark && (
        <span className="leading-none">
          <span className={`display font-semibold tracking-tight text-brand-ink ${s.text}`}>{site.name}</span>
          {byline && <span className="block text-[0.7rem] text-ink-3 mt-1 tracking-wide">by {site.company}</span>}
        </span>
      )}
    </span>
  );
}
