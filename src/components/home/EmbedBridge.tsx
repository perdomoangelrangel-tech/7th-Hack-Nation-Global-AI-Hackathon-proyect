"use client";
/**
 * Embed bridge (WAVE 6 T8): when /atlas runs inside the platform shell, report readiness, height and the URL
 * state to the parent, and accept validated navigate requests from it. Inert when not framed.
 * Protocol and validation: ./bridge.ts. Mounted once per /atlas render in src/app/atlas/page.tsx.
 */
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isEmbedded } from "@/components/atlas/useEmbed";
import { BRIDGE, navigateHref, parseNavigate, pickTargetOrigin, routeFromUrl } from "./bridge";

const ROUTE_POLL_MS = 400; // the atlas updates its URL with history.replaceState (no event to listen to)
const NAVIGATE_SETTLE_MS = 1500;

export function EmbedBridge({ allowedOrigins }: { allowedOrigins: string[] }) {
  const router = useRouter();
  useEffect(() => {
    if (!isEmbedded() || window.parent === window) return;
    const target = pickTargetOrigin(document.referrer, allowedOrigins);
    if (!target) return;
    const post = (msg: object) => { try { window.parent.postMessage(msg, target); } catch { /* parent gone */ } };

    let lastHref = window.location.href;
    post({ type: BRIDGE.ready, route: routeFromUrl(lastHref) });
    post({ type: BRIDGE.route, route: routeFromUrl(lastHref) });
    const poll = window.setInterval(() => {
      if (window.location.href === lastHref) return;
      lastHref = window.location.href;
      post({ type: BRIDGE.route, route: routeFromUrl(lastHref) });
    }, ROUTE_POLL_MS);

    let lastH = 0; let raf = 0; let settle = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = Math.ceil(document.documentElement.scrollHeight);
        if (h !== lastH) { lastH = h; post({ type: BRIDGE.height, height: h }); }
      });
    });
    ro.observe(document.documentElement); ro.observe(document.body);

    const onMessage = (ev: MessageEvent) => {
      if (!allowedOrigins.includes(ev.origin) || ev.source !== window.parent) return;
      const req = parseNavigate(ev.data);
      if (!req) return;
      const href = navigateHref(window.location.href, req);
      router.push(href);
      // A client navigation can be cancelled by the atlas' own replaceState while it settles (e.g. the stepper
      // writing step=1 right after mount). If the URL hasn't reached the request, reload just this frame there.
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        const now = new URLSearchParams(window.location.search);
        if ((["p", "d", "mode", "l"] as const).some((k) => req[k] && now.get(k) !== req[k])) window.location.replace(href);
      }, NAVIGATE_SETTLE_MS);
    };
    window.addEventListener("message", onMessage);
    return () => { window.clearInterval(poll); ro.disconnect(); cancelAnimationFrame(raf); window.clearTimeout(settle); window.removeEventListener("message", onMessage); };
  }, [allowedOrigins, router]);
  return null;
}
