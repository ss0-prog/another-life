import { lessonById } from "@/lib/sim/data/jp-lessons";
import { drawLottery } from "@/lib/sim/data/jp-lottery";
import { createRng } from "@/lib/sim/rng";
import type { Person, Stats } from "@/lib/sim/types";

// 売買(買い物)。金額は、設計上の仮定(だいたいの目安)。
export type ShopItem = {
  id: string;
  group: string;
  label: string;
  note: string;
  // 買う値段(万円)。
  costMan: (p: Person) => number;
  // 持っているあいだ、毎年かかる費用(万円)。
  yearlyMan?: (p: Person) => number;
  // 買える状況か(持っていない・年齢・暮らし)。
  visible: (p: Person) => boolean;
  // 買ったときの変化。出来事に書く文を返す。
  apply: (p: Person) => string;
  // 持ち続けるもの(一度買うと、売るまで持っている)。false なら、何度でも買える。
  keep: boolean;
  // 手放して得られるお金(万円)。売れるものだけ。
  sellMan?: (p: Person) => number;
  sellApply?: (p: Person) => string;
};

const REGION_PRICE = { tokyo: 1, metro: 0.7, local: 0.5, rural: 0.35 } as const;
const homePrice = (p: Person) => Math.round(4500 * REGION_PRICE[p.region]); // 中古マンション・戸建ての目安
const downPay = (p: Person) => Math.round(homePrice(p) * 0.15); // 頭金。のこりは住宅ローン
const held = (p: Person, id: string) => (p.owns[id] !== undefined ? Math.max(0, p.age - p.owns[id]) : 0);
const inc = (p: Person, d: Partial<Stats>) => {
  for (const k of Object.keys(d) as (keyof Stats)[]) p.stats[k] = Math.max(0, Math.min(100, p.stats[k] + (d[k] ?? 0)));
};
const adult = (p: Person) => p.age >= 18;
const has = (p: Person, id: string) => p.owns[id] !== undefined;
const hasCar = (p: Person) => has(p, "car_kei") || has(p, "car_used") || has(p, "car_new");
const carYearly = (id: string) => (p: Person) => Math.round((id === "car_new" ? 48 : id === "car_used" ? 36 : 28) * (p.region === "tokyo" ? 1.3 : 1));
const carWorth = (p: Person) => {
  const base = has(p, "car_new") ? 300 : has(p, "car_used") ? 100 : 140;
  const id = has(p, "car_new") ? "car_new" : has(p, "car_used") ? "car_used" : "car_kei";
  return Math.max(Math.round(base * 0.12), Math.round(base * Math.pow(0.85, held(p, id))));
};
const carSell = (p: Person) => `車を手放した(売った額は約${carWorth(p)}万円)`;
const dropCar = (p: Person) => {
  for (const k of ["car_kei", "car_used", "car_new"]) delete p.owns[k];
  return carSell(p);
};

// 習い事・趣味の道具(いま続けているものにだけ、出る)。
const GEAR: Record<string, [string, number]> = {
  fishing: ["釣り具一式", 5], hiking: ["登山靴と装備", 8], camp: ["キャンプ道具", 15], games: ["ゲーム機やボードゲーム", 6], reading: ["本棚と電子書籍の端末", 4],
  gardening: ["園芸用具とプランター", 3], running: ["ランニングシューズとウェア", 3], diy: ["工具セット", 6], photo: ["カメラとレンズ", 20], guitar: ["ギター", 12],
  piano: ["電子ピアノ", 15], violin: ["バイオリン", 18], vocal: ["マイクと録音機材", 5], painting: ["画材一式", 4], tennis: ["ラケットとウェア", 4], golf: ["ゴルフクラブ", 20],
  swim: ["水着とゴーグル", 2], soccer: ["スパイクとボール", 2], baseball: ["グローブとバット", 4], martial: ["道着と防具", 3], dance: ["ダンスシューズと衣装", 4],
  yoga: ["ヨガマット", 2], fitness: ["トレーニング器具", 10], cooking: ["良い調理器具", 5], programming: ["高性能のパソコン", 25], sewing: ["ミシン", 6], travel_club: ["スーツケースと旅の道具", 5],
  english: ["辞書と教材", 2], tea: ["茶道具・花器", 8], theater: ["衣装と小道具", 3], ballet: ["トウシューズとレオタード", 3], calligraphy: ["筆と硯", 2], gym: ["シューズと用具", 2],
  qualification: ["参考書と問題集", 2], chinese: ["教材と辞書", 2], abacus: ["そろばんと教材", 1], cram: ["参考書と問題集", 2], volunteer: ["活動用の道具", 1],
};

