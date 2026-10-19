import { lessonById } from "@/lib/sim/data/jp-lessons";
import type { Person } from "@/lib/sim/types";

// 頭の良さは、生まれもった素質のまま変わらないのではなく、幼いころから、学びや芸術にふれるほど、伸びやすい(設計上の仮定)。
// 毎年、上がる確率は、年齢で決まる土台の確率に、続けている習い事の分が、足される。
// 習い事は、はじめた年齢が早いほど、効き目が大きい(3歳からなら1.5倍、10歳で約1倍、18歳をこえると4分の1ほど)。

// 年齢で決まる、土台の確率。幼いほど高く、大人になるとほとんどなくなる。
const baseChance = (a: number) => (a < 3 ? 0 : a <= 12 ? 0.1 : a <= 18 ? 0.06 : a <= 25 ? 0.03 : a <= 40 ? 0.008 : 0);
// はじめた年齢が早いほど、効き目が大きい。
export const startFactor = (since: number) => Math.min(1.5, Math.max(0.25, 1.5 - 0.075 * (since - 3)));
// 習い事ごとの、上がりやすさへの寄与(1年あたり)。塾がもっとも大きく、音楽・芸術がそれに続く。
function lessonWeight(id: string): number {
  if (id === "cram") return 0.16;
  const def = lessonById(id);
  if (!def) return 0;
  if (def.group === "音楽・芸術") return 0.1;
  if (id === "english" || id === "abacus" || id === "programming" || id === "reading") return 0.05;
  return 0;
}
// 大人になってからは、習い事の効き目も、小さくなる。
const ageFade = (a: number) => (a <= 25 ? 1 : a <= 40 ? 0.4 : 0.15);

// この年に、頭の良さが1つ上がる確率。
export function intelChance(p: Person, a: number): number {
  const bonus = p.lessons.reduce((sum, l) => sum + lessonWeight(l.id) * startFactor(l.since), 0);
  const c = baseChance(a) + Math.min(0.35, bonus) * ageFade(a);
  return Math.min(0.6, c);
}
