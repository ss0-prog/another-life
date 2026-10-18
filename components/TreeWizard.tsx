"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dropdown, type DropdownItem } from "@/components/Dropdown";
import { JobPicker } from "@/components/JobPicker";
import { chipClass, numberInputClass, primaryButtonClass } from "@/components/controls";
import { IDEAL, idealChance, MBTI_NAME, typeLabel } from "@/lib/sim/mbti";
import { soften } from "@/lib/jp";
import { SURVEY, type SurveyKey } from "@/lib/sim/survey";
import { HS_FIELDS, UNIV_FIELDS, VOC_FIELDS } from "@/lib/sim/data/jp-majors";
import { DEFAULT_JOB, OCC_LABEL } from "@/lib/sim/data/jp-jobs";
import { jpData } from "@/lib/sim/data/jp";
import { branchAsk } from "@/lib/sim/data/jp-turning";
import type { Ailment, Branch, DebtAnswer, HousingAnswer, Major, Marital, BranchKind, Condition, School, CurrentSelf, Edu, Occ, Region, Sex } from "@/lib/sim/types";

type Props = {
  t: {
    title: string;
    back: string;
    next: string;
    skip: string;
    start: string;
    summary: string;
    root: string;
    real: string;
    rememberLogin: string;
    remember: string;
    remembered: string;
    rememberFailed: string;
    rememberOff: string;
  };
  onSubmit: (self: CurrentSelf, branch: Branch) => void;
  prefill?: CurrentSelf | null;
  auth: { enabled: boolean; loggedIn: boolean; login: () => Promise<boolean>; remember: (self: CurrentSelf, branch: Branch) => Promise<boolean> };
};

// ---- 答えの集まり ----
type Values = {
  age?: number;
  prefecture?: string;
  sex?: Sex;
  condition?: Condition;
  ailment?: Ailment;
  school?: School;
  yearsLeft?: number;
  mbti?: string | null;
  edu?: string; // 学歴の答え(junior_high / hs_work / vocational / univ / grad / dropout)
  marital?: string;
  debt?: string;
  occ?: string; // 職種の id(または "none" = 働いていない)
  job?: string | null;
  workStyle?: "private" | "public" | "self" | "nonregular";
  region?: Region;
  housing?: HousingAnswer;
  married?: boolean;
  kids?: number;
  majorCat?: string;
  field?: string;
  feel?: string;
  tie?: string;
  body?: string;
  wealth?: string;
  habit?: string;
  kidAge1?: number;
  kidAge2?: number;
  kidAge3?: number;
  kidSex1?: string;
  kidSex2?: string;
  kidSex3?: string;
  partnerName?: string;
  savings?: number | null;
  kind?: BranchKind;
  branchAge?: number;
  motive?: string;
  option?: string;
};

type Opt = { value: string; label: string; sub?: string };
type Step = {
  id: keyof Values;
  node: string; // 木に出す、短い見出し
  q: string;
  prompt: string;
  input: "chips" | "number" | "select" | "optionalNumber" | "optionalText";
  withSex?: boolean; // 数字(年齢)と一緒に、子どもの性別も聞く
  options?: Opt[];
  groups?: { label: string; options: Opt[] }[];
  min?: number;
  max?: number;
  unit?: string;
  default?: number;
  label: (raw: string) => string; // 木に出す、答えの文字
};

const MBTI = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"];
const optLabel = (opts: Opt[], v: string) => opts.find((o) => o.value === v)?.label ?? v;

const SEX: Opt[] = [{ value: "female", label: "女性" }, { value: "male", label: "男性" }, { value: "none", label: "答えない" }];
const EDU: Opt[] = [
  { value: "junior_high", label: "中学卒" },
  { value: "hs_work", label: "高校卒" },
  { value: "vocational", label: "専門学校・短大・高専卒" },
  { value: "univ", label: "大学卒" },
  { value: "grad", label: "大学院卒" },
  { value: "dropout", label: "高校・大学を中退した" },
];
const MARITAL: Opt[] = [
  { value: "no", label: "していない(未婚)" },
  { value: "yes", label: "している" },
  { value: "partnered", label: "事実婚・パートナーと同居(籍は入れていない)" },
  { value: "divorced", label: "離婚した" },
  { value: "widowed", label: "死別した" },
];
const DEBT: Opt[] = [
  { value: "none", label: "ない" },
  { value: "scholarship", label: "奨学金・ローンが少しある(約300万円)" },
  { value: "several", label: "数百万円ある(約500万円)" },
  { value: "huge", label: "1,000万円以上ある" },
];
const REGION: Opt[] = (Object.keys(jpData.regionLabel) as Region[]).map((r) => ({ value: r, label: jpData.regionLabel[r] }));
const HOUSING: Opt[] = [
  { value: "owned", label: "持ち家" },
  { value: "rent", label: "賃貸" },
  { value: "parents", label: "実家" },
  { value: "lodging", label: "居候(友人や親戚の家)" },
  { value: "dorm", label: "寮・社宅" },
  { value: "share", label: "シェアハウス" },
  { value: "facility", label: "施設・病院で暮らしている" },
  { value: "homeless", label: "定まった住まいがない" },
];
const SCHOOL: Opt[] = [
  { value: "none", label: "通っていない(卒業した)" },
  { value: "hs", label: "高校" },
  { value: "vocational", label: "専門学校" },
  { value: "univ", label: "大学" },
  { value: "grad", label: "大学院" },
];
const YEARS_LEFT: Opt[] = [
  { value: "1", label: "1年以内" },
  { value: "2", label: "あと2年" },
  { value: "3", label: "あと3年" },
  { value: "4", label: "あと4年" },
  { value: "6", label: "5年以上" },
];
const SCHOOL_EDU: Record<Exclude<School, "none">, Edu> = { hs: "hs_work", vocational: "vocational", univ: "univ", grad: "grad" };
const WORK: Opt[] = [{ value: "private", label: "民間の会社など" }, { value: "public", label: "公務員" }, { value: "self", label: "自営・独立" }, { value: "nonregular", label: "パート・派遣・契約など(非正規)" }];
const KINDS = Object.keys(jpData.branches) as BranchKind[];
// 職種の検索に使う、名前の手がかり(正規表現)。
const jobKw: Record<string, RegExp | undefined> = Object.fromEntries(jpData.jobs.map((j) => [j.id, j.kw]));

