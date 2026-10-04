"use client";
/** A link that plays a subtle UI sound on click (WAVE 6B: website uses only `tap` on primary CTAs). */
import Link from "next/link";
import type { ComponentProps } from "react";
import { playSfx, type SfxName } from "@/lib/sfx";

export function SfxLink({ sound = "tap", onClick, ...props }: ComponentProps<typeof Link> & { sound?: SfxName }) {
  return <Link {...props} onClick={(e) => { playSfx(sound); onClick?.(e); }} />;
}
