/**
 * /plan/clusters?l=en — the Pharma "Clusters for your mechanism" table on its own page (printable, shareable).
 * The same <ClusterTable> is what explorer mounts in the atlas center behind the Map/Table toggle.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";
import { ClusterTable } from "@/components/journey/ClusterTable";
import { parseLocale } from "@/lib/journey/server";

export const metadata: Metadata = { title: `Clusters for your mechanism · ${site.company}`, description: "Mechanism clusters ranked by unmet need, every count from a sourced edge.", robots: { index: false } };

export default async function ClustersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const locale = parseLocale(Array.isArray(sp.l) ? sp.l[0] : sp.l);
  return (
    <main className="min-h-dvh bg-brand-mist px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <Link href={`/atlas?p=priya&l=${locale}`} className="text-sm text-brand-deep hover:underline">← {locale === "es" ? "Volver al atlas" : "Back to the atlas"}</Link>
        <div className="mt-3 rounded-2xl border border-line bg-white"><ClusterTable locale={locale} /></div>
        <p className="mt-3 text-xs text-ink-3">{locale === "es" ? "No es consejo médico." : "Not medical advice."} {site.company}</p>
      </div>
    </main>
  );
}
