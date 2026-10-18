import { jpData } from "@/lib/sim/data/jp";
import { interpolateLog } from "@/lib/sim/rng";

// 世の中の統計。結果画面で、シミュレーションの人生と見比べるために使う。
// 出典は、出典ページ(/sources)にも書いている。数字は、公表された値を、だいたいの形で写したもの。

// 国税庁「民間給与実態統計調査」令和5年分。年齢階層別の平均給与(男女計・万円)。
export const SALARY_BY_AGE: { from: number; to: number; man: number }[] = [
  { from: 20, to: 24, man: 267 },
  { from: 25, to: 29, man: 394 },
  { from: 30, to: 34, man: 431 },
  { from: 35, to: 39, man: 466 },
  { from: 40, to: 44, man: 501 },
  { from: 45, to: 49, man: 521 },
  { from: 50, to: 54, man: 540 },
  { from: 55, to: 59, man: 545 },
  { from: 60, to: 64, man: 445 },
];

// 総務省「家計調査(貯蓄・負債編)」2020年平均。二人以上の世帯の、世帯主の年齢階級別の貯蓄現在高の平均(万円)。
export const SAVINGS_BY_AGE: { from: number; to: number; man: number; label: string }[] = [
  { from: 20, to: 39, man: 708, label: "40歳未満" },
  { from: 40, to: 49, man: 1081, label: "40代" },
  { from: 50, to: 59, man: 1703, label: "50代" },
  { from: 60, to: 69, man: 2384, label: "60代" },
  { from: 70, to: 89, man: 2259, label: "70歳以上" },
];

// 厚生労働省「人口動態統計」2023年(確定数)。平均初婚年齢(夫31.1・妻29.7)と、第1子出生時の母の平均年齢(31.0)。
export const FIRST_MARRIAGE = { husband: 31.1, wife: 29.7 };
export const FIRST_BIRTH_MOTHER = 31.0;

// 生き残る人の割合(0歳を100%とする)。厚生労働省「簡易生命表」の平均余命に合うよう当てはめた死亡率(男女の平均)から、計算したもの。
export function survival(): { age: number; pct: number }[] {
  const curve = jpData.curves.mortality.none;
  const out: { age: number; pct: number }[] = [];
  let alive = 1;
  for (let a = 0; a <= 105; a++) {
    out.push({ age: a, pct: alive * 100 });
    alive *= 1 - Math.min(1, interpolateLog(curve, a));
  }
  return out;
}
