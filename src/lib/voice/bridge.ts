"use client";
/**
 * Narration bridge: AtlasApp owns the single `useNarration()` instance (its current claim drives the map
 * highlight) and hands it to <NarrationBar>. NarrationBar publishes it here so the Guide dock's "Listen" tab
 * can drive the very same narration without a new prop path through AtlasApp. OWNER: voice lane.
 */
import { useSyncExternalStore } from "react";
import type { useNarration } from "@/components/atlas/useNarration";
import type { Dict } from "@/lib/i18n";

export interface NarrationLink {
  n: ReturnType<typeof useNarration>;
  t: Dict;
  personaName: string;
  onListen: () => void;
}

let current: NarrationLink | null = null;
const listeners = new Set<() => void>();

export function publishNarration(link: NarrationLink | null) {
  current = link;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useNarrationLink(): NarrationLink | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

// ---- Guide panel open flag: the caption strip over the map hides while the Guide shows the transcript ----
let guideOpen = false;
const openListeners = new Set<() => void>();
export function setGuideOpen(v: boolean) { if (guideOpen !== v) { guideOpen = v; openListeners.forEach((l) => l()); } }
const subscribeOpen = (l: () => void) => { openListeners.add(l); return () => { openListeners.delete(l); }; };
export function useGuideOpen(): boolean {
  return useSyncExternalStore(subscribeOpen, () => guideOpen, () => false);
}
