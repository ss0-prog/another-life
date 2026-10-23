import type { Background, Person } from "@/lib/sim/types";

// 生まれた家庭の、経済的な暮らし向き(5段階)。実際の統計(子どもの貧困率 約11%・ひとり親世帯の貧困率 約4割など)を手がかりにした、設計上の仮定。
export const BG_LABEL: Record<Background, string> = {
  poverty: "経済的に困窮した家庭",
  tight: "家計に余裕のない家庭",
  modest: "ふつうの暮らしの家庭",
  comfortable: "ゆとりのある家庭",
  rich: "裕福な家庭",
};

// 生まれる確率(合計100)。
export const BG_PRIOR: Record<Background, number> = { poverty: 11, tight: 17, modest: 42, comfortable: 22, rich: 8 };
// 頭の良さの土台のずれ(育つ環境の差。大きな差ではない)。
export const BG_INTEL: Record<Background, number> = { poverty: -5, tight: -3, modest: 0, comfortable: 3, rich: 5 };
// 暮らしの能力値「経済」のはじまり。
export const BG_MONEY: Record<Background, number> = { poverty: 22, tight: 35, modest: 50, comfortable: 65, rich: 80 };
// 家計の差が、貯金のはじまりに与える倍率。
export const BG_FACTOR: Record<Background, number> = { poverty: 0.3, tight: 0.5, modest: 1, comfortable: 1.6, rich: 3 };
// 6〜17歳の「学び」が、1年に動く量(塾・参考書・家庭の余裕・親の関わりの差)。
export const BG_LEARN: Record<Background, number> = { poverty: -0.9, tight: -0.4, modest: 0, comfortable: 0.5, rich: 0.9 };
// 非行・犯罪に近づく起きやすさの倍率(統計では、家庭の貧しさ・ひとり親・低い学力・弱いつながりと関わりが強い。運命ではなく、確率の差)。
export const BG_RISK: Record<Background, number> = { poverty: 3, tight: 1.8, modest: 1, comfortable: 0.6, rich: 0.5 };

// お小遣い(月額)。6歳から。貧しい家庭では、高校生になっても、もらえない。
const ALLOW_MULT: Record<Background, number> = { poverty: 0, tight: 0.5, modest: 1, comfortable: 1.6, rich: 2.6 };
const ALLOW_CAP: Record<Background, number> = { poverty: 0, tight: 5000, modest: 10000, comfortable: 15000, rich: 30000 };
export function monthlyAllowance(bg: Background, age: number): number {
  if (age < 6) return 0;
  const base = age < 9 ? 500 : age < 12 ? 1000 : age < 15 ? 3000 : 5000;
  return Math.min(ALLOW_CAP[bg], Math.round((base * ALLOW_MULT[bg]) / 100) * 100);
}
// お年玉(年額)。
const GIFT_MULT: Record<Background, number> = { poverty: 0.35, tight: 0.6, modest: 1, comfortable: 1.3, rich: 2 };
export function newYearGift(bg: Background, age: number): number {
  const base = age < 6 ? 3000 : age < 9 ? 5000 : age < 12 ? 10000 : age < 15 ? 15000 : 20000;
  return Math.min(50000, Math.round((base * GIFT_MULT[bg]) / 1000) * 1000);
}

// 18歳未満の習い事・塾は、家計が払う。家計に余裕がないと、通えない(理由を返す。通えるなら null)。
export function lessonBlock(p: Person, costMan: number): string | null {
  if (p.age >= 18) return null;
  if (p.background === "poverty") return "家計に余裕がなく、習い事や塾には通えません。";
  if (p.background === "tight") {
    if (costMan > 12) return "月謝が家計では厳しそうです。";
    if (p.lessons.length >= 1) return "家計に余裕がなく、習い事はひとつまでです。";
  }
  return null;
}

// ひとり親家庭(育ててくれた親)。貧困率が高い家庭ほど、ひとり親の割合が高い。
export const SOLO_RATE: Record<Background, number> = { poverty: 0.3, tight: 0.14, modest: 0.06, comfortable: 0.03, rich: 0.02 };
export const soloWho = (p: Pick<Person, "soloParent">) => (p.soloParent === "father" ? "父" : "母");
export const absentWho = (p: Pick<Person, "soloParent">) => (p.soloParent === "father" ? "母" : "父");
