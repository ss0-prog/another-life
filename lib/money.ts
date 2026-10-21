// 金額(万円)の書き表し方。1億円からは「億」、1兆円からは「兆」で書く(「12,000万円」ではなく「1億2,000万円」)。
// n は、万円。大きな数でも、上の2つの単位だけを出す(「1兆2,300億円」「1億2,345万円」)。
export function manParts(n: number): { num: string; unit: string } {
  if (!Number.isFinite(n)) return { num: "0", unit: "万円" };
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(Math.round(n));
  if (a < 10000) return { num: `${sign}${a.toLocaleString("ja-JP")}`, unit: "万円" };
  if (a < 100000000) {
    const oku = Math.floor(a / 10000);
    const rest = a % 10000;
    return { num: rest > 0 ? `${sign}${oku.toLocaleString("ja-JP")}億${rest.toLocaleString("ja-JP")}万` : `${sign}${oku.toLocaleString("ja-JP")}億`, unit: "円" };
  }
  let cho = Math.floor(a / 100000000);
  let oku = Math.round((a % 100000000) / 10000);
  if (oku >= 10000) {
    cho += 1;
    oku = 0;
  }
  return { num: oku > 0 ? `${sign}${cho.toLocaleString("ja-JP")}兆${oku.toLocaleString("ja-JP")}億` : `${sign}${cho.toLocaleString("ja-JP")}兆`, unit: "円" };
}

export const manText = (n: number): string => {
  const { num, unit } = manParts(n);
  return `${num}${unit}`;
};

// グラフの軸の、短い書き方(「5万」「1.2億」「3兆」)。
export const manShort = (n: number): string => {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 100000000) return `${sign}${+(a / 100000000).toFixed(a >= 1000000000 ? 0 : 1)}兆`;
  if (a >= 10000) return `${sign}${+(a / 10000).toFixed(a >= 100000 ? 0 : 1)}億`;
  return `${sign}${Math.round(a).toLocaleString("ja-JP")}万`;
};
