import type { Person } from "@/lib/sim/types";

// 職種ごとの、階級・役職(昇進のはしご)。
// 実際の階級・役職の名前と順番にならった。昇任の年齢や確率は、設計上の仮定(試験・年数・欠員などで、実際は人によって大きく変わる)。
// 各段: [名前, 標準的に届く年齢, 前の段に最低いる年数, 条件がそろった年の昇任確率, 給料の倍率(最初の段=1), 印]
//   印: "rare" = まれにしか届かない(自動では割りあてない) / "exec" = 組織のトップなど、責任ある立場(あいだは、働き方の選択が出ない)
type Flag = "rare" | "exec" | "";
type StepDef = readonly [string, number, number, number, number, Flag?];
export type RankStep = { label: string; typ: number; minYears: number; chance: number; mult: number; rare: boolean; exec: boolean };
export type Ladder = { id: string; label: string; steps: RankStep[]; publicStyle: boolean };

const L = (id: string, label: string, publicStyle: boolean, defs: StepDef[]): Ladder => ({
  id,
  label,
  publicStyle,
  steps: defs.map(([n, typ, minYears, chance, mult, f]) => ({ label: n, typ, minYears, chance, mult, rare: f === "rare", exec: f === "exec" })),
});

export const LADDERS: Record<string, Ladder> = {
  // ---- 公安・公務(昇任試験と年数) ----
  police: L("police", "警察官", true, [
    ["巡査", 22, 0, 0, 1], ["巡査長", 27, 3, 0.35, 1.06], ["巡査部長", 31, 3, 0.22, 1.16], ["警部補", 38, 4, 0.14, 1.3], ["警部", 46, 5, 0.1, 1.48], ["警視", 52, 5, 0.07, 1.72],
    ["警視正", 56, 4, 0.04, 1.95, "rare"], ["警視長", 58, 3, 0.025, 2.2, "rare"], ["警視監", 59, 2, 0.015, 2.45, "rare"], ["警視総監", 60, 1, 0.006, 2.7, "exec"],
  ]),
  firefighter: L("firefighter", "消防士", true, [
    ["消防士", 22, 0, 0, 1], ["消防士長", 31, 4, 0.3, 1.12], ["消防司令補", 36, 4, 0.2, 1.26], ["消防司令", 43, 5, 0.12, 1.45], ["消防司令長", 50, 5, 0.07, 1.68],
    ["消防監", 55, 4, 0.04, 1.9, "rare"], ["消防正監", 57, 2, 0.02, 2.1, "rare"], ["消防総監", 59, 1, 0.006, 2.4, "exec"],
  ]),
  jsdf: L("jsdf", "自衛官", true, [
    ["3曹", 20, 0, 0, 1], ["2曹", 25, 3, 0.35, 1.07], ["1曹", 30, 4, 0.25, 1.16], ["曹長", 37, 5, 0.18, 1.28], ["准尉", 44, 5, 0.12, 1.4, "rare"], ["3尉", 46, 2, 0.12, 1.55, "rare"],
    ["2尉", 48, 3, 0.1, 1.68, "rare"], ["1尉", 50, 3, 0.08, 1.8, "rare"], ["3佐", 52, 3, 0.06, 1.95, "rare"], ["2佐", 54, 3, 0.04, 2.1, "rare"], ["1佐", 56, 3, 0.03, 2.3, "rare"],
    ["将補", 57, 2, 0.015, 2.55, "rare"], ["将", 59, 2, 0.01, 2.8, "rare"], ["統合幕僚長・幕僚長", 60, 1, 0.004, 3.1, "exec"],
  ]),
  coast_guard: L("coast_guard", "海上保安官", true, [
    ["三等海上保安士", 20, 0, 0, 1], ["二等海上保安士", 24, 3, 0.35, 1.07], ["一等海上保安士", 29, 4, 0.25, 1.16], ["三等海上保安正", 36, 6, 0.14, 1.34], ["二等海上保安正", 43, 5, 0.09, 1.55],
    ["一等海上保安正", 49, 5, 0.06, 1.78], ["三等海上保安監", 54, 4, 0.03, 2, "rare"], ["二等海上保安監", 57, 2, 0.015, 2.25, "rare"], ["海上保安監", 60, 2, 0.005, 2.6, "exec"],
  ]),
  prison_guard: L("prison_guard", "刑務官", true, [
    ["看守", 22, 0, 0, 1], ["看守部長", 29, 4, 0.3, 1.14], ["副看守長", 36, 5, 0.18, 1.3], ["看守長", 43, 5, 0.1, 1.5], ["矯正副長", 50, 5, 0.06, 1.72], ["矯正長", 55, 4, 0.03, 1.95, "rare"], ["矯正監", 58, 3, 0.01, 2.2, "exec"],
  ]),
  national_clerk: L("national_clerk", "国家公務員(一般職)", true, [
    ["係員", 22, 0, 0, 1], ["主任", 28, 4, 0.3, 1.1], ["係長", 34, 5, 0.22, 1.24], ["課長補佐", 42, 6, 0.12, 1.42], ["課長", 50, 6, 0.06, 1.7], ["部長・室長", 56, 4, 0.025, 1.95, "rare"],
  ]),
  bureaucrat: L("bureaucrat", "国家公務員(総合職)", true, [
    ["係員", 23, 0, 0, 1], ["係長", 26, 3, 0.55, 1.15], ["課長補佐", 30, 4, 0.4, 1.35], ["室長", 36, 5, 0.25, 1.6], ["課長", 42, 5, 0.15, 1.9], ["審議官", 50, 6, 0.06, 2.3, "rare"],
    ["局長", 54, 3, 0.03, 2.6, "rare"], ["事務次官", 58, 3, 0.008, 2.9, "exec"],
  ]),
  city_hall: L("city_hall", "地方公務員(一般行政職)", true, [
    ["主事", 22, 0, 0, 1], ["主任", 28, 4, 0.3, 1.1], ["係長", 34, 5, 0.22, 1.25], ["課長補佐", 41, 5, 0.14, 1.42], ["課長", 47, 5, 0.09, 1.65], ["部長", 53, 5, 0.05, 1.9, "rare"], ["局長・副市長級", 57, 3, 0.02, 2.15, "exec"],
  ]),
  diplomat: L("diplomat", "外交官", true, [
    ["書記官", 24, 0, 0, 1], ["一等書記官", 32, 6, 0.3, 1.3], ["参事官", 40, 6, 0.2, 1.6], ["公使", 48, 6, 0.1, 1.95, "rare"], ["大使", 54, 5, 0.05, 2.3, "exec"],
  ]),
  judge: L("judge", "裁判官・検察官", true, [
    ["判事補・検事", 27, 0, 0, 1], ["判事・検事", 37, 10, 0.4, 1.4], ["部総括判事・次席検事", 47, 8, 0.12, 1.75], ["地方裁判所長・検事正", 55, 6, 0.06, 2.05, "rare"],
    ["高等裁判所長官・検事長", 60, 4, 0.03, 2.4, "rare"], ["最高裁判所判事・検事総長", 64, 3, 0.01, 2.7, "exec"],
  ]),
  // ---- 教育・研究 ----
  school_teacher: L("school_teacher", "小・中学校の教員", true, [
    ["教諭", 23, 0, 0, 1], ["主幹教諭", 38, 8, 0.12, 1.15], ["教頭", 46, 5, 0.1, 1.3], ["校長", 54, 6, 0.1, 1.5, "exec"],
  ]),
  hs_teacher: L("hs_teacher", "高等学校の教員", true, [
    ["教諭", 23, 0, 0, 1], ["主幹教諭", 38, 8, 0.12, 1.15], ["教頭", 47, 5, 0.1, 1.3], ["校長", 55, 6, 0.1, 1.5, "exec"],
  ]),
  kindergarten: L("kindergarten", "幼稚園教員", false, [
    ["教諭", 22, 0, 0, 1], ["主任教諭", 33, 6, 0.15, 1.1], ["副園長", 43, 6, 0.1, 1.25], ["園長", 52, 6, 0.1, 1.4, "exec"],
  ]),
  childcare: L("childcare", "保育士", false, [
    ["保育士", 22, 0, 0, 1], ["主任保育士", 34, 6, 0.15, 1.12], ["副園長", 44, 6, 0.1, 1.28], ["園長", 52, 6, 0.1, 1.45, "exec"],
  ]),
  assoc_prof: L("assoc_prof", "大学・高専の教員", false, [
    ["助教", 29, 0, 0, 1], ["講師", 35, 5, 0.2, 1.15], ["准教授", 41, 6, 0.15, 1.35], ["教授", 49, 7, 0.1, 1.6],
  ]),
  prof: L("prof", "大学・高専の教授", false, [
    ["教授", 45, 0, 0, 1], ["学部長・研究科長", 56, 8, 0.07, 1.15, "rare"], ["副学長", 60, 3, 0.04, 1.25, "rare"], ["学長", 63, 3, 0.03, 1.4, "exec"],
  ]),
  researcher: L("researcher", "研究者", false, [
    ["研究員", 27, 0, 0, 1], ["主任研究員", 35, 5, 0.18, 1.2], ["主席研究員", 44, 7, 0.1, 1.45], ["研究所長・部長", 53, 7, 0.06, 1.75, "exec"],
  ]),
  // ---- 医療・福祉 ----
  doctor: L("doctor", "医師(勤務医)", false, [
    ["研修医", 24, 0, 0, 1], ["医員(専攻医)", 27, 2, 0.8, 1.3], ["医長", 38, 8, 0.15, 1.7], ["部長", 46, 6, 0.1, 2.0], ["副院長", 54, 6, 0.05, 2.3, "rare"], ["院長", 58, 3, 0.04, 2.6, "exec"],
  ]),
  nurse: L("nurse", "看護師", false, [
    ["看護師", 22, 0, 0, 1], ["主任", 31, 6, 0.18, 1.12], ["看護師長", 38, 6, 0.12, 1.3], ["副看護部長", 46, 6, 0.08, 1.45], ["看護部長", 52, 5, 0.08, 1.6, "exec"],
  ]),
  pharmacist: L("pharmacist", "薬剤師", false, [
    ["薬剤師", 24, 0, 0, 1], ["主任薬剤師", 32, 5, 0.18, 1.12], ["薬局長・薬剤科長", 38, 6, 0.14, 1.3], ["薬剤部長", 48, 8, 0.07, 1.5, "exec"],
  ]),
  care_worker: L("care_worker", "介護職員", false, [
    ["介護職員", 22, 0, 0, 1], ["リーダー", 28, 4, 0.2, 1.08], ["主任・ユニット長", 35, 5, 0.12, 1.2], ["施設長", 45, 8, 0.06, 1.4, "exec"],
  ]),
  // ---- 専門職(組織に勤める人) ----
  lawyer: L("lawyer", "弁護士(勤務)", false, [
    ["勤務弁護士", 28, 0, 0, 1], ["シニアアソシエイト", 33, 4, 0.3, 1.3], ["パートナー", 40, 7, 0.14, 1.8], ["代表パートナー", 52, 10, 0.05, 2.4, "exec"],
  ]),
  accountant: L("accountant", "公認会計士・税理士(勤務)", false, [
    ["スタッフ", 25, 0, 0, 1], ["シニア", 29, 3, 0.35, 1.2], ["マネージャー", 34, 5, 0.2, 1.5], ["パートナー", 42, 8, 0.08, 2, "rare"],
  ]),
  atc: L("atc", "航空管制官", true, [
    ["管制官", 23, 0, 0, 1], ["上席管制官", 33, 6, 0.2, 1.2], ["管制長", 43, 8, 0.1, 1.45], ["管制部長・センター長", 53, 8, 0.05, 1.7, "exec"],
  ]),
  clinic: L("clinic", "医療技術職", false, [
    ["スタッフ", 23, 0, 0, 1], ["主任", 31, 6, 0.18, 1.12], ["科長・技師長", 40, 7, 0.1, 1.3], ["部長", 50, 8, 0.05, 1.5, "exec"],
  ]),
  kitchen: L("kitchen", "料理・菓子の職人", false, [
    ["見習い", 18, 0, 0, 1], ["一人前の職人", 26, 6, 0.2, 1.2], ["板長・工房長", 36, 8, 0.1, 1.45], ["料理長・親方", 46, 8, 0.05, 1.7, "rare"],
  ]),
  // ---- 一般の会社(正社員)の、いくつかの型 ----
  corp: L("corp", "会社員", false, [
    ["一般社員", 22, 0, 0, 1], ["主任", 28, 3, 0.3, 1.07], ["係長", 33, 4, 0.22, 1.16], ["課長", 38, 4, 0.16, 1.3], ["次長", 44, 4, 0.09, 1.45], ["部長", 48, 4, 0.07, 1.62],
    ["執行役員", 52, 4, 0.025, 2.0, "rare"], ["取締役", 55, 3, 0.015, 2.5, "exec"],
  ]),
  tech: L("tech", "技術職(会社)", false, [
    ["エンジニア", 22, 0, 0, 1], ["シニアエンジニア", 29, 4, 0.28, 1.15], ["リード・主任", 34, 4, 0.2, 1.3], ["マネージャー", 40, 5, 0.12, 1.5], ["部長", 46, 5, 0.07, 1.7], ["執行役員・CTO", 52, 5, 0.02, 2.1, "exec"],
  ]),
  retail: L("retail", "店舗・サービス業", false, [
    ["スタッフ", 20, 0, 0, 1], ["リーダー", 25, 2, 0.3, 1.06], ["副店長", 30, 3, 0.2, 1.15], ["店長", 34, 3, 0.18, 1.3], ["エリアマネージャー", 42, 5, 0.08, 1.5], ["統括部長", 50, 6, 0.04, 1.75, "rare"],
  ]),
  factory: L("factory", "工場・ものづくり", false, [
    ["作業員", 20, 0, 0, 1], ["班長", 30, 6, 0.18, 1.1], ["係長・工長", 38, 6, 0.12, 1.22], ["課長", 46, 7, 0.07, 1.4], ["工場長", 53, 6, 0.04, 1.6, "rare"],
  ]),
  construction: L("construction", "建設・現場", false, [
    ["作業員", 20, 0, 0, 1], ["職長", 30, 6, 0.18, 1.12], ["現場代理人・主任技術者", 38, 6, 0.12, 1.3], ["所長", 46, 7, 0.07, 1.5], ["工事部長", 53, 6, 0.04, 1.75, "rare"],
  ]),
  driver: L("driver", "運転・運輸", false, [
    ["乗務員", 22, 0, 0, 1], ["指導役・班長", 33, 6, 0.15, 1.1], ["運行管理者", 40, 6, 0.1, 1.22], ["営業所長", 48, 7, 0.06, 1.4, "rare"],
  ]),
};

