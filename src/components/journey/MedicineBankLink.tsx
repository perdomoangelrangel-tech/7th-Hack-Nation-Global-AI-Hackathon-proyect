/**
 * "Open in Medicines bank" → <APP_URL>/medicines/<CHEMBL id> (the platform page with every regulatory link).
 * OWNER: action lane · explorer mounts it in the node drawer for treatment nodes:
 *   <MedicineBankLink id={node.id} locale={locale} />     // id = "treatment:CHEMBL…" or a bare CHEMBL id
 * Renders nothing for ids that are not ChEMBL compounds (no dead links).
 */
import { Pill } from "lucide-react";
import { site } from "@/lib/site";
import type { Locale } from "@/lib/i18n";
import { medicineBankUrl } from "@/lib/journey/medicines";

const LABEL = { en: "Open in Medicines bank", es: "Abrir en el banco de medicamentos" };

export function MedicineBankLink({ id, locale = "en", compact = false, className = "" }: { id: string; locale?: Locale; compact?: boolean; className?: string }) {
  const href = medicineBankUrl(site.appUrl, id);
  if (!href) return null;
  // Inside the platform's iframe the bank must open in the top window, not inside the embedded atlas.
  return (
    <a href={href} target="_top" rel="noopener" onClick={(e) => e.stopPropagation()}
      className={compact
        ? `inline-flex items-center gap-1 text-xs text-brand-deep hover:underline ${className}`
        : `inline-flex items-center gap-1.5 rounded-full border border-brand/50 bg-paper px-3 py-1.5 text-sm font-medium text-brand-deep hover:bg-brand-soft min-h-10 ${className}`}>
      <Pill size={compact ? 13 : 15} aria-hidden />{LABEL[locale]}
    </a>
  );
}
