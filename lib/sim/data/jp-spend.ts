import { clamp } from "@/lib/sim/helpers";
import { pick } from "@/lib/sim/rng";
import type { Occ, Person, SpendCategoryDef, SpendPlan } from "@/lib/sim/types";

// お金の使い道を、言葉の手がかりで分類し、その人の特徴(年齢・仕事・地域・家族・MBTI・景気)と
// 金額(万円)から、直後に始めたことと、数年後の結果を組み立てる。AI は使わない。

const isE = (p: Person) => Boolean(p.mbti?.startsWith("E"));
const isI = (p: Person) => Boolean(p.mbti?.startsWith("I"));
const working = (p: Person) => p.occ !== null && p.occ !== "retired";

// 仕事ごとの、学び直しの分野。
const FIELDS: Record<Occ | "retired" | "student", string[]> = {
  mgmt: ["マネジメント", "財務の基礎"],
  tech: ["最新の専門知識", "データ分析", "英語での論文や資料の読み書き"],
  office: ["簿記", "英語", "表計算やデータ処理"],
  sales: ["商品知識と交渉術", "マーケティング", "英語"],
  service: ["接客の資格", "調理や介護の資格", "経営の基礎"],
  security: ["防災や救命の資格", "警備の上位資格"],
  agri: ["栽培や経営の技術", "加工や販売の方法"],
  production: ["機械や電気の資格", "生産管理", "溶接や検査の技能"],
  transport: ["大型免許や運行管理の資格", "安全運転の技能"],
  construction: ["施工管理や電気工事の資格", "設計の基礎"],
  logistics: ["フォークリフトなどの資格", "倉庫管理"],
  retired: ["歴史や語学", "地域の講座"],
  student: ["語学", "資格の基礎"],
};

const fieldOf = (p: Person, pickIdx: () => number) => {
  const list = FIELDS[p.occ ?? "student"];
  return list[Math.floor(pickIdx() * list.length)];
};

const plan = (start: string, effect: SpendPlan["effect"], payoff?: SpendPlan["payoff"]): SpendPlan => ({ start, effect, payoff });

