import { describe, expect, it } from "vitest";
import { detectDisease, detectIntents, resolveDisease } from "./detect";
import { testDiseases } from "./fixtures";

describe("detectDisease", () => {
  it("finds diseases by name in English and Spanish", () => {
    expect(detectDisease("Are there trials for Dravet syndrome?", testDiseases)?.orpha).toBe("ORPHA:33069");
    expect(detectDisease("¿Qué tratamientos hay para el síndrome de Rett?", testDiseases)?.orpha).toBe("ORPHA:778");
    expect(detectDisease("¿Qué huecos de investigación hay en CDKL5?", testDiseases)?.orpha).toBe("ORPHA:505652");
  });
  it("uses aliases and ORPHA codes", () => {
    expect(detectDisease("severe myoclonic epilepsy of infancy treatments", testDiseases)?.orpha).toBe("ORPHA:33069");
    expect(detectDisease("what about batten disease?", testDiseases)?.orpha).toBe("ORPHA:228349");
    expect(detectDisease("ORPHA:72 genes", testDiseases)?.orpha).toBe("ORPHA:72");
  });
  it("does not match substrings inside other words", () => {
    expect(detectDisease("Is there a treatment?", testDiseases)).toBeNull();
    expect(detectDisease("rettangle", testDiseases)).toBeNull();
  });
});

describe("resolveDisease", () => {
  it("accepts codes with or without prefix, names and short names", () => {
    expect(resolveDisease("ORPHA:778", testDiseases)?.name).toBe("Rett syndrome");
    expect(resolveDisease("orpha 72", testDiseases)?.orpha).toBe("ORPHA:72");
    expect(resolveDisease("Angelman", testDiseases)?.orpha).toBe("ORPHA:72");
    expect(resolveDisease("Síndrome de Dravet", testDiseases)?.orpha).toBe("ORPHA:33069");
    expect(resolveDisease("", testDiseases)).toBeNull();
  });
});

describe("detectIntents", () => {
  it("reads topics in EN and ES", () => {
    expect(detectIntents("Is there a cure for Dravet?")).toContain("cure");
    expect(detectIntents("¿Hay ensayos activos para Dravet?")).toContain("trials");
    expect(detectIntents("¿Qué genes están asociados con Angelman?")).toContain("genes");
    expect(detectIntents("What are the research gaps?")).toContain("gaps");
    expect(detectIntents("Where can families find support?")).toContain("community");
    expect(detectIntents("hello")).toEqual([]);
  });
});