// ---- 答える詳しさ: 1 = かんたん / 2 = ふつう / 3 = くわしく ----
// かんたんは、最低限の質問だけ。答えなかった項目は、年齢や住んでいる場所から、ふつうの値でおぎなう。
export type Level = 1 | 2 | 3;
export const LEVELS: { level: Level; name: string; sub: string; note: string }[] = [
  { level: 1, name: "かんたん", sub: "約11問・1分", note: "年齢・仕事・結婚など最低限だけ。まず試してみたい人に。" },
  { level: 2, name: "ふつう", sub: "約18問・2分", note: "住まい・貯金・持病なども答える。結果があなたに近づく。" },
  { level: 3, name: "くわしく", sub: "約27問・4分", note: "専攻・性格・いまの暮らしの感覚まで。いちばんあなたに近い。" },
];
const STEP_LEVEL: Partial<Record<keyof Values, Level>> = {
  condition: 2, ailment: 2, workStyle: 2, region: 2, housing: 2, kids: 2, savings: 2, debt: 2,
  mbti: 3, majorCat: 3, field: 3, partnerName: 3, kidAge1: 3, kidAge2: 3, kidAge3: 3, feel: 3, tie: 3, body: 3, wealth: 3, habit: 3,
};
const levelOf = (id: keyof Values): Level => STEP_LEVEL[id] ?? 1;
const LEVEL_KEY = "betsu-uchu:level";
// 答えなかった項目の、おぎない(いまの住んでいる場所など)。
const regionOf = (prefecture: string): Region => jpData.prefectures.find((p) => p.name === prefecture)?.region ?? "local";

function stepsFor(v: Values, selfAge: number | undefined, level: Level = 3): Step[] {
  // 90歳以上は、もう働けない(仕事の選択肢には、「働いていない」「専業」「退職」だけを出す)。
  const tooOld = (selfAge ?? 0) >= 90;
  return allStepsFor(v, selfAge)
    .filter((s) => levelOf(s.id) <= level)
    .map((s) => (s.id === "occ" && tooOld && s.groups ? { ...s, options: s.groups[0].options, groups: [s.groups[0]], prompt: "90歳をこえると仕事を続けることは、難しくなります。いまの暮らしを選んでください。" } : s));
}

