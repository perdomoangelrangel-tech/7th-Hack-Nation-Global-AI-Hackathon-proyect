"use client";
/**
 * Co-create lives at the end of the route (S4) and inside step 3, but the dialog is hosted by the
 * <CoCreate> mount in AtlasApp. They talk through one window event, so no parent wiring is needed.
 */
import type { Draft } from "@/lib/journey/prefill";
import type { ProposalKind } from "@/lib/journey/proposals";

export const COCREATE_EVENT = "nedamex:cocreate";
export interface CoCreateRequest { kind: ProposalKind; draft?: Partial<Draft> }

export function openCoCreate(kind: ProposalKind, draft?: Partial<Draft>) {
  window.dispatchEvent(new CustomEvent<CoCreateRequest>(COCREATE_EVENT, { detail: { kind, draft } }));
}
