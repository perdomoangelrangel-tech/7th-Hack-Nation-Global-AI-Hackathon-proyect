"use client";
/** The shared "Sounds" switch (brand's src/lib/sfx.ts keeps it in localStorage and broadcasts `nedamex:sfx`). */
import { useCallback, useEffect, useState } from "react";
import { setSfxEnabled, sfxEnabled } from "@/lib/sfx";

export function useSfx() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(sfxEnabled()));
    const sync = (e: Event) => setOn((e as CustomEvent<boolean>).detail);
    window.addEventListener("nedamex:sfx", sync);
    return () => { cancelAnimationFrame(id); window.removeEventListener("nedamex:sfx", sync); };
  }, []);
  const set = useCallback((v: boolean) => { setSfxEnabled(v); setOn(v); }, []);
  return [on, set] as const;
}
