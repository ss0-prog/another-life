import { SINCE, yearOf } from "@/lib/sim/era";
import type { Person } from "@/lib/sim/types";

// 「活動する」の出会いの場。出かけると、その場での選択が出て、友人・恋人・ペット・仕事のチャンスなどにつながる。
// 費用や、出会える確率は、設計上の仮定。
export type MeetDef = { id: string; label: string; note: string; costMan: number; question: string; did: string; show: (p: Person) => boolean };

const single = (p: Person) => !p.married && p.partner?.status !== "dating";

export const MEETINGS: MeetDef[] = [
  { id: "party", label: "飲み会・交流会に出る", note: "人脈が広がり、友人・恋人・仕事のチャンスにつながることも。お酒を飲みすぎることもある。", costMan: 1, question: "meet_party", did: "飲み会・交流会に、顔を出した", show: (p) => p.age >= 20 && p.age <= 75 },
  { id: "study", label: "勉強会・セミナーに参加する", note: "学びが深まり、同じ志の人と出会える。仕事のチャンスにつながることも。", costMan: 0.5, question: "meet_study", did: "勉強会・セミナーに、参加した", show: (p) => p.age >= 16 && p.age <= 75 },
  { id: "circle", label: "趣味・スポーツのサークルに顔を出す", note: "気の合う仲間や、恋人と出会えることも。", costMan: 0.3, question: "meet_circle", did: "サークルに、顔を出した", show: (p) => p.age >= 15 && p.age <= 80 },
  { id: "app", label: "マッチングアプリを使ってみる", note: "恋人探し。いい出会いもあれば、がっかりすることも、だまされることも。", costMan: 0.3, question: "meet_app", did: "マッチングアプリで、会う約束をした", show: (p) => p.age >= 18 && p.age <= 55 && single(p) && yearOf(p) >= SINCE.matching },
  { id: "pet", label: "保護犬・保護猫の譲渡会に行く", note: "ペットを家族に迎えられる。ボランティアの仲間にも出会える。", costMan: 0, question: "meet_pet", did: "保護犬・保護猫の譲渡会に、足を運んだ", show: (p) => p.age >= 20 && p.age <= 78 },
  { id: "local", label: "地域のイベント・ボランティアに参加する", note: "近所の人や同じ思いの人と、つながれる。", costMan: 0, question: "meet_local", did: "地域のイベントに、参加した", show: (p) => p.age >= 15 && p.age <= 85 },
];

export const meetById = (id: string) => MEETINGS.find((m) => m.id === id);
// 出会いの場に出かけられるのは、1年に3回まで。
export const MEET_LIMIT = 3;
