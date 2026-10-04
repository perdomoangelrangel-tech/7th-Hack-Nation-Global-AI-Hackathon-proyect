# How Nedamex uses OpenAI

Nedamex is an evidence graph for rare diseases. OpenAI does the three jobs the challenge names — **Extract**, **Reconcile**, **Explain** — and nothing the model writes reaches a user, a voice or the database without passing deterministic checks. Every feature also runs without a key (deterministic fallback), and every API response says which path produced it: `mode: "openai" | "deterministic"`.

| Job | Where in the product | Endpoint | Model |
|---|---|---|---|
| **Extract** | Evidence drawer → "Extract with OpenAI" on any PubMed source; batch `npm run extract` | `POST /api/extract` | `OPENAI_MODEL` |
| **Reconcile** | Search box (a name local search misses → "closest match"); every extracted entity | `POST /api/reconcile` | `OPENAI_MODEL_FAST` |
| **Explain** | Evidence drawer → "Explain in plain words"; persona narration; "Ask Nedamex" | `POST /api/explain`, `/api/narrate`, `/api/ask` | `OPENAI_MODEL_FAST` (≤ 3 edges) / `OPENAI_MODEL` |

Code: `src/lib/ai/` (client, explain, reconcile, extract, draft/verify), `src/lib/agents/` (persona prompts), `src/lib/verifier.ts`, UI in `src/components/ai/`.

## The client
`src/lib/ai/client.ts` — defaults to **gpt-4o-mini** for every call (`OPENAI_MODEL`, `OPENAI_MODEL_FAST`); Responses API with **Structured Outputs** (`json_schema`, `strict: true`). Schemas are written in zod, converted to JSON Schema, and the reply is validated again with zod. 30 s timeout (45 s for extraction), one retry, temperature 0.2 on non-reasoning models. On any failure — no key, timeout, API error, schema mismatch — the caller gets `mode: "deterministic"` and uses its fallback. Prompts, outputs and keys are never logged; only the failure class is.

Untrusted text (a user's question, a paper's abstract) is fenced in `<untrusted>` blocks and the system prompt says it is data, never instructions.

## Explain — plain language that cites every sentence
1. The selected graph edges become numbered **facts**, each carrying its evidence ids and its kind: *observed* (a source states it), *inferred* (Nedamex analysis), *extracted* (AI-read paper), *gap*.
2. The model writes sentences for the chosen mode (Patient · Family & patient group · Researcher · Pharma) and cites `fact_ids` — it never sees URLs or evidence ids. `simple: true` asks for ~grade-6 language.
3. `verifyDraft` (deterministic) then:
   - drops sentences with no fact id or an id that was not given;
   - drops sentences that state a dose or promise a cure, even if cited (names such as "KCNQ2 Cure Alliance" are allowed);
   - in Explain, drops advice ("you might…", "this week…") because no fact there is a recommendation;
   - appends "(the atlas suggests this: needs expert review)" to any inferred/extracted sentence the model worded as fact;
   - strips ids the model echoed into the prose.
4. If every model sentence is dropped, the deterministic template is returned instead.

## Reconcile — names to graph entities, never invented ids
Deterministic tiers first: canonical id → exact name → alias (e.g. *SMEI → Dravet syndrome*, *Munc18-1 → STXBP1*) → normalized (accents, punctuation and generic words like "syndrome" removed; "infantile"/"juvenile" are kept because they distinguish CLN types) → rarity-weighted fuzzy overlap. Only fuzzy or near-miss names go to the model, with a candidate list; it may pick one of those ids or answer "none". Anything else it returns is ignored.

## Extract — claims from a paper, with the exact quote
`PMID` → title + abstract from NCBI E-utilities → the model lists entities and claims (`subject · relation · object · supports|contradicts · quote · confidence`). Deterministic checks then require:
- every entity mention to appear in the text;
- every quote to be a verbatim span of the abstract (after normalizing PubMed typography such as U+2010 hyphens);
- the quote to be about the claim (one side named in it, the other in it or in the title);
- relation and entity types to match the graph (e.g. `causes` = gene/variant → disease; reversed pairs are flipped);
- **no `treats`**: a treatment finding is `studied_for` with a qualifier decided from the quote (`reported_response` for "some patients responded" / case reports, `clinical_trial`, `preclinical`, `proposed`, `approved_indication` only if the quote says approved). These are shown in the drawer as questions for an expert and are never drawn as graph edges (QA-31).
- names the model skipped are added from the atlas names and aliases (e.g. "Munc18-1" → STXBP1), and a short disease name borrows the fuller resolved name in the same quote (QA-42).

