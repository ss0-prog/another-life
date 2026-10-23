import { SINCE, yearOf } from "@/lib/sim/era";
import { randomPartner } from "@/lib/sim/helpers";
import type { ConcernKind, CountryData, Person, Stats } from "@/lib/sim/types";
import type { Rng } from "@/lib/sim/rng";

// 人間関係の悩み(恋人・友人・家族・職場)。向き合っている間は、毎年、それに関する出来事が、多く起きる。
// 解決の条件と、出来事の起きやすさは、設計上の仮定。
type Ev = { text: (p: Person) => string; delta: Partial<Stats>; when?: (p: Person) => boolean; effect?: (p: Person, r: Rng, d: CountryData) => string | null };

const noPartner = (p: Person) => !p.partner || p.partner.status === "ex";
const pn = (p: Person) => (p.partner ? `${p.partner.given}さん` : "気になる人");

const EVENTS: Record<ConcernKind, Ev[]> = {
  romance: [
    { text: () => "友人に誘われた飲み会で、気になる人に出会った", delta: { joy: 3, bonds: 2 }, when: noPartner, effect: (p, r, d) => ((p.partner = randomPartner(r, d, p.age, "crush", p.mbti, p)), null) },
    { text: (p) => `${pn(p)}と連絡を取り合うようになった`, delta: { joy: 4, bonds: 3 }, when: (p) => p.partner?.status === "crush" },
    { text: () => "マッチングアプリで何人かとやりとりしたが、ピンとくる人はいなかった", delta: { joy: -2, bonds: 1 }, when: (p) => noPartner(p) && yearOf(p) >= SINCE.matching },
    { text: () => "気になる人に声をかけられずに後悔した", delta: { joy: -3 }, when: noPartner },
    { text: (p) => `${pn(p)}と、はじめて二人で出かけた`, delta: { joy: 5, bonds: 3 }, when: (p) => p.partner?.status === "crush" || p.partner?.status === "dating" },
    { text: () => "恋愛と仕事や勉強の時間の使い方で無為に迷った", delta: { joy: -1, health: -1 }, when: (p) => p.occ !== null },
    { text: (p) => `${pn(p)}とすれちがいが続き、気持ちが沈んだ`, delta: { joy: -4, bonds: -1 }, when: (p) => p.partner?.status === "dating" },
    { text: () => "友人の恋愛の話を聞いてうらやましくなった", delta: { joy: -2 }, when: noPartner },
  ],
  friends: [
    { text: () => "久しぶりに友人と会って夜まで語り合った", delta: { joy: 5, bonds: 4 } },
    { text: () => "友人との約束が続けて流れて少しさみしくなった", delta: { joy: -3, bonds: -1 } },
    { text: () => "気の合う新しい友人ができた", delta: { joy: 4, bonds: 5 } },
    { text: () => "友人とのささいな行き違いで気まずくなった", delta: { joy: -4, bonds: -2 } },
    { text: () => "友人の悩みを夜遅くまで聞いた", delta: { bonds: 4, health: -1 } },
    { text: () => "友人たちと旅行の計画を立てた", delta: { joy: 5, bonds: 3 } },
  ],
  family: [
    { text: () => "実家に帰って家族とゆっくり食卓を囲んだ", delta: { joy: 4, bonds: 4 } },
    { text: () => "家族と将来のことで意見がぶつかった", delta: { joy: -4, bonds: -2 } },
    { text: () => "家族にいままで言えなかった気持ちを話せた", delta: { joy: 3, bonds: 5 } },
    { text: () => "家族の体調が気になって、連絡の回数が増えた", delta: { bonds: 3, joy: -1 } },
    { text: () => "家族と昔の話をして笑い合った", delta: { joy: 4, bonds: 3 } },
    { text: () => "忙しさで家族との連絡が途切れがちになった", delta: { bonds: -3, joy: -2 }, when: (p) => p.occ !== null },
  ],
  work: [
    { text: () => "職場の同僚と昼食をともにして、打ち解けた", delta: { bonds: 3, joy: 3 }, when: (p) => p.occ !== null },
    { text: () => "上司の言い方が気になり、一人で悩んだ", delta: { joy: -4, bonds: -1, health: -1 }, when: (p) => p.occ !== null },
    { text: () => "同僚の仕事を手伝ったことで感謝された", delta: { bonds: 4, joy: 3 }, when: (p) => p.occ !== null },
    { text: () => "チームの中で意見がうまく伝わらず、もどかしかった", delta: { joy: -3 }, when: (p) => p.occ !== null },
    { text: () => "職場の人と、仕事のあとに食事に行った", delta: { bonds: 4, joy: 2 }, when: (p) => p.occ !== null },
    { text: () => "苦手な人とも、一言ずつ話をするよう心がけた", delta: { bonds: 2, joy: 1 }, when: (p) => p.occ !== null },
  ],
};

// 悩みに向き合っている年の出来事。なければ null。
export function concernEvent(p: Person, r: Rng, d: CountryData): { text: string; delta: Partial<Stats> } | null {
  const c = p.concern;
  if (!c) return null;
  const list = EVENTS[c.kind].filter((e) => !e.when || e.when(p));
  if (list.length === 0) return null;
  const e = list[Math.floor(r() * list.length)];
  const extra = e.effect ? e.effect(p, r, d) : null;
  return { text: extra ?? e.text(p), delta: e.delta };
}

// 悩みが、解決したか。(12年たつと、気持ちが落ち着き、自然に区切りがつく)
export function concernResolved(p: Person): string | null {
  const c = p.concern;
  if (!c) return null;
  const years = p.age - c.since;
  const bonds = p.stats.bonds;
  // 少なくとも4年は、向き合う(すぐには解決しない)。
  if (years < 4) return null;
  if (c.kind === "romance" && p.partner && (p.partner.status === "married" || (p.partner.status === "dating" && p.age - (p.history.datingSince ?? p.age) >= 2))) return "大切に思える人と、安定した関係を築けるようになった。恋愛への迷いはひと区切りついた";
  if (c.kind === "friends" && bonds >= 78) return "気の置けない友人たちに囲まれて、人との関わりに満たされるようになった";
  if (c.kind === "family" && bonds >= 78) return "家族との距離が縮まり、心から安心できる関係になった";
  if (c.kind === "work" && bonds >= 74) return "職場の人との関係が落ち着き、働きやすくなった";
  if (years >= 12) return "長いあいだ向き合ってきた悩みが、少しずつ気にならなくなった";
  return null;
}

export const CONCERN_LABEL: Record<ConcernKind, string> = { romance: "恋愛", friends: "友人関係", family: "家族との関係", work: "職場の人間関係" };