const gearItems = (): ShopItem[] =>
  Object.keys(GEAR).map((lid) => {
    const [name, cost] = GEAR[lid];
    const label = lessonById(lid)?.label ?? lid;
    return {
      id: `gear:${lid}`,
      group: "趣味・習い事の道具",
      label: `${label}の${name}`,
      note: "道具をそろえると、続けるあいだ、効果がふえる(約1.35倍)。",
      costMan: () => cost,
      visible: (p) => p.lessons.some((l) => l.id === lid) && !has(p, `gear:${lid}`),
      apply: (p) => (inc(p, { joy: 3 }), `${label}の${name}をそろえた`),
      keep: true,
      sellMan: (p) => Math.max(1, Math.round(cost * 0.3)),
      sellApply: () => `${label}の${name}を手放した`,
    };
  });


// 宝くじ: 1枚300円。1年に買えるのは、100枚まで(買った枚数は、年ごとに数える)。当せん金と確率は、jp-lottery.ts(年末ジャンボの公式の一覧)。
const LOT_MAX = 100;
const lotLeft = (p: Person) => LOT_MAX - ((p.history.lotYear ?? -1) === p.age ? (p.history.lotYearN ?? 0) : 0);
const buyLottery = (p: Person, n: number): string => {
  p.history.lotBought = (p.history.lotBought ?? 0) + n;
  p.history.lotYearN = ((p.history.lotYear ?? -1) === p.age ? (p.history.lotYearN ?? 0) : 0) + n;
  p.history.lotYear = p.age;
  // 乱数は、年齢と、これまでに買った枚数から決める(同じ人生では、同じ結果)。
  const r = createRng(((p.age + 1) * 2654435761) ^ (p.history.lotBought * 40503) ^ (p.birthYear ?? 0));
  const { win, top } = drawLottery(r, n);
  p.cashDelta += win;
  const cost = n * 300;
  if (top === "1等") return (inc(p, { joy: 30, money: 40, bonds: -5 }), "宝くじで1等が当たった。受け取ったのは数億円。人生が大きく動きはじめた");
  if (win >= 100000) return (inc(p, { joy: 12, money: 6 }), `宝くじで${Math.round(win / 10000)}万円が当たった`);
  return (inc(p, { joy: win > cost * 0.5 ? 2 : -1 }), `宝くじを${n}枚買って${win.toLocaleString("ja-JP")}円が戻ってきた(買った額は${cost.toLocaleString("ja-JP")}円)`);
};

