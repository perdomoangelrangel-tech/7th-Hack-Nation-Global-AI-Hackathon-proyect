"use client";
/**
 * Embed mode (WAVE 5): true when /atlas runs inside an iframe (the Lovable app supplies its own header) or with
 * `?embed=1`. Read after mount so server and client render the same markup first (no hydration mismatch).
 */
import { useEffect, useState } from "react";

export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("embed") === "1") return true;
    return window.self !== window.top;
  } catch {
    return true; // cross-origin access to window.top throws → we are framed
  }
}

export function useEmbed() {
  const [embed, setEmbed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEmbed(isEmbedded()));
    return () => cancelAnimationFrame(id);
  }, []);
  return embed;
}
