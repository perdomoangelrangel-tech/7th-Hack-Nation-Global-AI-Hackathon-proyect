import { describe, expect, it } from "vitest";
import { BRIDGE, navigateHref, parseNavigate, pickTargetOrigin, routeFromUrl } from "./bridge";

const APP = "https://nedamex.lovable.app";

describe("embed bridge", () => {
  it("reads the route state from the URL", () => {
    expect(routeFromUrl("https://nedamex.vercel.app/atlas?embed=1&p=maria&d=disease:ORPHA:599373&mode=challenge&step=2"))
      .toEqual({ p: "maria", d: "disease:ORPHA:599373", mode: "challenge", step: "2", e: null, l: null, path: "/atlas" });
  });

  it("talks only to an allowed parent", () => {
    expect(pickTargetOrigin(`${APP}/atlas?p=maria`, [APP])).toBe(APP);
    expect(pickTargetOrigin("https://evil.example/page", [APP])).toBe(APP); // falls back; postMessage to APP is dropped by an evil parent
    expect(pickTargetOrigin("", [APP])).toBe(APP);
    expect(pickTargetOrigin("", [])).toBeNull();
  });

  it("accepts only well-formed navigate requests", () => {
    expect(parseNavigate({ type: BRIDGE.navigate, p: "osei", d: "disease:ORPHA:33069", mode: "free", l: "es" }))
      .toEqual({ p: "osei", d: "disease:ORPHA:33069", mode: "free", l: "es" });
    expect(parseNavigate({ type: BRIDGE.navigate, p: "admin", d: "javascript:alert(1)", mode: "x" })).toBeNull();
    expect(parseNavigate({ type: "other", p: "maria" })).toBeNull();
    expect(parseNavigate("nedamex:navigate")).toBeNull();
    expect(parseNavigate({ type: BRIDGE.navigate, d: "disease:ORPHA:1&p=x" })).toBeNull();
  });

  it("builds the next /atlas URL, keeping embed and dropping stale step/edge on a new disease", () => {
    const next = navigateHref("https://nedamex.vercel.app/atlas?embed=1&p=maria&d=disease:ORPHA:599373&step=3&e=edge:1", { d: "disease:ORPHA:33069" });
    const u = new URL(next, "https://x");
    expect(u.pathname).toBe("/atlas");
    expect(u.searchParams.get("embed")).toBe("1");
    expect(u.searchParams.get("d")).toBe("disease:ORPHA:33069");
    expect(u.searchParams.get("step")).toBeNull();
    expect(u.searchParams.get("e")).toBeNull();
  });
});
