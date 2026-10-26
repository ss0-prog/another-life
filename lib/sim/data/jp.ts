import { branches, turningPoints } from "@/lib/sim/data/jp-turning";
import { intents } from "@/lib/sim/data/jp-intent";
import { BG_FACTOR, BG_PRIOR } from "@/lib/sim/family";
import { eventQuestions, lifeEvents } from "@/lib/sim/data/jp-events";
import { familyEvents } from "@/lib/sim/data/jp-family-events";
import { COUNTRIES } from "@/lib/sim/data/jp-countries";
import { LESSONS } from "@/lib/sim/data/jp-lessons";
import { OFFICES, PART_TIMES } from "@/lib/sim/data/jp-parttime";
import { JOBS, OCC_LABEL } from "@/lib/sim/data/jp-jobs";
import { compose, smallEvents } from "@/lib/sim/data/jp-scene";
import { vignette } from "@/lib/sim/data/jp-vignette";
import { spendCategories } from "@/lib/sim/data/jp-spend";
import type { CountryData, Region } from "@/lib/sim/types";

const prefs = (region: Region, names: string[]) => names.map((name) => ({ name, region }));

// 日本版データ。国勢調査・人口動態統計・生命表・賃金構造基本統計調査などで
// 一般に知られる傾向を、手触りが外れない程度の概算で表にしたもの(公式値の転記ではない)。
// 将来は e-Stat 等の実データに置き換える。値の置き場はこのファイルに集約する。
// 「分岐の効果」(turningPoints / branches の増減値)は統計ではなく、設計上の仮定。
export const jpData: CountryData = {
  prefectures: [
    ...prefs("tokyo", ["東京都"]),
    ...prefs("metro", ["北海道", "宮城県", "埼玉県", "千葉県", "神奈川県", "愛知県", "京都府", "大阪府", "兵庫県", "広島県", "福岡県"]),
    ...prefs("local", ["茨城県", "栃木県", "群馬県", "新潟県", "富山県", "石川県", "長野県", "岐阜県", "静岡県", "三重県", "滋賀県", "奈良県", "岡山県", "山口県", "香川県", "愛媛県", "熊本県", "沖縄県"]),
    ...prefs("rural", ["青森県", "岩手県", "秋田県", "山形県", "福島県", "山梨県", "福井県", "鳥取県", "島根県", "徳島県", "高知県", "佐賀県", "長崎県", "大分県", "宮崎県", "鹿児島県", "和歌山県"]),
  ],

  ailments: [
    { id: "none", label: "とくになし", healthDelta: 0, illness: 1, income: 1, joy: 0 },
    { id: "hypertension", label: "高血圧・脂質異常(通院中)", healthDelta: -4, illness: 1.15, income: 1, joy: 0 },
    { id: "diabetes2", label: "2型糖尿病", healthDelta: -8, illness: 1.35, income: 0.97, joy: -2 },
    { id: "mental", label: "うつ病・不安障害など、心の病気", healthDelta: -8, illness: 1.1, income: 0.88, joy: -12 },
    { id: "cancer", label: "がん(治療中・経過観察)", healthDelta: -22, illness: 2.2, income: 0.85, joy: -8 },
    { id: "heart_acq", label: "心臓・血管の病気", healthDelta: -18, illness: 1.9, income: 0.9, joy: -4 },
    { id: "intractable", label: "膠原病・難病など", healthDelta: -14, illness: 1.6, income: 0.9, joy: -6 },
    { id: "chronic_pain", label: "腰・関節などの慢性の痛み", healthDelta: -6, illness: 1.05, income: 0.95, joy: -3 },
    { id: "other", label: "その他の持病", healthDelta: -8, illness: 1.3, income: 0.95, joy: -3 },
  ],
  conditions: [
    { id: "none", label: "とくになし", healthBase: 75, illness: 1, income: 1 },
    { id: "heart", label: "先天性の心臓の病気", healthBase: 55, illness: 2, income: 0.9 },
    { id: "diabetes", label: "1型糖尿病", healthBase: 60, illness: 1.6, income: 0.95 },
    { id: "asthma", label: "喘息・アレルギー体質", healthBase: 65, illness: 1.3, income: 1 },
    { id: "sensory", label: "聴覚・視覚の障害", healthBase: 70, illness: 1.1, income: 0.92 },
    { id: "other", label: "その他の持病", healthBase: 60, illness: 1.5, income: 0.95 },
  ],

  regionLabel: { tokyo: "東京23区", metro: "大都市", local: "地方都市", rural: "郊外・農村部" },
  occLabel: { ...OCC_LABEL, retired: "仕事を退いた暮らし", student: "学生" },
  // 政治家は、選挙に出て、当選してはじめてなれる職。職業の選択肢には出さない(出馬は、活動の「出馬」から)。
  jobs: JOBS.filter((j) => j.id !== "politician"),
  cities: {
    tokyo: ["東京・世田谷区", "東京・江戸川区", "東京・杉並区", "東京・足立区", "東京・板橋区", "東京・練馬区", "東京・大田区"],
    metro: ["大阪府・吹田市", "愛知県・名古屋市", "福岡県・福岡市", "兵庫県・西宮市", "神奈川県・川崎市", "埼玉県・さいたま市", "北海道・札幌市", "宮城県・仙台市"],
    local: ["静岡県・浜松市", "新潟県・長岡市", "岡山県・倉敷市", "熊本県・熊本市", "群馬県・前橋市", "石川県・金沢市", "愛媛県・松山市", "岩手県・盛岡市"],
    rural: ["長野県・上田市の郊外", "秋田県・大仙市", "高知県・四万十町", "島根県・出雲市の外れ", "山形県・鶴岡市の郊外", "宮崎県・都城市の郊外"],
  },

  workStartAge: { univ: 22, grad: 24, vocational: 20, hs_work: 18 },
  retireAge: 65,

  prior: { background: BG_PRIOR },

  transition: {
    occ: { tech: 14, office: 20, sales: 14, service: 20, production: 10, transport: 6, construction: 5, logistics: 8, security: 2, agri: 1, mgmt: 0 },
    region: {
      tokyo: { tokyo: 60, metro: 25, local: 10, rural: 5 },
      metro: { tokyo: 22, metro: 40, local: 28, rural: 10 },
      local: { tokyo: 15, metro: 30, local: 45, rural: 10 },
      rural: { tokyo: 8, metro: 22, local: 40, rural: 30 },
    },
  },

  curves: {
    mortalityScale: { male: 0.87, female: 0.82, none: 0.845 },
    // 亡くなる確率のうち、事故・急病・災害など「出来事によるもの」の割合。若いほど大きい(死因別統計の傾向を手がかりにした仮定)。
    suddenShare: [[0, 0.4], [10, 0.5], [20, 0.72], [35, 0.55], [45, 0.3], [60, 0.14], [75, 0.05], [90, 0.02]],
    // 未婚者が1年のうちに結婚する確率
    marriageRate: [[20, 0.01], [24, 0.04], [27, 0.08], [30, 0.09], [34, 0.06], [38, 0.035], [43, 0.018], [50, 0.008], [60, 0.004]],
    // 既婚者が1年のうちに子を授かる確率
    birthRate: [[20, 0.12], [26, 0.2], [30, 0.22], [34, 0.17], [38, 0.08], [42, 0.025], [45, 0.003]],
    jobChange: [[20, 0.08], [25, 0.07], [30, 0.05], [35, 0.04], [45, 0.025], [55, 0.012], [60, 0.008]],
    moveRate: [[20, 0.08], [25, 0.07], [30, 0.05], [40, 0.025], [55, 0.015]],
    // 大きな病気をする確率(1年あたり)
    illnessRate: [[3, 0.004], [20, 0.005], [40, 0.012], [55, 0.03], [70, 0.06], [85, 0.1]],
    purchaseRate: [[28, 0.01], [32, 0.03], [36, 0.05], [42, 0.04], [50, 0.02], [60, 0.01]],
    // 1年のうちに亡くなる確率。厚生労働省「令和5年簡易生命表」の平均余命
    // (男 0歳81.09年・65歳19.52年 / 女 0歳87.14年・65歳24.38年 ほか5歳刻み)に合うよう、
    // 10歳刻みの値を当てはめた(対数補間)。個々の年齢の死亡率そのものの転記ではない。
    // 105歳以降は、世界の長寿の記録(122歳)を参考にした、設計上の仮定。最大は123歳。
    mortality: {
      male: [[0, 0.00132], [10, 4e-05], [20, 0.00042], [30, 0.00053], [40, 0.00088], [50, 0.0022], [60, 0.00555], [70, 0.01681], [80, 0.03896], [90, 0.1457], [100, 0.33633], [105, 0.38], [110, 0.4], [123, 0.42]],
      female: [[0, 0.00128], [10, 3e-05], [20, 0.00032], [30, 0.00025], [40, 0.00049], [50, 0.00142], [60, 0.00268], [70, 0.00611], [80, 0.01976], [90, 0.08149], [100, 0.3179], [105, 0.36], [110, 0.38], [123, 0.42]],
      none: [[0, 0.0013], [10, 4e-05], [20, 0.00037], [30, 0.00039], [40, 0.00069], [50, 0.00181], [60, 0.00412], [70, 0.01146], [80, 0.02936], [90, 0.1136], [100, 0.32712], [105, 0.37], [110, 0.39], [123, 0.42]],
    },
  },
  regionFactor: {
    marriage: { tokyo: 0.8, metro: 1, local: 1.1, rural: 1.1 },
    purchase: { tokyo: 0.5, metro: 0.8, local: 1.3, rural: 1.5 },
  },

  // 年収の目安(万円)。本文に数字は出さず、暮らしの余裕を判定するためだけに使う。
  income: {
    // 水準は、厚生労働省「令和6年賃金構造基本統計調査」(一般労働者・産業計)の、年収(きまって支給する現金給与額 × 12 + 年間賞与その他特別給与額)を手がかりに、
    // 大学卒・男性・事務の職・全国平均の地域・企業規模は中くらい、のときの年収(額面)が、22歳で約370万円、25歳で約440万円、30歳で約530万円、40歳で約700万円、50歳で約840万円、55歳で約880万円になるよう合わせた概算。
    // 大学卒の年収は、学歴計の年収(年齢階級別)に、大学卒と学歴計の所定内給与の比をかけて推定した(大学卒だけの賞与の資料は、使っていない)。
    base: { mgmt: 1400, tech: 900, office: 690, sales: 690, service: 540, security: 530, agri: 480, production: 700, transport: 690, construction: 750, logistics: 540, retired: 250 },
    ageFactor: [[20, 0.481], [22, 0.542], [25, 0.635], [30, 0.77], [35, 0.9], [40, 1.007], [45, 1.123], [50, 1.216], [55, 1.277], [60, 0.923], [65, 0.658], [75, 0.491]],
    // 都道府県がわからないときだけの、地域4区分の倍率。ふだんは、都道府県ごと・年齢ごとの実際の賃金(jp-wage-region.ts)を使う。
    regionFactor: { tokyo: 1.2, metro: 1.0, local: 0.92, rural: 0.82 },
    sexFactor: { male: 1, female: 0.85, none: 0.92 },
    femaleAgeFactor: [[20, 0.98], [22, 0.97], [26, 0.94], [30, 0.88], [35, 0.82], [40, 0.78], [50, 0.73], [60, 0.72]],
    // 学歴・雇用形態・企業規模による違い(いずれも概算の仮定)
    eduFactor: { hs_work: 0.77, vocational: 0.82, univ: 1, grad: 1.2 },
    employmentFactor: { regular: 1, nonregular: 0.62, self: 1 },
    firmFactor: { large: 1.25, mid: 1, small: 0.83 },
    econSensitivity: { mgmt: 0.8, tech: 0.6, office: 0.7, sales: 1.3, service: 1.3, security: 0.8, agri: 1.0, production: 1.1, transport: 0.9, construction: 1.2, logistics: 1.1 },
    majorFactor: { humanities: 1, science: 1.06, medical: 1.12, education: 0.98, art: 0.88, sports: 0.93 },
  },
  econLabel: (level) => (level > 0.6 ? "好景気" : level > -0.4 ? "ふつう" : level > -1.1 ? "不況" : "深刻な不況"),

  branches,
  turningPoints,
  countries: COUNTRIES,
  lessons: LESSONS,
  partTimes: PART_TIMES,
  offices: OFFICES,
  lifeEvents: [...lifeEvents, ...familyEvents],
  eventQuestions,
  names: {
    surname: ["佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤", "吉田", "山田", "佐々木", "山口", "松本", "井上", "木村", "林", "斎藤", "清水", "山崎", "森", "池田", "橋本", "阿部", "石川", "山下", "中島", "石井", "小川", "前田", "岡田", "長谷川", "藤田", "後藤", "近藤", "村上", "遠藤", "青木", "坂本", "斉藤", "福田", "太田", "西村", "藤井", "金子", "岡本", "藤原", "三浦", "中野", "原田", "松田", "竹内", "小野", "田村", "中山", "和田", "石田", "上田", "森田"],
    boy: ["大翔", "蓮", "湊", "陽翔", "悠真", "樹", "颯太", "朝陽", "海斗", "律", "蒼", "大和", "陸", "翔", "奏太", "悠斗", "颯", "拓海", "健太", "誠", "優斗", "航", "直樹", "亮", "和也", "裕介", "智也", "圭", "隼人", "龍之介"],
    girl: ["結菜", "陽葵", "芽依", "凛", "紬", "澪", "咲良", "莉子", "栞", "杏", "美咲", "葵", "紗希", "彩", "愛", "真央", "琴音", "花", "遥", "七海", "千尋", "菜々子", "里奈", "唯", "優奈", "麻衣", "舞", "恵", "由美", "沙織"],
    neutral: ["ひなた", "あおい", "はる", "そら", "りん", "みお", "かなで", "いずみ", "ゆう", "つばさ"],
    dog: ["むぎ", "ココ", "ハチ", "マル", "ラッキー", "コタロー"],
    cat: ["ミケ", "ソラ", "モモ", "クロ", "チャチャ", "ルナ"],
    small: ["ポポ", "ミルク", "ゴマ", "ココア"],
  },
  intents,
  spendCategories,

  // 株価のシミュレーション用の設定。長期の日本株の「だいたいの傾向」を手がかりにした仮定で、
  // 実際の株価・将来の値動きを再現するものではない。
  assets: [
    { id: "index", label: "日本株インデックス", desc: "日本の株式市場全体に、広く分散して投資する。", mu: 0.085, sigma: 0.17, crashP: 0.05, crash: [0.15, 0.35], ruinP: 0 },
    { id: "world", label: "全世界株式の投資信託", desc: "世界の株式に広く分散して投資する投資信託(インデックス型)。積み立てに向く。日本株とほぼ同じ時期に下がりやすい。", mu: 0.07, sigma: 0.16, crashP: 0, crash: [0, 0], ruinP: 0 },
    { id: "balanced", label: "バランス型の投資信託", desc: "株式と債券を、組み合わせた投資信託。値動きは株式だけより、おだやか。", mu: 0.04, sigma: 0.08, crashP: 0, crash: [0, 0], ruinP: 0 },
    { id: "reit", label: "不動産の投資信託(REIT)", desc: "オフィスビルや商業施設などの不動産に投資する。分配金が出るが、株と同じように値動きがある。", mu: 0.045, sigma: 0.15, crashP: 0, crash: [0, 0], ruinP: 0 },
    { id: "gold", label: "金(ゴールド)", desc: "株とは、ちがう動きをしやすい。値上がり益のみで、利息や配当はつかない。", mu: 0.03, sigma: 0.14, crashP: 0, crash: [0, 0], ruinP: 0 },
    { id: "growth", label: "個別の成長株", desc: "値動きが大きい。大きく伸びることも、ほぼ無価値になることもある。", mu: 0.15, sigma: 0.38, crashP: 0, crash: [0, 0], ruinP: 0.01 },
    { id: "crypto", label: "暗号資産(仮想通貨)", desc: "値動きがきわめて大きい。何倍にもなることも、ほぼ無価値になることもある。", mu: 0.12, sigma: 0.75, crashP: 0, crash: [0, 0], ruinP: 0.03 },
    { id: "bond", label: "債券・預金", desc: "値動きは小さいが、増え方もゆるやか。", mu: 0.012, sigma: 0.03, crashP: 0, crash: [0, 0], ruinP: 0 },
  ],
  // 貯金の増え方の仮定。手取りから生活費を引いた黒字の一部が貯金に回る。
  cashflow: {
    saveRate: 0.14,
    pension: 200,
    retiredNeed: 230,
    startSavings: [[15, 5], [18, 10], [22, 40], [28, 200], [35, 450], [45, 800], [60, 1200]],
    backgroundFactor: BG_FACTOR,
  },

  tags: [
    { id: "challenge", label: "挑戦する", keywords: /挑戦|起業|独立|留学|海外|転職|冒険|やってみ|賭け/ },
    { id: "stable", label: "安定を選ぶ", keywords: /安定|公務員|貯金|堅実|地元|守る|続け/ },
    { id: "learn", label: "学ぶ", keywords: /勉強|資格|大学|学ぶ|学び|研究|読書|習/ },
    { id: "bond", label: "人とつながる", keywords: /結婚|友|家族|恋|仲間|ボランティア|会い|支え/ },
    { id: "rest", label: "休む・整える", keywords: /休|旅|のんびり|療養|整え|ゆっくり|癒/ },
  ],

  stageLabel: (age, occ) =>
    occ === "retired" ? "仕事を退いた暮らし" : occ ? jpData.occLabel[occ] : age < 3 ? "乳幼児" : age < 6 ? "園児" : age < 12 ? "小学生" : age < 15 ? "中学生" : age < 18 ? "高校生" : age < 23 ? "学生" : age < 65 ? "仕事に就いていない暮らし" : "仕事を退いた暮らし",

  vignette,
  smallEvents,
  compose,
};
