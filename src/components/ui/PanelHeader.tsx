"use client";
/**
 * <PanelHeader> — mandatory header for every panel (UX_WAVE4 §3): icon · title · one-line purpose · (i) popover.
 * <PanelState> — the panel body slots: loading (Blender helix + skeleton) · empty · error (retry) · ready.
 * OWNER: brand lane. Portable (no Next-only imports) — usable in /atlas and the Lovable app.
 *
 *   <section aria-labelledby="route-h">
 *     <PanelHeader id="route-h" icon={ACTION_ICON.route} title="Your route"
 *       subtitle="Four questions from your disease to a next step."
 *       info="Each answer links to its evidence. Dashed lines are our analysis and need expert review." />
 *     <PanelState status={journey ? "ready" : error ? "error" : "loading"} onRetry={reload}
 *       empty={{ title: "No route yet", hint: "Pick a disease to start." }}>
 *       …content…
 *     </PanelState>
 *   </section>
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { HelixLoader } from "@/components/three/HelixLoader";
import { ACTION_ICON, ACTION_LABEL, ICON, SIGNAL_ICON, type LucideIcon } from "@/lib/icons";

export interface PanelHeaderProps {
  icon: LucideIcon;
  title: string;
  /** One line: what this panel is for. */
  subtitle?: string;
  /** Content of the (i) popover: how to read it, where the data comes from. */
  info?: ReactNode;
  /** Right-aligned actions (buttons, toggles). */
  actions?: ReactNode;
  /** id for the heading (use it in aria-labelledby on the panel). */
  id?: string;
  level?: 2 | 3;
  className?: string;
}

export function PanelHeader({ icon: Icon, title, subtitle, info, actions, id, level = 2, className = "" }: PanelHeaderProps) {
  const auto = useId();
  const headingId = id ?? `ph-${auto}`;
  const popId = `${headingId}-info`;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);
  const H = level === 2 ? "h2" : "h3";
  const InfoIcon = ACTION_ICON.info;
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <span aria-hidden className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-deep">
        <Icon size={ICON.ui} strokeWidth={ICON.stroke} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <H id={headingId} className="truncate text-[0.95rem] font-bold leading-tight text-brand-ink">{title}</H>
          {info && (
            <div ref={wrap} className="relative">
              <button
                type="button"
                aria-label={`About ${title}`}
                aria-expanded={open}
                aria-controls={popId}
                onClick={() => setOpen((v) => !v)}
                className="grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:bg-brand-mist hover:text-brand-deep"
              >
                <InfoIcon size={ICON.chip} strokeWidth={ICON.stroke} aria-hidden />
              </button>
              {open && (
                <div id={popId} role="dialog" aria-label={`About ${title}`} className="absolute left-1/2 top-8 z-50 w-72 -translate-x-1/2 rounded-xl border border-line bg-paper p-3 text-sm text-ink-2 shadow-[var(--shadow-soft)]">
                  {info}
                </div>
              )}
            </div>
          )}
        </div>
        {subtitle && <p className="mt-0.5 text-xs leading-snug text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

export type PanelStatus = "ready" | "loading" | "empty" | "error";

export interface PanelStateProps {
  status: PanelStatus;
  children?: ReactNode;
  /** Loading copy (default "Following the evidence…"). */
  loadingLabel?: string;
  /** Skeleton rows shown under the loader. */
  skeleton?: number;
  empty?: { title: string; hint?: string; action?: ReactNode };
  /** Error copy (default "We couldn't load this. Try again."). */
  errorLabel?: string;
  onRetry?: () => void;
  className?: string;
}

export function PanelState({ status, children, loadingLabel = ACTION_LABEL.loading, skeleton = 3, empty, errorLabel = ACTION_LABEL.error, onRetry, className = "" }: PanelStateProps) {
  if (status === "ready") return <>{children}</>;
  if (status === "loading") {
    return (
      <div role="status" aria-live="polite" className={`py-4 ${className}`}>
        <div className="flex items-center gap-3 text-sm text-ink-3">
          <HelixLoader size={28} label={loadingLabel} />
          <span>{loadingLabel}</span>
        </div>
        <div aria-hidden className="mt-3 space-y-2">
          {Array.from({ length: skeleton }, (_, i) => (
            <div key={i} className="h-3 animate-pulse rounded-full bg-brand-soft" style={{ width: `${92 - i * 14}%` }} />
          ))}
        </div>
      </div>
    );
  }
  if (status === "empty") {
    const Gap = SIGNAL_ICON.gap;
    return (
      <div className={`flex items-start gap-3 rounded-xl border border-dashed border-line p-4 text-sm ${className}`}>
        <Gap size={ICON.ui} strokeWidth={ICON.stroke} aria-hidden className="mt-0.5 shrink-0 text-amber" />
        <div>
          <p className="font-semibold text-brand-ink">{empty?.title ?? "Nothing here yet"}</p>
          {empty?.hint && <p className="mt-0.5 text-ink-3">{empty.hint}</p>}
          {empty?.action && <div className="mt-2">{empty.action}</div>}
        </div>
      </div>
    );
  }
  const Err = ACTION_ICON.error;
  const Retry = ACTION_ICON.retry;
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-xl border border-line bg-paper-2 p-4 text-sm ${className}`}>
      <Err size={ICON.ui} strokeWidth={ICON.stroke} aria-hidden className="mt-0.5 shrink-0 text-ink-3" />
      <div className="flex-1">
        <p className="text-ink-2">{errorLabel}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-brand-ink hover:border-brand-deep">
            <Retry size={ICON.chip} strokeWidth={ICON.stroke} aria-hidden />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
