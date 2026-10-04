"use client";
/**
 * Co-creation & matchmaking entry point ("Propose a hypothesis / collaboration / add missing evidence").
 * OWNER: action lane. Mounted by AtlasApp (explorer lane) — keep this props contract stable.
 * Proposals are DRAFTS: never evidence, always rendered dashed and labeled "community draft".
 * Saved through POST /api/proposals (Supabase RPC submit_proposal; in-memory "saved locally (demo)" fallback).
 */
import { useEffect, useRef, useState } from "react";
import { PencilLine } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";
import type { JourneyV2 } from "@/lib/journey/build";
import { prefillDraft, type Draft } from "@/lib/journey/prefill";
import { PROPOSAL_EVENT, type ProposalSaved } from "@/lib/journey/proposals";
import { COCREATE_EVENT, type CoCreateRequest } from "@/components/journey/events";
import { isNoRoute, useJourney } from "@/components/journey/useJourney";
import { KindBadge } from "@/components/journey/KindBadge";
import { journeyCopy } from "@/components/journey/copy";
import { motionTokens } from "@/lib/motion";
import { coCopy } from "./copy";

export interface CoCreateProps { persona: PersonaId; locale: Locale; disease: string | null; diseaseName?: string; edgeIds?: string[] }

export function CoCreate({ persona, locale, disease, diseaseName, edgeIds }: CoCreateProps) {
  const c = coCopy[locale];
  const { data } = useJourney(disease, persona, locale);
  const j = data && !isNoRoute(data) ? data : null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  const reduce = useReducedMotion();

  // UX_WAVE4 S2/S4: co-create is no longer a strip above the route. This mount only hosts the dialog and the
  // toast; the S4 card, step 3 partners and the evidence drawer open it with openCoCreate(kind, draft?).
  const ctx = useRef({ j, disease, edgeIds });
  useEffect(() => { ctx.current = { j, disease, edgeIds }; });
  useEffect(() => {
    const onOpen = (e: Event) => {
      const { kind, draft: extra } = (e as CustomEvent<CoCreateRequest>).detail;
      const { j: jj, disease: d, edgeIds: ids } = ctx.current;
      if (!d) return;
      const base = jj ? prefillDraft(kind, jj, ids ?? []) : { kind, title: "", body: "", entities: [d], edges: ids ?? [] };
      setDraft({ ...base, ...(extra ?? {}) });
    };
    window.addEventListener(COCREATE_EVENT, onOpen);
    return () => window.removeEventListener(COCREATE_EVENT, onOpen);
  }, []);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(null), 7000); return () => window.clearTimeout(id); }, [toast]);

  if (!disease) return null;
  return (
    <>
      <ProposalDialog draft={draft} locale={locale} persona={persona} disease={disease} diseaseName={diseaseName ?? j?.disease.name ?? ""} journey={j}
        onClose={() => setDraft(null)}
        onSaved={(s) => {
          setDraft(null);
          setToast({ text: s.stored === "supabase" ? c.saved_shared : c.saved_local, tone: s.stored === "supabase" ? "ok" : "warn" });
          window.dispatchEvent(new CustomEvent(PROPOSAL_EVENT, { detail: s.proposal }));
        }} />
      <div aria-live="polite" className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 pointer-events-none flex justify-end">
        <AnimatePresence>
          {toast && (
            <motion.div key={toast.text} initial={{ opacity: 0, y: reduce ? 0 : motionTokens.distance.md }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0.12 : motionTokens.duration.normal, ease: motionTokens.easing.smooth }}
              className={`pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg bg-paper ${toast.tone === "ok" ? "border-brand/50" : "border-amber/60"}`}>
              <p className="font-medium text-ink flex gap-1.5 items-start"><PencilLine size={15} className="mt-0.5 shrink-0 text-brand-deep" aria-hidden />{toast.text}</p>
              <p className="text-xs text-ink-3 mt-1">{c.toast_detail}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function ProposalDialog({ draft, locale, persona, disease, diseaseName, journey, onClose, onSaved }: {
  draft: Draft | null; locale: Locale; persona: PersonaId; disease: string; diseaseName: string; journey: JourneyV2 | null;
  onClose: () => void; onSaved: (s: ProposalSaved) => void;
}) {
  const c = coCopy[locale];
  const jc = journeyCopy[locale];
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<Draft | null>(draft);
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Sync the dialog with the requested draft (open with a fresh prefill, close when cleared).
  const [shown, setShown] = useState<Draft | null>(null);
  if (draft !== shown) { setShown(draft); if (draft) { setForm(draft); setContact(""); setConsent(false); setErr(null); } }
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (draft && !el.open) el.showModal();
    else if (!draft && el.open) el.close();
  }, [draft]);

  const edgeLabel = (id: string) => {
    if (!journey) return id;
    const n = journey.connections.neighbors.find((x) => x.edge === id);
    if (n) return `${journey.disease.name} ~ ${n.name} (${jc.inferred_review})`;
    const a = [...journey.assets.own, ...journey.assets.reusable].find((x) => x.cite.edges.includes(id));
    // cite.edges = [asset → its disease, asset → each neighbor it also enrolls] (see toAsset in build.ts)
    if (a) { const i = a.cite.edges.indexOf(id); return `${a.nct} → ${i <= 0 ? a.disease_name : a.shared_with[i - 1]?.name ?? a.disease_name}`; }
    const p = journey.people.collaborators.find((x) => x.cite.edges.includes(id));
    if (p) return p.name;
    return id;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/proposals", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: form.kind, title: form.title, body: form.body, persona, disease, entities: form.entities, edges: form.edges, contact: consent && contact.trim() ? contact.trim() : null, consent }),
      });
      const b = await r.json();
      if (!r.ok || !b.ok) throw new Error(b.issues?.join("; ") ?? b.error ?? String(r.status));
      onSaved(b as ProposalSaved);
    } catch (x) {
      setErr(`${c.error}: ${(x as Error).message}`);
    } finally { setBusy(false); }
  };

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="cocreate-title"
      className="m-auto w-[min(640px,calc(100vw-24px))] max-h-[calc(100dvh-24px)] rounded-2xl border border-line bg-paper p-0 text-ink shadow-2xl backdrop:bg-brand-ink/30 backdrop:backdrop-blur-sm">
      {form && (
        <form onSubmit={submit} className="flex flex-col max-h-[calc(100dvh-24px)]">
          <header className="px-5 pt-5 pb-3 border-b border-line">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-ink-3">{diseaseName}</p>
                <h2 id="cocreate-title" className="serif text-xl text-brand-ink mt-1">{c.actions[form.kind]}</h2>
              </div>
              <button type="button" onClick={onClose} className="rounded-full w-8 h-8 grid place-items-center text-ink-3 hover:bg-paper-2" aria-label={c.cancel}>✕</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={c.kind_label}>
              {(["hypothesis", "collaboration", "evidence"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={form.kind === k} onClick={() => setForm(journey ? prefillDraft(k, journey) : { ...form, kind: k })}
                  className={`rounded-full px-3 py-1 text-xs border ${form.kind === k ? "bg-brand-deep text-white border-brand-deep" : "border-line text-ink-2 hover:bg-paper-2"}`}>{c.actions[k]}</button>
              ))}
            </div>
            <ol className="mt-3 flex flex-wrap gap-1.5 text-[11px]" aria-label={c.progress_label}>
              {c.progress.map((x, i) => <li key={x} className="rounded-full border border-brand/40 bg-brand-mist px-2 py-0.5 text-brand-deep"><span className="font-semibold mr-1">{i + 1}</span>{x}</li>)}
            </ol>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-2"><KindBadge kind="proposed" c={jc} />{c.draft_note}</p>
          </header>

          <div className="px-5 py-4 overflow-y-auto space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-ink-2">{c.field_title}</span>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={3} maxLength={200}
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-2">{c.field_body}</span>
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required maxLength={4000} rows={8}
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </label>
            <div>
              <p className="text-xs font-medium text-ink-2">{c.cited_edges} ({form.edges.length})</p>
              {form.edges.length === 0 && <p className="text-xs text-ink-3 mt-1">{c.no_edges}</p>}
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {form.edges.map((id) => (
                  <li key={id} className="chip !text-[11px]">
                    <span className="max-w-[260px] truncate" title={id}>{edgeLabel(id)}</span>
                    <button type="button" onClick={() => setForm({ ...form, edges: form.edges.filter((x) => x !== id) })} aria-label={`${c.remove} ${id}`} className="text-ink-3 hover:text-ink">×</button>
                  </li>
                ))}
              </ul>
            </div>
            <fieldset className="rounded-lg border border-line p-3">
              <legend className="px-1 text-xs font-medium text-ink-2">{c.contact_legend}</legend>
              <label className="flex items-start gap-2 text-xs text-ink-2 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (!e.target.checked) setContact(""); }} className="mt-0.5 accent-[var(--brand-deep)]" />
                <span>{c.consent}</span>
              </label>
              <input value={contact} onChange={(e) => setContact(e.target.value)} disabled={!consent} maxLength={200} placeholder={c.contact_placeholder} aria-label={c.contact_placeholder}
                className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm disabled:bg-paper-2 disabled:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/40" />
            </fieldset>
            {err && <p className="text-sm text-amber" role="alert">{err}</p>}
          </div>

          <footer className="px-5 py-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-ink-3 max-w-xs">{c.disclaimer}</p>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-ink-2 hover:bg-paper-2">{c.cancel}</button>
              <button type="submit" disabled={busy} className="rounded-full bg-brand-deep px-4 py-2 text-sm font-semibold text-white hover:bg-brand-ink disabled:opacity-60">{busy ? c.saving : c.submit}</button>
            </div>
          </footer>
        </form>
      )}
    </dialog>
  );
}
