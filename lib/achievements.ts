import type { GameState } from "@/lib/sim/types";
import { resolvePlace } from "@/lib/geo/japan";

// 実績(Steamのような、「達成したこと」の記念)。
// 条件は、一つの人生の記録(GameState)から、ことばの手がかりと数字だけで、判定する。
// 新しい実績を足すときは、下の ACHIEVEMENTS に、1つ書き足すだけでよい。

export type Rarity = "common" | "rare" | "legend";

export type Achievement = {
  id: string;
  name: string;
  desc: string;
  // 画面に出す、ひとこと(漢字1字)のしるし
  mark: string;
  rarity: Rarity;
  // 実績に添える、豆知識(実際の統計の数字)と、その出典(小さな文字で出す)
  // true の実績は、達成するまで、名前と条件を、コレクションで伏せる(1つだけにしている)
  secret?: boolean;
  trivia?: string;
  source?: string;
  check: (s: GameState) => boolean;
};

const SRC_CENT = "出典: 厚生労働省「百歳以上高齢者の調査結果」(令和7年9月15日現在、2025年9月公表)";
const SRC_LIFE = "出典: 厚生労働省「令和7(2025)年簡易生命表の概況」(2026年7月公表)";
const SRC_NTA = "出典: 国税庁「令和6年分 民間給与実態統計調査」(令和7年9月公表)";
const SRC_GWR = "出典: ギネス世界記録(民間の認定。公的機関の統計ではありません)";

const ageNow = (s: GameState) => s.deathAge ?? s.person.age;
const series = (s: GameState) => s.series ?? [];
const maxOf = (s: GameState, f: (p: NonNullable<GameState["series"]>[number]) => number | undefined) => series(s).reduce((m, p) => Math.max(m, f(p) ?? -Infinity), -Infinity);
const events = (s: GameState) => s.events.map((e) => e.event);
const hasEvent = (s: GameState, re: RegExp) => events(s).some((t) => re.test(t));
// 暮らした場所(引っ越しの軌跡。いまの場所もふくむ)
const homes = (s: GameState) => {
  const list = [...(s.person.homes ?? []).map((h) => h.place), s.person.city];
  return [...new Set(list)];
};
const maxInc = (s: GameState) => maxOf(s, (p) => p.inc);
const maxNet = (s: GameState) => maxOf(s, (p) => p.net);
const job = (s: GameState, ...ids: string[]) => ids.includes(s.person.job ?? "") || ids.includes(s.snap?.job ?? "");
const years = (s: GameState, pred: (p: NonNullable<GameState["series"]>[number]) => boolean) => series(s).filter(pred).length;