function allStepsFor(v: Values, selfAge: number | undefined): Step[] {
  // 18歳未満は、学歴・仕事・結婚・貯金などは聞かない(学生で、実家で暮らす前提)。
  const minor = (selfAge ?? 99) < 18;
  const steps: Step[] = [
    { id: "age", node: "いまの年齢", q: "いま何歳ですか?", prompt: "10歳から90歳まで遊べます。あなたの「いま」からはじめます。", input: "number", min: 10, max: 90, unit: "歳", label: (r) => `${r}歳` },
    { id: "prefecture", node: "生まれた場所", q: "どこで生まれましたか?", prompt: "生まれた都道府県を選んでください。", input: "select", options: jpData.prefectures.map((p) => ({ value: p.name, label: p.name })), label: (r) => `${r}生まれ` },
    { id: "sex", node: "性別", q: "性別を教えてください。", prompt: "平均寿命や賃金の統計の計算に使います。答えなくても進めます。", input: "chips", options: SEX, label: (r) => optLabel(SEX, r) },
    {
      id: "condition",
      node: "先天性の持病",
      q: "先天性の持病はありますか?",
      prompt: "生まれつきの持病は健康や寿命にわずかに影響します。答えたくなければ「とくになし」を選んでください。",
      input: "chips",
      options: jpData.conditions.map((c) => ({ value: c.id, label: c.label })),
      label: (r) => (r === "none" ? "持病なし" : (jpData.conditions.find((c) => c.id === r)?.label ?? r)),
    },
    {
      id: "ailment",
      node: "いまの持病",
      q: "現在持病はありますか?",
      prompt: "いま通院や治療をしている病気です(先天性とは別。生活習慣や年齢でかかったものを含みます)。健康や寿命、収入にあたえる影響はゲーム内の目安です。",
      input: "chips",
      options: jpData.ailments.map((a) => ({ value: a.id, label: a.label })),
      label: (r) => (r === "none" ? "持病なし" : (jpData.ailments.find((a) => a.id === r)?.label ?? r)),
    },
    { id: "mbti", node: "MBTI", q: "MBTIはわかりますか?", prompt: "性格タイプの診断です。人づきあいや選択の傾向に少しだけ影響します。わからなければ飛ばせます。", input: "chips", options: [{ value: "", label: "わからない・答えない" }, ...MBTI.map((m) => ({ value: m, label: m, sub: MBTI_NAME[m] }))], label: (r) => (r ? typeLabel(r) : "MBTIなし") },
  ];
  if (!minor) {
    steps.push({ id: "school", node: "学校", q: "いま学校に通っていますか?", prompt: "在学中ならその学校を選んでください。卒業後の進路や就職は人生の中で選べます。", input: "chips", options: SCHOOL, label: (r) => (r === "none" ? "在学していない" : `${optLabel(SCHOOL, r)}に在学中`) });
  }
  if (!minor && v.school && v.school !== "none") {
    steps.push({ id: "yearsLeft", node: "卒業まで", q: "卒業まであと何年ですか?", prompt: "卒業した年から働き始めます。", input: "chips", options: YEARS_LEFT, label: (r) => (Number(r) <= 1 ? "1年以内に卒業" : `卒業まであと${Number(r) >= 6 ? "5年以上" : r + "年"}`) });
  }
  if (!minor && v.school === "none") {
    steps.push(
    { id: "edu", node: "最終学歴", q: "最終学歴を教えてください。", prompt: "給料や就ける仕事の計算に使います。", input: "chips", options: EDU, label: (r) => optLabel(EDU, r) },
    {
      id: "occ",
      node: "いまの仕事",
      q: "いまの仕事は?",
      prompt: "書いて探す・声で探す・五十音から探す・分類から選ぶ、のどれでも選べます。「動物が好き」のような好きなことからも探せます。",
      input: "select",
      options: [{ value: "none", label: "働いていない(求職中など)" }, { value: "homemaker", label: "専業主婦・主夫" }, { value: "retired", label: "仕事を退いて年金などで暮らしている" }, ...jpData.jobs.map((j) => ({ value: j.id, label: j.title }))],
      groups: [
        { label: "", options: [{ value: "none", label: "働いていない(求職中など)" }, { value: "homemaker", label: "専業主婦・主夫" }, { value: "retired", label: "仕事を退いて年金などで暮らしている" }] },
        ...(Object.keys(OCC_LABEL) as Occ[]).map((o) => ({ label: OCC_LABEL[o], options: jpData.jobs.filter((j) => j.occ === o).map((j) => ({ value: j.id, label: j.title })) })),
      ],
      label: (r) => (r === "none" ? "働いていない" : r === "homemaker" ? "専業主婦・主夫" : r === "retired" ? "退職して年金暮らし" : (jpData.jobs.find((j) => j.id === r)?.title ?? r)),
    }
    );
  }
  if (!minor && v.school === "none" && v.occ && v.occ !== "none" && v.occ !== "homemaker" && v.occ !== "retired") {
    steps.push({ id: "workStyle", node: "働き方", q: "勤め先は?", prompt: "民間・公務員・自営で収入の安定や昇進のしかたが変わります。", input: "chips", options: WORK, label: (r) => optLabel(WORK, r) });
  }
  // 専攻・学科: 大学・大学院は、分野 → 専攻。専門学校・高校は、分野・学科。卒業後の進路の候補に使う。
  if (!minor) {
    const student = !!v.school && v.school !== "none";
    const lvl: "univ" | "voc" | "hs" | null = student
      ? v.school === "hs"
        ? "hs"
        : v.school === "vocational"
          ? "voc"
          : "univ"
      : v.school === "none"
        ? v.edu === "univ" || v.edu === "grad"
          ? "univ"
          : v.edu === "vocational"
            ? "voc"
            : v.edu === "hs_work"
              ? "hs"
              : null
        : null;
    const now = student ? "いま、" : "これまで、";
    const skip = { value: "", label: "わからない・その他" };
    if (lvl === "univ") {
      steps.push({ id: "majorCat", node: "専攻の分野", q: `${now}どの分野を学んでいますか?`.replace("学んでいますか", student ? "学んでいますか" : "学びましたか"), prompt: "大学・大学院の専攻の大まかな分野です。このあと詳しい専攻を聞きます。卒業後の進路(就ける職種)の候補に使います。", input: "chips", options: [...UNIV_FIELDS.map((c) => ({ value: c.id, label: c.label })), skip], label: (r) => UNIV_FIELDS.find((c) => c.id === r)?.label ?? "分野は未回答" });
      const cat = UNIV_FIELDS.find((c) => c.id === v.majorCat);
      if (v.majorCat !== undefined && cat) steps.push({ id: "field", node: "専攻", q: "詳しい専攻はどれにいちばん近いですか?", prompt: `${cat.label}のなかから選びます。`, input: "chips", options: [...cat.details.map((d) => ({ value: d.id, label: d.label })), skip], label: (r) => cat.details.find((d) => d.id === r)?.label ?? "専攻は未回答" });
    } else if (lvl === "voc") {
      steps.push({ id: "field", node: "専攻", q: student ? "専門学校・短大・高専で何を学んでいますか?" : "専門学校・短大・高専で何を学びましたか?", prompt: "学んだ分野です。卒業後の進路(就ける職種)の候補に使います。", input: "chips", options: [...VOC_FIELDS.map((d) => ({ value: d.id, label: d.label })), skip], label: (r) => VOC_FIELDS.find((d) => d.id === r)?.label ?? "分野は未回答" });
    } else if (lvl === "hs") {
      steps.push({ id: "field", node: "学科", q: student ? "高校ではどの学科で学んでいますか?" : "高校ではどの学科で学びましたか?", prompt: "学科です。卒業後の進路(就ける職種)の候補に使います。", input: "chips", options: [...HS_FIELDS.map((d) => ({ value: d.id, label: d.label })), skip], label: (r) => HS_FIELDS.find((d) => d.id === r)?.label ?? "学科は未回答" });
    }
  }
  steps.push({ id: "region", node: "住んでいる場所", q: "いまどんな地域に住んでいますか?", prompt: "大都市・地方などおおまかな分類です。給料や物価、仕事の探しやすさが変わります。", input: "chips", options: REGION, label: (r) => optLabel(REGION, r) });
  if (!minor)
    steps.push(
    { id: "housing", node: "住まい", q: "住まいは?", prompt: "持ち家・賃貸・実家のどれか。毎年の出費や貯金のたまり方が変わります。", input: "chips", options: HOUSING, label: (r) => optLabel(HOUSING, r) },
    { id: "married", node: "結婚", q: "結婚していますか?", prompt: "家族の状況は収入や支出、つながりに影響します。", input: "chips", options: MARITAL, label: (r) => optLabel(MARITAL, r) },
  );
  if (!minor && (v.marital === "yes" || v.marital === "partnered")) steps.push({ id: "partnerName", node: "配偶者", q: v.marital === "partnered" ? "パートナーの名前を書きますか?" : "配偶者の名前を書きますか?", prompt: "書かなくても大丈夫です(空欄なら、名前はランダムに決まります)。もうひとりのあなたも分岐の時点で結婚していれば、この人と暮らしています。", input: "optionalText", label: (r) => (r ? `配偶者は${r}さん` : "配偶者の名前は未記入") });
  if (!minor && v.marital && v.marital !== "no") steps.push({ id: "kids", node: "子ども", q: "お子さんは?", prompt: "", input: "chips", options: [0, 1, 2, 3].map((n) => ({ value: String(n), label: `${n}${n === 3 ? "人以上" : "人"}` })), label: (r) => `子ども${r}人` });
  if (!minor && v.marital && v.marital !== "no" && (v.kids ?? 0) > 0) {
    for (let i = 1; i <= (v.kids ?? 0); i++) {
      const key = `kidAge${i}` as "kidAge1" | "kidAge2" | "kidAge3";
      steps.push({ id: key, node: `第${i}子`, q: `第${i}子はあなたが何歳のときに生まれましたか?`, prompt: i === 1 ? "年齢と性別を答えます。ターニングポイントよりも前に生まれていた子どもは、もうひとりのあなたにもいます(名前は、まだありません)。" : "年齢と性別を答えます。", input: "number", withSex: true, min: 15, max: selfAge ?? 90, unit: "歳", default: Math.max(18, (selfAge ?? 30) - 4 * i), label: (r) => { const [age, sx] = r.split("|"); return `第${i}子は${age}歳のとき${sx === "boy" ? "(男子)" : sx === "girl" ? "(女子)" : ""}`; } });
    }
  }
  if (!minor) steps.push({ id: "savings", node: "資産", q: "いまの資産は?", prompt: "預貯金や投資などいま持っているお金の合計です。わかる範囲で。空欄なら年齢から見積もります。", input: "optionalNumber", min: 0, unit: "万円", label: (r) => (r === "" ? "資産は見積もり" : `資産${Number(r).toLocaleString("ja-JP")}万円`) });
  if (!minor) steps.push({ id: "debt", node: "借金", q: "借金(奨学金・ローンなど)はありますか?", prompt: "住宅ローンを除くいまの借金です。答えたくなければ「ない」で進めます。", input: "chips", options: DEBT, label: (r) => optLabel(DEBT, r) });
  // 事前の調査: いまの暮らしの感覚を聞く(はじまりの能力値になる)。答えたくなければ、飛ばせる。
  for (const sq of SURVEY) {
    steps.push({
      id: sq.key,
      node: sq.node,
      q: sq.q,
      prompt: sq.prompt,
      input: "chips",
      options: [...sq.options.map((o) => ({ value: o.value, label: o.label })), { value: "", label: "わからない・答えない" }],
      label: (r) => `${sq.node}: ${sq.options.find((o) => o.value === r)?.label ?? "未回答"}`,
    });
  }
  steps.push({ id: "kind", node: "ターニングポイント", q: "あなたの人生のターニングポイントは?", prompt: "「あのとき別の道を選んでいたら」と思う場面を、大まかに選びます。このあとそのときの思いと具体的な道を、順に聞きます。ここからもうひとりのあなたの人生が始まります。", input: "chips", options: KINDS.filter((k) => (selfAge ?? 99) > jpData.branches[k].minAge).map((k) => ({ value: k, label: jpData.branches[k].label })), label: (r) => `ターニングポイント: ${jpData.branches[r as BranchKind].label}` });
  if (v.kind) {
    const age = selfAge ?? 30;
    steps.push({ id: "branchAge", node: "分岐した年齢", q: "それは何歳のときでしたか?", prompt: "あなたの今より前の年齢を入れてください。", input: "number", min: jpData.branches[v.kind].minAge, max: age - 1, unit: "歳", default: Math.max(jpData.branches[v.kind].minAge, Math.min(jpData.branches[v.kind].defaultAge, age - 1)), label: (r) => `${r}歳のとき` });
  }
  if (v.kind && v.branchAge !== undefined) {
    const br = jpData.branches[v.kind];
    steps.push({ id: "motive", node: "そのときの思い", q: "そのときどんな思いがありましたか?", prompt: v.kind === "job" ? "ここで具体的な職種の候補が絞られます。" : "ここで具体的な道の候補が絞られます。", input: "chips", options: br.motives.map((m) => ({ value: m.id, label: branchAsk[`${v.kind}.motive.${m.id}`] ?? m.label, sub: m.note })), label: (r) => br.motives.find((m) => m.id === r)?.label ?? r });
  }
  if (v.kind && v.branchAge !== undefined && v.motive) {
    const br = jpData.branches[v.kind];
    const motive = br.motives.find((m) => m.id === v.motive);
    const selfLike = selfFrom(v);
    if (v.kind === "job") {
      // 仕事の分岐は、思いに合う職種から、具体的に選ぶ。
      const jobs = jpData.jobs.filter((j) => (!motive?.jobFilter || motive.jobFilter(j, selfLike)) && (!selfLike || j.id !== selfLike.job));
      const occs = (Object.keys(OCC_LABEL) as Occ[]).filter((o) => jobs.some((j) => j.occ === o));
      steps.push({
        id: "option",
        node: "選ばなかった職種",
        q: "具体的にはどの職種に進みたかったですか?",
        prompt: `${jobs.length}の職種から選べます。書く・声・五十音・分類のどれでも探せます。あなたが実際に就いた仕事はここには出ません。`,
        input: "select",
        options: jobs.map((j) => ({ value: j.id, label: j.title })),
        groups: occs.map((o) => ({ label: OCC_LABEL[o], options: jobs.filter((j) => j.occ === o).map((j) => ({ value: j.id, label: j.title })) })),
        label: (r) => jpData.jobs.find((j) => j.id === r)?.title ?? r,
      });
    } else {
      let options = br.options.filter((o) => (!motive?.options || motive.options.includes(o.id)) && (!selfLike || !o.matches(selfLike)));
      // その思いに合う道が、ほかにないとき(すでに、いちばん上の学歴など)は、いまの道以外の、すべての道から選べる。
      if (options.length === 0) options = br.options.filter((o) => !selfLike || !o.matches(selfLike));
      steps.push({ id: "option", node: "選ばなかった道", q: "具体的にはどの道を選びたかったですか?", prompt: "あなたが実際に歩んだ道はここには出ません。", input: "chips", options: options.map((o) => ({ value: o.id, label: branchAsk[`${v.kind}.option.${o.id}`] ?? o.label })), label: (r) => br.options.find((o) => o.id === r)?.label ?? r });
    }
  }
  return steps;
}

