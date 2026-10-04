"use client";
/**
 * QA-39 · pending feedback for Home → /atlas. The route-level fallback (src/app/atlas/loading.tsx) makes the
 * navigation itself instant; these cover the moment between the click and that fallback.
 *   <Link …>Label<PendingHint label="Opening your route…" /></Link>   (must be inside a <Link>)
 *   <PendingStatus pending={isPending} label="…" />                   (router.push inside startTransition)
 * Fixed size, always rendered, opacity toggled → no layout shift. Spinner stops under reduced motion.
 */
import { useLinkStatus } from "next/link";
import { LoaderCircle } from "lucide-react";
import { HelixLoader } from "@/components/three/HelixLoader";

export function PendingHint({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className={`inline-grid h-4 w-4 place-items-center transition-opacity ${pending ? "opacity-100" : "opacity-0"}`}>
      <LoaderCircle aria-hidden size={16} className="motion-safe:animate-spin" />
      <span className="sr-only" role="status">{pending ? label : ""}</span>
    </span>
  );
}

export function PendingStatus({ pending, label }: { pending: boolean; label: string }) {
  return (
    <p role="status" className={`mt-3 flex min-h-6 items-center justify-center gap-2 text-sm text-ink-2 transition-opacity ${pending ? "opacity-100" : "opacity-0"}`}>
      {pending && <><span aria-hidden className="inline-grid"><HelixLoader size={18} label={label} /></span>{label}</>}
    </p>
  );
}
