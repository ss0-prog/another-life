import { createRng } from "@/lib/sim/rng";

// 空模様。2〜3年ごとに移り変わり、晴れがいちばん多い(5割以上)。同じ種からは同じ空模様になる。
export type Weather = "clear" | "cloudy" | "rain" | "snow" | "thunder";

const WEIGHTS: Record<Weather, number> = { clear: 56, cloudy: 17, rain: 14, snow: 7, thunder: 6 };
const cache = new Map<number, Weather[]>();

// 年齢ごとの空模様(0〜111歳)。
export function weatherPath(seed: number): Weather[] {
  const hit = cache.get(seed);
  if (hit) return hit;
  const rng = createRng((seed ^ 0x57ea7e2) >>> 0);
  const path: Weather[] = [];
  let clearYears = 0;
  while (path.length <= 111) {
    const len = 2 + (rng() < 0.5 ? 1 : 0);
    let w: Weather = "clear";
    // 晴れが5割を下回りそうなら、次は晴れにする。
    if (path.length > 0 && clearYears / path.length >= 0.55) {
      let r = rng() * (100 - WEIGHTS.clear);
      for (const k of ["cloudy", "rain", "snow", "thunder"] as const) {
        r -= WEIGHTS[k];
        if (r < 0) {
          w = k;
          break;
        }
      }
    }
    for (let i = 0; i < len; i++) {
      path.push(w);
      if (w === "clear") clearYears++;
    }
  }
  if (cache.size > 20) cache.clear();
  cache.set(seed, path);
  return path;
}

export const weatherAt = (seed: number, age: number): Weather => weatherPath(seed)[Math.min(111, Math.max(0, age))];

// 空模様が変わったときに、年表に添える一文。
export const WEATHER_EVENT: Record<Weather, string> = {
  clear: "空が晴れ渡る日々が戻ってきた",
  cloudy: "どんよりとした曇り空の日々が続くようになった",
  rain: "雨の降る日が多い、長雨の季節が続いた",
  snow: "雪の降る日が増え、街が白く染まった",
  thunder: "雷の鳴る、不安定な空模様が続いた",
};