// 事前の調査の答え(答えなかった項目は、入れない)。
function surveyOf(v: Values): CurrentSelf["survey"] {
  const out: NonNullable<CurrentSelf["survey"]> = {};
  for (const k of ["feel", "tie", "body", "wealth", "habit"] as SurveyKey[]) if (v[k]) out[k] = v[k];
  return Object.keys(out).length ? out : undefined;
}

function selfFrom(v0: Values): CurrentSelf | null {
  if (v0.age === undefined || !v0.prefecture || !v0.sex) return null;
  // 答えなかった項目は、ふつうの値でおぎなう。
  const v = { ...v0, age: v0.age, prefecture: v0.prefecture, sex: v0.sex, condition: v0.condition ?? ("none" as Condition), region: v0.region ?? regionOf(v0.prefecture) };
  if (v.age < 18) {
    // 18歳未満: 学生で、実家で暮らし、未婚で、貯金は年齢から見積もる。
    return { age: v.age, ailment: v.ailment ?? "none", school: "none", prefecture: v.prefecture, sex: v.sex, condition: v.condition, mbti: v.mbti || null, edu: "univ", occ: "none", job: null, workStyle: "private", region: v.region, housing: "parents", married: false, kids: 0, savings: null, survey: surveyOf(v) };
  }
  if (!v.school || v.marital === undefined) return null;
  const housing: HousingAnswer = v.housing ?? (v.age < 25 ? "parents" : "rent");
  const student = v.school !== "none";
  if (student ? v.yearsLeft === undefined : !v.edu || !v.occ) return null;
  const edu: Edu = student ? SCHOOL_EDU[v.school as Exclude<School, "none">] : v.edu === "junior_high" || v.edu === "dropout" ? "hs_work" : (v.edu as Edu);
  const marital: Marital = v.marital === "yes" ? "married" : v.marital === "divorced" || v.marital === "widowed" || v.marital === "partnered" ? v.marital : "single";
  const hasKids = marital !== "single";
  const jobDef = student || v.occ === "none" || v.occ === "homemaker" || v.occ === "retired" ? undefined : jpData.jobs.find((j) => j.id === v.occ);
  const occ: Occ | "none" = student || !jobDef ? "none" : jobDef.occ;
  return {
    ailment: v.ailment ?? "none",
    school: v.school,
    yearsLeft: student ? v.yearsLeft : undefined,
    age: v.age,
    prefecture: v.prefecture,
    sex: v.sex,
    condition: v.condition,
    mbti: v.mbti || null,
    edu,
    occ,
    job: jobDef ? jobDef.id : null,
    workStyle: occ === "none" ? "private" : (v.workStyle ?? "private"),
    region: v.region,
    housing,
    married: marital === "married",
    marital,
    retired: v.occ === "retired" && !student ? true : undefined,
    homemaker: v.occ === "homemaker" && !student ? true : undefined,
    debt: (v.debt ?? "none") as DebtAnswer,
    major: v.majorCat && edu !== "hs_work" && edu !== "vocational" ? (v.majorCat as Major) : undefined,
    field: v.field || undefined,
    survey: surveyOf(v),
    eduDetail: v.edu === "junior_high" || v.edu === "dropout" ? v.edu : undefined,
    kids: hasKids ? (v.kids ?? 0) : 0,
    kidSexes: hasKids && v.kids ? ([v.kidSex1, v.kidSex2, v.kidSex3].slice(0, v.kids).map((x) => (x === "boy" || x === "girl" ? x : "unknown")) as ("boy" | "girl" | "unknown")[]) : undefined,
    partnerName: (marital === "married" || marital === "partnered") && v.partnerName ? v.partnerName : undefined,
    kidBirthAges: hasKids && v.kids ? ([v.kidAge1, v.kidAge2, v.kidAge3].slice(0, v.kids).filter((x): x is number => typeof x === "number")) : undefined,
    savings: v.savings ?? null,
  };
}

// 選択式の質問(select)を、自作のドロップダウンの項目に直す。
function dropdownItems(step: Step): DropdownItem[] {
  if (step.groups) return step.groups.flatMap((g) => g.options.map((o) => ({ ...o, group: g.label || undefined })));
  return step.options!.map((o) => ({ value: o.value, label: o.label }));
}

