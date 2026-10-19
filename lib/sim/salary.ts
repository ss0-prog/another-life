import { condOf } from "@/lib/sim/helpers";
import { interpolate } from "@/lib/sim/rng";
import type { CountryData, Person } from "@/lib/sim/types";
import { WAGE_REGION, WAGE_REGION_BANDS } from "@/lib/sim/data/jp-wage-region";

// 年収の目安(万円、個人)。大分類の水準に、職種・年齢・地域・性別・学歴・専攻・雇用形態・企業規模・勤め先(民間/公務員)・
// 景気・持病・職種内の違い(payMult)を掛け合わせる。patch で一部の条件を差し替えれば、「もしこうなら」の目安も出せる。
// 性別による倍率。女性は、新卒ではほぼ同じで、年齢とともに差が開く。
function sexMult(q: Person, inc: CountryData["income"]): number {
  if (q.sex === "male") return 1;
  const f = interpolate(inc.femaleAgeFactor, q.age);
  return q.sex === "female" ? f : (1 + f) / 2;
}

// 住んでいる都道府県(「東京・世田谷区」「愛知県・名古屋市」などの先頭)を、表の名前にそろえる。
export function prefectureOf(city: string): string | null {
  const head = city.split("・")[0].trim();
  if (!head) return null;
  const name = head === "北海道" ? head : head.replace(/[都府県]$/, "");
  return name in WAGE_REGION ? name : null;
}

// 地域による、年収の倍率。都道府県ごとの、年齢階級別の実際の賃金(jp-wage-region.ts)から、年齢のあいだは直線でつなぐ。
// 若いうちは地域の差が小さく、年齢とともに開く。都道府県がわからなければ(あるいは海外では)、地域の4区分の倍率を使う。
export function regionWage(q: Person, inc: CountryData["income"]): number {
  const pref = q.abroad ? null : prefectureOf(q.city);
  if (!pref) return inc.regionFactor[q.region];
  const r = WAGE_REGION[pref];
  const b = WAGE_REGION_BANDS;
  if (q.age <= b[0]) return r[0];
  if (q.age >= b[b.length - 1]) return r[r.length - 1];
  let i = 0;
  while (q.age > b[i + 1]) i++;
  const t = (q.age - b[i]) / (b[i + 1] - b[i]);
  return r[i] + (r[i + 1] - r[i]) * t;
}

export function incomeOf(p: Person, data: CountryData, econ: number, patch: Partial<Person> = {}): number {
  const q: Person = { ...p, ...patch };
  if (q.occ === null) return 0;
  if (q.occ === "retired") return q.pensionFrom !== undefined && q.age < q.pensionFrom ? 0 : data.cashflow.pension * (q.pensionMult ?? 1);
  const inc = data.income;
  const cond = condOf(data, q);
  const publicSector = q.sector === "public";
  // 公務員は、景気の影響を受けにくい。
  const sens = inc.econSensitivity[q.occ] * (publicSector ? 0.2 : 1);
  let v = inc.base[q.occ];
  v *= q.employment === "self" ? 1 : interpolate(inc.ageFactor, q.age);
  v *= regionWage(q, inc) * sexMult(q, inc) * inc.eduFactor[q.edu] * cond.income;
  v *= inc.employmentFactor[q.employment] * (q.employment === "self" || q.occ === "agri" || publicSector ? 1 : inc.firmFactor[q.firm]);
  if (publicSector) v *= 1.04;
  if (q.major && (q.edu === "univ" || q.edu === "grad")) v *= inc.majorFactor[q.major];
  if (q.abroad) v *= q.abroad.incomeFactor;
  v *= q.payMult * (1 + econ * 0.04 * sens);
  v *= 0.7 + (q.stats.money / 100) * 0.6;
  // 何かの値が欠けても、画面に NaN を出さない。
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

export const round10 = (n: number) => (Number.isFinite(n) ? Math.round(n / 10) * 10 : 0);

// ---- 転職(中途採用)の賃金 ----
// 厚生労働省「雇用動向調査」(令和6年)では、転職した人のうち、前の職より賃金が「増加」した人が40.5%、「減少」した人が29.4%(残りは、変わらない)。
// その分布から、前の職との倍率を決める(増加は +5〜+25%、減少は -5〜-25% の幅は、設計上の仮定)。
export function drawChangeFactor(r: () => number): number {
  const u = r();
  const mag = 0.05 + r() * 0.2;
  if (u < 0.405) return 1 + mag;
  if (u < 0.405 + 0.294) return 1 - mag;
  return 1;
}

// 転職後の年収の目安(万円)。前の年収に倍率をかけ、職の水準のちがいを、少しだけ反映する。
export function changeIncome(p: Person, data: CountryData, econ: number, job: { occ: Person["occ"]; id: string; mult: number }, factor: number): { now: number; next: number } {
  const now = incomeOf(p, data, econ);
  // 職種の水準(平均は約0.93倍)のちがいは、少しだけ反映する(±2%まで)。
  const adj = Math.max(0.98, Math.min(1.02, Math.pow(job.mult / 0.93, 0.15)));
  return { now, next: now * factor * adj };
}

// 転職して、新しい職の賃金の水準(payMult)を、changeIncome の結果になるように合わせる。
export function applyChangeIncome(p: Person, data: CountryData, econ: number, target: number) {
  const at = incomeOf(p, data, econ);
  if (at > 0 && target > 0) p.payMult = Math.max(0.3, Math.min(3, p.payMult * (target / at)));
}
