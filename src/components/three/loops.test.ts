/**
 * WAVE 5 motion contract: every looping Blender clip is seamless and spins turn at constant speed.
 * Reads the exported GLBs directly (animation samplers are not Draco-compressed).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface Gltf {
  nodes: { name: string }[];
  accessors: { bufferView: number; byteOffset?: number; count: number; type: string; componentType: number }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  animations: { name: string; channels: { sampler: number; target: { node: number; path: string } }[]; samplers: { input: number; output: number; interpolation?: string }[] }[];
}

function load(file: string) {
  const buf = readFileSync(join(process.cwd(), "public", "models", file));
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString()) as Gltf;
  const binStart = 20 + jsonLen + 8;
  const read = (i: number) => {
    const a = gltf.accessors[i];
    const bv = gltf.bufferViews[a.bufferView];
    const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type as "SCALAR" | "VEC3" | "VEC4"];
    const start = binStart + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const out: number[][] = [];
    for (let k = 0; k < a.count; k++) {
      const row: number[] = [];
      for (let c = 0; c < n; c++) row.push(buf.readFloatLE(start + (k * n + c) * 4));
      out.push(row);
    }
    return out;
  };
  return { gltf, read };
}

const LOOPS = { "nexmed-agent.glb": ["Idle", "Listen", "Think", "Speak"], "nexmed-hero.glb": ["Idle"] } as const;
const angle = (q1: number[], q2: number[]) => 2 * Math.acos(Math.min(1, Math.abs(q1[0] * q2[0] + q1[1] * q2[1] + q1[2] * q2[2] + q1[3] * q2[3])));

describe("Blender loops are seamless", () => {
  for (const [file, clips] of Object.entries(LOOPS)) {
    const { gltf, read } = load(file);
    for (const name of clips) {
      it(`${file} · ${name}: last pose = first pose, spins at constant speed`, () => {
        const anim = gltf.animations.find((a) => a.name === name);
        expect(anim, name).toBeDefined();
        for (const ch of anim!.channels) {
          const s = anim!.samplers[ch.sampler];
          const out = read(s.output);
          const node = gltf.nodes[ch.target.node].name;
          if (ch.target.path === "rotation") {
            // constant angular step between samples (spins) or a closed loop (wobbles)
            const steps = out.slice(1).map((q, i) => angle(out[i], q));
            const max = Math.max(...steps), min = Math.min(...steps);
            const closed = angle(out[0], out[out.length - 1]) < 1e-3;
            const constant = max - min < Math.max(1e-3, max * 0.05);
            expect(closed || constant, `${node} rotation: closed=${closed} step ${min.toFixed(4)}..${max.toFixed(4)}`).toBe(true);
          } else {
            const first = out[0], last = out[out.length - 1];
            first.forEach((v, i) => expect(Math.abs(v - last[i]), `${node}.${ch.target.path}[${i}]`).toBeLessThan(1e-4));
          }
        }
      });
    }
  }
});
