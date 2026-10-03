export interface SeedDisease {
  orpha: string;        // ORPHA:33069
  mondo: string;        // MONDO:0011122
  efo: string;          // MONDO_0011122 (formato Open Targets)
  name: string;
  name_es: string;
  genes: string[];      // símbolos HGNC
  search_terms: string[];
}

export interface SeedOrganization {
  name: string;
  country: string;
  url: string;
  kind: "patient_org" | "research" | "clinic" | "pharma";
  diseases: string[];   // ORPHA codes
}
