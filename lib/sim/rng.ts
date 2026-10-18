// 種つきの乱数。同じ seed なら同じ人生を再現できる。
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const chance = (rng: Rng, p: number) => rng() < p;

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function weighted<T extends string>(rng: Rng, weights: Partial<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r < 0) return key;
  }
  return entries[entries.length - 1][0];
}

// [年齢, 値] の折れ線を線形補間する。範囲外は端の値。
export type Curve = readonly (readonly [number, number])[];

export function interpolate(curve: Curve, age: number): number {
  if (age <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i];
    if (age <= x1) {
      const [x0, y0] = curve[i - 1];
      return y0 + ((y1 - y0) * (age - x0)) / (x1 - x0);
    }
  }
  return curve[curve.length - 1][1];
}

// 確率のように桁が変わる値は、対数で補間したほうが実際のカーブに近い。
export function interpolateLog(curve: Curve, age: number): number {
  if (age <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i];
    if (age <= x1) {
      const [x0, y0] = curve[i - 1];
      const t = (age - x0) / (x1 - x0);
      return Math.exp(Math.log(y0) * (1 - t) + Math.log(y1) * t);
    }
  }
  return curve[curve.length - 1][1];
}