export const SHOP: ShopItem[] = [
  // ---- 住まい ----
  {
    id: "home", group: "住まい", label: "家を買う(頭金を払い、のこりはローン)",
    note: "頭金は、価格の約15%。のこりは住宅ローンで、毎年の返済が生活費にふくまれる。",
    costMan: downPay, visible: (p) => adult(p) && !p.owned && p.occ !== null && p.occ !== "retired" && !p.abroad,
    apply: (p) => ((p.owned = true), (p.housingKind = null), (p.withParents = false), (p.owns.home = p.age), inc(p, { joy: 6, money: -2 }), `住まいを買った(価格の目安 約${homePrice(p).toLocaleString("ja-JP")}万円。住宅ローンを組んだ)`),
    keep: false,
  },
  {
    id: "home_sell", group: "住まい", label: "持ち家を売る",
    note: "ローンの残りを返したあとの手取りが入り、賃貸の暮らしに変わる。",
    costMan: () => 0, visible: (p) => p.owned && !p.abroad,
    apply: () => "",
    keep: false,
    sellMan: (p) => Math.round(homePrice(p) * (0.15 + Math.min(0.6, 0.03 * (p.owns.home !== undefined ? held(p, "home") : 8)))),
    sellApply: (p) => ((p.owned = false), (p.housingKind = null), delete p.owns.home, delete p.owns.fire, inc(p, { joy: -2 }), "持ち家を売り、賃貸の暮らしに移った"),
  },
  {
    id: "reform", group: "住まい", label: "家をリフォームする",
    note: "水まわりや内装を新しくする。暮らしやすくなる。",
    costMan: () => 250, visible: (p) => adult(p) && p.owned,
    apply: (p) => (inc(p, { joy: 6, health: 2 }), "家をリフォームして、暮らしやすくなった"), keep: false,
  },
  {
    id: "furniture", group: "住まい", label: "家具・家電を買いそろえる",
    note: "新生活や買い替えのとき。毎日の暮らしが整う。",
    costMan: (p) => (p.married ? 40 : 20), visible: (p) => adult(p) && !p.abroad && !p.withParents,
    apply: (p) => (inc(p, { joy: 3, health: 1 }), "家具や家電を買いそろえた"), keep: false,
  },
  {
    id: "bedding", group: "住まい", label: "良い寝具に買い替える",
    note: "睡眠の質が上がる。",
    costMan: () => 8, visible: (p) => adult(p) && !has(p, "bedding"),
    apply: (p) => ((p.owns.bedding = p.age), inc(p, { health: 3, joy: 1 }), "良い寝具に替えて、よく眠れるようになった"), keep: true,
    sellMan: () => 0, sellApply: (p) => (delete p.owns.bedding, ""),
  },
  // ---- 乗りもの ----
  {
    id: "car_kei", group: "乗りもの", label: "軽自動車を買う",
    note: "本体は約140万円。保険・税金・ガソリンなどで、毎年約28万円(東京は約3割増し)。地方では、暮らしが楽になる。",
    costMan: () => 140, yearlyMan: carYearly("car_kei"), visible: (p) => adult(p) && !hasCar(p),
    apply: (p) => ((p.owns.car_kei = p.age), inc(p, { joy: p.region === "rural" || p.region === "local" ? 6 : 3, bonds: 1 }), "軽自動車を買った"), keep: true,
    sellMan: carWorth, sellApply: dropCar,
  },
  {
    id: "car_used", group: "乗りもの", label: "中古車を買う",
    note: "本体は約100万円。維持費は毎年約36万円。",
    costMan: () => 100, yearlyMan: carYearly("car_used"), visible: (p) => adult(p) && !hasCar(p),
    apply: (p) => ((p.owns.car_used = p.age), inc(p, { joy: p.region === "rural" || p.region === "local" ? 6 : 3, bonds: 1 }), "中古車を買った"), keep: true,
    sellMan: carWorth, sellApply: dropCar,
  },
  {
    id: "car_new", group: "乗りもの", label: "新車を買う",
    note: "本体は約300万円。維持費は毎年約48万円。手放すと、価値は大きく下がる。",
    costMan: () => 300, yearlyMan: carYearly("car_new"), visible: (p) => adult(p) && !hasCar(p),
    apply: (p) => ((p.owns.car_new = p.age), inc(p, { joy: 8, bonds: 1 }), "新車を買った"), keep: true,
    sellMan: carWorth, sellApply: dropCar,
  },
  {
    id: "bicycle", group: "乗りもの", label: "自転車を買う",
    note: "体を動かす習慣がつく。",
    costMan: () => 5, visible: (p) => p.age >= 8 && !has(p, "bicycle"),
    apply: (p) => ((p.owns.bicycle = p.age), inc(p, { health: 3, joy: 2 }), "自転車を買い、出かけるのが楽しくなった"), keep: true,
    sellMan: () => 1, sellApply: (p) => (delete p.owns.bicycle, "自転車を手放した"),
  },
  {
    id: "motorbike", group: "乗りもの", label: "バイクを買う",
    note: "本体は約40万円。維持費は毎年約8万円。",
    costMan: () => 40, yearlyMan: () => 8, visible: (p) => p.age >= 18 && !has(p, "motorbike"),
    apply: (p) => ((p.owns.motorbike = p.age), inc(p, { joy: 6 }), "バイクを買い、風を切って走る楽しさを知った"), keep: true,
    sellMan: (p) => Math.max(5, Math.round(40 * Math.pow(0.85, held(p, "motorbike")))), sellApply: (p) => (delete p.owns.motorbike, "バイクを手放した"),
  },
  // ---- 宝くじ ----
  {
    id: "lottery10", group: "宝くじ", label: "宝くじを買う(10枚・3,000円)",
    note: "1枚300円。1等7億円が当たるのは、2,000万枚に1枚。当せん金の総額は、買った額の約半分で、買うほど、平均では減っていく。1年に買えるのは100枚まで。",
    costMan: () => 0.3, visible: (p) => adult(p) && lotLeft(p) >= 10,
    apply: (p) => buyLottery(p, 10), keep: false,
  },
  {
    id: "lottery100", group: "宝くじ", label: "宝くじをまとめて買う(100枚・3万円)",
    note: "1枚300円。3等以上(100万円以上)は、5万枚に1枚ほどの確率。1年に買えるのは100枚まで。",
    costMan: () => 3, visible: (p) => adult(p) && lotLeft(p) >= 100,
    apply: (p) => buyLottery(p, 100), keep: false,
  },
  // ---- 暮らしの買い物 ----
  {
    id: "pc", group: "暮らしの買い物", label: "パソコン・スマートフォンを買い替える",
    note: "仕事や勉強がはかどる。",
    costMan: () => 15, visible: (p) => adult(p),
    apply: (p) => (inc(p, { learn: 3, joy: 2 }), "パソコンとスマートフォンを買い替えた"), keep: false,
  },
  {
    id: "clothes", group: "暮らしの買い物", label: "服や靴を新調する",
    note: "気持ちが明るくなる。",
    costMan: () => 3, visible: (p) => p.age >= 12,
    apply: (p) => (inc(p, { joy: 2, bonds: 1 }), "服や靴を新調して、気分が晴れた"), keep: false,
  },
  {
    id: "treat", group: "暮らしの買い物", label: "ごちそうを食べに行く",
    note: "ささやかなごほうび。",
    costMan: () => 2, visible: (p) => adult(p),
    apply: (p) => (inc(p, { joy: 2 }), "ちょっと良いお店で、ごちそうを食べた"), keep: false,
  },
  {
    id: "brand", group: "暮らしの買い物", label: "ブランドの時計やバッグを買う",
    note: "気分は上がるが、お金への不安も増える。",
    costMan: () => 80, visible: (p) => adult(p),
    apply: (p) => (inc(p, { joy: 5, money: -2 }), "ブランドの時計(バッグ)を買った"), keep: false,
  },
  {
    id: "gym_tools", group: "暮らしの買い物", label: "健康器具・サプリメントを買う",
    note: "気休めの面もあるが、体を気づかう習慣になる。",
    costMan: () => 10, visible: (p) => adult(p),
    apply: (p) => (inc(p, { health: 2 }), "健康器具を買い、体を気づかうようになった"), keep: false,
  },
  {
    id: "books", group: "暮らしの買い物", label: "本や学習教材を買う",
    note: "学びが少し進む。",
    costMan: () => 3, visible: (p) => p.age >= 8,
    apply: (p) => (inc(p, { learn: 3, joy: 1 }), "本や学習教材を買い、勉強がはかどった"), keep: false,
  },
  {
    id: "donate", group: "暮らしの買い物", label: "寄付をする",
    note: "だれかの役に立つ。",
    costMan: () => 5, visible: (p) => adult(p),
    apply: (p) => (inc(p, { joy: 2, bonds: 2 }), "寄付をして、少し誇らしい気持ちになった"), keep: false,
  },
  // ---- 家族・人との関わり ----
  {
    id: "gift", group: "家族・人との関わり", label: "大切な人に贈り物をする",
    note: "恋人や家族、友人に。",
    costMan: () => 5, visible: (p) => adult(p) && (p.married || p.partner?.status === "dating" || p.kids > 0 || p.age < 60),
    apply: (p) => (inc(p, { bonds: 4, joy: 1 }), "大切な人に贈り物をして、喜んでもらえた"), keep: false,
  },
  {
    id: "ring", group: "家族・人との関わり", label: "婚約指輪を買う",
    note: "付き合っている人がいる、結婚前のとき。プロポーズの成功率が上がる。",
    costMan: () => 30, visible: (p) => adult(p) && !p.married && p.partner?.status === "dating" && !has(p, "ring"),
    apply: (p) => ((p.owns.ring = p.age), (p.marriageBias *= 1.5), inc(p, { bonds: 4, joy: 3 }), "婚約指輪を用意した"), keep: true,
    sellMan: () => 10, sellApply: (p) => (delete p.owns.ring, "婚約指輪を手放した"),
  },
  {
    id: "wedding", group: "家族・人との関わり", label: "結婚式を挙げる",
    note: "一生の思い出になる。費用は、平均で300万円ほど。",
    costMan: () => 300, visible: (p) => adult(p) && p.married && !has(p, "wedding"),
    apply: (p) => ((p.owns.wedding = p.age), inc(p, { bonds: 8, joy: 8 }), "結婚式を挙げ、たくさんの人に祝ってもらった"), keep: true,
  },
  {
    id: "baby_goods", group: "家族・人との関わり", label: "ベビー用品をそろえる",
    note: "0〜2歳の子どもがいるとき。",
    costMan: () => 15, visible: (p) => p.kidList.some((k) => p.age - k.bornAge <= 2),
    apply: (p) => (inc(p, { joy: 2, bonds: 2 }), "ベビー用品をそろえた"), keep: false,
  },
  {
    id: "school_goods", group: "家族・人との関わり", label: "子どもの入学の用意をする",
    note: "ランドセルや制服、学用品など。",
    costMan: () => 12, visible: (p) => p.kidList.some((k) => [6, 12, 15, 18].includes(p.age - k.bornAge)),
    apply: (p) => (inc(p, { bonds: 3, joy: 2 }), "子どもの入学の用意をそろえた"), keep: false,
  },
  {
    id: "parents_trip", group: "家族・人との関わり", label: "親を旅行に連れていく",
    note: "親孝行。",
    costMan: () => 20, visible: (p) => adult(p) && p.age < 70,
    apply: (p) => (inc(p, { bonds: 5, joy: 4 }), "親を旅行に連れていき、喜んでもらえた"), keep: false,
  },
  // ---- 保険・備え ----
  {
    id: "medIns", group: "保険・備え", label: "医療保険に入る",
    note: "毎年約8万円。治療費の自己負担が、約3割になる。",
    costMan: () => 0, yearlyMan: () => 8, visible: (p) => adult(p) && !has(p, "medIns"),
    apply: (p) => ((p.owns.medIns = p.age), (p.history.medIns = 1), "医療保険に入った"), keep: true,
    sellMan: () => 0, sellApply: (p) => (delete p.owns.medIns, (p.history.medIns = 0), "医療保険を解約した"),
  },
  {
    id: "fire", group: "保険・備え", label: "火災・地震保険に入る",
    note: "持ち家のとき。毎年約3万円。災害の自己負担が、約3分の1になる。",
    costMan: () => 0, yearlyMan: () => 3, visible: (p) => p.owned && !has(p, "fire"),
    apply: (p) => ((p.owns.fire = p.age), "火災・地震保険に入った"), keep: true,
    sellMan: () => 0, sellApply: (p) => (delete p.owns.fire, "火災・地震保険を解約した"),
  },
  {
    id: "grave", group: "保険・備え", label: "お墓・仏壇を用意する(終活)",
    note: "家族に負担をかけない備え。",
    costMan: () => 150, visible: (p) => p.age >= 55 && !has(p, "grave"),
    apply: (p) => ((p.owns.grave = p.age), inc(p, { joy: 3, bonds: 2 }), "お墓(仏壇)を用意し、気持ちが落ち着いた"), keep: true,
  },
  ...gearItems(),
];

export const shopById = (id: string) => SHOP.find((x) => x.id === id);

// いま売り買いできるもの。買えるもの(まだ持っていない)と、売れるもの(持っている)。
export const shopBuyable = (p: Person) => SHOP.filter((x) => x.id !== "home_sell" && x.visible(p));
export const shopSellable = (p: Person) =>
  SHOP.filter((x) => x.sellMan && (x.id === "home_sell" ? x.visible(p) : x.keep && p.owns[x.id] !== undefined));

// 持っているものに、毎年かかる費用(万円)。
export const yearlyCosts = (p: Person) => SHOP.filter((x) => x.yearlyMan && p.owns[x.id] !== undefined);
