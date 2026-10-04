import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./cors";

describe("isAllowedOrigin", () => {
  it("allows local Vite dev servers", () => {
    expect(isAllowedOrigin("http://localhost:8080", {})).toBe(true);
    expect(isAllowedOrigin("http://localhost:5173", {})).toBe(true);
  });

  it("rejects other Lovable apps, look-alikes, plain http and other ports", () => {
    expect(isAllowedOrigin("https://someone-else.lovable.app", {})).toBe(false);
    expect(isAllowedOrigin("https://4ce45bdb-819e.lovableproject.com", {})).toBe(false);
    expect(isAllowedOrigin("https://lovable.app.evil.com", {})).toBe(false);
    expect(isAllowedOrigin("https://evil-lovable.app", {})).toBe(false);
    expect(isAllowedOrigin("http://x.lovable.app", {})).toBe(false);
    expect(isAllowedOrigin("http://localhost:3001", {})).toBe(false);
    expect(isAllowedOrigin(null, {})).toBe(false);
  });

  it("adds the program URL and extra origins from env", () => {
    const env = { NEXT_PUBLIC_PROGRAM_URL: "https://app.nedamex.org/atlas", CORS_EXTRA_ORIGINS: "https://nedamex-research.lovable.app, https://b.example" };
    expect(isAllowedOrigin("https://nedamex-research.lovable.app", env)).toBe(true);
    expect(isAllowedOrigin("https://app.nedamex.org", env)).toBe(true);
    expect(isAllowedOrigin("https://b.example", env)).toBe(true);
    expect(isAllowedOrigin("https://c.example", env)).toBe(false);
  });
});
