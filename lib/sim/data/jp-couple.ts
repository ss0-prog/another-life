import { compat } from "@/lib/sim/mbti";
import type { Person, Stats } from "@/lib/sim/types";

// 交際中の出来事と、別れやすさ。交際期間は、国立社会保障・人口問題研究所「出生動向基本調査」(第16回・2021年)で、
// 結婚した初婚どうしの夫婦の平均が、約4.3年。別れる確率や、出来事の起きやすさは、設計上の仮定。

type CoupleEvent = { from: number; to: number; w: number; text: (n: string) => string; delta: Partial<Stats>; when?: (p: Person) => number };

const E = (from: number, to: number, w: number, text: (n: string) => string, delta: Partial<Stats>, when?: (p: Person) => number): CoupleEvent => ({ from, to, w, text, delta, when });
const comp = (p: Person) => compat(p.mbti, p.partner?.mbti);
const busy = (p: Person) => (p.occ !== null && p.occ !== "retired" ? 1.5 : 0.4);

const POOL: CoupleEvent[] = [
  E(0, 1, 2, (n) => `${n}と映画やカフェに通い、お互いの好きなものを少しずつ知っていった`, { joy: 4, bonds: 3 }),
  E(0, 1, 1.5, (n) => `${n}とのはじめての記念日。ささやかなお祝いをした`, { joy: 5, bonds: 3 }),
  E(0, 3, 1.5, (n) => `${n}と二人で、はじめての小旅行に出かけた`, { joy: 6, bonds: 4, money: -1 }),
  E(0, 2, 1.2, (n) => `友人に、${n}を恋人として紹介した`, { bonds: 3, joy: 3 }),
  E(0, 9, 1.2, (n) => `${n}と誕生日にプレゼントを贈りあった`, { joy: 4, bonds: 3 }),
  E(0, 9, 1.0, (n) => `${n}とライブやお祭りに出かけ、思い切り楽しんだ`, { joy: 6, bonds: 2 }),
  E(0, 9, 1.4, (n) => `些細なことで${n}と口論になったが、話し合って仲直りした`, { bonds: 2, joy: -2 }, (p) => (comp(p) < 55 ? 1.8 : 1)),
  E(0, 9, 1.2, (n) => `仕事の忙しさで、${n}とすれちがう日が続いた`, { bonds: -3, joy: -4 }, (p) => busy(p)),
  E(0, 9, 0.9, (n) => `お金の使い方をめぐって${n}と意見が割れた`, { bonds: -2, money: -1 }),
  E(0, 9, 0.9, (n) => `${n}が風邪で寝込んだとき、看病に通った`, { bonds: 4, health: -1 }),
  E(0, 9, 0.9, (n) => `${n}の仕事の悩みを夜どおし聞き、支えになった`, { bonds: 4, joy: 1 }),
  E(0, 9, 0.8, (n) => `${n}の友人たちとも仲良くなり、輪が広がった`, { bonds: 4, joy: 3 }),
  E(0, 9, 0.7, (n) => `${n}とおたがいの趣味を教えあい、休日の楽しみが増えた`, { joy: 4, learn: 1 }),
  E(1, 6, 1.5, (n) => `${n}の両親にあいさつに行った`, { bonds: 4, joy: -1, health: -1 }),
  E(1, 6, 1.2, (n) => `${n}に自分の両親を紹介した`, { bonds: 4 }),
  E(1, 9, 1.0, (n) => `${n}と旅行や帰省をともにした`, { joy: 5, bonds: 3, money: -1 }),
  E(1, 9, 0.7, (n) => `転勤や進学で、${n}と遠距離になった`, { bonds: -3, joy: -3 }, (p) => busy(p)),
  E(2, 9, 1.4, (n) => `${n}とこれからの暮らしや結婚について話し合った`, { bonds: 4, joy: 2 }),
  E(2, 9, 1.0, (n) => `${n}と同棲するかどうかを話し合った`, { bonds: 2 }),
  E(2, 9, 0.8, (n) => `${n}との間に将来の考え方のちがいが見えてきた`, { bonds: -2, joy: -2 }, (p) => (comp(p) < 55 ? 2 : 0.6)),
  E(3, 9, 0.8, (n) => `長い付き合いの${n}とは、一緒にいることがあたりまえになった`, { bonds: 3, joy: 2 }),
];

// 交際してから years 年たったときの、出来事ひとつ(なければ null)。
export function coupleEvent(p: Person, years: number, r: () => number): { text: string; delta: Partial<Stats> } | null {
  const n = p.partner ? `${p.partner.given}さん` : "恋人";
  const items = POOL.filter((e) => years >= e.from && years <= e.to).map((e) => ({ e, w: e.w * (e.when ? e.when(p) : 1) }));
  const total = items.reduce((s, x) => s + x.w, 0);
  if (total <= 0) return null;
  let x = r() * total;
  for (const it of items) {
    x -= it.w;
    if (x < 0) return { text: it.e.text(n), delta: it.e.delta };
  }
  return null;
}

// 1年のうちに、別れる確率。付き合いはじめは別れやすく、長くなるほど、別れにくい。相性や、同棲で変わる。
export function breakupChance(p: Person, years: number): number {
  const base = years < 1 ? 0.28 : years < 2 ? 0.22 : years < 3 ? 0.17 : years < 4 ? 0.12 : 0.09;
  const c = comp(p);
  const clash = c < 48 ? 1.7 : c >= 80 ? 0.55 : 1;
  return Math.min(0.7, base * clash * (p.history.cohab ? 0.6 : 1) * (p.stats.bonds < 30 ? 1.2 : 1));
}

export function breakupText(p: Person, years: number, r: () => number): string {
  const who = p.partner ? `${p.partner.given}さん` : "恋人";
  const reasons = ["すれ違いが続き", "仕事の忙しさで会えない日が重なり", "価値観のちがいが大きくなり", "遠距離になって気持ちが離れ", "将来の考え方が合わず"];
  const long = ["結婚の話が進まないまま、時間だけが過ぎ", "おたがいの将来の考えがちがうことがはっきりし"];
  const pool = years >= 4 ? long : reasons;
  const why = pool[Math.floor(r() * pool.length)];
  return `${why}、${who}と別れることになった(付き合って${Math.max(1, Math.round(years))}年)`;
}