export const ACHIEVEMENTS: Achievement[] = [
  // ---- 長寿 ----
  { id: "age100", name: "百寿者", desc: "100歳まで生きた。", mark: "寿", rarity: "rare", trivia: "2025年9月時点で、日本の百歳以上は99,763人。調査が始まった1963年は153人だった。その約88%(87,784人)が、女性。", source: SRC_CENT, check: (s) => ageNow(s) >= 100 },
  { id: "age105", name: "105歳の壁を越えた", desc: "105歳まで生きた。", mark: "寿", rarity: "rare", trivia: "日本人の平均寿命は、男性81.35歳・女性87.33歳(2025年)。105歳は、平均より、20年前後も長く生きたことになる。", source: SRC_LIFE, check: (s) => ageNow(s) >= 105 },
  { id: "age110", name: "超百寿者", desc: "110歳まで生きた。", mark: "超", rarity: "rare", trivia: "国内の百歳以上は約10万人いるが、110歳をこえる人は、そのごく一部。2025年9月時点の、国内の女性の最高齢は114歳だった。", source: SRC_CENT, check: (s) => ageNow(s) >= 110 },
  { id: "age115", name: "歴史に残る長寿", desc: "115歳まで生きた。", mark: "史", rarity: "legend", trivia: "2025年9月時点で、国内の最高齢(女性)は114歳。115歳は、それを上回る年齢。", source: SRC_CENT, check: (s) => ageNow(s) >= 115 },
  { id: "age120", name: "人類の最長老に並ぶ", desc: "120歳まで生きた。", mark: "極", rarity: "legend", trivia: "確認されている世界最高齢の記録は、122歳(1997年没)。120歳をこえた人は、記録のうえでも、ほぼ、いない。", source: SRC_GWR, check: (s) => ageNow(s) >= 120 },
  { id: "age123", name: "最大寿命", desc: "このゲームの最大寿命、123歳まで生き抜いた。", mark: "限", rarity: "legend", secret: true, trivia: "確認されている世界最高齢の記録は、122歳。このゲームの上限の123歳は、それを1歳こえる、設計上の上限です。", source: SRC_GWR, check: (s) => ageNow(s) >= 123 },

  // ---- 暮らし・引っ越し ----
  { id: "move5", name: "引っ越し上手", desc: "暮らす場所を、5回以上変えた。", mark: "移", rarity: "common", check: (s) => homes(s).length >= 6 },
  { id: "move10", name: "根なし草", desc: "暮らす場所を、10回以上変えた。", mark: "旅", rarity: "rare", check: (s) => homes(s).length >= 11 },
  {
    id: "abroad",
    name: "海の向こうで暮らした",
    desc: "海外で暮らした。",
    mark: "海",
    rarity: "common",
    check: (s) => !!s.person.abroad || homes(s).some((h) => resolvePlace(h).kind === "abroad"),
  },
  {
    id: "northsouth",
    name: "北から南まで",
    desc: "北海道と、九州・沖縄の両方で、暮らした。",
    mark: "縦",
    rarity: "rare",
    check: (s) => {
      const pts = homes(s).map((h) => resolvePlace(h)).filter((p) => p.kind === "japan");
      return pts.some((p) => p.kind === "japan" && p.ll[1] > 41.5) && pts.some((p) => p.kind === "japan" && p.ll[1] < 33.6);
    },
  },

  // ---- 家族 ----
  { id: "kids3", name: "にぎやかな食卓", desc: "子どもが3人以上になった。", mark: "家", rarity: "common", check: (s) => s.person.kids >= 3 },
  { id: "kids5", name: "大家族", desc: "子どもが5人以上になった。", mark: "族", rarity: "rare", check: (s) => s.person.kids >= 5 },
  { id: "kids7", name: "子だくさん", desc: "子どもが7人以上になった。", mark: "宝", rarity: "legend", check: (s) => s.person.kids >= 7 },
  { id: "golden", name: "金婚式", desc: "結婚して、50年を、ともに過ごした。", mark: "金", rarity: "rare", check: (s) => years(s, (p) => !!p.mar) >= 50 },

  // ---- 資産 ----
  { id: "money1k", name: "資産1,000万円", desc: "資産が、1,000万円を超えた。", mark: "蓄", rarity: "common", check: (s) => maxNet(s) >= 1000 },
  { id: "money5k", name: "資産5,000万円", desc: "資産が、5,000万円を超えた。", mark: "貯", rarity: "common", check: (s) => maxNet(s) >= 5000 },
  { id: "money1o", name: "億り人", desc: "資産が、1億円を超えた。", mark: "億", rarity: "rare", check: (s) => maxNet(s) >= 10000 },
  { id: "money5o", name: "資産5億円", desc: "資産が、5億円を超えた。", mark: "財", rarity: "legend", check: (s) => maxNet(s) >= 50000 },
  { id: "money10o", name: "大富豪", desc: "資産が、10億円を超えた。", mark: "富", rarity: "legend", check: (s) => maxNet(s) >= 100000 },
  { id: "money100o", name: "桁ちがいの資産家", desc: "資産が、100億円を超えた。", mark: "覇", rarity: "legend", check: (s) => maxNet(s) >= 1000000 },
  { id: "lottery", name: "宝くじ当せん", desc: "宝くじで、まとまったお金が当たった。", mark: "当", rarity: "rare", check: (s) => hasEvent(s, /宝くじで、[\d,]+万円が当たった/) },
  { id: "debtfree", name: "借金を返しきった", desc: "借金を、すべて返した。", mark: "返", rarity: "common", check: (s) => s.person.history.debtCleared !== undefined },
  { id: "backfromzero", name: "どん底からの再起", desc: "住まいを失ったあと、もう一度、暮らしを立て直した。", mark: "立", rarity: "rare", check: (s) => s.person.history.homelessEnd !== undefined },
  { id: "bankrupt", name: "転んでも、また", desc: "自己破産を経験した。", mark: "破", rarity: "common", check: (s) => s.person.bankrupt !== null && s.person.bankrupt !== undefined },
  { id: "selfmade", name: "成り上がり", desc: "家計が苦しい家に生まれて、資産が1億円を超えた。", mark: "昇", rarity: "legend", check: (s) => s.person.background === "tight" && maxNet(s) >= 10000 },

  // ---- 年収 ----
  { id: "inc500", name: "年収500万円", desc: "年収が、500万円に届いた。", mark: "収", rarity: "common", trivia: "民間企業で働く人の平均給与は、年に478万円(2024年分)。", source: SRC_NTA, check: (s) => maxInc(s) >= 500 },
  { id: "inc1000", name: "年収1,000万円", desc: "年収が、1,000万円に届いた。", mark: "千", rarity: "rare", trivia: "民間企業で働く人の平均給与は、年に478万円(2024年分)。その2倍をこえる水準。", source: SRC_NTA, check: (s) => maxInc(s) >= 1000 },
  { id: "inc2000", name: "年収2,000万円", desc: "年収が、2,000万円に届いた。", mark: "弐", rarity: "rare", trivia: "民間企業で働く人の平均給与(478万円・2024年分)の、4倍ほど。", source: SRC_NTA, check: (s) => maxInc(s) >= 2000 },
  { id: "inc5000", name: "年収5,000万円", desc: "年収が、5,000万円に届いた。", mark: "参", rarity: "legend", trivia: "民間企業で働く人の平均給与(478万円・2024年分)の、10倍をこえる。", source: SRC_NTA, check: (s) => maxInc(s) >= 5000 },
  { id: "inc10000", name: "年収1億円", desc: "年収が、1億円に届いた。", mark: "頂", rarity: "legend", check: (s) => maxInc(s) >= 10000 },

  // ---- 心と体 ----
  { id: "joy95", name: "幸福の絶頂", desc: "幸福度が、95を超えた年があった。", mark: "福", rarity: "rare", check: (s) => maxOf(s, (p) => p.joy) >= 95 },
  { id: "healthy80", name: "元気な80代", desc: "80歳を過ぎても、健康が80以上だった。", mark: "健", rarity: "rare", check: (s) => series(s).some((p) => p.age >= 80 && p.health >= 80) },

  // ---- 仕事・夢 ----
  { id: "pm", name: "総理大臣", desc: "日本の総理大臣になった。", mark: "首", rarity: "legend", check: (s) => s.person.history.pm !== undefined },
  { id: "summit", name: "頂点に立った", desc: "それぞれの世界の、頂点に立った。", mark: "頂", rarity: "legend", check: (s) => s.person.history.summit !== undefined },

  // ---- 学び ----
  { id: "grad", name: "大学院を修了", desc: "大学院を出た。", mark: "院", rarity: "common", check: (s) => s.person.edu === "grad" },
  { id: "learn100", name: "学びの達人", desc: "「学び」の能力値が、100に達した。", mark: "学", rarity: "rare", check: (s) => maxOf(s, (p) => p.learn) >= 100 },

  // ---- 夢の職業(なかなか就けない仕事) ----
  { id: "job_doctor", name: "医師になった", desc: "医師として、働いた。", mark: "医", rarity: "rare", check: (s) => job(s, "doctor") },
  { id: "job_lawyer", name: "弁護士になった", desc: "弁護士・司法書士・弁理士として、働いた。", mark: "法", rarity: "rare", check: (s) => job(s, "lawyer", "judge") },
  { id: "job_pilot", name: "空を飛ぶ仕事", desc: "パイロットとして、働いた。", mark: "空", rarity: "rare", check: (s) => job(s, "pilot") },
  { id: "job_astronaut", name: "宇宙飛行士", desc: "宇宙飛行士になった。日本の宇宙飛行士は、選抜の倍率が、きわめて高い。", mark: "宇", rarity: "legend", check: (s) => job(s, "astronaut") },
  { id: "job_shogi", name: "プロ棋士", desc: "将棋・囲碁のプロになった。", mark: "棋", rarity: "legend", check: (s) => job(s, "shogi") },
  { id: "job_pro", name: "プロスポーツ選手", desc: "プロのスポーツ選手として、働いた。", mark: "技", rarity: "rare", check: (s) => job(s, "athlete", "esports") },
  { id: "job_star", name: "スポットライトの下で", desc: "俳優・声優・アイドル・歌手など、表舞台の仕事に就いた。", mark: "星", rarity: "rare", check: (s) => job(s, "actor", "voice_actor", "idol", "singer", "comedian", "model", "entertainer") },
  { id: "job_creator", name: "作品を世に出した", desc: "漫画家・小説家・作曲家・映画監督などとして、働いた。", mark: "創", rarity: "rare", check: (s) => job(s, "manga", "novelist", "composer", "film_director", "game_creator") },
  { id: "job_founder", name: "起業家", desc: "自分で会社を起こした。", mark: "創", rarity: "common", check: (s) => job(s, "founder", "ceo") },
  { id: "job_professor", name: "大学の教授", desc: "大学や高専の教授になった。", mark: "授", rarity: "rare", check: (s) => job(s, "prof") },
  { id: "job_politician", name: "国政の場へ", desc: "政治家(議員)になった。", mark: "政", rarity: "rare", check: (s) => job(s, "politician") || !!s.person.office },
  { id: "job_diplomat", name: "外交官", desc: "外交官や、国の官僚になった。", mark: "官", rarity: "rare", check: (s) => job(s, "diplomat", "bureaucrat") },
];

// 一つの人生で、達成した実績の id。
export function evaluate(state: GameState): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    try {
      if (a.check(state)) out.push(a.id);
    } catch {
      // 条件の判定に失敗しても、ほかの実績には、影響させない
    }
  }
  return out;
}

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

// 実績の、まとまり(コレクション画面で、見出しにする)
export const GROUPS = ["長寿", "資産", "年収", "家族", "暮らし", "心と体", "学び", "仕事・夢"] as const;
export type Group = (typeof GROUPS)[number];
export function groupOf(id: string): Group {
  if (id.startsWith("age")) return "長寿";
  if (id.startsWith("money") || ["lottery", "debtfree", "backfromzero", "bankrupt", "selfmade"].includes(id)) return "資産";
  if (id.startsWith("inc")) return "年収";
  if (id.startsWith("kids") || id === "golden") return "家族";
  if (id.startsWith("move") || ["abroad", "northsouth"].includes(id)) return "暮らし";
  if (["joy95", "healthy80"].includes(id)) return "心と体";
  if (["grad", "learn100"].includes(id)) return "学び";
  return "仕事・夢";
}
