/** External links for evidence identifiers (PMID → PubMed, NCT → ClinicalTrials.gov, ORPHA → Orphanet, HP → HPO, DOI, MONDO, Reactome, ClinVar). */
/** Canonical link for a known identifier; the stored evidence URL wins when present. */
export function externalUrl(id: string, stored?: string | null): string | null {
  if (stored) return stored;
  const s = id.trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(?:PMID:?\s*)(\d+)$/i))) return `https://pubmed.ncbi.nlm.nih.gov/${m[1]}/`;
  if ((m = s.match(/^(NCT\d{8})$/i))) return `https://clinicaltrials.gov/study/${m[1].toUpperCase()}`;
  if ((m = s.match(/^ORPHA:(\d+)$/i))) return `https://www.orpha.net/en/disease/detail/${m[1]}`;
  if ((m = s.match(/^(HP:\d{7})$/i))) return `https://hpo.jax.org/browse/term/${m[1].toUpperCase()}`;
  if ((m = s.match(/^(?:doi:\s*)?(10\.\d{4,9}\/\S+)$/i))) return `https://doi.org/${m[1]}`;
  if ((m = s.match(/^(MONDO:\d{7})$/i))) return `https://monarchinitiative.org/${m[1].toUpperCase()}`;
  if ((m = s.match(/^(R-HSA-\d+)$/i))) return `https://reactome.org/content/detail/${m[1].toUpperCase()}`;
  if ((m = s.match(/^VCV0*(\d+)/i))) return `https://www.ncbi.nlm.nih.gov/clinvar/variation/${m[1]}/`;
  return null;
}

