import { compat } from "@/lib/sim/mbti";
import type { Person } from "@/lib/sim/types";

// いま関係のある人との「関係値」(0〜100)。親密なのか、疎遠なのか。
// つながり・相性・同居・出来事(口論・無理な働き方など)から、いまの状態を計算する(設計上の仮定)。
export type Relation = { id: string; role: string; name: string; score: number; label: string; tone: "good" | "mid" | "bad" | "gone"; facts: string[] };

// 人間関係の大きなまとまり。その中に、家族・恋人・友人・職場の人が、ならぶ。
export type RelationGroup = "家族" | "恋人" | "友人" | "職場";
export const GROUP_ORDER: RelationGroup[] = ["家族", "恋人", "友人", "職場"];
export function groupOfRelation(r: Relation): RelationGroup {
  if (r.id === "mother" || r.id === "father" || r.id.startsWith("kid")) return "家族";
  if (r.id === "partner") return r.role === "配偶者" ? "家族" : "恋人";
  if (r.id === "ex") return "恋人";
  if (r.id === "boss") return "職場";
  return "友人";
}

export const relationLabel = (s: number) => (s >= 85 ? "とても親密" : s >= 70 ? "親密" : s >= 55 ? "良好" : s >= 40 ? "ふつう" : s >= 25 ? "疎遠" : s >= 10 ? "不仲" : "断絶");
const toneOf = (s: number): Relation["tone"] => (s >= 55 ? "good" : s >= 25 ? "mid" : "bad");

// 人ごとの相性のようなもの(同じ人なら、ずっと同じ値)。-6〜+6。
const jitter = (key: string) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (((h >>> 0) % 1000) / 1000 - 0.5) * 12;
};
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const recent = (p: Person, k: string, y: number) => p.age - (p.history[k] ?? -99) <= y;

