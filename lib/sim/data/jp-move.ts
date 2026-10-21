import { bump } from "@/lib/sim/helpers";
import { isE } from "@/lib/sim/mbti";
import type { Person } from "@/lib/sim/types";

// 学生のときの引っ越し・転校の影響。新しい環境で、ストレスがかかる。友だちができやすいかは、性格(MBTI)で変わり、いじめにあう確率も、高くなる(設計上の仮定)。
// 学生か: 働いていない、かつ、学校に通っている年齢(在学中)。
export const isStudent = (p: Person): boolean => p.occ === null && (p.age <= 22 || p.gradAge !== null);

export function moveAftermath(p: Person, r: () => number): string[] {
  const out: string[] = [];
  const extrovert = isE(p.mbti);
  const known = Boolean(p.mbti);
  // 友だちが、すぐにできる確率: 外向きなら高く、内向きなら低い(わからなければ、中間)。つながりの強さも効く。
  const friendP = Math.min(0.9, Math.max(0.15, (known ? (extrovert ? 0.72 : 0.38) : 0.55) + (p.stats.bonds - 50) / 250));
  p.extra.stress = Math.min(100, p.extra.stress + 6);
  bump(p, { joy: -3 });
  out.push("新しい環境になじめるか、不安な日々が続いた");
  if (r() < friendP) {
    bump(p, { bonds: 3, joy: 2 });
    out.push("気さくに話しかけてくれる子がいて、すぐに友だちができた");
  } else {
    bump(p, { bonds: -3, joy: -3 });
    out.push("なかなか輪に入れず、しばらくは、ひとりで過ごすことが多かった");
  }
  // いじめにあう確率: 転校生・新入りは、ふだんより高い。内向きで、つながりが弱いほど、さらに高い。
  const bullyP = Math.min(0.5, 0.1 + (known && !extrovert ? 0.06 : 0) + (p.stats.bonds < 40 ? 0.08 : 0) + (p.extra.stress > 60 ? 0.04 : 0));
  if (r() < bullyP) {
    bump(p, { bonds: -5, joy: -8, health: -2 });
    p.extra.stress = Math.min(100, p.extra.stress + 6);
    p.history.bullied = p.age;
    out.push("転校生だからと、仲間はずれやからかいを受けた");
  }
  return out;
}