// ---- 木の形 ----
type Leaf = { t: number; off: number; rot: number; size: number };
type Geom = { x0: number; y0: number; x1: number; y1: number; cx: number; cy: number; side: 1 | -1; leaves: Leaf[] };
type Answer = { id: keyof Values; value: string; label: string; node: string; geom: Geom };

// 前の節から、斜め上へ、ランダムな角度と長さで枝を伸ばす。
function grow(prev: { x: number; y: number; side: 1 | -1 }, index: number, width: number): Geom {
  const r = () => Math.random();
  let side: 1 | -1 = r() < 0.65 ? (prev.side === 1 ? -1 : 1) : prev.side;
  // 中心から離れすぎたら、戻る向きに伸ばす。
  const limit = Math.min(300, width * 0.25);
  if (prev.x > limit) side = -1;
  if (prev.x < -limit) side = 1;
  const angle = side * (0.35 + r() * 0.65); // 上向きから 20〜57 度
  // 画面がせまいときは、枝も、文字も、縮める(はみ出さないように)
  const sc = width < 520 ? 0.62 : width < 800 ? 0.82 : 1;
  const len = (150 + r() * 90) * sc;
  const x1 = prev.x + Math.sin(angle) * len;
  const y1 = prev.y - Math.cos(angle) * len;
  const mx = (prev.x + x1) / 2;
  const my = (prev.y + y1) / 2;
  const bend = (r() - 0.5) * 90;
  const leaves: Leaf[] = Array.from({ length: 2 + Math.floor(r() * 3) }, () => ({ t: 0.25 + r() * 0.6, off: (r() < 0.5 ? -1 : 1) * (12 + r() * 22), rot: r() * 180, size: 9 + r() * 10 }));
  void index;
  return { x0: prev.x, y0: prev.y, x1, y1, cx: mx + bend, cy: my - Math.abs(bend) * 0.3, side, leaves };
}

const quad = (g: Geom, t: number) => ({
  x: (1 - t) * (1 - t) * g.x0 + 2 * (1 - t) * t * g.cx + t * t * g.x1,
  y: (1 - t) * (1 - t) * g.y0 + 2 * (1 - t) * t * g.cy + t * t * g.y1,
});

// 答えの並びから、入力済みの値をつくる。
function valuesOf(answers: { id: keyof Values; value: string }[]): Values {
  const v: Record<string, unknown> = {};
  for (const a of answers) {
    const raw = a.value;
    switch (a.id) {
      case "age":
      case "branchAge":
      case "kids":
      case "yearsLeft":
        v[a.id] = Number(raw);
        break;
      // 子どもは、年齢と性別を一緒に答える("30|boy" の形)。
      case "kidAge1":
      case "kidAge2":
      case "kidAge3": {
        const [kidAge, sx] = raw.split("|");
        v[a.id] = Number(kidAge);
        v[`kidSex${a.id.slice(-1)}`] = sx || "unknown";
        break;
      }
      case "partnerName":
        v[a.id] = raw;
        break;
      case "married":
        v.married = raw === "yes";
        v.marital = raw;
        break;
      case "savings":
        v[a.id] = raw === "" ? null : Number(raw);
        break;
      case "mbti":
      case "job":
        v[a.id] = raw === "" ? null : raw;
        break;
      default:
        v[a.id] = raw;
    }
  }
  return v as Values;
}

// 記憶した「いまのあなた」から、ターニングポイントの手前までの答えを組み立てる(ターニングポイントだけ選び直せる)。
function answersFromSelf(self: CurrentSelf): Answer[] {
  const raw: Record<string, string> = {
    age: String(self.age), ailment: self.ailment ?? "none", school: self.school ?? "none", yearsLeft: String(self.yearsLeft ?? 1), prefecture: self.prefecture, sex: self.sex, condition: self.condition, mbti: self.mbti ?? "", edu: self.eduDetail ?? self.edu, occ: self.retired ? "retired" : self.homemaker ? "homemaker" : self.occ === "none" ? "none" : (self.job ?? DEFAULT_JOB[self.occ]),
    job: self.job ?? "", workStyle: self.workStyle, region: self.region, housing: self.housing, married: (self.marital ?? (self.married ? "married" : "single")) === "single" ? "no" : (self.marital ?? "married") === "married" ? "yes" : (self.marital as string), debt: self.debt ?? "none", kids: String(self.kids), savings: self.savings === null ? "" : String(self.savings),
  };
  (["kidAge1", "kidAge2", "kidAge3"] as const).forEach((k, i) => {
    const v = self.kidBirthAges?.[i];
    if (typeof v === "number") raw[k] = `${v}|${self.kidSexes?.[i] ?? "unknown"}`;
  });
  (["feel", "tie", "body", "wealth", "habit"] as SurveyKey[]).forEach((k) => {
    raw[k] = self.survey?.[k] ?? "";
  });
  raw.majorCat = self.major ?? "";
  raw.field = self.field ?? "";
  if (self.marital === "married" || self.marital === "partnered" || (!self.marital && self.married)) raw.partnerName = self.partnerName ?? "";
  const out: Answer[] = [];
  let tip = { x: 0, y: 0, side: 1 as 1 | -1 };
  for (let guard = 0; guard < 30; guard++) {
    const v = valuesOf(out);
    const step = stepsFor(v, v.age)[out.length];
    if (!step || step.id === "kind" || raw[step.id] === undefined) break;
    const geom = grow(tip, out.length, 1000);
    out.push({ id: step.id, value: raw[step.id], label: step.label(raw[step.id]), node: step.node, geom });
    tip = { x: geom.x1, y: geom.y1, side: geom.side };
  }
  return out;
}

