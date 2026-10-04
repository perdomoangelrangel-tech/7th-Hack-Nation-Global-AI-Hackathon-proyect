/**
 * QA-39 · route-level fallback for /atlas: with it, navigation (Home → route, deep links) shows feedback at once
 * instead of waiting for the server render. No logo/header → also right inside the Lovable frame.
 */
import { HelixLoader } from "@/components/three/HelixLoader";

export default function AtlasLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[radial-gradient(ellipse_at_30%_20%,var(--paper)_0%,var(--brand-mist)_55%,var(--brand-soft)_100%)]">
      <div className="flex flex-col items-center gap-3 text-ink-2">
        <HelixLoader size={56} label="Following the evidence…" />
        <p aria-hidden className="text-sm">Following the evidence…</p>
      </div>
    </div>
  );
}