export const spendCategories: SpendCategoryDef[] = [
  {
    id: "learn",
    label: "学び直し",
    tag: "learn",
    subsumes: ["grad", "univ", "study_abroad", "certificate", "language"],
    test: /勉強|学び|学ぶ|資格|講座|スクール|大学院|留学|語学|英語|簿記|プログラミング|習い事|セミナー|研修|読書|参考書|教材|通信教育/,
    plan: (p, man, rng) => {
      const field = fieldOf(p, rng);
      const how = man < 5 ? "書籍や通信講座で" : man < 30 ? "オンライン講座や資格スクールで" : man < 100 ? "社会人向けのスクールに通って" : man < 300 ? "専門のスクールや集中講座に通って" : "大学院や留学など、本格的に腰を据えて";
      const style = p.age >= 60 ? "暮らしの張り合いとして、" : p.kids > 0 && p.age < 60 ? "子どもが寝たあとの時間に、" : isE(p) ? "同じ志の仲間とともに、" : isI(p) ? "ひとりでこつこつと、" : p.region === "rural" && man < 100 ? "オンライン中心で、" : "";
      const chance = clamp(0.3 + p.stats.learn / 250 + Math.min(man, 200) / 800 - (p.age >= 55 ? 0.15 : 0), 0.15, 0.85);
      const years = 1 + (man >= 100 ? 1 : 0) + (man >= 300 ? 1 : 0);
      return plan(
        `${style}${how}${field}の学び直しを始めた`,
        { learn: Math.min(14, 3 + man / 8), money: man >= 100 ? -2 : 0, health: -1 },
        {
          years,
          chance,
          good: {
            event: working(p) ? `${field}の力が身につき、仕事の幅が広がった` : `${field}の学びが、暮らしの大きな張り合いになった`,
            delta: { learn: 6, money: 3 },
            payMult: working(p) ? 1 + Math.min(0.08, 0.02 + man / 3000) : undefined,
          },
          bad: { event: "忙しさに追われて、学びは途中で途切れてしまった", delta: { money: -1 } },
        },
      );
    },
  },
  {
    id: "trip",
    label: "旅",
    tag: "rest",
    subsumes: ["travel", "rest"],
    test: /旅|旅行|ツアー|温泉|海外|帰省|キャンプ|バカンス|遠出|クルーズ|ドライブ/,
    plan: (p, man, rng) => {
      const who = p.kids > 0 && p.age < 60 ? "家族で" : p.married ? "パートナーと" : isI(p) ? "ひとりで" : isE(p) ? "友人たちと" : "";
      const where = man < 5 ? "近場の温泉へ" : man < 20 ? "国内を、数日かけて" : man < 60 ? "海外へ、一週間ほど" : man < 200 ? "長い休暇をとって、海外を巡る旅に" : "仕事を離れて、長い旅に";
      return plan(
        `${who}${where}出かけた`,
        { health: 3, bonds: man >= 60 ? 4 : 2 },
        { years: 1, chance: 0.3 + (isE(p) ? 0.15 : 0), good: { event: "旅先での出会いが、その後の考え方を少し変えた", delta: { bonds: 5, learn: 2 } } },
      );
    },
  },
  {
    id: "family",
    label: "家族のため",
    tag: "bond",
    subsumes: ["social"],
    test: /家族|子ども|子供|親孝行|両親|プレゼント|記念日|結婚式|育児|教育費|習い事|孫|仕送り/,
    plan: (p, man) => {
      let start: string;
      if (p.age >= 60) start = "子や孫に、贈り物をした";
      else if (p.married && p.kids > 0) start = man < 10 ? "家族で、記念日の食事や小さな外出を楽しんだ" : man < 50 ? "家族で旅行に出かけ、思い出をつくった" : man < 200 ? "家族のために、住まいの設備や子どもの学びに使った" : "子どもの教育資金として、積み立てを始めた";
      else if (p.married) start = man < 50 ? "パートナーと、記念日に特別な時間を過ごした" : "パートナーと、二人の暮らしを整えた";
      else start = man < 30 ? "親に、旅行や贈り物をした" : "親の住まいの修繕を手伝った";
      return plan(start, { bonds: Math.min(10, 3 + man / 10) }, { years: 1, chance: 0.4, good: { event: "家族との関係が、いっそう深まった", delta: { bonds: 5 } } });
    },
  },
  {
    id: "give",
    label: "寄付・支援",
    tag: "bond",
    subsumes: ["social"],
    test: /寄付|募金|支援|恩返し|貢献|ふるさと納税|応援/,
    plan: (p, man) => {
      const start = man < 5 ? "地域の団体に、少しずつ寄付した" : man < 30 ? "気になっていた活動に、まとまった寄付をした" : "支援したい団体を決めて、継続的な寄付を始めた";
      return plan(start, { bonds: Math.min(8, 2 + man / 10) }, { years: 2, chance: 0.25 + (isE(p) ? 0.25 : 0), good: { event: "活動に誘われ、ボランティアにも関わるようになった", delta: { bonds: 8, learn: 2 } } });
    },
  },
  {
    id: "pet",
    label: "ペットを迎える",
    tag: "bond",
    test: /ペット|犬|猫|いぬ|ねこ|子犬|子猫|飼う|飼い|うさぎ|ハムスター|インコ|小動物/,
    plan: (p, man, _rng, _data, _econ, text) => {
      if (p.pets.filter((x) => !x.died).length >= 3) return plan("もうこれ以上は世話できないと、ペットを迎えるのはやめた", { bonds: 0 });
      const cat = /猫|ねこ/.test(text);
      const small = /うさぎ|ハムスター|インコ|小動物/.test(text);
      const kind = small ? "小さな動物" : cat ? "猫" : "犬";
      p.pets.push({ name: "", kind, adoptedAge: p.age });
      return plan(`${kind}を家族に迎えた(${man < 1 ? Math.round(man * 10000).toLocaleString("ja-JP") + "円" : Math.round(man) + "万円"}の初期費用)`, kind === "犬" ? { health: 3, bonds: 5, money: -1 } : { bonds: 4, money: -1 });
    },
  },
  {
    id: "self",
    label: "体と心を整える",
    tag: "rest",
    subsumes: ["health", "treatment", "rest"],
    test: /整える|美容|エステ|ジム|運動|健康|人間ドック|治療|歯|眼鏡|禁煙|マッサージ|サウナ|睡眠|メンタル|カウンセリング|整体/,
    plan: (p, man) => {
      const start =
        p.condition !== "none"
          ? "専門の医師にかかり、治療と体のケアに力を入れ始めた"
          : man >= 50
            ? "整体や歯科治療など、気になっていた不調を根本から整えた"
            : p.age < 40
              ? "ジムに通い、体づくりを始めた"
              : p.age < 60
                ? "人間ドックを受け、生活習慣を見直し始めた"
                : "歯や目など、気になっていた不調を整えた";
      return plan(start, { health: Math.min(12, 4 + man / 6) }, { years: 1, chance: 0.6, good: { event: "体が軽くなり、体調が安定してきた", delta: { health: 6 } } });
    },
  },
  {
    id: "business",
    label: "事業・独立",
    tag: "challenge",
    subsumes: ["side_job", "challenge"],
    test: /起業|開業|独立|店|事業|副業|設備|機材|開店|屋台|ビジネス/,
    plan: (p, man, rng, data, econ) => {
      const occ = p.occ ?? "student";
      const start =
        man >= 300
          ? "店舗や事務所を借りて、開業した"
          : occ === "service" || occ === "sales"
            ? "小さな店の開業準備を始めた"
            : occ === "tech" || occ === "office" || occ === "student"
              ? "機材をそろえ、個人で受ける仕事の準備を始めた"
              : occ === "production" || occ === "construction" || occ === "transport"
                ? "道具と資格をそろえ、独立の準備を始めた"
                : occ === "retired"
                  ? "地元で小さな商いの準備を始めた"
                  : "副業のための準備を始めた";
      const chance = clamp(0.4 + p.stats.learn / 300 + econ * 0.08 - (man < 10 ? 0.15 : 0), 0.15, 0.7);
      return plan(
        start,
        { learn: 3, health: -2 },
        {
          years: 2,
          chance,
          good: { event: "事業が軌道に乗り、収入の柱になった", delta: { money: 8 }, payMult: working(p) ? 1.08 : undefined },
          bad: { event: econ < -0.4 ? "景気の悪化と資金不足で、事業を畳むことになった" : "思うように客がつかず、事業を畳むことになった", delta: { money: man >= 100 ? -10 : -5 } },
        },
      );
    },
  },
  {
    id: "hobby",
    label: "趣味",
    tag: "rest",
    test: /趣味|楽器|ギター|ピアノ|カメラ|ゲーム|映画|ライブ|推し|収集|釣り|ゴルフ|ガーデニング|手芸|スポーツ|ダンス|絵/,
    plan: (p, man, rng) => {
      const pool: [string, number][] = [
        ["楽器を習い始めた", isI(p) ? 2 : 1],
        ["カメラを手に、写真を撮り歩くようになった", isI(p) ? 2 : 1],
        ["釣りやキャンプなど、外遊びを始めた", p.kids > 0 ? 2 : 1],
        ["絵や手芸など、ものづくりを始めた", p.age >= 55 ? 2 : 1],
        ["スポーツのクラブに入った", isE(p) ? 2 : 1],
        ["映画やライブに、よく通うようになった", isE(p) ? 2 : 1],
      ];
      const total = pool.reduce((a, [, w]) => a + w, 0);
      let r = rng() * total;
      let start = pool[0][0];
      for (const [t, w] of pool) {
        r -= w;
        if (r < 0) {
          start = t;
          break;
        }
      }
      return plan(start, { health: 2, bonds: isE(p) ? 5 : 3 }, { years: 1, chance: 0.5, good: { event: "同じ趣味の仲間ができた", delta: { bonds: 6 } } });
    },
  },
  {
    id: "home",
    label: "住まい",
    tag: "stable",
    subsumes: ["rent"],
    test: /リフォーム|家具|家電|敷金|礼金|頭金|引っ越し費用|部屋|インテリア/,
    plan: (p, man) => {
      const start = man < 30 ? "部屋の環境を整え、暮らしやすくした" : man < 100 ? "家具や家電を一新した" : man < 200 ? "住まいのリフォームを行った" : "住まいを見直し、暮らしの拠点を整えた";
      return plan(start, { health: 3, bonds: 2 });
    },
  },
  {
    id: "car",
    label: "乗り物",
    tag: "stable",
    test: /車|バイク|自転車|クルマ/,
    plan: (p, man) => {
      if (man < 10) return plan("自転車やバイクを買い、移動が楽になった", { bonds: 1 });
      if (p.region === "local" || p.region === "rural") return plan("車を買い、行動範囲が広がった", { bonds: 3, health: 1 });
      return plan("車を買ったが、都会では使う機会は多くなかった", { bonds: 1, money: -2 });
    },
  },
  {
    id: "invest",
    label: "投資",
    tag: "stable",
    subsumes: ["stocks"],
    test: /株|投資|NISA|ニーサ|積立|ファンド|債券|資産運用/,
    plan: () => plan("株式投資を始めた", { learn: 2 }),
  },
  {
    id: "save",
    label: "貯金",
    tag: "stable",
    subsumes: ["saving"],
    test: /貯金|貯める|節約|備え|老後|とっておく|残す/,
    plan: () => plan("お金を使わず、備えとして残すことにした", { money: 3 }),
  },
  {
    id: "social",
    label: "人づきあい",
    tag: "bond",
    subsumes: ["social"],
    test: /飲み会|友人|友達|仲間|パーティ|コミュニティ|サークル|会う|おごる|集まり|交流/,
    plan: (p, man) => {
      const start = man < 10 ? "友人たちを集めて、にぎやかな時間を過ごした" : "人を招いたり、集まりを開いたりする機会を増やした";
      return plan(start, { bonds: Math.min(10, 3 + man / 8) }, { years: 1, chance: 0.35, good: { event: "そこから、新しい出会いや縁が生まれた", delta: { bonds: 5 } } });
    },
  },
];

void pick;
