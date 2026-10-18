import { economyPath } from "@/lib/sim/economy";
import { createRng, type Rng } from "@/lib/sim/rng";
import type { AssetId, CountryData } from "@/lib/sim/types";

const MONTHS = 111 * 12;

// 価格の道筋。0歳の0か月目を 100 として、月ごとの価格を持つ。
export type Market = Record<AssetId, number[]>;

const cache = new Map<string, Market>();

function gauss(rng: Rng): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

// 同じ種からは同じ価格の道筋になる。分岐した/しなかった二つの人生は、同じ市場を見る。
export function marketOf(seed: number, data: CountryData): Market {
  const key = `${seed}:${data.assets.map((a) => a.id).join()}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const market = {} as Market;
  const indexCrash: number[] = new Array(MONTHS + 1).fill(0);
  const econ = economyPath(seed);

  data.assets.forEach((a, idx) => {
    const rng = createRng((seed ^ Math.imul(idx + 1, 0x9e3779b1)) >>> 0);
    const path = [100];
    let ruined = false;
    for (let i = 1; i <= MONTHS; i++) {
      // ほぼ無価値になったあとは、動かない。
      if (ruined) {
        path.push(path[i - 1]);
        continue;
      }
      // 景気がよい年は株価もやや上向き、不況の年はやや下向きになる。
      const econDrift = a.id === "bond" ? 0 : (0.06 * (econ[Math.floor(i / 12)] ?? 0)) / 12;
      let r = (a.mu - (a.sigma * a.sigma) / 2) / 12 + econDrift + (a.sigma / Math.sqrt(12)) * gauss(rng);
      if (a.id === "index" && rng() < a.crashP / 12) {
        indexCrash[i] = a.crash[0] + rng() * (a.crash[1] - a.crash[0]);
      }
      // 暴落は市場全体で起こる。成長株は、より大きく巻き込まれる。
      const share: Partial<Record<AssetId, number>> = { index: 1, world: 0.9, balanced: 0.4, reit: 0.8, growth: 1.5, crypto: 1.2 };
      const drop = Math.min(0.8, indexCrash[i] * (share[a.id] ?? 0));
      if (drop > 0) r += Math.log(1 - drop);
      if (a.ruinP > 0 && rng() < a.ruinP / 12) {
        ruined = true;
        r += Math.log(0.05);
      }
      path.push(path[i - 1] * Math.exp(r));
    }
    market[a.id] = path;
  });

  if (cache.size > 20) cache.clear();
  cache.set(key, market);
  return market;
}

export const monthIndex = (age: number, month: number) => Math.min(MONTHS, age * 12 + month);

export const priceAt = (market: Market, id: AssetId, age: number, month: number) => market[id][monthIndex(age, month)];
