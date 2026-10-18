import type { Rng } from "@/lib/sim/rng";
import type { ActTag } from "@/lib/sim/types";

// MBTI(16タイプ)の、ゲーム内での扱い。
// 注意: 「相性がよいとされるタイプ」は、MBTIの解説書やサイトで広く紹介されている組み合わせ(俗説・目安)で、
// 恋愛や人間関係の成否を科学的に予測するものではありません。ゲーム内の仮定として使っています。

export const MBTI_TYPES = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"] as const;

export const MBTI_NAME: Record<string, string> = {
  INTJ: "建築家", INTP: "論理学者", ENTJ: "指揮官", ENTP: "討論者",
  INFJ: "提唱者", INFP: "仲介者", ENFJ: "主人公", ENFP: "運動家",
  ISTJ: "管理者", ISFJ: "擁護者", ESTJ: "幹部", ESFJ: "領事",
  ISTP: "巨匠", ISFP: "冒険家", ESTP: "起業家", ESFP: "エンターテイナー",
};

// 相性がよいとされる2タイプ(広く紹介されている組み合わせ)。
export const IDEAL: Record<string, [string, string]> = {
  INTJ: ["ENFP", "ENTP"], INTP: ["ENTJ", "ESTJ"], ENTJ: ["INFP", "INTP"], ENTP: ["INFJ", "INTJ"],
  INFJ: ["ENFP", "ENTP"], INFP: ["ENFJ", "ENTJ"], ENFJ: ["INFP", "ISFP"], ENFP: ["INFJ", "INTJ"],
  ISTJ: ["ESFP", "ESTP"], ISFJ: ["ESFP", "ESTP"], ESTJ: ["ISTP", "INTP"], ESFJ: ["ISFP", "ISTP"],
  ISTP: ["ESFJ", "ESTJ"], ISFP: ["ENFJ", "ESFJ"], ESTP: ["ISFJ", "ISTJ"], ESFP: ["ISFJ", "ISTJ"],
};

export const isE = (m: string | null | undefined) => Boolean(m?.startsWith("E"));
export const isN = (m: string | null | undefined) => m?.[1] === "N";
export const isT = (m: string | null | undefined) => m?.[2] === "T";
export const isJ = (m: string | null | undefined) => m?.[3] === "J";

// 呼び名と、英字4文字を並べて書く(例: 仲介者(INFP))。
export const typeLabel = (m: string) => (MBTI_NAME[m] ? `${MBTI_NAME[m]}(${m})` : m);
// 「仲介者タイプ」のように、呼び名で言う。
export const typeCall = (m: string | null | undefined) => (m && MBTI_NAME[m] ? `${typeLabel(m)}タイプ` : "");

// 2つのタイプの相性の目安(0〜100)。相性がよいとされる組み合わせは高く、同じタイプはほどほど、そのほかは文字の共通点で決める。
export function compat(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 50;
  if (IDEAL[a]?.includes(b) || IDEAL[b]?.includes(a)) return 90;
  if (a === b) return 62;
  let s = 42;
  if (a[1] === b[1]) s += 10; // 物の見方(S/N)が近い
  if (a[3] === b[3]) s += 6; // 暮らし方(J/P)が近い
  if (a[0] !== b[0]) s += 8; // 内向と外向は、補い合う
  if (a[2] !== b[2]) s += 3;
  return Math.max(25, Math.min(85, s));
}

export const compatMark = (score: number) => (score >= 80 ? "◎" : score >= 62 ? "○" : score >= 48 ? "△" : "×");

// 恋人になる相手のタイプの重み。相性がよいとされるタイプが、出会いやすい。
const weightOf = (mine: string, t: string) => 1 + 6 * Math.max(0, (compat(mine, t) - 50) / 40);

// 相性がよいとされる2タイプの人が、恋人として現れる確率(0〜1)。
export function idealChance(mine: string | null | undefined): number {
  if (!mine || !IDEAL[mine]) return 0;
  const total = MBTI_TYPES.reduce((s, t) => s + weightOf(mine, t), 0);
  return IDEAL[mine].reduce((s, t) => s + weightOf(mine, t), 0) / total;
}

export function pickPartnerMbti(rng: Rng, mine: string | null | undefined): string {
  if (!mine) return MBTI_TYPES[Math.floor(rng() * 16)];
  const total = MBTI_TYPES.reduce((s, t) => s + weightOf(mine, t), 0);
  let r = rng() * total;
  for (const t of MBTI_TYPES) {
    r -= weightOf(mine, t);
    if (r < 0) return t;
  }
  return MBTI_TYPES[0];
}

// 周りの人(友人・上司・義理の家族)のタイプは、だれとも同じ確率で決まる。
export const randomMbti = (rng: Rng) => MBTI_TYPES[Math.floor(rng() * 16)];

// 活動の性質と、タイプの向き不向き。+なら向いている、-なら苦手。
export function fitScore(mbti: string | null | undefined, tags: ActTag[] | undefined): number {
  if (!mbti || !tags?.length) return 0;
  const likes: ActTag[] = [];
  const dislikes: ActTag[] = [];
  if (mbti[0] === "E") { likes.push("social", "stage"); dislikes.push("solo"); } else { likes.push("solo"); dislikes.push("stage"); }
  if (mbti[1] === "N") { likes.push("creative", "logic"); dislikes.push("steady"); } else { likes.push("outdoor", "craft", "steady"); dislikes.push("creative"); }
  if (mbti[2] === "F") { likes.push("service", "creative"); dislikes.push("logic"); } else { likes.push("logic"); }
  if (mbti[3] === "J") likes.push("steady"); else likes.push("outdoor");
  let s = 0;
  for (const t of tags) s += (likes.includes(t) ? 1 : 0) - (dislikes.includes(t) ? 1 : 0);
  return Math.max(-2, Math.min(3, s));
}
// 効果にかける倍率(向いていれば大きく、苦手なら小さく)。
export const fitMult = (score: number) => Math.max(0.55, Math.min(1.6, 1 + 0.2 * score));
