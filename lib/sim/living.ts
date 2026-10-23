import { HOME_PRICE, monthlyMan } from "@/lib/sim/data/jp-turning";
import type { CountryData, Person } from "@/lib/sim/types";

// 1年ぶんの、生活費・固定費の内訳(万円)。家計調査・全国家計構造調査の費目(食料・住居・光熱水道・交通通信・保健医療・教養娯楽など)にならった目安。
// 全国の1か月の消費支出は、総世帯で約25.1万円・二人以上世帯で約30.2万円(全国家計構造調査・令和6年)。
// 子どもの学習費は、文部科学省「子供の学習費調査」(公立: 小学校約35万円・中学校約54万円・高校約51万円)を目安にした。
export type CostItem = { id: string; label: string; man: number; note?: string };

const RENT: Record<string, number> = { tokyo: 150, metro: 105, local: 78, rural: 64 };

export function livingCosts(p: Person, data: CountryData): { items: CostItem[]; total: number } {
  const kids = p.kidList.filter((k) => p.age - k.bornAge < 18);
  const adults = 1 + (p.married ? 1 : 0);
  const n = adults + kids.length * 0.8;
  const items: CostItem[] = [];
  const add = (id: string, label: string, man: number, note?: string) => {
    if (man > 0) items.push({ id, label, man: Math.round(man), ...(note ? { note } : {}) });
  };
  const factor = p.abroad?.costFactor ?? 1;

  // 住居費
  if (p.withParents) add("housing", "家にいれる生活費", 36, "実家で暮らしている間の、食費や光熱費の負担");
  else if (p.housingKind === "homeless") add("housing", "住居費", 0);
  else if (p.owned) {
    const price = HOME_PRICE[p.region];
    add("housing", "住宅ローンの返済・固定資産税・管理費", monthlyMan(price) * 12 + price * 0.007, "毎月の返済に、年に1度の固定資産税などが加わる");
  } else {
    const mult = p.housingKind ? { lodging: 0.3, dorm: 0.4, share: 0.7, facility: 0.5, homeless: 0 }[p.housingKind] : 1;
    add("housing", "家賃", RENT[p.region] * (adults > 1 || kids.length > 0 ? 1.2 : 1) * (kids.length > 1 ? 1.1 : 1) * mult * factor, "毎月の家賃(更新料や火災保険は、ならして含む)");
  }
  // 食費・光熱水道・通信交通・保険医療・衣類日用品・教養娯楽
  const food = (50 + 30 * (adults - 1) + 28 * kids.length) * (p.withParents ? 0 : 1) * factor;
  add("food", "食費", food);
  add("utilities", "光熱・水道", p.withParents ? 0 : (12 + 5 * (n - 1)) * factor);
  const car = p.region === "rural" ? 22 : p.region === "local" ? 18 : 0;
  add("transport", "通信・交通", (28 + car + 10 * (adults - 1) + 3 * kids.length) * factor, car > 0 ? "地方では、車の維持費(ガソリン・保険・税)がかかる" : "スマートフォン・インターネット・電車やバスなど");
  const health = (12 + 3 * kids.length + (p.ailment !== "none" ? 8 : 0) + (p.age >= 65 ? 8 : p.age >= 50 ? 3 : 0)) * factor;
  add("health", "医療・保険", health, "医療費の自己負担や、民間の保険料");
  add("daily", "衣類・日用品", (15 + 8 * (n - 1)) * factor);
  add("leisure", "教養・娯楽・交際", (28 + 10 * (n - 1)) * (p.age >= 65 ? 0.8 : 1) * factor);
  // 子どもの教育費(学校の学習費)
  const edu = kids.reduce((sum, k) => {
    const a = p.age - k.bornAge;
    return sum + (a < 6 ? 8 : a < 12 ? 35 : a < 15 ? 54 : 51);
  }, 0);
  add("education", "子どもの教育費", edu, "学校の費用・給食・習い事・塾などの学習費");
  return { items, total: items.reduce((s, x) => s + x.man, 0) };
}
