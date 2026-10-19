import { incomeOf } from "@/lib/sim/salary";
import type { CountryData, Person, TaxSnap } from "@/lib/sim/types";

// 税と社会保険料の計算(万円)。実在の制度のおおまかな仕組みに合わせた、シミュレーション用の簡略版。
// 年ごとの改正は追わない。細かい控除(医療費・保険料・ふるさと納税・扶養の細かい要件など)や、自治体・健康保険組合ごとの違いは入れていない。
// 数字は制度の転記ではない。くわしい区別は「データについて」に書いている。

export type TaxResult = {
  gross: number; // 額面
  incomeTax: number; // 所得税(復興特別所得税をふくむ)
  resident: number; // 住民税
  health: number; // 健康保険(国保・後期高齢をふくむ)と介護保険
  pension: number; // 年金保険料(厚生年金・国民年金)
  employment: number; // 雇用保険
  social: number; // 社会保険料の合計
  credit: number; // 住宅ローン控除で減った所得税(参考)
  net: number; // 手取り
  consumption: number; // 暮らしの支出にふくまれる消費税の目安(手取りからは、別に引かない)
};

const ZERO: TaxResult = { gross: 0, incomeTax: 0, resident: 0, health: 0, pension: 0, employment: 0, social: 0, credit: 0, net: 0, consumption: 0 };

// 所得税の累進税率(課税所得、万円): [上限, 税率, 控除額]。
const BRACKETS: [number, number, number][] = [
  [195, 0.05, 0],
  [330, 0.1, 9.75],
  [695, 0.2, 42.75],
  [900, 0.23, 63.6],
  [1800, 0.33, 153.6],
  [4000, 0.4, 279.6],
  [Infinity, 0.45, 479.6],
];
const RECON = 1.021; // 復興特別所得税

const bracketTax = (taxable: number) => {
  if (taxable <= 0) return 0;
  const [, rate, sub] = BRACKETS.find(([cap]) => taxable <= cap)!;
  return (taxable * rate - sub) * RECON;
};
// 課税所得が1万円ふえたときの、所得税の増え方(住民税を除く)。
const marginalIncomeTax = (taxable: number) => (taxable <= 0 ? 0 : BRACKETS.find(([cap]) => taxable <= cap)![1] * RECON);

// 給与所得控除(令和7年分以後。国税庁 No.1410)。
function salaryDeduction(g: number): number {
  if (g <= 190) return Math.min(g, 65);
  if (g <= 360) return g * 0.3 + 8;
  if (g <= 660) return g * 0.2 + 44;
  if (g <= 850) return g * 0.1 + 110;
  return 195;
}
// 公的年金等控除(65歳以上、ほかの所得が1,000万円以下。国税庁 No.1600 の式を、記憶から写したもので、一部は未照合)。
function pensionDeduction(g: number): number {
  if (g <= 330) return Math.min(g, 110);
  if (g <= 410) return g * 0.25 + 27.5;
  if (g <= 770) return g * 0.15 + 68.5;
  if (g <= 1000) return g * 0.05 + 145.5;
  return 195.5;
}
// 基礎控除(所得税、令和7年分。国税庁 No.1199)。合計所得金額で変わる。
function basicDeduction(totalIncome: number): number {
  if (totalIncome <= 132) return 95;
  if (totalIncome <= 336) return 88;
  if (totalIncome <= 489) return 68;
  if (totalIncome <= 655) return 63;
  if (totalIncome <= 2350) return 58;
  if (totalIncome <= 2400) return 48;
  if (totalIncome <= 2450) return 32;
  if (totalIncome <= 2500) return 16;
  return 0;
}

type Kind = "wage" | "self" | "pension";
type Opts = { kids16?: number; homeCredit?: boolean };

// 個人ひとり分の、1年の税と社会保険料。
function taxOne(kind: Kind, gross: number, age: number, nonregular: boolean, o: Opts = {}): TaxResult {
  if (gross <= 0) return { ...ZERO };
  let health = 0;
  let pension = 0;
  let employment = 0;
  let ded: number;
  if (kind === "wage") {
    ded = salaryDeduction(gross);
    employment = gross * 0.0055;
    // 年収が約106万円を超えるまでの非正規は、扶養の範囲(または学生)として、社会保険に入らないと仮定する。
    const insured = !(nonregular && gross < 106);
    if (insured) {
      health = Math.min(gross, 1600) * 0.05 + (age >= 40 && age < 65 ? Math.min(gross, 1600) * 0.008 : 0);
      pension = age < 70 ? Math.min(gross, 850) * 0.0915 : 0;
    }
    if (age >= 65) employment = 0;
  } else if (kind === "self") {
    ded = 65; // 青色申告特別控除を、使っていると仮定する。
    const base = Math.max(0, gross - 43);
    health = Math.min(110, Math.max(2, base * (age >= 40 && age < 65 ? 0.115 : 0.095)));
    pension = age >= 20 && age < 60 ? 20 : 0;
  } else {
    ded = pensionDeduction(gross);
    health = gross * 0.06;
  }
  const social = health + pension + employment;
  const dep = (o.kids16 ?? 0) * 38;
  const taxable = Math.max(0, gross - ded - social - basicDeduction(Math.max(0, gross - ded)) - dep);
  let incomeTax = bracketTax(taxable);
  let credit = 0;
  if (o.homeCredit && incomeTax > 0) {
    // 住宅ローン控除: 年末のローン残高(3,000万円と仮定)の0.7%。引ききれないぶんは、ここでは見ない。
    credit = Math.min(incomeTax, 21);
    incomeTax -= credit;
  }
  const rTaxable = Math.max(0, gross - ded - social - 43 - (o.kids16 ?? 0) * 33);
  const resident = rTaxable > 0 ? rTaxable * 0.1 + 0.5 : 0;
  const net = gross - incomeTax - resident - social;
  return { gross, incomeTax, resident, health, pension, employment, social, credit, net, consumption: 0 };
}