// 職種 → はしごの種類。ここにない職種は、大分類のきまり(下)で決める。
const BY_JOB: Record<string, string> = {
  police: "police", firefighter: "firefighter", jsdf: "jsdf", coast_guard: "coast_guard", prison_guard: "prison_guard", national_clerk: "national_clerk", bureaucrat: "bureaucrat", city_hall: "city_hall",
  diplomat: "diplomat", judge: "judge", school_teacher: "school_teacher", hs_teacher: "hs_teacher", kindergarten: "kindergarten", childcare: "childcare", assoc_prof: "assoc_prof", prof: "prof",
  researcher: "researcher", doctor: "doctor", nurse: "nurse", jr_nurse: "nurse", pharmacist: "pharmacist", care_worker: "care_worker", home_helper: "care_worker", lawyer: "lawyer", accountant: "accountant",
  software: "tech", electric_eng: "tech", machine_eng: "tech", transport_eng: "tech", chem_eng: "tech", arch_eng: "tech", civil_eng: "tech", sys_consultant: "tech", it_infra: "tech", data_sci: "tech", it_support: "tech",
  semiconductor: "factory", train_driver: "driver", bus_driver: "driver", taxi_driver: "driver", truck_big: "driver", truck: "driver",
  speech_therapist: "clinic", rehab: "clinic", radiology: "clinic", dental_hyg: "clinic", dietitian: "clinic", other_health: "clinic", air_traffic: "atc",
  tax_officer: "national_clerk", labor_inspector: "national_clerk", immigration: "national_clerk", court_clerk: "national_clerk", weather: "national_clerk", school_clerk: "city_hall",
  school_nurse: "school_teacher", special_teacher: "school_teacher", bank_clerk: "corp", ja_staff: "corp", actuary: "corp", cloud_eng: "tech", security_eng: "tech", product_manager: "tech", robot_eng: "tech", energy_eng: "tech", space_eng: "tech",
  sommelier: "retail", ground_staff: "retail", tour_conductor: "retail", sushi_chef: "kitchen", wagashi: "kitchen", patissier: "kitchen", brewer: "kitchen", welder: "factory",
  frame: "construction", carpenter: "construction", plumber: "construction", plasterer: "construction", electrician: "construction", civil_worker: "construction", crane: "construction",
  shop_clerk: "retail", beauty_advisor: "retail", waiter: "retail", barista: "retail", cook: "retail", hotel: "retail", fitness_staff: "retail", amusement: "retail",
};
// 大分類で、はしごがあるのは、会社に勤める事務・営業の仕事と、工場の仕事。
const BY_OCC: Record<string, string> = { office: "corp", sales: "corp", production: "factory" };
// はしごを持たない職種(フリー・自営・芸能・スポーツなど)。
const NONE = new Set(["manager", "politician", "ceo", "founder", "owner", "athlete", "streamer", "esports", "shogi", "artist", "musician", "composer", "singer", "idol", "actor", "voice_actor", "comedian", "model", "manga", "novelist", "journalist", "photographer", "designer", "web_designer", "film_director", "translator", "astronaut", "trader", "fp", "clergy", "game_creator", "interior", "entertainer", "tutor", "dancer", "stage_dir", "video_editor", "broadcast_writer", "analyst", "consultant", "secretary", "school_counselor", "curator", "other_pro", "other_teacher"]);

