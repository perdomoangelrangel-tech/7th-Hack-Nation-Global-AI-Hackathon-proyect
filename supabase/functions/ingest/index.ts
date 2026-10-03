// Edge Function `ingest`: pulls open sources into the evidence graph.
// Auth: header `x-ingest-key` must equal public.app_secrets('ingest_key') (verify_jwt is off).
// Body: { orpha?: "ORPHA:33069", step?: "orphanet"|"ctgov"|"pubmed"|"clinvar"|"opentargets"|"hpo"|"orgs"|"community"|"approvals"|"all", dry?: boolean }
// Curated regulatory approvals (seed/approvals.json) are re-applied at the end of EVERY non-dry call.
// Invoked from SQL with pg_net (see private.invoke_ingest) and scheduled with pg_cron.
import { createClient } from "npm:@supabase/supabase-js@2";
import { Batch } from "./graph.ts";
import type { Ctx, SeedDisease, SourceId } from "./types.ts";
import { DISEASES } from "./seed.ts";
import { orphanet } from "./sources/orphanet.ts";
import { opentargets } from "./sources/opentargets.ts";
import { ctgov } from "./sources/ctgov.ts";
import { pubmed } from "./sources/pubmed.ts";
import { community } from "./sources/community.ts";
import { clinvar } from "./sources/clinvar.ts";
import { orgs } from "./sources/orgs.ts";
import { hpo } from "./sources/hpo.ts";
import { approvals } from "./sources/approvals.ts";

type DiseaseStep = "orphanet" | "opentargets" | "ctgov" | "pubmed" | "community" | "clinvar" | "orgs";
type Step = DiseaseStep | "hpo" | "approvals" | "all";

// Order matters: orphanet creates the disease + gene nodes, opentargets the ChEMBL treatments that
// ctgov interventions are matched to, pubmed the papers that community reads.
const DISEASE_STEPS: DiseaseStep[] = ["orphanet", "opentargets", "ctgov", "pubmed", "community", "clinvar", "orgs"];
const RUNNERS: Record<DiseaseStep, (ctx: Ctx, d: SeedDisease) => Promise<void>> = {
  orphanet, opentargets, ctgov, pubmed, community, clinvar, orgs,
};
const SOURCE_OF: Record<DiseaseStep | "hpo" | "approvals", SourceId> = {
  orphanet: "orphanet", opentargets: "opentargets", ctgov: "ctgov", pubmed: "pubmed",
  community: "pubmed", clinvar: "clinvar", orgs: "patient_orgs", hpo: "hpo", approvals: "fda",
};
const BUDGET_MS = 125_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const t0 = Date.now();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const provided = req.headers.get("x-ingest-key") ?? "";
  const { data: secret } = await db.from("app_secrets").select("value").eq("name", "ingest_key").maybeSingle();
  if (!provided || !secret?.value || !safeEqual(provided, secret.value)) return json({ error: "unauthorized" }, 401);

  // deno-lint-ignore no-explicit-any
  const body: any = await req.json().catch(() => ({}));
  const step: Step = body.step ?? "all";
  const dry = body.dry === true;
  const valid: Step[] = [...DISEASE_STEPS, "hpo", "approvals", "all"];
  if (!valid.includes(step)) return json({ error: `unknown step ${step}`, valid }, 400);
  const targets: SeedDisease[] = body.orpha ? DISEASES.filter((d) => d.orpha === body.orpha || d.slug === body.orpha) : DISEASES;
  if (!targets.length) return json({ error: `unknown disease ${body.orpha}`, known: DISEASES.map((d) => d.orpha) }, 400);

  const deadline = t0 + BUDGET_MS;
  const samples: Record<string, unknown> = {};
  const results: unknown[] = [];
  const skipped: string[] = [];

  const runStep = async (name: DiseaseStep | "hpo" | "approvals", d: SeedDisease | null, fn: (ctx: Ctx) => Promise<void>) => {
    if (name !== "approvals" && Date.now() > deadline - 15_000) { skipped.push(`${d?.orpha ?? "ALL"}:${name}`); return; }
    const notes: string[] = [];
    const ctx: Ctx = {
      db, batch: new Batch(), dry, deadline,
      sample: (k, v) => { if (dry) samples[`${d?.slug ?? "all"}.${k}`] = truncateJson(v); },
      note: (m) => notes.push(m), extra: {}, params: body,
    };
    const s = Date.now();
    let runId: number | null = null;
    if (!dry) {
      const { data } = await db.from("ingest_runs").insert({ disease: d?.orpha ?? "ALL", source_id: SOURCE_OF[name], status: "running" }).select("id").single();
      runId = data?.id ?? null;
    }
    try {
      await fn(ctx);
      if (dry) {
        results.push({ step: name, disease: d?.orpha ?? "ALL", ok: true, would_write: ctx.batch.preview(3), extra: ctx.extra, notes, ms: Date.now() - s });
        return;
      }
      const counts = await ctx.batch.flush(db);
      const extraNote = Object.keys(ctx.extra).length ? ` ${JSON.stringify(ctx.extra)}` : "";
      const noteText = notes.length ? ` notes: ${notes.join(" | ").slice(0, 800)}` : "";
      await db.from("ingest_runs").update({
        status: "done", entities_upserted: counts.entities, edges_upserted: counts.edges, evidence_upserted: counts.evidence,
        error: (extraNote + noteText).trim() || null, finished_at: new Date().toISOString(),
      }).eq("id", runId);
      await db.from("sources").update({ last_synced_at: new Date().toISOString() }).eq("id", SOURCE_OF[name]);
      results.push({ step: name, disease: d?.orpha ?? "ALL", ok: true, counts, extra: ctx.extra, notes, ms: Date.now() - s });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e).slice(0, 1000);
      if (runId) await db.from("ingest_runs").update({ status: "failed", error: msg, finished_at: new Date().toISOString() }).eq("id", runId);
      results.push({ step: name, disease: d?.orpha ?? "ALL", ok: false, error: msg, notes, ms: Date.now() - s });
    }
  };

  if (step === "hpo") {
    await runStep("hpo", null, (ctx) => hpo(ctx));
  } else if (step !== "approvals") {
    const steps = step === "all" ? DISEASE_STEPS : [step];
    for (const d of targets) for (const st of steps) await runStep(st, d, (ctx) => RUNNERS[st](ctx, d));
  }
  // Curated approvals last, on every call, so no upstream refresh can revert them.
  if (!dry || step === "approvals") {
    for (const d of targets) await runStep("approvals", d, (ctx) => approvals(ctx, d));
  }

  const ok = results.every((r) => (r as { ok: boolean }).ok);
  return json({ ok, dry, step, ms: Date.now() - t0, results, skipped, ...(dry ? { samples } : {}) }, ok ? 200 : 207);
});

function truncateJson(v: unknown, max = 8000): unknown {
  try {
    const s = JSON.stringify(v);
    return s && s.length > max ? s.slice(0, max) + "…" : v;
  } catch { return String(v).slice(0, max); }
}