export function relationships(p: Person): Relation[] {
  const out: Relation[] = [];
  const bonds = p.stats.bonds;
  const working = p.occ !== null && p.occ !== "retired";

  // 恋人・配偶者
  const pt = p.partner;
  if (pt && pt.status !== "ex") {
    const name = `${pt.given}さん`;
    const c = pt.mbti && p.mbti ? compat(p.mbti, pt.mbti) : 60;
    const facts: string[] = [];
    let s = 48 + (c - 50) * 0.5 + (bonds - 50) * 0.3 + jitter(pt.family + pt.given);
    if (pt.mbti && p.mbti) facts.push(`相性 ${c}%`);
    if (pt.status === "crush") {
      s = 25 + (c - 50) * 0.3 + (bonds - 50) * 0.2;
      facts.push("まだ、気になっている段階");
    } else {
      const years = pt.status === "dating" ? p.age - (p.history.datingSince ?? p.age) : p.age - pt.since;
      if (years >= 0) facts.push(pt.status === "married" ? `結婚して${years}年` : `付き合って${years}年`);
      s += Math.min(14, years * 1.5);
      if (p.history.cohab !== undefined || pt.status === "married") { s += 6; facts.push("一緒に暮らしている"); }
      if (p.kids > 0 && pt.status === "married") { s += 3; facts.push("子どもがいる"); }
    }
    if (recent(p, "conflict", 2)) { s -= 6; facts.push("最近、いざこざがあった"); }
    if (recent(p, "overtime", 2) && working) { s -= 5; facts.push("仕事の忙しさで、すれちがいがち"); }
    if (p.extra.stress > 70) { s -= 6; facts.push("ストレスで、余裕がない"); }
    if (bonds >= 70) facts.push("つながりが強く、支えあえている");
    if (bonds < 30) facts.push("つながりが弱く、気持ちが離れがち");
    const sc = clamp(s);
    out.push({ id: "partner", role: pt.status === "married" ? "配偶者" : pt.status === "dating" ? "恋人" : "気になる人", name, score: sc, label: pt.status === "crush" ? (sc >= 30 ? "気になる" : "まだ遠い") : relationLabel(sc), tone: toneOf(sc), facts });
  } else if (pt && pt.status === "ex") {
    out.push({ id: "ex", role: "別れた人", name: `${pt.given}さん`, score: 5, label: "疎遠", tone: "gone", facts: ["別れてから、連絡は取っていない"] });
  }

  // 両親
  for (const [who, key] of [["母", "mother"], ["父", "father"]] as const) {
    const dead = p.age >= p.parentDeath[key];
    if (dead) {
      out.push({ id: key, role: who, name: who, score: 0, label: "亡くなった", tone: "gone", facts: [`${p.parentDeath[key]}歳のときに、亡くなった`] });
      continue;
    }
    const facts: string[] = [];
    let s = 55 + (bonds - 50) * 0.4 + jitter(key + p.birthPlace);
    if (p.withParents) { s += 6; facts.push("一緒に暮らしている"); }
    else if (p.region !== p.birthRegion || p.abroad) { s -= 6; facts.push(p.abroad ? "海外で暮らし、なかなか会えない" : "離れて暮らしている"); }
    if (p.age >= p.parentDeath[key] - 2) { s += 4; facts.push("病気で入院している(気にかけている)"); }
    if (p.age < 18) facts.push("親として、守ってもらっている");
    if (working && recent(p, "overtime", 2)) { s -= 4; facts.push("忙しくて、顔を見せられていない"); }
    if (p.age >= 13 && p.age <= 17) { s -= 8; facts.push("反抗期で、ぶつかりやすい"); }
    const sc = clamp(s);
    out.push({ id: key, role: who, name: who, score: sc, label: relationLabel(sc), tone: toneOf(sc), facts });
  }

  // 子ども
  p.kidList.forEach((k, i) => {
    const age = p.age - k.bornAge;
    const facts: string[] = [`${age}歳`];
    let s = 62 + (bonds - 50) * 0.3 + jitter(`kid${i}${k.bornAge}`);
    if (working && recent(p, "overtime", 2)) { s -= 6; facts.push("仕事で、一緒に過ごす時間が少ない"); }
    if (age >= 13 && age <= 17) { s -= 12; facts.push("思春期で、距離ができている"); }
    if (age >= 18 && p.age >= 40) { s -= 4; facts.push("独り立ちして、別々に暮らす"); }
    if (age < 6) { s += 6; facts.push("手がかかるぶん、そばにいる時間が長い"); }
    if (p.extra.stress > 70) { s -= 5; facts.push("ストレスで、ゆとりがない"); }
    const sc = clamp(s);
    out.push({ id: `kid${i}`, role: k.sex === "boy" ? "息子" : k.sex === "girl" ? "娘" : "子ども", name: k.name || `${i + 1}人め`, score: sc, label: relationLabel(sc), tone: toneOf(sc), facts });
  });

  // 友人・職場の上司
  const fr = p.npc?.friend;
  if (p.age >= 10) {
    const c = fr && p.mbti ? compat(p.mbti, fr) : 60;
    const sc = clamp(45 + (bonds - 50) * 0.5 + (c - 50) * 0.3 + jitter("friend" + p.birthPlace));
    out.push({ id: "friend", role: "親友", name: "いちばん仲のよい友人", score: sc, label: relationLabel(sc), tone: toneOf(sc), facts: [fr && p.mbti ? `相性 ${c}%` : "", bonds < 35 ? "忙しく、会う機会が減っている" : bonds >= 65 ? "よく会い、何でも話せる" : ""].filter(Boolean) });
  }
  const bs = p.npc?.boss;
  if (working && p.employment !== "self") {
    const c = bs && p.mbti ? compat(p.mbti, bs) : 55;
    let s = 50 + (c - 50) * 0.5 + jitter("boss" + p.job) - (recent(p, "conflict", 2) ? 8 : 0);
    const facts = [bs && p.mbti ? `相性 ${c}%` : "", recent(p, "conflict", 2) ? "最近、衝突があった" : ""].filter(Boolean);
    if (recent(p, "overtime", 2)) { s -= 4; facts.push("無理な働き方を強いられている"); }
    const sc = clamp(s);
    out.push({ id: "boss", role: "上司", name: "いまの職場の上司", score: sc, label: relationLabel(sc), tone: toneOf(sc), facts });
  }
  return out;
}
