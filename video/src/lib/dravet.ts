import { C } from "../theme";
import { Pt } from "./route";

/**
 * Sample Dravet map used in the videos. Only real identifiers:
 * ORPHA:33069 (Orphanet), SCN1A = HGNC:10585, HPO terms below, approved Dravet therapies
 * (stiripentol, cannabidiol, fenfluramine) via Open Targets, Dravet Syndrome Foundation (seed list).
 * No NCT or PMID numbers are shown on purpose (the live app shows them).
 */
export type MapStation = { at: Pt; name: string; code?: string; source?: string; place: "above" | "below" | "left" | "right" };
export type MapLine = { key: string; color: string; pts: Pt[]; dashed?: boolean; stations: MapStation[]; t: [number, number] };

export const HUB: Pt = [820, 540];

export const DRAVET_LINES: MapLine[] = [
  {
    key: "gene",
    color: C.gene,
    pts: [HUB, [580, 300], [250, 300]],
    stations: [{ at: [330, 300], name: "SCN1A", code: "HGNC:10585", source: "ClinVar", place: "above" }],
    t: [0.8, 1.8],
  },
  {
    key: "pheno",
    color: C.pheno,
    pts: [HUB, [1820, 540]],
    stations: [
      { at: [1060, 540], name: "Febrile seizure", code: "HP:0002373", place: "above" },
      { at: [1270, 540], name: "Myoclonus", code: "HP:0001336", place: "below" },
      { at: [1490, 540], name: "Status epilepticus", code: "HP:0002133", place: "above" },
      { at: [1700, 540], name: "Developmental delay", code: "HP:0001263", place: "below" },
    ],
    t: [1.6, 3.4],
  },
  {
    key: "treat",
    color: C.treat,
    pts: [HUB, [1140, 220], [1820, 220]],
    stations: [
      { at: [1250, 220], name: "Stiripentol", source: "Open Targets", place: "above" },
      { at: [1480, 220], name: "Cannabidiol", source: "Open Targets", place: "above" },
      { at: [1710, 220], name: "Fenfluramine", source: "Open Targets", place: "above" },
    ],
    t: [3.0, 4.6],
  },
  {
    key: "trial",
    color: C.trial,
    pts: [HUB, [250, 540]],
    stations: [{ at: [380, 540], name: "Active trials", source: "ClinicalTrials.gov", place: "above" }],
    t: [4.4, 5.2],
  },
  {
    key: "comm",
    color: C.comm,
    pts: [HUB, [580, 780], [250, 780]],
    stations: [{ at: [330, 780], name: "Dravet Syndrome Foundation", source: "patient org", place: "below" }],
    t: [5.0, 5.9],
  },
  {
    key: "lit",
    color: C.lit,
    pts: [HUB, [820, 960]],
    stations: [{ at: [820, 900], name: "Literature", source: "PubMed", place: "right" }],
    t: [5.7, 6.5],
  },
  {
    key: "gap",
    color: C.gap,
    dashed: true,
    pts: [HUB, [1040, 760], [1440, 760]],
    stations: [{ at: [1440, 760], name: "Cure by diet?", code: "no evidence", place: "right" }],
    t: [6.8, 8.0],
  },
];

export const LEGEND = [
  { label: "Genes", color: C.gene },
  { label: "Symptoms", color: C.pheno },
  { label: "Treatments", color: C.treat },
  { label: "Trials", color: C.trial },
  { label: "Community", color: C.comm },
  { label: "Literature", color: C.lit },
  { label: "No evidence", color: C.gap, dashed: true },
];
