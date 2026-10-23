// 犯罪に手を染めたときの、検挙と裁き。
// 検挙率は、警察庁・法務省の統計から(令和6年・令和5年)。法定刑は、現行の刑法(2025年6月から、懲役・禁錮は「拘禁刑」に一本化)。
//   刑法犯全体の検挙率: 38.9%(令和6年)。殺人96.6%・強盗92.5%(令和6年)。傷害81.0%・暴行82.4%・詐欺36.2%(令和5年)。
//   窃盗は、罪種別の令和6年の値を確認できなかったため、刑法犯全体の検挙率(38.9%)を使う。
//   起訴は、検察が処理した人のおよそ3分の1(令和3年: 起訴約24万4千人・不起訴約49万2千人)。拘禁刑の判決は、実刑が約36%・全部執行猶予が約64%(令和3年)。
// 罪名ごとの起訴率・罰金になる割合・刑期の目安は、これらをもとにした設計上の仮定。

export type CrimeId = "theft" | "fraud" | "robbery" | "assault";

export type CrimeDef = {
  id: CrimeId;
  label: string;
  law: string; // 法定刑
  clearance: number; // 検挙率
  clearanceNote: string;
  limit: number; // 公訴時効(年)
  prosecute: number; // 検挙されたときに、起訴される確率(設計上の仮定)
  fineShare: number; // 起訴されたうち、罰金(略式)になる割合。罰金のない罪は 0
  fineMan: [number, number]; // 罰金の額(万円)
  terms: [number, number]; // 拘禁刑の刑期(年)の目安
  suspendedShare: number; // 拘禁刑のうち、執行猶予がつく割合
  gain: [number, number]; // 手に入るお金(万円)
};

export const CRIMES: Record<CrimeId, CrimeDef> = {
  theft: { id: "theft", label: "窃盗", law: "窃盗罪(刑法235条): 10年以下の拘禁刑、または50万円以下の罰金", clearance: 0.389, clearanceNote: "刑法犯全体・令和6年", limit: 7, prosecute: 0.35, fineShare: 0.5, fineMan: [10, 50], terms: [1, 2], suspendedShare: 0.64, gain: [5, 30] },
  fraud: { id: "fraud", label: "詐欺", law: "詐欺罪(刑法246条): 10年以下の拘禁刑(罰金はない)", clearance: 0.362, clearanceNote: "令和5年", limit: 7, prosecute: 0.55, fineShare: 0, fineMan: [0, 0], terms: [1.5, 3.5], suspendedShare: 0.5, gain: [50, 300] },
  robbery: { id: "robbery", label: "強盗", law: "強盗罪(刑法236条): 5年以上の有期拘禁刑", clearance: 0.925, clearanceNote: "令和6年", limit: 10, prosecute: 0.9, fineShare: 0, fineMan: [0, 0], terms: [4, 8], suspendedShare: 0.08, gain: [30, 150] },
  assault: { id: "assault", label: "傷害(報復)", law: "傷害罪(刑法204条): 15年以下の拘禁刑、または50万円以下の罰金", clearance: 0.81, clearanceNote: "令和5年", limit: 10, prosecute: 0.45, fineShare: 0.5, fineMan: [10, 50], terms: [1, 3], suspendedShare: 0.64, gain: [0, 0] },
};

// 逮捕までの年数の分布(設計上の仮定): 検挙される場合の多くは、すぐに捕まる。
export function yearsToArrest(r: () => number): number {
  const x = r();
  return x < 0.5 ? 0 : x < 0.75 ? 1 : x < 0.87 ? 2 : 3 + Math.floor(r() * 4);
}

export type Verdict =
  | { kind: "none" } // 不起訴(起訴猶予)
  | { kind: "fine"; man: number }
  | { kind: "suspended"; years: number } // 執行猶予つきの拘禁刑
  | { kind: "prison"; years: number };

// 検挙されたあとの、検察と裁判の結果。
export function judge(def: CrimeDef, r: () => number, prior: boolean): Verdict {
  // 前科があると、起訴されやすく、執行猶予もつきにくい。
  const pros = Math.min(0.97, def.prosecute * (prior ? 1.4 : 1));
  if (r() >= pros) return { kind: "none" };
  if (def.fineShare > 0 && r() < def.fineShare * (prior ? 0.6 : 1)) {
    return { kind: "fine", man: Math.round(def.fineMan[0] + r() * (def.fineMan[1] - def.fineMan[0])) };
  }
  const years = Math.round((def.terms[0] + r() * (def.terms[1] - def.terms[0])) * 2) / 2;
  const susp = def.suspendedShare * (prior ? 0.35 : 1);
  return r() < susp ? { kind: "suspended", years } : { kind: "prison", years };
}
