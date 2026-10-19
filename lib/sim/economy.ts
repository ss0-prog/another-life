import { createRng, type Rng } from "@/lib/sim/rng";
import { CPI_CHANGE, GDP_GROWTH, SIM_NOW_YEAR, UNEMPLOYMENT, econFromGdp } from "@/lib/sim/data/jp-history";

// 景気の指数。0 がふつう、プラスは好景気、マイナスは不況。年齢ごとに1つの値で、
// 同じ種からは同じ景気の移り変わりになる(分岐した/しなかった二つの人生は、同じ景気を生きる)。
const cache = new Map<number, number[]>();

function gauss(rng: Rng): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export function economyPath(seed: number): number[] {
  const hit = cache.get(seed);
  if (hit) return hit;
  const rng = createRng((seed ^ 0xec0e0c0) >>> 0);
  const path: number[] = [];
  let level = 0;
  for (let age = 0; age <= 111; age++) {
    level = 0.6 * level + 0.3 * gauss(rng);
    // まれに、深い不況が来る。
    if (rng() < 0.035) level -= 1.3 + rng() * 0.8;
    level = Math.max(-2.5, Math.min(1.5, level));
    path.push(level);
  }
  if (cache.size > 20) cache.clear();
  cache.set(seed, path);
  return path;
}

// 普通預金の金利(年)。景気がよいと上がり、悪いと、ほぼゼロになる(架空の水準。実際の金利とは関係ありません)。
// 2000年代から2023年までの日本は、年0.001%前後だったが、2024年以降は、0.1〜0.2%に上がった。
export const savingsRate = (econ: number) => Math.max(0.00001, Math.min(0.003, 0.0008 + econ * 0.0007));

// 生まれた年(いまの年齢から決まる)と年齢から、その年が、実際の統計のある年なら、実際の景気を使う。ない年(未来など)は、毎回ランダム。
export const birthYearOf = (currentAge: number) => SIM_NOW_YEAR - currentAge;
export const yearAt = (birthYear: number | undefined, age: number) => (birthYear === undefined ? undefined : birthYear + age);
export function economyAt(seed: number, age: number, birthYear?: number) {
  const y = yearAt(birthYear, age);
  const g = y === undefined ? undefined : GDP_GROWTH[y];
  if (g !== undefined) return econFromGdp(g);
  return economyPath(seed)[Math.min(111, Math.max(0, age))];
}
// その年の物価上昇率(%)と失業率(%)。統計がない年は、undefined(毎回ランダムの未来)。
export const cpiAt = (birthYear: number | undefined, age: number) => (birthYear === undefined ? undefined : CPI_CHANGE[birthYear + age]);
export const unemploymentAt = (birthYear: number | undefined, age: number) => (birthYear === undefined ? undefined : UNEMPLOYMENT[birthYear + age]);
