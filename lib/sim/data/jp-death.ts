import type { DeathNote, Person } from "@/lib/sim/types";

// 亡くなった原因の説明。数字は、公表されている統計の要約(だいたいの値)で、診断や治療の助言ではありません。
export type Disease = { label: string; summary: string; facts: string[]; source: { name: string; url: string } };

const MHLW_DEATH = { name: "厚生労働省「人口動態統計」(令和5年)", url: "https://www.mhlw.go.jp/toukei/saikin/hw/jinkou/kakutei23/index.html" };

export const DISEASES: Record<string, Disease> = {
  cancer: {
    label: "がん",
    summary: "体の細胞がもとの働きを失って増え続け、まわりの臓器をおかす病気です。胃・大腸・肺・乳房・前立腺など、できる場所で性質が大きくちがいます。",
    facts: ["日本人の死因の第1位で、亡くなる人の約4人に1人はがんです。", "全がんの5年相対生存率は2013〜2014年に診断された人で約67.5%です(早く見つかるほど治りやすい)。"],
    source: { name: "国立がん研究センター がん情報サービス/厚生労働省「人口動態統計」", url: "https://ganjoho.jp/public/index.html" },
  },
  heart: {
    label: "心臓の病気",
    summary: "心筋梗塞や心不全など、心臓の血管や筋肉の病気です。血管が詰まったり、心臓のポンプの力が弱まったりします。高血圧・糖尿病・脂質異常・喫煙などがきっかけになります。",
    facts: ["心疾患は日本人の死因の第2位で、亡くなる人の約15%にあたります。"],
    source: { name: "厚生労働省 e-ヘルスネット/「人口動態統計」(令和5年)", url: "https://www.e-healthnet.mhlw.go.jp/information/dictionary/metabolic/ym-017.html" },
  },
  stroke: {
    label: "脳の病気(脳卒中)",
    summary: "脳の血管が詰まる脳梗塞、破れる脳出血・くも膜下出血などです。突然おこり、命にかかわることも、後遺症が残ることもあります。",
    facts: ["脳血管疾患は死因のおよそ6〜7%を占めます。", "介護が必要になる主な原因のひとつでもあります。"],
    source: MHLW_DEATH,
  },
  pneumonia: {
    label: "肺炎",
    summary: "細菌やウイルスなどで、肺に炎症がおこる病気です。高齢になると、飲み込む力や免疫の力が弱まり、食べ物が気管に入って起こる誤嚥性肺炎も増えます。",
    facts: ["肺炎は死因のおよそ5%を占め、亡くなる人の大半は高齢者です。"],
    source: MHLW_DEATH,
  },
  senility: {
    label: "老衰",
    summary: "特定の病気ではなく、年をとって全身の機能が少しずつ衰えて、自然に亡くなることです。死亡診断書では、ほかに死因がはっきりしない高齢の方に使われます。",
    facts: ["日本人の死因の第3位(約12%)で、近年割合がふえています。"],
    source: MHLW_DEATH,
  },
  diabetes: {
    label: "糖尿病の合併症",
    summary: "血糖値の高い状態が長く続き、血管や神経がいたんで、心臓・腎臓・目などに合併症がおこる病気です。生活習慣と関わりの深い2型と、自分の免疫がインスリンをつくる細胞をこわす1型があります。",
    facts: ["日本糖尿病学会の調査(2001〜2010年)では、糖尿病の人の平均寿命は、そうでない人より男性で約8歳・女性で約11歳短いと報告されています。治療の進歩で差は縮まってきています。"],
    source: { name: "日本糖尿病学会「糖尿病の死因に関する委員会」報告", url: "https://www.jds.or.jp/" },
  },
  congenital: {
    label: "生まれつきの心臓の病気",
    summary: "生まれつき、心臓や太い血管のつくりに異常がある病気です。軽いものから手術が必要なものまで、重さはさまざまです。",
    facts: ["生まれる赤ちゃんの約1%にみられ、治療の進歩で約9割が成人になります。", "大人になってからも、定期的な診察が欠かせない人がたくさんいます。"],
    source: { name: "厚生労働科学研究成果データベース(先天性心疾患の研究班資料)", url: "https://mhlw-grants.niph.go.jp/" },
  },
  intractable: {
    label: "難病",
    summary: "原因がはっきりせず、治療法が確立されていない、長く続く病気です。膠原病など、国が「指定難病」として、医療費を助成するものが300をこえます。",
    facts: ["指定難病の患者は、全国で100万人をこえます(医療費の助成を受けている人)。"],
    source: { name: "厚生労働省 難病情報センター", url: "https://www.nanbyou.or.jp/" },
  },
  illness: {
    label: "病気",
    summary: "さまざまな病気が重なって、体の力が落ちていったことをまとめて「病気」としています。",
    facts: ["日本人の死因の上位は、がん・心疾患・老衰・脳血管疾患・肺炎で、あわせて全体の約7割になります。"],
    source: MHLW_DEATH,
  },
  longillness: {
    label: "長い闘病",
    summary: "深刻な病気が見つかってから、長いあいだ治療を続けながら暮らし、亡くなったことを表しています。",
    facts: ["がん・心疾患・脳血管疾患など、長く付き合う病気が日本人の死因の上位を占めます。"],
    source: MHLW_DEATH,
  },
  traffic: {
    label: "交通事故",
    summary: "車・バイク・自転車・歩行中などの、交通事故です。",
    facts: ["交通事故の死者は、1970年の約1万7千人から大きく減り、2023年は約2,700人です。", "亡くなる人の半数をこえるのは65歳以上の高齢者です。"],
    source: { name: "警察庁「交通事故統計」", url: "https://www.npa.go.jp/publications/statistics/koutsuu/index.html" },
  },
  work: {
    label: "仕事中の事故",
    summary: "建設・運輸・工場・農林などの現場で起こりやすい事故です。",
    facts: ["仕事中の事故で亡くなる人は、年に700〜800人台で、建設業・製造業・運輸業に多くなっています。"],
    source: { name: "厚生労働省「労働災害統計」", url: "https://www.mhlw.go.jp/bunya/roudoukijun/anzeneisei11/rousai-hassei/" },
  },
  water: {
    label: "水の事故",
    summary: "海・川・湖・プールなど、水辺でのおぼれる事故です。",
    facts: ["水の事故は夏に多く、子どもと高齢者に注意が必要です。"],
    source: { name: "警察庁「水難の概況」", url: "https://www.npa.go.jp/publications/statistics/safetylife/chiiki.html" },
  },
  mountain: {
    label: "山や海の遭難",
    summary: "登山や海のレジャーでの、遭難や転落です。",
    facts: ["山岳遭難は中高年に多く、道に迷う・転ぶ・滑るが主な原因です。"],
    source: { name: "警察庁「山岳遭難の概況」", url: "https://www.npa.go.jp/publications/statistics/safetylife/chiiki.html" },
  },
  disaster: {
    label: "災害",
    summary: "地震・津波・豪雨・台風などの自然災害です。",
    facts: ["日本は地震や風水害の多い国で、災害の備え(家具の固定や避難の確認、保険)が被害をへらします。"],
    source: { name: "内閣府「防災白書」", url: "https://www.bousai.go.jp/kaigirep/hakusho/index.html" },
  },
  crime: {
    label: "事件に巻き込まれた",
    summary: "思いがけない事件に巻き込まれたことです。",
    facts: ["日本の殺人の件数は長期的に減っており、世界でも低い水準です。"],
    source: { name: "警察庁「警察白書」", url: "https://www.npa.go.jp/hakusyo/index.html" },
  },
};