export function TreeWizard({ t, onSubmit, auth, prefill }: Props) {
  const [remember, setRemember] = useState<"idle" | "busy" | "ok" | "fail">("idle");
  const [answers, setAnswers] = useState<Answer[]>(() => (prefill ? answersFromSelf(prefill) : []));
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 420 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: Math.max(320, el.clientWidth), h: Math.max(240, el.clientHeight) }));
    ro.observe(el);
    setSize({ w: Math.max(320, el.clientWidth), h: Math.max(240, el.clientHeight) });
    return () => ro.disconnect();
  }, []);
  const [text, setText] = useState("");
  const [pick, setPick] = useState("");
  const [sexPick, setSexPick] = useState<"unknown" | "boy" | "girl">("unknown");

  const values = useMemo(() => valuesOf(answers), [answers]);

  // 答える詳しさ。はじめに選ぶ(前回えらんだものを、おぼえておく)。記憶した入力から始めるときは、全部。
  const [level, setLevelState] = useState<Level | null>(prefill ? 3 : null);
  const [lastLevel, setLastLevel] = useState<Level | null>(null);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(LEVEL_KEY));
      if (v === 1 || v === 2 || v === 3) setLastLevel(v);
    } catch {}
  }, []);
  const setLevel = (l: Level) => {
    setLevelState(l);
    try {
      localStorage.setItem(LEVEL_KEY, String(l));
    } catch {}
  };
  const choosing = level === null && answers.length === 0;

  const steps = useMemo(() => stepsFor(values, values.age, level ?? 3), [values, level]);
  // 詳しさを変えたときも、まだ答えていない質問のうち、いちばん先のものを出す。
  const answeredIds = useMemo(() => new Set<string>(answers.map((a) => a.id)), [answers]);
  const step = steps.find((x) => !answeredIds.has(x.id));
  const done = !step;
  // 残りの質問数(ターニングポイントのあとに続く質問も、見込んで数える)。
  const pending = steps.filter((x) => !answeredIds.has(x.id)).length;
  const chainLeft = !values.kind ? 3 : values.branchAge === undefined ? 2 : !values.motive ? 1 : 0;
  const answeredCount = steps.length - pending;
  // まだ質問が出ていない項目(学歴・仕事・専攻など)も、見込んで数える。進むにつれて、数が増えないように。
  const adult = (values.age ?? 99) >= 18;
  const stillToCome =
    (adult && values.school === undefined ? 2 : 0) + // 最終学歴・仕事(在学中なら、卒業までの年数)
    (level !== null && level >= 2 && adult && values.occ === undefined && values.school !== undefined && values.school !== "none" ? 0 : level !== null && level >= 2 && adult && values.occ === undefined ? 1 : 0) + // 働き方
    (level === 3 && adult && !answeredIds.has("majorCat") && !steps.some((x) => x.id === "majorCat") ? 2 : 0); // 専攻の分野・専攻
  const remaining = pending + chainLeft + stillToCome;
  const total = answeredCount + remaining;

  // さかのぼっている間は、見せる枝の数(shown)を、ひとつずつ減らす。
  const [cut, setCut] = useState<number | null>(null);
  const shown = cut ?? answers.length;
  const last = answers[shown - 1];
  const tip = last ? { x: last.geom.x1, y: last.geom.y1, side: last.geom.side } : { x: 0, y: 0, side: 1 as const };

  const commit = (raw: string) => {
    if (!step) return;
    const geom = grow(tip, answers.length, size.w);
    setAnswers([...answers, { id: step.id, value: raw, label: step.label(raw), node: step.node, geom }]);
    setText("");
    setPick("");
    setSexPick("unknown");
  };
  // 子どもの年齢と性別は、一緒に答える("30|boy" の形)。
  const commitNum = (x: string) => commit(step?.withSex ? `${x}|${sexPick}` : x);

  const back = () => setAnswers(answers.slice(0, -1));

  const numberOk = () => {
    if (!step) return false;
    const n = Number(text);
    if (step.input === "optionalNumber") return text === "" || (Number.isFinite(n) && n >= (step.min ?? 0));
    return text !== "" && Number.isInteger(n) && n >= (step.min ?? -Infinity) && n <= (step.max ?? Infinity);
  };

  // 「別の人生をシミュレートする」を押したら、文字がふわっと消え、枝が、いちばん先から根もとへ、さかのぼっていく。
  // 最後まで戻ったら、遊ぶ画面へ入る。
  const [rewinding, setRewinding] = useState(false);
  const [full, setFull] = useState(false); // さかのぼりの間は、木を、画面いっぱいに広げる
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
  const submit = () => {
    const self = selfFrom(values);
    if (!self || !values.kind || values.branchAge === undefined || !values.option || rewinding) return;
    const branch: Branch = { kind: values.kind, option: values.option, age: values.branchAge };
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
    setRewinding(true);
    const n = answers.length;
    later(() => setFull(true), 500);
    const FADE = 900; // 文字が消えるまで
    const step = Math.min(380, Math.max(170, 3400 / Math.max(1, n))); // 枝を1本もどす間隔
    for (let i = 1; i <= n; i++) later(() => setCut(n - i), FADE + (i - 1) * step);
    later(() => onSubmit(self, branch), FADE + n * step + 1100);
  };

  const rememberNow = async () => {
    const self = selfFrom(values);
    if (!self || !values.kind || values.branchAge === undefined || !values.option) return;
    setRemember("busy");
    if (!auth.loggedIn && !(await auth.login())) return setRemember("idle");
    setRemember((await auth.remember(self, { kind: values.kind, option: values.option, age: values.branchAge })) ? "ok" : "fail");
  };

  // カメラ: いちばん新しい節が、画面の下寄りに来るように、木全体を動かす。
  const camX = size.w / 2 - tip.x;
  const camY = size.h * (size.w < 520 ? 0.78 : 0.72) - tip.y;
  const fadeText = `transition-opacity duration-[800ms] ease-out ${rewinding ? "pointer-events-none opacity-0" : ""}`;
  // 画面の幅に合わせた、文字の大きさの倍率
  const fs = size.w < 520 ? 0.62 : size.w < 800 ? 0.82 : 1;
  // 根もとの名前は、最初の枝と反対側に出す。画面のはしから、はみ出すときは、反対にする。
  const rootLabelW = 26 * fs + 6 * 26 * fs;
  let rootLeft = (answers[0]?.geom.side ?? -1) === 1;
  if (rootLeft && camX - rootLabelW < 6) rootLeft = false;
  else if (!rootLeft && camX + rootLabelW > size.w - 6) rootLeft = true;
  const trunkW = (i: number) => Math.max(4, 13 - i * 0.4);

  return (
    <div className="relative flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col">
      {/* さかのぼっている間は、文字をすべて、ふわっと消す */}
      {/* 左下に、ついてくる「トップへ」: 入力の途中でも、トップページへ、もどれる */}
      <button
        type="button"
        onClick={() => {
          if (answers.length > 2 && !window.confirm("入力した内容は消えます。トップページへもどりますか?")) return;
          window.dispatchEvent(new Event("betsu-uchu:home"));
        }}
        aria-label="トップページへもどる"
        className={`${fadeText} font-gothic fixed bottom-4 left-4 z-40 flex items-center gap-2 border border-line bg-panel/90 px-4 py-2.5 text-sm tracking-wider text-haze shadow-[0_6px_24px_rgba(0,0,0,0.4)] hover:border-haze hover:text-mist max-sm:bottom-3 max-sm:left-3 max-sm:px-3`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10v9.5h13V10" />
          <path d="M10 19.5v-5h4v5" />
        </svg>
        トップへ
      </button>
      {/* 左上の「<<」: ひとつ前の質問にもどる */}
      {answers.length > 0 && (
        <button type="button" onClick={back} aria-label="ひとつ前の質問にもどる" title="ひとつ前の質問にもどる" className={`${fadeText} absolute left-4 top-3 z-20 border border-line bg-void/50 px-3 py-1.5 text-sm font-bold tracking-wider text-haze hover:border-haze hover:text-mist`}>
          &lt;&lt; 戻る
        </button>
      )}
      {/* 木 */}
      <div className="relative h-[22vh] min-h-44 w-full sm:h-[34vh] sm:min-h-64">
      <div ref={box} className={full ? "fixed inset-0 z-[80] overflow-hidden bg-void/95 animate-[fadein_0.8s_ease-out]" : "absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_94%,transparent)]"}>
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="absolute inset-0 h-full w-full" role="img" aria-label={t.title}>
          <motion.g initial={false} animate={{ x: camX, y: camY }} transition={{ type: "spring", stiffness: 40, damping: 15 }}>
            {/* 幹 */}
            <motion.path d="M 0 220 L 0 0" stroke="var(--color-warm)" strokeWidth={14} strokeLinecap="round" fill="none" opacity={0.85} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
            <motion.circle cx={0} cy={0} r={18} fill="var(--color-warm)" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1, type: "spring" }} />
            {/* 根もとの名前。最初の枝と反対側に出して、重ならないようにする。木が伸びると、根もとと一緒に、画面の外へ流れていく */}
            <motion.text x={((rootLeft ? -26 : 26) + 10) * fs} y={7 * fs} textAnchor={rootLeft ? "end" : "start"} fill="var(--color-mist)" fontSize={26 * fs} initial={{ opacity: 0 }} animate={{ opacity: rewinding ? 0 : 1 }} transition={rewinding ? { duration: 0.8 } : { delay: 1.2 }}>
              {t.root}
            </motion.text>
            <AnimatePresence>
              {answers.map((a, i) => {
                const g = a.geom;
                const d = `M ${g.x0} ${g.y0} Q ${g.cx} ${g.cy} ${g.x1} ${g.y1}`;
                const isLast = i === shown - 1;
                const gone = i >= shown;
                // 名前と答えの文字が、画面のはしから、はみ出すときは、反対側に出す
                const lw = Math.max(a.label.length * 27 * fs, a.node.length * 18 * fs) + 28 * fs;
                const sx = camX + g.x1;
                const wantRight = g.side === 1;
                const right = wantRight ? sx + lw < size.w - 6 || sx - lw < 6 : sx - lw < 6 && sx + lw < size.w - 6;
                return (
                  <motion.g key={`${a.id}-${i}`} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
                    <motion.path d={d} stroke="var(--color-warm)" strokeWidth={trunkW(i)} strokeLinecap="round" fill="none" opacity={0.8} initial={{ pathLength: 0 }} animate={{ pathLength: gone ? 0 : 1 }} transition={gone ? { duration: 0.5, ease: "easeIn" } : { duration: 1.1, ease: "easeOut" }} />
                    {g.leaves.map((l, k) => {
                      const pt = quad(g, l.t);
                      return (
                        <motion.ellipse key={k} cx={pt.x + l.off} cy={pt.y - Math.abs(l.off) * 0.4} rx={l.size} ry={l.size * 0.55} transform={`rotate(${l.rot} ${pt.x + l.off} ${pt.y})`} fill="var(--color-s-health)" opacity={0.6} initial={{ scale: 0 }} animate={{ scale: gone ? 0 : 1 }} transition={gone ? { duration: 0.3 } : { delay: 0.7 + k * 0.12, type: "spring" }} />
                      );
                    })}
                    <motion.circle cx={g.x1} cy={g.y1} r={isLast ? 16 : 10} fill={isLast ? "var(--color-warm)" : "var(--color-mist)"} initial={{ scale: 0 }} animate={{ scale: gone ? 0 : 1 }} transition={gone ? { duration: 0.3 } : { delay: 0.9, type: "spring", stiffness: 200 }} />
                    <motion.g initial={{ opacity: 0 }} animate={{ opacity: rewinding || gone ? 0 : isLast ? 1 : 0.8 }} transition={rewinding ? { duration: 0.8 } : { delay: 1 }}>
                      <text x={g.x1 + (right ? 28 : -28) * fs} y={g.y1 - 8 * fs} textAnchor={right ? "start" : "end"} fill="var(--color-haze)" fontSize={18 * fs}>
                        {a.node}
                      </text>
                      <text x={g.x1 + (right ? 28 : -28) * fs} y={g.y1 + 22 * fs} textAnchor={right ? "start" : "end"} fill="var(--color-mist)" fontSize={27 * fs}>
                        {a.label}
                      </text>
                    </motion.g>
                  </motion.g>
                );
              })}
            </AnimatePresence>

            {/* ターニングポイント: 実際に歩んだ道を、薄い点線で添える */}
            {done && last && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: rewinding ? 0 : 1 }} transition={rewinding ? { duration: 0.8 } : { delay: 1.2 }}>
                <path d={`M ${last.geom.x0} ${last.geom.y0} Q ${last.geom.x0 - last.geom.side * 40} ${last.geom.y0 - 60} ${last.geom.x0 - last.geom.side * 90} ${last.geom.y0 - 130}`} stroke="var(--color-cool)" strokeWidth={3} strokeDasharray="4 7" fill="none" opacity={0.7} />
                <text x={last.geom.x0 - last.geom.side * 100} y={last.geom.y0 - 138} textAnchor={last.geom.side === 1 ? "end" : "start"} fill="var(--color-cool)" fontSize={15}>
                  {t.real}
                </text>
              </motion.g>
            )}
          </motion.g>
        </svg>
      </div>
      </div>

      {answers.length > 0 && (
        <p className={`${fadeText} relative z-10 mx-auto -mt-2 max-w-4xl px-[2.5vw] text-center text-xs leading-7 tracking-wider text-dim`}>{answers.map((a) => a.label).join("  ›  ")}</p>
      )}

      {/* 詳しさと、残りの質問数 */}
      {!choosing && level !== null && (
        <div className={`${fadeText} relative z-10 mx-auto mt-3 w-full max-w-3xl px-[2.5vw]`}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5" role="group" aria-label="答える詳しさ">
              <span className="mr-1 text-[11px] tracking-[0.2em] text-dim">詳しさ</span>
              {LEVELS.map((l) => (
                <button key={l.level} type="button" onClick={() => setLevel(l.level)} aria-pressed={level === l.level} className={`border px-2.5 py-1 text-xs tracking-wider transition-colors ${level === l.level ? "border-warm bg-warm/15 text-mist" : "border-line text-haze hover:border-haze hover:text-mist"}`}>
                  {l.name}
                </button>
              ))}
            </div>
            <p className="font-gothic text-xs tracking-wider text-haze" aria-live="polite">
              {done ? "すべて答えました" : <>あと{remaining > 3 ? "約" : ""}<span className="mx-1 text-base font-bold text-warm">{remaining}</span>問</>}
            </p>
          </div>
          <div className="mt-2 flex gap-[3px]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answeredCount} aria-label="答えた質問の数">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i < answeredCount ? "bg-warm" : i === answeredCount && !done ? "bg-warm/50" : "bg-line/70"}`} />
            ))}
          </div>
        </div>
      )}

      {/* 質問 */}
      <div className={`${fadeText} relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-[2.5vw] pb-12 pt-2`}>
        {choosing ? (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full text-center">
            <p className="text-xs tracking-[0.4em] text-warm">はじめに</p>
            <h2 className="mt-3 text-xl font-bold leading-9 tracking-[0.12em] text-mist sm:text-2xl">どのくらいくわしく答えますか?</h2>
            <p className="mt-2 text-sm leading-7 tracking-wider text-haze">答えなかった項目はふつうの値でおぎないます。あとからいつでも変えられます。</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {LEVELS.map((l) => (
                <button key={l.level} type="button" onClick={() => setLevel(l.level)} className="group relative flex flex-col items-center border border-line bg-panel/70 px-4 py-5 text-center transition-colors hover:border-warm">
                  <span className="text-lg font-bold tracking-[0.2em] text-mist">{l.name}</span>
                  <span className="font-gothic mt-1 text-sm font-bold tracking-wider text-warm">{l.sub}</span>
                  <span className="font-gothic mt-3 text-xs leading-6 tracking-wider text-haze">{l.note}</span>
                  <span className="mt-4 flex gap-1" aria-hidden>
                    {[1, 2, 3].map((i) => (
                      <span key={i} className={`h-1.5 w-6 rounded-full ${i <= l.level ? "bg-warm" : "bg-line/70"}`} />
                    ))}
                  </span>
                  {lastLevel === l.level && <span className="font-gothic mt-3 text-[11px] tracking-wider text-dim">前回えらんだ詳しさ</span>}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
        <AnimatePresence mode="wait">
          {step ? (
            <motion.div key={`${step.id}-${answers.length}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5 }} className="w-full text-center">
              <p className="text-xs tracking-[0.4em] text-warm">{step.node}</p>
              <h2 className="mt-3 text-xl font-bold leading-9 tracking-[0.12em] text-mist sm:text-2xl">{soften(step.q)}</h2>
              {step.prompt && <p className="mt-2 text-sm leading-7 tracking-wider text-haze">{soften(step.prompt)}</p>}

              {step.input === "chips" && (
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {step.options!.map((o) => (
                    <button key={o.value} type="button" onClick={() => commit(o.value)} className={`${chipClass(false)} ${o.sub ? "min-w-28" : ""}`}>
                      {o.label}
                      {o.sub && <span className="block text-xs tracking-[0.1em] text-dim">{o.sub}</span>}
                    </button>
                  ))}
                </div>
              )}

              {(step.input === "number" || step.input === "optionalNumber") && (
                <div className="mt-6 flex flex-col items-center gap-5">
                  <div className="flex items-baseline gap-3">
                    <input
                      autoFocus
                      type="number"
                      inputMode="numeric"
                      min={step.min}
                      max={step.max}
                      value={text}
                      placeholder={step.default !== undefined ? String(step.default) : undefined}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (numberOk() ? commitNum(text) : step.default !== undefined && text === "" && commitNum(String(step.default)))}
                      className={numberInputClass}
                    />
                    <span className="text-sm tracking-widest text-haze">{step.unit}</span>
                  </div>
                  {step.withSex && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {([["boy", "男子"], ["girl", "女子"], ["unknown", "答えない"]] as const).map(([val, lab]) => (
                        <button key={val} type="button" onClick={() => setSexPick(val)} className={chipClass(sexPick === val)}>
                          {lab}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-6">
                    {step.input === "optionalNumber" && (
                      <button type="button" onClick={() => commit("")} className="text-sm tracking-[0.2em] text-haze underline-offset-8 hover:text-mist hover:underline">
                        {t.skip}
                      </button>
                    )}
                    <button type="button" disabled={!numberOk() && !(step.default !== undefined && text === "")} onClick={() => commitNum(text === "" && step.default !== undefined ? String(step.default) : text)} className={primaryButtonClass}>
                      <span className="absolute inset-0 border border-warm/60 bg-warm/5 transition-colors group-hover:border-warm group-hover:bg-warm/10" />
                      {t.next}
                    </button>
                  </div>
                </div>
              )}

              {step.input === "optionalText" && (
                <div className="mt-6 flex flex-col items-center gap-5">
                  <input
                    autoFocus
                    type="text"
                    maxLength={12}
                    value={text}
                    placeholder="名前(12文字まで・空欄でもOK)"
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && commit(text.trim())}
                    className="w-64 border-b border-line bg-transparent py-2 text-center text-xl tracking-[0.2em] text-mist outline-none placeholder:text-sm placeholder:text-dim focus:border-haze"
                  />
                  <button type="button" onClick={() => commit(text.trim())} className={primaryButtonClass}>
                    <span className="absolute inset-0 border border-warm/60 bg-warm/5 transition-colors group-hover:border-warm group-hover:bg-warm/10" />
                    {text.trim() ? t.next : "書かずに進む"}
                  </button>
                </div>
              )}

              {step.input === "select" && (step.id === "occ" || step.id === "option") && (
                <div className="mt-6 flex flex-col items-center gap-5">
                  <JobPicker ariaLabel={step.q} value={pick} onChange={setPick} items={dropdownItems(step)} kw={jobKw} />
                  <button type="button" disabled={!pick} onClick={() => commit(pick)} className={primaryButtonClass}>
                    <span className="absolute inset-0 border border-warm/60 bg-warm/5 transition-colors group-hover:border-warm group-hover:bg-warm/10" />
                    {t.next}
                  </button>
                </div>
              )}

              {step.input === "select" && step.id !== "occ" && step.id !== "option" && (
                <div className="mt-6 flex flex-col items-center gap-5">
                  <Dropdown ariaLabel={step.q} value={pick} onChange={setPick} searchable={step.id === "prefecture"} placeholder={step.id === "prefecture" ? "選んでください" : "選ぶ"} items={dropdownItems(step)} />
                  <button type="button" disabled={step.id === "prefecture" && !pick} onClick={() => commit(pick)} className={primaryButtonClass}>
                    <span className="absolute inset-0 border border-warm/60 bg-warm/5 transition-colors group-hover:border-warm group-hover:bg-warm/10" />
                    {t.next}
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="done" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full text-center">
              <h2 className="text-xl tracking-[0.2em] text-mist [text-wrap:wrap] sm:text-2xl">{t.summary}</h2>
              {values.mbti && IDEAL[values.mbti] && (
                <p className="mx-auto mt-4 max-w-xl text-sm leading-7 tracking-wider text-haze">
                  あなたは {typeLabel(values.mbti)}。相性がよいとされるのは {IDEAL[values.mbti].map(typeLabel).join("・")}。<br />
                  人生で恋人になる人のうち、このタイプの人は約<span className="font-bold text-warm">{Math.round(idealChance(values.mbti) * 100)}%</span>(MBTIの相性は俗説で目安です)。
                </p>
              )}
              <button type="button" onClick={submit} className={`${primaryButtonClass} mt-8`}>
                <span className="absolute inset-0 border border-warm/60 bg-warm/5 transition-colors group-hover:border-warm group-hover:bg-warm/10" />
                {t.start}
              </button>
              <div className="mt-6">
                <button type="button" disabled={!auth.enabled || remember === "busy" || remember === "ok"} onClick={rememberNow} className="border border-line px-6 py-2 text-sm tracking-[0.2em] text-haze hover:border-haze hover:text-mist disabled:opacity-50">
                  {auth.loggedIn ? t.remember : t.rememberLogin}
                </button>
                <p className="mt-2 text-xs tracking-wider text-dim">
                  {!auth.enabled ? t.rememberOff : remember === "ok" ? t.remembered : remember === "fail" ? t.rememberFailed : ""}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}

        {answers.length > 0 && (
          <button type="button" onClick={back} className="mt-8 text-sm tracking-[0.3em] text-haze underline-offset-8 hover:text-mist hover:underline">
            {t.back}
          </button>
        )}
      </div>
    </div>
  );
}
