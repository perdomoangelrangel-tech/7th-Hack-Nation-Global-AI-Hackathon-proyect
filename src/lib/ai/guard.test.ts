import { describe, expect, it } from "vitest";
import { rateLimit, readJson, stripControl } from "./guard";

const req = (ip: string, body?: string, type = "application/json") => new Request("http://x/api/t", { method: "POST", headers: { "x-forwarded-for": `${ip}, 10.0.0.1`, "content-type": type }, body });

describe("guard", () => {
  it("allows the limit, then 429 with Retry-After, per IP", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit(req("1.1.1.1"), "t", 3)).toBeNull();
    const r = rateLimit(req("1.1.1.1"), "t", 3)!;
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(rateLimit(req("2.2.2.2"), "t", 3)).toBeNull();
  });
  it("rejects non-JSON, oversized and malformed bodies; strips control characters", async () => {
    expect((await readJson(req("3.3.3.3", "hi", "text/plain")) as { ok: false; res: Response }).res.status).toBe(415);
    expect((await readJson(req("3.3.3.3", JSON.stringify({ q: "x".repeat(40_000) }))) as { ok: false; res: Response }).res.status).toBe(413);
    expect((await readJson(req("3.3.3.3", "{bad")) as { ok: false; res: Response }).res.status).toBe(400);
    const ok = await readJson(req("3.3.3.3", JSON.stringify({ q: "a\u0000b\u0007c\nd", h: [{ t: "x\u001by" }] })));
    expect(ok).toEqual({ ok: true, body: { q: "abc\nd", h: [{ t: "xy" }] } });
    expect(stripControl(5)).toBe(5);
  });
});
