"use client";
/** Hides its children when /atlas is embedded (?embed=1 seen by the server, or any iframe after mount). */
import type { ReactNode } from "react";
import { useEmbed } from "@/components/atlas/useEmbed";

export function EmbedHidden({ embed = false, children }: { embed?: boolean; children: ReactNode }) {
  const framed = useEmbed();
  return embed || framed ? null : <>{children}</>;
}
