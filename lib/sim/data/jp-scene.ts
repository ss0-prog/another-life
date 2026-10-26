import { eraSentence, yearOf } from "@/lib/sim/era";
import { pick, type Rng } from "@/lib/sim/rng";
import type { CountryData, Housing, Money, Occ, Person, Region } from "@/lib/sim/types";

export function housingOf(p: Person): Housing {
  if (p.owned) return p.region === "tokyo" || p.region === "metro" ? "owned_flat" : "owned_house";
  if (p.withParents) return "parents";
  return p.married || p.kids > 0 ? "rent_family" : "rent_single";
}

const HOME: Record<Housing, Record<Region, string[]>> = {
  parents: {
    tokyo: ["実家の自分の部屋。壁紙だけ、いつのまにか張り替えられている。"],
    metro: ["実家の二階にある、子どものころから使っている部屋。"],
    local: ["実家の自分の部屋。本棚には、昔の教科書が残っている。"],
    rural: ["広い実家の奥の部屋。畳のにおいが、ずっと変わらない。"],
  },
  rent_single: {
    tokyo: ["六畳ほどのワンルーム。ベッドと机のあいだを、体をひねって歩く。", "駅から歩いて十分の1K。ベランダの向こうに、隣のビルの壁がある。"],
    metro: ["ひとり暮らしの1K。東京より、少しだけ部屋に余白がある。"],
    local: ["車がないと動けない町の、広めの1DK。", "古い木造アパートの一階。窓の外で、庭の草が伸びている。"],
    rural: ["町はずれの小さな借家。冬には、隙間風が静かに入ってくる。"],
  },
  rent_family: {
    tokyo: ["2LDKの賃貸。リビングの隅に、洗濯物が干してある。"],
    metro: ["家賃と相談して決めた2LDK。収納がいつも足りない。"],
    local: ["駐車場つきの3DKの賃貸。部屋数の割に、家賃は穏やかだ。"],
    rural: ["広めの借家。庭に、使わなくなった物干し台が立っている。"],
  },
  owned_flat: {
    tokyo: ["ローンを組んで買ったマンションの一室。部屋は広くないが、鍵は自分のものだ。"],
    metro: ["ローンの残る、築年数のたったマンション。ベランダに小さな鉢植えが並ぶ。"],
    local: [],
    rural: [],
  },
  owned_house: {
    tokyo: [],
    metro: [],
    local: ["ローンの残る一軒家。玄関の脇に、自転車が並んでいる。"],
    rural: ["庭つきの一軒家。物置に、いつから置いたか分からない農具がある。"],
  },
};

const WINDOW: Record<Region, string[]> = {
  tokyo: ["窓の外には、ビルの明かりが途切れず並んでいる。遠くで電車の音がしている。"],
  metro: ["窓の向こうに、暮れかけた街の屋根が重なっている。"],
  local: ["窓の外は、車のライトがときどき通るだけの静かな通りだ。"],
  rural: ["窓の外は、田んぼと遠い山の影。虫の声がしている。"],
};

const HANDS: Record<Occ | "retired" | "student", string[]> = {
  mgmt: ["ネクタイをゆるめても、頭の中の会議は終わらない。", "部下の顔を思い浮かべながら、明日の段取りを考える。"],
  tech: ["机の上には、資料とノートPCと冷めかけたコーヒー。", "仕事で使う専門書に、付箋がいくつも挟まっている。"],
  office: ["鞄の中に、明日の会議の資料が少し折れて入っている。", "デスクワークで凝った肩を、ゆっくり回す。"],
  sales: ["靴の底が、今日歩いた距離のぶんだけ減っている。", "スマートフォンに、取引先からの返信が溜まっている。"],
  service: ["靴を脱ぐと、立ちっぱなしだった足がじんわり熱い。", "エプロンのポケットに、レシートが数枚入ったままだ。"],
  security: ["制服の肩に、夜の空気の冷たさが残っている。", "巡回の足音が、まだ耳の奥に残っている。"],
  agri: ["長靴の泥が、玄関で乾きかけている。", "手のひらのたこが、季節ごとに少しずつ形を変える。"],
  production: ["作業着の袖から、機械油のにおいがした。", "肩の奥に、一日ぶんの重さが残っている。"],
  transport: ["ハンドルを握っていた手が、まだ少しこわばっている。", "地図にない近道を、頭の中でなぞってみる。"],
  construction: ["日に焼けた腕に、今日の現場の砂ぼこりがついている。", "ヘルメットの内側に、汗のにおいが染みている。"],
  logistics: ["腰の奥に、一日で運んだ荷物の重みが残っている。", "リュックの底に、配達の伝票が丸まって入っている。"],
  retired: ["縁側に、読みかけの新聞が置いてある。", "一日の予定が少ないことにも、もう慣れた。"],
  student: ["机の上に、読みかけの教科書とノートが開いてある。", "課題の締め切りを、付箋に書いて貼ってある。"],
};

