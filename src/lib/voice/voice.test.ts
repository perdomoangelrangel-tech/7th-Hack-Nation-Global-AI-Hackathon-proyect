import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERSONA_IDS, VOICES, resolveVoice, settingsFor, voiceOptions } from "./voices";
import { cacheClear, cacheGet, cachePut, cacheStats, cleanText, plan } from "./tts";
import { handleSpeak } from "./speak";

describe("voice map", () => {
  it("has a primary and at least one alternate per mode, no duplicates within a mode", () => {
    expect(PERSONA_IDS.sort()).toEqual(["devon", "maria", "osei", "priya"]);
    for (const p of PERSONA_IDS) {
      const ids = voiceOptions(p).map((o) => o.id);
      expect(ids.length).toBeGreaterThanOrEqual(2);
      expect(new Set(ids).size).toBe(ids.length);
      ids.forEach((id) => expect(id).toMatch(/^[A-Za-z0-9]{20}$/));
    }
  });

  it("only honours a requested voice that belongs to the persona", () => {
    const alt = VOICES.devon.alternates[0];
    expect(resolveVoice("devon", alt.id).id).toBe(alt.id);
    expect(resolveVoice("devon", "not-a-voice").id).toBe(VOICES.devon.primary.id);
    expect(resolveVoice("devon", VOICES.osei.primary.id).id).toBe(VOICES.devon.primary.id);
  });

  it("clamps speed into ElevenLabs' 0.7..1.2 range", () => {
    expect(settingsFor("priya", 1.2).speed).toBeLessThanOrEqual(1.2);
    expect(settingsFor("devon", 0.8).speed).toBeGreaterThanOrEqual(0.7);
    expect(settingsFor("maria", 1).speed).toBe(VOICES.maria.settings.speed);
  });
});

describe("tts plan + cache", () => {
  beforeEach(() => cacheClear());

  it("normalizes text and gives the same key for equivalent input", () => {
    expect(cleanText("  Hello   **world**\n")).toBe("Hello world");
    expect(plan({ text: "Hi  there", persona: "maria" }).key).toBe(plan({ text: "Hi there", persona: "maria" }).key);
    expect(plan({ text: "Hi", persona: "maria" }).key).not.toBe(plan({ text: "Hi", persona: "osei" }).key);
    expect(plan({ text: "Hi", persona: "maria", rate: 1.2 }).key).not.toBe(plan({ text: "Hi", persona: "maria" }).key);
  });

  it("stores, returns and accounts bytes", () => {
    cachePut("a", new Uint8Array([1, 2, 3]));
    expect(cacheGet("a")).toEqual(new Uint8Array([1, 2, 3]));
    expect(cacheStats()).toEqual({ entries: 1, bytes: 3 });
    cachePut("a", new Uint8Array([9]));
    expect(cacheStats()).toEqual({ entries: 1, bytes: 1 });
  });
});

describe("handleSpeak", () => {
  const OLD = process.env.ELEVENLABS_API_KEY;
  beforeEach(() => cacheClear());
  afterEach(() => { if (OLD === undefined) delete process.env.ELEVENLABS_API_KEY; else process.env.ELEVENLABS_API_KEY = OLD; });

  it("400 on a bad body", async () => {
    const r = await handleSpeak({ text: "" });
    expect(r.status).toBe(400);
  });

  it("503 without a key so the client uses browser speech", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    const r = await handleSpeak({ text: "Hello", persona: "devon", locale: "en" });
    expect(r.status).toBe(503);
    expect((await r.json()).fallback).toBe("browser");
  });

  it("calls ElevenLabs with the persona voice, streams mp3 and caches the second call", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    const fake = vi.fn(async () => new Response(new Uint8Array([7, 7, 7]), { status: 200, headers: { "content-type": "audio/mpeg" } }));
    const body = { text: "STXBP1 is a gene.", persona: "osei", locale: "en" };

    const r1 = await handleSpeak(body, fake as unknown as typeof fetch);
    expect(r1.status).toBe(200);
    expect(r1.headers.get("content-type")).toBe("audio/mpeg");
    expect(r1.headers.get("x-voice-cache")).toBe("miss");
    expect(new Uint8Array(await r1.arrayBuffer())).toEqual(new Uint8Array([7, 7, 7]));

    const [url, init] = fake.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/text-to-speech/${VOICES.osei.primary.id}/stream`);
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("test-key");
    expect(JSON.parse(String(init.body)).model_id).toBe("eleven_multilingual_v2");

    await new Promise((r) => setTimeout(r, 0)); // let the tee'd branch fill the cache
    const r2 = await handleSpeak(body, fake as unknown as typeof fetch);
    expect(r2.headers.get("x-voice-cache")).toBe("hit");
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it("maps an invalid key upstream to 503 (fallback) and other failures to 502", async () => {
    process.env.ELEVENLABS_API_KEY = "bad";
    const unauthorized = vi.fn(async () => new Response("nope", { status: 401 }));
    expect((await handleSpeak({ text: "a" }, unauthorized as unknown as typeof fetch)).status).toBe(503);
    const boom = vi.fn(async () => new Response("err", { status: 500 }));
    expect((await handleSpeak({ text: "b" }, boom as unknown as typeof fetch)).status).toBe(502);
  });
});

import { DEFAULT_AGENTS, agentIds, agentVariables } from "./agents";

describe("agents", () => {
  afterEach(() => { delete process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_FAMILY; });

  it("has an agent per mode and lets env override or disable one", () => {
    expect(agentIds()).toEqual(DEFAULT_AGENTS);
    process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_FAMILY = "agent_0000000000000000000000000000";
    expect(agentIds().maria).toBe("agent_0000000000000000000000000000");
    process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_FAMILY = "off";
    expect(agentIds().maria).toBeNull();
    process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_FAMILY = "garbage";
    expect(agentIds().maria).toBe(DEFAULT_AGENTS.maria);
  });

  it("always sends every dynamic variable the agent prompts reference", () => {
    const v = agentVariables({ persona: "maria", locale: "en", disease: null });
    expect(Object.keys(v).sort()).toEqual(["disease_id", "disease_name", "locale", "persona"]);
    expect(v.disease_name).toBeTruthy();
    expect(agentVariables({ persona: "osei", locale: "es", disease: "disease:ORPHA:1", diseaseName: "X" }).disease_name).toBe("X");
  });
});