// 原因ごとの、説明のもと(表示名から対応させる)。
export const DISEASE_BY_LABEL: Record<string, string> = {
  がん: "cancer",
  心臓の病気: "heart",
  脳の病気: "stroke",
  肺炎: "pneumonia",
  老衰: "senility",
  糖尿病の合併症: "diabetes",
  生まれつきの心臓の病気: "congenital",
  難病: "intractable",
  病気: "illness",
  長い闘病: "longillness",
  交通事故: "traffic",
  仕事中の事故: "work",
  水の事故: "water",
  山や海の遭難: "mountain",
  災害: "disaster",
  事件に巻き込まれた: "crime",
  急な心臓や脳の病気: "heart",
};

// 亡くなった「理由」: その人の持病・健康・暮らしから、重なっていたことを、並べる。
export function deathReasons(p: Person, label: string, isSudden: boolean, ailmentLabel: string, conditionLabel: string, jobTitle: string | null): string[] {
  const out: string[] = [];
  if (isSudden) {
    out.push("ふいの出来事で、前ぶれはなかった(突然の出来事は乱数で決まります)");
    if (label === "交通事故" && (p.region === "rural" || p.region === "local")) out.push("車が欠かせない地域で暮らしていて、交通事故にあう機会が多かった");
    if (label === "仕事中の事故" && jobTitle) out.push(`事故の多い仕事(${jobTitle})に就いていた`);
    if ((label === "急な心臓や脳の病気") && p.stats.health < 55) out.push(`健康度が低く(${Math.round(p.stats.health)})、心臓や脳に負担がかかっていた`);
    if (label === "急な心臓や脳の病気" && ailmentLabel) out.push(`持病(${ailmentLabel})があった`);
    return out;
  }
  if (conditionLabel) out.push(`生まれつきの持病(${conditionLabel})があった`);
  if (ailmentLabel) out.push(`持病(${ailmentLabel})があった`);
  if (p.sick) out.push(`深刻な病気が見つかり、${Math.max(0, p.age - (p.history.sick ?? p.age))}年たっていた`);
  if (p.mood === "depressed") out.push("うつ状態が続き、体の力も落ちていた");
  if (p.stats.health < 40) out.push(`健康度が低かった(${Math.round(p.stats.health)})`);
  if (p.habit) out.push(({ gamble: "ギャンブルにのめり込み、心身がすり減っていた", smoke: "長年の喫煙が、体に負担をかけていた", drink: "長年の飲酒が、体に負担をかけていた" } as const)[p.habit.kind]);
  if (p.age - (p.history.overtime ?? -99) <= 6) out.push("長いあいだ、無理のある働き方が続いていた");
  if (p.age >= 80) out.push("高齢で、体の力が自然に衰えていた");
  else if (p.age >= 65 && out.length === 0) out.push("年齢とともに、病気にかかりやすくなっていた");
  if (out.length === 0) out.push("とくに大きな持病はなく、年齢の割に早いまれなケース(確率で決まります)");
  return out;
}

export const buildDeathNote = (p: Person, label: string, isSudden: boolean, ailmentLabel: string, conditionLabel: string, jobTitle: string | null): DeathNote => ({
  cause: label,
  disease: DISEASE_BY_LABEL[label] ?? "illness",
  reasons: deathReasons(p, label, isSudden, ailmentLabel, conditionLabel, jobTitle),
});
