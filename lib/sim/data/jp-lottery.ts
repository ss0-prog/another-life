// 宝くじ: 1枚300円。当せん金と本数は、年末ジャンボ宝くじ(第984回・23ユニット・発売総額1,380億円)の、公式サイトの一覧にもとづく。
// 1ユニットは2,000万枚で、総枚数は4億6千万枚。当せん金の総額は、法律で、発売総額の50%以内と決まっている(この一覧も、ほぼ50%)。
export const LOTTERY_TICKETS = 460_000_000;
export const LOTTERY_PRIZES: { name: string; yen: number; count: number }[] = [
  { name: "1等", yen: 700_000_000, count: 23 },
  { name: "1等の前後賞", yen: 150_000_000, count: 46 },
  { name: "2等", yen: 10_000_000, count: 184 },
  { name: "3等", yen: 1_000_000, count: 9_200 },
  { name: "1等の組違い賞", yen: 100_000, count: 4_577 },
  { name: "4等", yen: 50_000, count: 46_000 },
  { name: "5等", yen: 10_000, count: 460_000 },
  { name: "6等", yen: 3_000, count: 4_600_000 },
  { name: "7等", yen: 300, count: 46_000_000 },
];
// 1枚買ったとき、当たる等級(はずれなら null)。
export const drawTicket = (r: () => number) => {
  let x = r() * LOTTERY_TICKETS;
  for (const pz of LOTTERY_PRIZES) {
    if (x < pz.count) return pz;
    x -= pz.count;
  }
  return null;
};

// n枚買ったときの、当せん金の合計(円)と、いちばん上の当せん(1等・高額・なし)。
export function drawLottery(r: () => number, n: number): { win: number; top: string } {
  let win = 0;
  let top = "";
  for (let i = 0; i < n; i++) {
    const pz = drawTicket(r);
    if (!pz) continue;
    win += pz.yen;
    if (pz.name === "1等") top = "1等";
    else if (pz.yen >= 100_000 && top !== "1等") top = pz.name;
  }
  return { win, top };
}
