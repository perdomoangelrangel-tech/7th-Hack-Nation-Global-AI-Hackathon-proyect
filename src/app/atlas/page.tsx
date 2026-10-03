import type { Metadata } from "next";
import { getDiseaseMap, listDiseases } from "@/lib/atlas-data";
import { resolveDisease } from "@/lib/agents/detect";
import { AtlasApp } from "@/components/atlas/AtlasApp";
import { isAudience } from "@/components/atlas/lines";

export const metadata: Metadata = {
  title: "Atlas",
  description: "Rare diseases drawn as a transit map of evidence: genes, symptoms, treatments, trials, papers and community. Every station has a source.",
};

const DEFAULT_ORPHA = "ORPHA:33069";

export default async function AtlasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const d = typeof sp.d === "string" ? sp.d : undefined;
  const a = typeof sp.a === "string" ? sp.a : undefined;
  const diseases = await listDiseases();
  const orpha = resolveDisease(d, diseases)?.orpha ?? diseases.find((x) => x.orpha === DEFAULT_ORPHA)?.orpha ?? diseases[0]?.orpha ?? DEFAULT_ORPHA;
  const map = await getDiseaseMap(orpha);
  return <AtlasApp diseases={diseases} map={map} orpha={orpha} initialAudience={isAudience(a) ? a : "family"} />;
}
