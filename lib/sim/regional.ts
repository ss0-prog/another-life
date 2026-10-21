import { HAPPINESS_2024, HAPPINESS_JP_2024, LIFE_EXPECTANCY_2020, LIFE_EXPECTANCY_JP_2020, MIN_WAGE_NATIONAL, MIN_WAGE_PREF, UNIV_ADVANCE_2024, UNIV_ADVANCE_JP_2024 } from "@/lib/sim/data/jp-regional";
import type { Person, Sex } from "@/lib/sim/types";

// 都道府県の名前を、表のキー(「東京都」→「東京」、「北海道」はそのまま)にそろえる。
export const prefKey = (name: string | null | undefined): string | null => {
  if (!name) return null;
  const head = name.split("・")[0].trim();
  const k = head === "北海道" ? head : head.replace(/[都府県]$/, "");
  return k in LIFE_EXPECTANCY_2020 ? k : null;
};

// 暮らしている(いま)都道府県。20歳までは、生まれた都道府県。海外では、なし。
export function prefOf(p: Pick<Person, "age" | "abroad" | "city" | "birthPlace">): string | null {
  if (p.abroad) return null;
  return prefKey(p.age < 20 ? p.birthPlace : p.city) ?? prefKey(p.birthPlace);
}

// 死亡率の、都道府県による倍率。平均寿命(2020年・都道府県別生命表)が、全国より1年長ければ、亡くなる確率は、約8%低くなる(年齢が8〜9年で死亡率が倍になる関係から)。
const MORT_K = 0.085;
export function mortalityMult(sex: Sex, pref: string | null): number {
  if (!pref) return 1;
  const e = LIFE_EXPECTANCY_2020[pref];
  if (!e) return 1;
  const i = sex === "male" ? 0 : 1;
  const nat = sex === "male" ? LIFE_EXPECTANCY_JP_2020[0] : sex === "female" ? LIFE_EXPECTANCY_JP_2020[1] : (LIFE_EXPECTANCY_JP_2020[0] + LIFE_EXPECTANCY_JP_2020[1]) / 2;
  const mine = sex === "male" || sex === "female" ? e[i] : (e[0] + e[1]) / 2;
  return Math.exp(-MORT_K * (mine - nat));
}

// 大学等への現役進学率(0〜1)。
export const univRate = (pref: string | null): number => (pref && UNIV_ADVANCE_2024[pref] ? UNIV_ADVANCE_2024[pref][0] : UNIV_ADVANCE_JP_2024) / 100;
export const univRateNational = () => UNIV_ADVANCE_JP_2024 / 100;

// 幸福度(調査の点数)の、全国との差を、暮らしの「幸福度」の目標に足す点数にする(差の約半分。点数の差は、あまり大きくないため)。
export function happinessOffset(pref: string | null): number {
  const h = pref ? HAPPINESS_2024[pref] : undefined;
  return h === undefined ? 0 : (h - HAPPINESS_JP_2024) * 0.5;
}

// アルバイトの収入の倍率(2025年度の全国平均の最低賃金 = 1)。最低賃金は、年ごとの全国加重平均額の推移と、都道府県ごとの水準(2025年度の全国平均との比)で決まる。
// 1978年度(目安制度のはじまり)より前は、1978年度の水準。2026年度より先は、2026年度の水準のまま。都道府県の比は、どの年も、2025年度の比のままと仮定する。
const NAT_2025 = MIN_WAGE_NATIONAL[2025];
export function minWageFactor(year: number, pref: string | null): number {
  const y = Math.min(2026, Math.max(1978, Math.round(year)));
  const nat = MIN_WAGE_NATIONAL[y] ?? NAT_2025;
  const prefRatio = pref && MIN_WAGE_PREF[pref] ? MIN_WAGE_PREF[pref].y2025 / NAT_2025 : 1;
  return (nat / NAT_2025) * prefRatio;
}

// 人物の、死亡率の倍率。生まれた都道府県を7割、いま暮らす都道府県を3割(生まれた土地の影響は、あとまで残る)。海外では、生まれた都道府県だけ。
export function mortalityOf(p: Pick<Person, "sex" | "abroad" | "city" | "birthPlace" | "age">): number {
  const b = mortalityMult(p.sex, prefKey(p.birthPlace));
  if (p.abroad || p.age < 20) return b;
  const c = mortalityMult(p.sex, prefKey(p.city));
  return Math.pow(b, 0.7) * Math.pow(c, 0.3);
}

// 人物の、幸福度の目標に足す点数。生まれた都道府県を7割、いま暮らす都道府県を3割。
export function happinessOf(p: Pick<Person, "abroad" | "city" | "birthPlace" | "age">): number {
  const b = happinessOffset(prefKey(p.birthPlace));
  if (p.abroad || p.age < 20) return b;
  return b * 0.7 + happinessOffset(prefKey(p.city)) * 0.3;
}
