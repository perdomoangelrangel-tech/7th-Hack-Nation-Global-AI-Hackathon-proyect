/**
 * Patient glossary (UX_WAVE4 §3) — exact UI copy. OWNER: brand lane.
 * Keys are lower-case; `aliases` lists other spellings that should show the same definition.
 */
export interface GlossaryEntry { term: string; definition: string; aliases?: string[] }

export const GLOSSARY: Record<string, GlossaryEntry> = {
  phenotype: { term: "phenotype", definition: "a symptom or physical trait", aliases: ["phenotypes"] },
  "loss of function": { term: "loss of function", definition: "the protein is missing or doesn't work", aliases: ["loss-of-function", "lof"] },
  "gain of function": { term: "gain of function", definition: "the protein does something harmful", aliases: ["gain-of-function"] },
  pathway: { term: "pathway", definition: "a chain of steps inside cells", aliases: ["pathways"] },
  "natural history study": { term: "natural history study", definition: "a study that follows patients over time, without treatment", aliases: ["natural history studies", "natural history"] },
  registry: { term: "registry", definition: "a shared list of patients who agree to be contacted for research", aliases: ["registries", "patient registry"] },
  "truncating variant": { term: "truncating variant", definition: "a change that cuts the protein short", aliases: ["truncating", "truncating variants"] },
  "missense variant": { term: "missense variant", definition: "a change that swaps one building block", aliases: ["missense", "missense variants"] },
  centrality: { term: "centrality", definition: "how connected this disease is in the atlas" },
};

/** term or alias (any case) → entry */
export function lookupTerm(word: string): GlossaryEntry | undefined {
  const w = word.toLowerCase().trim();
  if (GLOSSARY[w]) return GLOSSARY[w];
  return Object.values(GLOSSARY).find((e) => e.aliases?.includes(w));
}

/** All spellings, longest first (so "natural history study" wins over "natural history"). */
export const GLOSSARY_PATTERNS: string[] = Object.values(GLOSSARY)
  .flatMap((e) => [e.term, ...(e.aliases ?? [])])
  .sort((a, b) => b.length - a.length);

/** Split text into plain strings and glossary hits (first occurrence of each entry only, whole words, case-insensitive). */
export function splitGlossary(text: string): (string | { match: string; entry: GlossaryEntry })[] {
  const escaped = GLOSSARY_PATTERNS.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
  const out: (string | { match: string; entry: GlossaryEntry })[] = [];
  const seen = new Set<string>();
  let last = 0;
  for (const m of text.matchAll(re)) {
    const entry = lookupTerm(m[0]);
    if (!entry || seen.has(entry.term) || m.index === undefined) continue;
    seen.add(entry.term);
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ match: m[0], entry });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
