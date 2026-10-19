import type { CareKind, Person } from "@/lib/sim/types";

// 子どもの預け先(0〜5歳)。仕事のあいだ、誰が見るか。毎年の費用と、くらしへの影響が、預け先で変わる。
// 数字は、公表された統計の転記ではなく、設計上の目安(認可保育園は0〜2歳で月2〜3万円ほど、3〜5歳は無償化で給食費などのみ、など)。
export const CARE_LABEL: Record<CareKind, string> = {
  daycare: "認可保育園",
  kodomoen: "認定こども園",
  kindergarten: "幼稚園(預かり保育あり)",
  grandparents: "親(祖父母)に預ける",
  sitter: "ベビーシッター・認可外保育",
  home_self: "自分が仕事を減らして家で育てる",
  home_partner: "パートナーが家で育てる",
};

// 認可保育園に入れない(待機)確率。都市部ほど高い(設計上の目安)。
export const WAITLIST: Record<string, number> = { tokyo: 0.22, metro: 0.12, local: 0.05 };

// パートナーが働いているか(名前と年齢から、ふつうの確率で決まる。共働きは、約7割という設計上の目安)。
export function partnerWorks(p: Person): boolean {
  const pt = p.partner;
  if (!pt || pt.status === "ex") return false;
  const h = [...pt.given].reduce((a, c) => a + c.charCodeAt(0), 0) + p.age * 7;
  return h % 100 < 72;
}

// 親(自分の両親)のどちらかが、まだ元気か。
export const parentsAround = (p: Person) => p.age < p.parentDeath.mother || p.age < p.parentDeath.father;

// 毎年の、預け先の費用(万円)と、くらしへの影響。kidAge は、いちばん下の子の年齢。income は、自分の年収の目安(万円)。
export type CareYear = { costMan: number; bump: Partial<Record<"bonds" | "joy" | "health" | "money", number>>; stress: number; career: number; text?: string };
export function careYear(p: Person, kind: CareKind, kidAge: number, income: number, r: () => number): CareYear {
  const small = kidAge < 3;
  const both = p.occ !== null && p.occ !== "retired" && partnerWorks(p);
  switch (kind) {
    case "daycare":
      return { costMan: small ? 30 : 8, bump: {}, stress: 1, career: 0 };
    case "kodomoen":
      return { costMan: small ? 30 : 12, bump: {}, stress: 1, career: 0 };
    case "kindergarten":
      // 幼稚園は、昼すぎに帰る。ふたりとも働いていると、預かり保育や送迎のやりくりが大変になる。
      return both
        ? { costMan: 18, bump: {}, stress: 3, career: 0.5, text: "幼稚園の送り迎えと、預かり保育のやりくりで、仕事の時間を調整する日が続いた" }
        : { costMan: 15, bump: { joy: 1 }, stress: 0, career: 0 };
    case "grandparents": {
      const clash = r() < 0.15;
      return clash
        ? { costMan: 0, bump: { bonds: -3 }, stress: 4, career: 0, text: "子育てのやり方で親とぶつかり、頼りづらくなった" }
        : { costMan: 0, bump: { bonds: 2 }, stress: 2, career: 0 };
    }
    case "sitter":
      return { costMan: small ? 120 : 90, bump: {}, stress: -2, career: 0 };
    case "home_self":
      // 仕事を減らして家で育てる間は、収入が大きく減る(自分の年収の4割ほど)。
      return { costMan: Math.round(income * 0.4), bump: { joy: 1 }, stress: 2, career: -2 };
    case "home_partner":
      // パートナーが家にいる間は、世帯の収入が減る。自分は、仕事に集中できる。
      return { costMan: Math.round(income * 0.35), bump: { bonds: 2 }, stress: -1, career: 1 };
  }
}
