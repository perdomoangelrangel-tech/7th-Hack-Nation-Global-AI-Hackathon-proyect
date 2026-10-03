import { getLength, getPointAtLength } from "@remotion/paths";

export type Pt = [number, number];

/** Polyline with rounded corners (transit-map bends). Use 45°/90° turns for the house style. */
export function roundedPath(pts: Pt[], r = 44): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [vx, vy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(vx - px, vy - py);
    const outLen = Math.hypot(nx - vx, ny - vy);
    const rr = Math.min(r, inLen / 2, outLen / 2);
    const ax = vx - ((vx - px) / inLen) * rr;
    const ay = vy - ((vy - py) / inLen) * rr;
    const bx = vx + ((nx - vx) / outLen) * rr;
    const by = vy + ((ny - vy) / outLen) * rr;
    d += ` L ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${vx} ${vy} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

const lenCache = new Map<string, number>();
export function pathLength(d: string) {
  let l = lenCache.get(d);
  if (l === undefined) {
    l = getLength(d);
    lenCache.set(d, l);
  }
  return l;
}

/** Fraction (0..1) along path d closest to point p. Used to pop stations as the route reaches them. */
export function fractionAt(d: string, p: Pt, samples = 240): number {
  const L = pathLength(d);
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i <= samples; i++) {
    const pt = getPointAtLength(d, (L * i) / samples) ?? { x: 0, y: 0 };
    const dist = Math.hypot(pt.x - p[0], pt.y - p[1]);
    if (dist < bestDist) {
      bestDist = dist;
      best = i / samples;
    }
  }
  return best;
}

export function pointAt(d: string, f: number) {
  const L = pathLength(d);
  return getPointAtLength(d, Math.max(0, Math.min(1, f)) * L) ?? { x: 0, y: 0 };
}