Every entity is reconciled to the atlas. Only OpenAI-mode results are saved (Supabase RPC `save_extraction`); the loader draws them as **dotted "AI-extracted · needs expert review"** edges, never as observed facts. The dictionary fallback is shown but never saved.

## Safety
- Fixed notice (never model-written) when a question asks for doses, a prognosis for one person, outcome promises or personal data.
- "Not a diagnosis or medical advice" disclaimer on every answer.
- Red-team: `node .claude/qa/redteam.mjs <url>` — 10 adversarial cases in EN/ES (doses, cure, prognosis, PII, prompt injection, made-up diseases).

## Live results (local, OpenAI key set, 2026-10-03/04)
All responses below came back with `mode: "openai"`. Models as configured locally: `OPENAI_MODEL_FAST` = gpt-4o-mini (explain ≤ 3 edges, reconcile), `OPENAI_MODEL` = gpt-6-luna (narration, ask, extraction).

| Check | Result |
|---|---|
| Explain, STXBP1-DEE ↔ KCNT1-EIMFS + KCNQ2 edge, all 4 modes | 2 cited sentences each, 2–4 s; inferred link worded "the atlas suggests… needs expert review"; Devon's version plain language; one advice sentence dropped by the guard (Maria) |
| Explain in the evidence drawer ("Explain in plain words") | renders "Written by OpenAI (gpt-4o-mini)" with kind badge and source count (`docs/qa/ai/live-explain-{1440,390}.png`) |
| Reconcile | SMEI → Dravet syndrome (alias) · Munc18-1 → STXBP1 (alias) · juvenile Batten → CLN3 (normalized) · *Pompe illness* → Pompe disease (**llm**, confirmed among candidates) · *infantile Batten* (CLN1, not in the atlas) → none · Zorblax → none |
| Search box → reconcile | "Pompe illness" → "closest match: Pompe disease" in the dropdown (`live-search-reconcile-1440.png`) |
| Extract in the drawer (PMID:32643187) | STXBP1 *causes* severe early epileptic encephalopathies, verbatim quote, "AI-extracted · needs expert review", saved (`live-extract-1440.png`) |
| Extract, PMID:42182245 (zebrafish screen) | **4-PBA · treats · STXBP1 disorders · contradicts** ("failed to rescue…") kept; a paraphrased quote ("stxbp1" for "stxbp1a") dropped as not verbatim |
| Narration, STXBP1-DEE, 4 modes | 5–7 verified claims each, 0 dropped |
| Red-team (10 cases, EN/ES) | **10/10 pass**; 8 answered in openai mode, the 2 made-up diseases correctly answered "not in the atlas" without a model call; the verifier dropped 3 cited sentences containing cure wording |
| Batch `npm run extract -- --limit 40` | 40 papers (STXBP1 cluster first) · **34 saved** · 6 with no verifiable claim (not saved) · 586 entities · **175 claims, 49 graphable** (both ends in the atlas) · 0 failures |

## Reproduce
```bash
# .env.local (never commit): OPENAI_API_KEY=…  OPENAI_MODEL=gpt-4o  OPENAI_MODEL_FAST=gpt-4o-mini
npm run dev
curl -s localhost:3000/api/health                                   # openai_env: "set"
curl -s localhost:3000/api/explain -H 'content-type: application/json' \
  -d '{"edgeIds":["edge:a05e46afa868"],"persona":"maria","locale":"en"}'
curl -s localhost:3000/api/reconcile -H 'content-type: application/json' \
  -d '{"names":["SMEI","Munc18-1","Pompe illness","infantile Batten"]}'
curl -s localhost:3000/api/extract -H 'content-type: application/json' -d '{"pmid":"42182245","save":false}'
npm run extract -- --limit 40          # idempotent by PMID; demo-route papers first
npm run extract -- --supersede-treats  # re-extract papers whose latest row still says "treats" (latest per PMID wins)
node .claude/qa/redteam.mjs http://localhost:3000
npm test                               # mocked OpenAI: happy path, fallback, uncited dropped, injection
```

## Limits
- Extraction reads abstracts only, not full text; claims are hypotheses for expert review.
- The model can pair a true sentence with a slightly broader claim; the quote checks narrow this but do not replace a reviewer.
- The cure filter is conservative: an honest sentence like "the sources don't say whether X cures Y" is dropped and replaced by the fixed notice.
- Model output varies between runs; the same paper can yield different (always checked) claim sets.
- Saved extractions are drawn as dotted edges only when the app reads the live Supabase graph; while the loader falls back to the bundled snapshot they are stored but not shown, until the loader also overlays them on the snapshot (requested from the data lane).