const MONEY: Record<Money, string[]> = {
  tight: ["財布の中身を、無意識に頭の中で確かめている。"],
  modest: ["贅沢はできないが、明日の心配をするほどでもない。"],
  comfortable: ["週末に少し遠出するくらいの余裕は、ちゃんとある。"],
  ample: ["欲しいものを、少しだけ迷ってから買える暮らしだ。"],
};

const OBJECTS = [
  "棚の上に、古い写真立てがひとつ。",
  "壁のカレンダーに、予定が細かく書き込まれている。",
  "窓辺に、いつ買ったか忘れた観葉植物が置いてある。",
  "玄関に、くたびれた靴が揃えて置いてある。",
  "テーブルの端に、封を切っていない郵便物が重なっている。",
];

const CONDITION: Record<string, string> = {
  heart: "定期検診の予約票が、冷蔵庫に貼ってある。",
  diabetes: "血糖値を測る小さな機械が、テーブルの上にある。",
  asthma: "吸入器が、いつもの場所に置いてある。",
  sensory: "身のまわりの小さな工夫が、暮らしのあちこちに根づいている。",
  other: "毎日の薬を、決まった時間に飲んでいる。",
};

const DETAIL = [
  "どこかの部屋から、夕食のにおいが流れてくる。",
  "蛍光灯が、ときどき小さくまたたく。",
  "スマートフォンの画面が、ひとつ光って消えた。",
  "湯を沸かす音が、一日の終わりを知らせている。",
];

const CLOSING = [
  "どんな日にも、あかりはひとつずつ灯っている。",
  "ふつうの一日が、ここでも静かに終わろうとしている。",
  "この部屋の一日も、やがて静かに暮れていく。",
];

function householdLine(p: Person, rng: Rng): string {
  if (p.withParents) return pick(rng, ["階下から、母が台所で動く音がする。", "廊下の向こうで、テレビの音が小さく流れている。"]);
  if (p.kids > 0 && p.age >= 55) return pick(rng, ["離れて暮らす子どもから、短いメッセージが届いている。", "棚の上に、子どもたちが幼いころの写真が並んでいる。"]);
  if (p.kids >= 2) return "子どもたちの足音が、廊下を行ったり来たりしている。";
  if (p.kids === 1) return "子どもが宿題の手を止めて、こちらを振り返る。";
  if (p.married) return pick(rng, ["隣の部屋から、パートナーの笑い声が聞こえる。", "台所では、パートナーが鍋の火加減を見ている。"]);
  return pick(rng, ["部屋にいるのは、あなただけだ。冷蔵庫の低い音が聞こえる。", "ひとりの夕食は、慣れてしまえば悪くない。"]);
}

export function compose(p: Person, money: Money, rng: Rng): string {
  const housing = housingOf(p);
  const season = pick(rng, ["春", "夏", "秋", "冬"]);
  const tod = pick(rng, ["夕方", "夜"]);
  const home = pick(rng, HOME[housing][p.region]);
  const [objA, objB] = [...OBJECTS].sort(() => rng() - 0.5);
  const sentences = [
    `${season}の${tod}、あなたの部屋。${home}`,
    pick(rng, WINDOW[p.region]),
    ...HANDS[p.occ ?? "student"],
    objA,
    objB,
    householdLine(p, rng),
  ];
  if (p.caregiving && p.age < 66) sentences.push("電話が鳴る。実家の親からだと、見なくても分かる。");
  if (p.condition !== "none") sentences.push(CONDITION[p.condition]);
  if (p.mbti) {
    sentences.push(
      p.mbti.startsWith("E")
        ? "スマートフォンの向こうで、旧い友人の声が弾んでいる。"
        : "ひとりで静かに過ごすこの時間が、いちばん落ち着く。",
    );
  }
  sentences.push(pick(rng, MONEY[money]), pick(rng, DETAIL), pick(rng, CLOSING));
  // その時代にない物(スマートフォンやパソコンなど)の文は、出さない。
  const year = yearOf(p);
  return sentences.map((x) => eraSentence(x, year)).filter((x): x is string => Boolean(x)).join("");
}

export const smallEvents: Record<"child" | "teen" | "young" | "mid" | "senior", string[]> = {
  child: ["転んでできた傷あとを、今でも覚えている", "はじめて自転車に乗れた日のことを覚えている", "夏祭りの夜に、迷子になりかけた"],
  teen: ["夜更かしして、友だちと朝まで語り明かした", "はじめて、ひとりで遠くまで出かけた", "進路のことで、親とはじめて本気で話した"],
  young: ["気の置けない友人たちと、旅行に出かけた", "ひとりで過ごす時間の心地よさに気づいた", "久しぶりに地元へ帰って、街の変わりように驚いた", "新しい趣味に、夢中になった時期があった"],
  mid: ["休日に、家族でゆっくり出かけた", "旧友と、久しぶりに再会した", "仕事の合間に、ふと空を見上げる習慣ができた", "健康診断の結果に、少しだけ生活を見直した"],
  senior: ["ずっと年下の子と、思いがけず仲良くなった", "昔の仲間と集まって、夜遅くまで笑った", "朝の散歩が、毎日の楽しみになった"],
};