const kindOf = (p: Person): Kind => (p.occ === "retired" ? "pension" : p.employment === "self" ? "self" : "wage");

// 配偶者の収入は、本人の3割5分(既存の「世帯は1.35倍」の置き方)。配偶者も、ひとりの働き手として、別に計算する。
export const SPOUSE_SHARE = 0.35;

function add(a: TaxResult, b: TaxResult): TaxResult {
  return {
    gross: a.gross + b.gross, incomeTax: a.incomeTax + b.incomeTax, resident: a.resident + b.resident, health: a.health + b.health, pension: a.pension + b.pension,
    employment: a.employment + b.employment, social: a.social + b.social, credit: a.credit + b.credit, net: a.net + b.net, consumption: 0,
  };
}

// 住宅ローン控除が使える年か(買ってから13年)。
const homeCreditOn = (p: Person) => p.owned && p.occ !== "retired" && p.owns.home !== undefined && p.age - p.owns.home < 13;

// 16歳以上の子ども(扶養控除の対象)の数。
const kids16 = (p: Person) => p.kidList.filter((k) => p.age - k.bornAge >= 16 && p.age - k.bornAge < 23).length;

// 世帯の、1年の税と社会保険料。patch で一部の条件を差し替えれば、「もしこうなら」の目安も出せる。
// 結婚していて働いているときは、配偶者のぶん(本人の3割5分)もふくむ。
export function householdTax(p: Person, data: CountryData, econ: number, patch: Partial<Person> = {}): TaxResult {
  const q: Person = { ...p, ...patch };
  if (q.occ === null) return { ...ZERO };
  const gross = incomeOf(p, data, econ, patch);
  const own = taxOne(kindOf(q), gross, q.age, q.employment === "nonregular", { kids16: kids16(q), homeCredit: homeCreditOn(q) });
  if (q.married && q.occ !== "retired") return add(own, taxOne("wage", gross * SPOUSE_SHARE, q.age, true));
  return own;
}

// 手取り(万円)。
export const netIncome = (p: Person, data: CountryData, econ: number, patch: Partial<Person> = {}) => householdTax(p, data, econ, patch).net;

// 手取りの割合(0〜1)。
export const netRatio = (t: TaxResult) => (t.gross > 0 ? t.net / t.gross : 1);

// 副業・アルバイトの収入(万円)にかかる税。働いていない人は、年に約103万円までは引かれない。
// 働いている人は、年に20万円をこえると申告する前提で、本業の税率と住民税10%がかかる(社会保険料は、かからない)。
export function sideTax(p: Person, data: CountryData, econ: number, payMan: number): number {
  if (payMan <= 0) return 0;
  const main = p.occ !== null && p.occ !== "retired";
  if (!main) return Math.max(0, payMan - 103) * 0.15;
  if (payMan <= 20) return 0;
  const t = householdTax(p, data, econ);
  const taxable = Math.max(0, t.gross - salaryDeduction(t.gross) - t.social - 58);
  return payMan * (marginalIncomeTax(taxable) + 0.1);
}

// 育児休業の1年あたりの手取りの減り(万円)。給付(賃金の67%、6か月をこえると50%。税も社会保険料もかからない)と、休まず働いたときの手取りとの差。
export function leaveLoss(p: Person, data: CountryData, econ: number, months: number): number {
  const gross = p.occ !== null ? incomeOf(p, data, econ) : 400;
  const net = p.occ !== null ? taxOne(kindOf(p), gross, p.age, p.employment === "nonregular", { kids16: 0 }).net : gross * 0.8;
  const monthly = gross / 12;
  const benefit = monthly * (Math.min(months, 6) * 0.67 + Math.max(0, months - 6) * 0.5);
  return Math.max(0, (net / 12) * months - benefit);
}

// 退職金(万円)にかかる税。退職所得控除(勤続20年まで1年あたり40万円、それ以降は70万円)を引き、残りの半分に、所得税と住民税がかかる。
export function retirementTax(lumpMan: number, years: number): number {
  const y = Math.max(1, years);
  const ded = y <= 20 ? Math.max(80, 40 * y) : 800 + 70 * (y - 20);
  const taxable = Math.max(0, (lumpMan - ded) / 2);
  return bracketTax(taxable) + taxable * 0.1;
}

// 暮らしの支出(万円)にふくまれる消費税の目安(食料品は8%、ほかは10%のため、平均で約7.5%と仮定)。
export const consumptionTaxOf = (spendMan: number) => spendMan * 0.075;

export const man = (n: number) => Math.round(n).toLocaleString("ja-JP");
export const pct = (r: number) => `${Math.round(r * 100)}%`;

// 画面に出すための、四捨五入した控え(万円)。
export const taxSnap = (t: TaxResult): TaxSnap => ({
  gross: Math.round(t.gross), incomeTax: Math.round(t.incomeTax), resident: Math.round(t.resident), health: Math.round(t.health), pension: Math.round(t.pension),
  employment: Math.round(t.employment), social: Math.round(t.social), credit: Math.round(t.credit), net: Math.round(t.net), consumption: Math.round(t.consumption),
});
