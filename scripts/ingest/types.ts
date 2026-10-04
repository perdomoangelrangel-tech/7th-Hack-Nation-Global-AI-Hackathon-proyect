export interface SeedDisease {
  orpha: string;        // ORPHA:33069 (identificador canónico del nodo)
  mondo: string;        // MONDO:0011794 (verificado contra Orphanet ExternalReference)
  efo: string;          // MONDO_0011794 (Open Targets format)
  efo_extra?: string[]; // verified Open Targets ancestor ids whose drug indications also apply (SMA → MONDO_0001516)
  omim?: string;        // OMIM:607208 (para anotaciones HPO)
  clinvar_disease?: string; // nombre del rasgo en ClinVar/MedGen ("Developmental and epileptic encephalopathy, 7")
  name: string;
  name_es: string;
  short_name: string;   // etiqueta para el grafo y la voz ("STXBP1-DEE")
  short_name_es: string;
  genes: string[];      // símbolos HGNC
  search_terms: string[];
}

export interface SeedOrganization {
  name: string;
  country: string;
  url: string;
  kind: "patient_org" | "research" | "clinic" | "pharma" | "umbrella";
  diseases: string[];   // ORPHA codes
  registry?: string;    // patient registry URL when the organization publishes one
  disease_urls?: Record<string, string>; // ORPHA -> official page naming that disease (evidence url instead of the homepage)
  verified?: string;
}