// その人に、はしごがあるか(正社員・公務員で、自営でない人だけ)。
export function ladderOf(p: Pick<Person, "job" | "occ" | "employment">): Ladder | null {
  if (!p.job || p.occ === null || p.occ === "retired") return null;
  if (p.employment !== "regular") return null;
  if (NONE.has(p.job)) return null;
  const key = BY_JOB[p.job] ?? BY_OCC[p.occ];
  return key ? (LADDERS[key] ?? null) : null;
}

// いまの階級(段の番号)。なければ 0。
export const rankIdx = (p: Pick<Person, "rank">) => p.rank?.idx ?? 0;
export function rankStep(p: Pick<Person, "job" | "occ" | "employment" | "rank">): RankStep | null {
  const l = ladderOf(p);
  if (!l) return null;
  return l.steps[Math.min(rankIdx(p), l.steps.length - 1)];
}
// 組織のトップなど、責任ある立場の段にいるか。
export const atExecRank = (p: Pick<Person, "job" | "occ" | "employment" | "rank">) => rankStep(p)?.exec === true;

// 途中から始める人(いま働いている人)の、はじめの段: 標準の年齢に届いている段(「まれ」な段は、割りあてない)。
export function initialRank(l: Ladder, age: number): number {
  let idx = 0;
  for (let i = 1; i < l.steps.length; i++) {
    const s = l.steps[i];
    if (s.rare || s.exec) break;
    if (s.typ <= age - 1) idx = i;
  }
  return idx;
}
