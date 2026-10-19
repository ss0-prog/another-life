import { incomeOf, round10 } from "@/lib/sim/salary";
import { JOBS, OCC_LABEL, OCC_OFFICIAL, jobById } from "@/lib/sim/data/jp-jobs";
import { assignJob, bump, fullName, moveAbroad, moveTo, randomPartner } from "@/lib/sim/helpers";
import { compat, typeCall } from "@/lib/sim/mbti";
import { STUDY_MAIN, STUDY_OTHERS, countryById } from "@/lib/sim/data/jp-countries";
import { fieldById, fieldJobIds } from "@/lib/sim/data/jp-majors";
import { weighted } from "@/lib/sim/rng";
import { industryQuestion } from "@/lib/sim/data/jp-industry";
import type { BranchOption, CountryData, Edu, Env, JobDef, Major, Occ, Person, Region, TurningOption, TurningPoint, TurningQuestion } from "@/lib/sim/types";

type Rng = Parameters<TurningOption["apply"]>[1];


const metroOrTokyo = (rng: () => number): Region => (rng() < 0.55 ? "tokyo" : "metro");

const eduEvent: Record<Edu, string> = {
  univ: "大学に進学した",
  vocational: "専門学校に進学した",
  hs_work: "高校を出て、働く道を選んだ",
  grad: "大学院に進学した",
};

const pickMajor = (rng: () => number): Major => weighted<Major>(rng, { humanities: 45, science: 28, medical: 8, education: 7, art: 4 });

function setEdu(p: Person, rng: () => number, data: CountryData, edu: Edu, away = false): string {
  p.edu = edu;
  p.field = null;
  p.gradAge = null; // 進学したら、卒業する年齢は、標準にもどる。
  p.major = edu === "univ" || edu === "grad" ? pickMajor(rng) : null;
  // 卒業しても、職場は、勝手には決まらない。卒業のあとの、進路を問う場面で、自分で選ぶ。
  p.occ = null;
  if (p.background === "tight" && edu !== "hs_work") bump(p, { money: -6 });
  if (edu === "hs_work") bump(p, { money: 4 });
  if (edu === "univ" || edu === "grad") bump(p, { learn: 6 });
  if (away) {
    const city = moveTo(p, rng, data, metroOrTokyo(rng));
    bump(p, { money: -4, bonds: -2 });
    return `${city}で学ぶために、実家を離れた`;
  }
  return eduEvent[edu];
}


// ---- 説明文(いまの地域・年齢・景気に応じた目安)をつくる道具 ----
const econNote = (env: Env) => (env.econ > 0.6 ? `(いまは${env.econLabel}で、やや高め)` : env.econ < -0.4 ? `(いまは${env.econLabel}で、やや低め)` : "");

// 年収の目安を、いまの地域と、東京・地方都市を並べて示す。
function payText(p: Person, env: Env, data: CountryData, pt: Partial<Person>): string {
  const at = (region?: Region) => round10(incomeOf(p, data, env.econ, { ...pt, ...(region ? { region } : {}) }));
  const here = pt.region ?? p.region;
  return `${pt.age ?? p.age}歳のころの年収の目安は、${data.regionLabel[here]}で約${at()}万円(東京23区なら約${at("tokyo")}万円、地方都市なら約${at("local")}万円)${econNote(env)}。`;
}

const fit = (env: Env, bad: string) => (env.econ < -0.6 ? bad : "");

// ---- 合格率: 頭の良さ(と、これまでの学び)で決まる ----
export function passRate(p: Person, diff: number): number {
  const score = p.intel * 0.6 + p.stats.learn * 0.4;
  const r = 1 / (1 + Math.exp(-(score - diff) / 7));
  return Math.min(0.97, Math.max(0.03, r));
}
export const pctText = (r: number) => `${Math.round(r * 100)}%`;
export const abilityText = (p: Person) => `これまでの学びは${Math.round(p.stats.learn)}`;

// ---- 職業(厚労省の職種区分にもとづく): 大分類 → (グループ) → 職種 → 勤め先 ----
type Workplace = { id: string; label: string; note: string; employment: "regular" | "nonregular" | "self"; firm: "large" | "mid" | "small"; sector: "private" | "public"; home?: boolean; mult?: number; auto?: boolean };

const WORKPLACES: Workplace[] = [
  { id: "large", label: "大企業・大きな組織(正社員)", note: "給料は高めで安定。転勤や競争もある。", employment: "regular", firm: "large", sector: "private" },
  { id: "mid", label: "中堅の会社(正社員)", note: "平均的な待遇。", employment: "regular", firm: "mid", sector: "private", auto: true },
  { id: "small", label: "地元の中小企業・個人経営(正社員)", note: "給料は控えめだが、実家から通えて暮らしの費用は抑えられる。", employment: "regular", firm: "small", sector: "private", home: true },
  { id: "nonreg", label: "派遣・契約・パート", note: "すぐに働けるが、収入は低く、景気の影響を受けやすい。", employment: "nonregular", firm: "mid", sector: "private" },
  { id: "public", label: "公務員(国・自治体)", note: "安定していて、景気の影響を受けにくい。試験がある。", employment: "regular", firm: "mid", sector: "public" },
  { id: "self", label: "自営・独立", note: "うまくいけば大きいが、収入の波が激しく、景気の影響を最も受ける。", employment: "self", firm: "small", sector: "private", mult: 0.9 },
];

const PUBLIC_OCC: Occ[] = ["tech", "office"];
const PUBLIC_JOBS = ["waste", "bus_driver", "civil_worker", "custodian", "cleaner"];
const NOT_PUBLIC = ["lawyer", "accountant", "musician", "artist", "designer", "other_health", "tutor", "clergy"];
const publicAllowed = (j: JobDef) => (PUBLIC_OCC.includes(j.occ) && !NOT_PUBLIC.includes(j.id)) || PUBLIC_JOBS.includes(j.id);

function workplacesFor(j: JobDef): Workplace[] {
  return WORKPLACES.filter((w) => {
    if (w.id === "public") return publicAllowed(j);
    if (w.id === "self") return j.occ !== "office";
    if (j.occ === "agri") return w.id === "small" || w.id === "nonreg";
    return true;
  });
}

function enterJob(p: Person, rng: Rng, data: CountryData, j: JobDef, w: Workplace): string {
  // 資格や試験が必要な職種は、頭の良さと学びで決まる確率で届く。届かなければ、同じ分野の標準的な職に就く。
  if (j.qual) {
    let r = passRate(p, j.qual.diff);
    if (j.qual.grad && p.edu !== "grad") r *= 0.15;
    if (rng() > r) {
      const title = assignJob(p, j.occ, rng, data);
      Object.assign(p, { employment: w.employment === "self" ? "regular" : w.employment, firm: w.firm, sector: w.sector });
      return `目指した${j.title}には届かず、${title}として働き始めた`;
    }
  }
  p.occ = j.occ;
  p.job = j.id;
  p.payMult = j.mult * (w.mult ?? 1);
  p.employment = w.employment;
  p.firm = w.firm;
  p.sector = w.sector;
  if (w.home) {
    p.region = p.birthRegion;
    p.city = p.birthPlace;
    p.withParents = true;
  }
  if (w.employment === "self") bump(p, { money: Math.round((rng() - 0.4) * 8), learn: 2 });
  let text = `${j.title}として、${w.label.replace("(正社員)", "")}で働き始めた`;
  // 就職の厳しい時期は、正社員になれないことがある。
  if (w.employment === "regular" && w.sector === "private" && p.econ < -0.6 && rng() < 0.45) {
    p.employment = "nonregular";
    text += "(採用が絞られた時期で、非正規からのスタートになった)";
  }
  return text;
}

const jobDetail = (j: JobDef): TurningOption["detail"] => (p, env, data) => {
  const parts = [j.note, payText(p, env, data, { occ: j.occ, job: j.id, payMult: j.mult })];
  if (j.qual) {
    const r = passRate(p, j.qual.diff) * (j.qual.grad && p.edu !== "grad" ? 0.15 : 1);
    parts.push(`${j.qual.label}。合格・採用の目安は約${pctText(r)}(${abilityText(p)})。${j.qual.grad && p.edu !== "grad" ? "大学院での学びがほぼ前提。" : ""}`);
  }
  return parts.join(" ");
};

const workplaceQuestion = (j: JobDef): TurningQuestion => ({
  title: `${j.title}として、どこで働く?`,
  prompt: "勤め先と働き方で、収入と暮らしが変わります。",
  options: workplacesFor(j).map((w) => ({
    id: w.id,
    label: w.label,
    auto: w.auto,
    apply: (p, rng, data) => enterJob(p, rng, data, j, w),
    detail: (p, env, data) => `${w.note} ${payText(p, env, data, { occ: j.occ, job: j.id, payMult: j.mult * (w.mult ?? 1), employment: w.employment, firm: w.firm, sector: w.sector })}${w.employment === "regular" && w.sector === "private" && env.econ < -0.6 ? " 不況の今は、正社員の採用が絞られている。" : ""}`,
  })),
});

const JOB_DEFAULT: Record<Occ, string> = { tech: "software", office: "office_general", sales: "shop_clerk", service: "care_worker", security: "guard", agri: "farmer", production: "machine_assembly", transport: "truck", construction: "carpenter", logistics: "delivery", mgmt: "office_general" };

const jobOption = (j: JobDef): TurningOption => ({
  id: j.id,
  label: j.title,
  auto: j.id === JOB_DEFAULT[j.occ],
  apply: () => "",
  detail: jobDetail(j),
  children: () => workplaceQuestion(j),
});

// 大分類の中の職種。多い分類は、グループに分けてから選ぶ。
const occQuestion = (occ: Occ, jobs: JobDef[]): TurningQuestion => {
  const groups = [...new Set(jobs.map((j) => j.group).filter(Boolean))] as string[];
  if (groups.length > 1) {
    return {
      title: `${OCC_LABEL[occ]}の、どの分野?`,
      prompt: "分野を選ぶと、そのなかの職種が出ます。",
      options: groups.map((g) => ({
        id: g,
        label: g,
        auto: g === jobById(JOB_DEFAULT[occ])?.group,
        apply: () => "",
        children: () => ({ title: `${g}の職種`, prompt: "どの職種に就くだろう。", options: jobs.filter((j) => j.group === g).map(jobOption) }),
      })),
    };
  }
  return { title: `${OCC_LABEL[occ]}の職種`, prompt: "どの職種に就くだろう。", options: jobs.map(jobOption) };
};

// 厚労省の大分類(管理的職業は、昇進でなるものなので、ここには出さない)
export const OCC_ENTRY: Occ[] = ["tech", "office", "sales", "service", "production", "transport", "construction", "logistics", "security", "agri"];

const occTree = (occ: Occ): TurningOption => ({
  id: occ,
  label: OCC_LABEL[occ],
  auto: occ === "office",
  apply: () => "",
  detail: (p, env, d) => `${OCC_OFFICIAL[occ]}。${payText(p, env, d, { occ, job: JOB_DEFAULT[occ], payMult: jobById(JOB_DEFAULT[occ])?.mult ?? 1 })}`,
  children: () => occQuestion(occ, JOBS.filter((j) => j.occ === occ)),
});


// ---- 卒業後の進路: 留学・職の候補 ----

// 人ごとに決まる、ばらつき(乱数のかわり。同じ人なら、いつも同じ候補が出る)。
const personSeed = (p: Person) => ([...p.birthPlace].reduce((a, c) => a + c.charCodeAt(0), 0) * 31 + Math.round(p.intel) * 7 + p.age) % 9973;
const hashOf = (s: string, seed: number) => {
  let h = seed;
  for (const ch of s) h = (h * 33 + ch.charCodeAt(0)) % 1000003;
  return h;
};
const pickStable = <T extends { id: string }>(list: T[], n: number, seed: number): T[] => [...list].sort((x, y) => hashOf(x.id, seed) - hashOf(y.id, seed)).slice(0, n);

// 留学の費用(万円)のうち、家族の支えと、奨学金でまかなえない分。これが、手持ちの貯金より多いと、その選択肢は出さない。
const studyHide = (p: Person, totalMan: number) => Math.max(0, totalMan - { tight: 100, modest: 400, comfortable: 900 }[p.background] - 300);
// 実際に、自分の貯金から出る分(万円)。足りなければ、借金(奨学金など)になる。
const studyPocket = (p: Person, totalMan: number) => Math.max(0, totalMan - { tight: 100, modest: 400, comfortable: 900 }[p.background]);

const STUDY_KIND = { lang: { label: "語学留学", years: 1, total: 150 }, college: { label: "大学・専門学校への留学", years: 3, total: 600 }, grad: { label: "大学院への留学", years: 2, total: 500 } } as const;

// 留学先: アメリカ・中国・カナダなどの主な国と、世界中の人気の留学先から、人ごとに決まる3つ。
const studyCountryQuestion = (kind: keyof typeof STUDY_KIND, p: Person): TurningQuestion => ({
  title: "どの国に留学する?",
  prompt: `${STUDY_KIND[kind].label}(${STUDY_KIND[kind].years}年)の行き先です。主な国と、人気の留学先から、いくつか出ています。`,
  options: [...STUDY_MAIN.map((id) => studyCountryOption(id, kind)), ...otherStudyOptions(p, kind)],
});

function studyCountryOption(id: string, kind: keyof typeof STUDY_KIND): TurningOption {
  const c = countryById(id)!;
  const k = STUDY_KIND[kind];
  return {
    id: c.id,
    label: `${c.name}(${c.cities.join("・")})`,
    cost: (p) => studyHide(p, k.total),
    apply: (p, r, d) => {
      const city = moveAbroad(p, r, d, c.id);
      if (p.abroad) {
        p.abroad.study = { until: p.age + k.years, kind };
        p.abroad.visa = "student";
      }
      p.cashDelta -= studyPocket(p, k.total) * 10000;
      bump(p, kind === "lang" ? { learn: 8, joy: 4 } : { learn: 10, money: -4 });
      return `${city}に、${k.label}に出かけた(${k.years}年間の予定。費用は約${k.total}万円で、家族の支えと奨学金で、まかなえない分は、自分の貯金から出す)`;
    },
    detail: () => `収入の水準は日本の約${Math.round(c.incomeFactor * 100)}%、物価は約${Math.round(c.costFactor * 100)}%。言葉や文化のちがいに、慣れるまで時間がかかる。`,
  };
}

// そのほかの留学先(人気の留学先から、人ごとに、3つが出る)。
const otherStudyOptions = (p: Person, kind: keyof typeof STUDY_KIND): TurningOption[] =>
  pickStable(
    STUDY_OTHERS.map((id) => ({ id })),
    3,
    personSeed(p),
  ).map((x) => studyCountryOption(x.id, kind));

// 専攻や学びにあった職(職種の id)。専攻のない人(高校・専門学校)は、学歴にあった職。
const MAJOR_JOBS: Record<string, string[]> = {
  humanities: ["office_general", "accounting_clerk", "city_hall", "national_clerk", "finance_sales", "pr_marketing", "legal_office", "other_sales", "journalist", "tour_guide"],
  science: ["software", "electric_eng", "machine_eng", "chem_eng", "arch_eng", "civil_eng", "it_infra", "data_sci", "researcher", "sys_consultant"],
  medical: ["nurse", "pharmacist", "doctor", "radiology", "rehab", "dietitian", "dental_hyg", "other_health", "care_manager"],
  education: ["school_teacher", "hs_teacher", "kindergarten", "childcare", "tutor", "social_worker", "other_teacher"],
  art: ["designer", "web_designer", "artist", "musician", "game_creator", "photographer", "manga", "novelist", "film_director", "fashion"],
  vocational: ["cook", "barber", "auto_mechanic", "nurse", "childcare", "dental_hyg", "electrician", "patissier", "care_worker", "web_designer"],
  hs_work: ["shop_clerk", "machine_assembly", "truck", "carpenter", "delivery", "care_worker", "guard", "food_factory", "police"],
};

const majorKey = (p: Person) => (p.major ?? (p.edu === "vocational" ? "vocational" : p.edu === "hs_work" ? "hs_work" : "humanities"));

const jobsQuestion = (title: string, prompt: string, jobs: JobDef[]): TurningQuestion => ({ title, prompt, options: jobs.map(jobOption) });

// 職につく: 専攻を活かせる仕事を中心に、ほかの仕事も、ランダムに出る候補から選べる。
const graduateWorkQuestion = (p: Person): TurningQuestion => ({
  title: "どんな仕事に就く?",
  prompt: "専攻や学びを活かせる仕事のほかに、思いがけない仕事も、候補に出ます。",
  options: [
    {
      id: "major",
      label: "専攻・学びを活かせる仕事",
      auto: true,
      apply: () => "",
      detail: (p) => `${p.field ? `${fieldById(p.field)?.label ?? ""}の学びが、そのまま活きる。` : "これまでの学びが、そのまま活きる。"}収入や就職のしやすさは、仕事によって、ちがう。`,
      children: (q) => jobsQuestion(q.field ? `${fieldById(q.field)?.label ?? "専攻"}を活かせる仕事` : "学びを活かせる仕事", "専攻や学科を活かして、どの仕事に就くだろう。", (q.field && fieldJobIds(q.field).length ? fieldJobIds(q.field) : MAJOR_JOBS[majorKey(q)] ?? []).map((id) => jobById(id)).filter((j): j is JobDef => Boolean(j))),
    },
    {
      id: "random",
      label: "ほかの業界の仕事に就く(業界を選ぶ)",
      apply: () => "",
      detail: () => "専攻とは関係のない、未経験の業界へ。まず業界を選び、そのなかの職種を選びます。",
      children: () => ({
        title: "どの業界へ?",
        prompt: "行きたい業界を選んでください。そのあと、その業界の職種を選びます(資格が必要な職種は、ここには出ません)。",
        options: OCC_ENTRY.map((o) => ({
          id: `occ_${o}`,
          label: OCC_LABEL[o],
          apply: () => "",
          detail: (p2, env, d) => `${OCC_OFFICIAL[o]}。${payText(p2, env, d, { occ: o, job: JOB_DEFAULT[o], payMult: jobById(JOB_DEFAULT[o])?.mult ?? 1 })}`,
          children: () => occQuestion(o, JOBS.filter((jb) => jb.occ === o && !jb.qual && jb.id !== "politician")),
        })),
      }),
    },
  ],
});

// 今の自分と同じ道は候補から外すため、各選択肢が「どの今の自分に当たるか」を持つ。
// 仕事の分岐の、「そのときの思い」ごとの職種の候補(設計上の分け方)。
const STABLE_JOBS = ["city_hall", "national_clerk", "police", "firefighter", "jsdf", "coast_guard", "prison_guard", "school_teacher", "hs_teacher", "kindergarten", "nurse", "pharmacist", "doctor", "train_driver", "power_plant", "postal", "bureaucrat", "judge", "accountant", "electrician", "paramedic", "childcare", "care_manager"];
const PASSION_JOBS = ["designer", "artist", "musician", "journalist", "game_creator", "streamer", "athlete", "fashion", "cook", "patissier", "barista", "craftsman", "farmer", "carpenter", "photographer", "trainer", "pet_care"];
const HELP_JOBS = ["police", "firefighter", "jsdf", "care_worker", "home_helper", "social_worker", "psychologist", "paramedic", "coast_guard", "funeral", "childcare"];
const OWN_JOBS = ["founder", "owner", "ceo", "trader", "cook", "barber", "carpenter", "streamer", "fisher", "craftsman", "lawyer", "accountant", "fp", "realtor"];

// 入力画面の選択肢は、「もし、あのとき〜していたら?」の形で見せる。(結果の表示や保存には、ふつうの言い方のラベルを使う)
export const branchAsk: Record<string, string> = {
  "childhood.motive.people": "もっと、人と関わる時間を持っていたら?",
  "childhood.motive.growth": "もっと、自分の力を伸ばしていたら?",
  "childhood.motive.body": "もっと、体を動かしていたら?",
  "childhood.option.out": "外で体を動かして過ごしていたら?",
  "childhood.option.study": "習い事や勉強に打ち込んでいたら?",
  "childhood.option.friends": "友だちと過ごす時間を大切にしていたら?",
  "childhood.option.alone": "ひとりで本やゲームに没頭していたら?",
  "education.motive.better": "もっといい進路を選んでいたら?",
  "education.motive.otherschool": "ほかの学校に行っていたら?",
  "education.motive.learn": "もっと学びを深めていたら?",
  "education.motive.indep": "早く自立して、働いていたら?",
  "education.motive.skill": "手に職をつけていたら?",
  "education.motive.wide": "進路の選択肢を、広げていたら?",
  "education.option.univ": "大学に進学していたら?",
  "education.option.vocational": "専門学校に進学していたら?",
  "education.option.hs_work": "高校を出てすぐ働いていたら?",
  "education.option.grad": "大学院に進学していたら?",
  "education.option.top_univ": "もっと難関の大学に進学していたら?",
  "education.option.other_hs": "別の高校に進学していたら?",
  "education.option.other_univ": "別の大学に進学していたら?",
  "education.option.med_school": "医学部・薬学部・歯学部など、医療系の大学に進学していたら?",
  "education.option.abroad_univ": "海外の大学に留学して学んでいたら?",
  "education.option.law_school": "専門職大学院(法科・会計・経営など)に進学していたら?",
  "education.option.abroad_grad": "海外の大学院に留学して学んでいたら?",
  "job.motive.pay": "もっと給料のいい仕事に就いていたら?",
  "job.motive.newfield": "別の業界に挑戦していたら?",
  "job.motive.stable": "安定した仕事に就いていたら?",
  "job.motive.passion": "好きなことを仕事にしていたら?",
  "job.motive.help": "人の役に立つ仕事をしていたら?",
  "job.motive.own": "自分で事業を起こしていたら?",
  "place.motive.city": "にぎやかな都会で暮らしていたら?",
  "place.motive.calm": "のんびりした土地で暮らしていたら?",
  "place.motive.world": "海外で、新しい世界を見ていたら?",
  "place.option.tokyo": "東京23区で暮らしていたら?",
  "place.option.metro": "大阪・名古屋・福岡などの大都市で暮らしていたら?",
  "place.option.local": "地方都市で暮らしていたら?",
  "place.option.rural": "郊外・農村部で暮らしていたら?",
  "place.option.abroad": "海外で暮らしていたら?",
  "family.motive.family": "もっと早く、家族をもっていたら?",
  "family.motive.free": "もっと、自由に生きていたら?",
  "family.option.married": "結婚していたら?",
  "family.option.single": "ひとりで生きていたら?",
  "family.option.child": "子どもを持っていたら?",
  "family.option.childfree": "子どもを持たなかったら?",
};

export const branches: CountryData["branches"] = {
  childhood: {
    label: "子どもの頃",
    defaultAge: 6,
    minAge: 3,
    options: [
      { id: "out", label: "外で体を動かして過ごす", matches: () => false, apply: (p) => (bump(p, { health: 8, bonds: 3 }), "放課後は、外で体を動かして過ごした") },
      { id: "study", label: "習い事や勉強に打ち込む", matches: () => false, apply: (p) => (bump(p, { learn: 8 }), "習い事や勉強に打ち込む日々を送った") },
      { id: "friends", label: "友だちと過ごす時間を大切にする", matches: () => false, apply: (p) => (bump(p, { bonds: 8 }), "友だちと過ごす時間がいちばん長かった") },
      { id: "alone", label: "ひとりで本やゲームに没頭する", matches: () => false, apply: (p) => (bump(p, { learn: 4, bonds: -2 }), "ひとりで本やゲームに没頭して過ごした") },
    ] satisfies BranchOption[],
    motives: [
      { id: "people", label: "もっと、人と関わる時間がほしかった", options: ["out", "friends"] },
      { id: "growth", label: "もっと、自分の力を伸ばしたかった", options: ["study", "alone"] },
      { id: "body", label: "もっと、体を動かしたかった", options: ["out"] },
      { id: "other", label: "その他" },
    ],
  },
  education: {
    label: "進路",
    defaultAge: 18,
    minAge: 15,
    options: [
      { id: "univ", label: "大学に進学する", matches: (s) => s.edu === "univ", apply: (p, r, d) => setEdu(p, r, d, "univ") },
      { id: "vocational", label: "専門学校に進学する", matches: (s) => s.edu === "vocational", apply: (p, r, d) => setEdu(p, r, d, "vocational") },
      { id: "hs_work", label: "高校を出てすぐ働く", matches: (s) => s.edu === "hs_work", apply: (p, r, d) => setEdu(p, r, d, "hs_work") },
      { id: "grad", label: "大学院に進学する", matches: (s) => s.edu === "grad", apply: (p, r, d) => setEdu(p, r, d, "grad") },
      {
        id: "top_univ",
        label: "もっと難関の大学に進学する",
        matches: () => false,
        apply: (p, r, d) => {
          const t = setEdu(p, r, d, "univ");
          p.payMult *= 1.06;
          p.history.eliteUniv = p.age;
          bump(p, { learn: 6, joy: 2 });
          return `${t}。志望を上げて、もっと難関の大学をめざした`;
        },
      },
      {
        id: "other_hs",
        label: "別の高校に進学する",
        matches: () => false,
        apply: (p) => {
          bump(p, { bonds: 3, joy: 2 });
          return "別の高校に進学した。通う道も、出会う友人も、ちがった";
        },
      },
      {
        id: "other_univ",
        label: "別の大学に進学する",
        matches: () => false,
        apply: (p, r, d) => {
          setEdu(p, r, d, "univ");
          bump(p, { bonds: 3, joy: 2 });
          return "別の大学に進学した。校風も、出会う人も、ちがった";
        },
      },
      {
        id: "med_school",
        label: "医学部・薬学部・歯学部など、医療系の大学に進学する",
        matches: (s) => s.major === "medical",
        apply: (p, r, d) => {
          setEdu(p, r, d, "univ");
          p.major = "medical";
          p.field = "m_med";
          bump(p, { learn: 10, money: -4, joy: -2 });
          return "医療系の大学に進学した。学ぶ期間は長く、大変な道に進んだ";
        },
      },
      {
        id: "abroad_univ",
        label: "海外の大学に留学して学ぶ",
        matches: () => false,
        apply: (p, r, d) => {
          setEdu(p, r, d, "univ");
          const city = moveAbroad(p, r, d);
          if (p.abroad) {
            p.abroad.study = { until: p.age + 4, kind: "college" };
            p.abroad.visa = "student";
          }
          p.cashDelta -= 300 * 10000;
          bump(p, { learn: 10, money: -5 });
          return `${city}の大学に留学した(費用は大きく、家族の支えと奨学金に頼る)`;
        },
      },
      {
        id: "law_school",
        label: "専門職大学院(法科・会計・経営など)に進学する",
        matches: () => false,
        apply: (p, r, d) => {
          setEdu(p, r, d, "grad");
          p.major = "humanities";
          p.payMult *= 1.08;
          bump(p, { learn: 10, money: -4 });
          return "専門職大学院に進学し、高度な資格をめざした";
        },
      },
      {
        id: "abroad_grad",
        label: "海外の大学院に留学して学ぶ",
        matches: () => false,
        apply: (p, r, d) => {
          setEdu(p, r, d, "grad");
          const city = moveAbroad(p, r, d);
          if (p.abroad) {
            p.abroad.study = { until: p.age + 2, kind: "grad" };
            p.abroad.visa = "student";
          }
          p.cashDelta -= 300 * 10000;
          bump(p, { learn: 12, money: -4 });
          return `${city}の大学院に留学した`;
        },
      },
    ] satisfies BranchOption[],
    motives: [
      { id: "better", label: "もっといい進路にしたかった", note: "より上の学歴・志望校・留学をめざす道", options: ["top_univ", "med_school", "abroad_univ", "grad", "law_school", "abroad_grad"] },
      { id: "otherschool", label: "ほかの学校に行きたかった", note: "学力の高さではなく、校風・場所・友人などで、別の学校を選ぶ道", options: ["other_hs", "other_univ"] },
      { id: "learn", label: "もっと学びを深めたかった", options: ["univ", "grad", "top_univ", "law_school", "abroad_grad"] },
      { id: "indep", label: "早く自立して、働きたかった", options: ["hs_work", "vocational"] },
      { id: "skill", label: "手に職をつけたかった", options: ["vocational", "hs_work"] },
      { id: "wide", label: "進路の選択肢を、広げたかった", options: ["univ", "grad", "vocational", "abroad_univ"] },
      { id: "other", label: "その他" },
    ],
  },
  job: {
    label: "仕事",
    defaultAge: 22,
    minAge: 18,
    options: OCC_ENTRY.map<BranchOption>((occ) => ({
      id: occ,
      label: OCC_LABEL[occ],
      matches: (s) => s.occ === occ,
      apply: (p, r, d) => {
        if (d.workStartAge[p.edu] > p.age) p.edu = p.age >= 22 ? "univ" : p.age >= 20 ? "vocational" : "hs_work";
        const title = assignJob(p, occ, r, d);
        return `${title}として働く道に進んだ`;
      },
    })),
    // 仕事の分岐は、そのときの思いを聞いたうえで、具体的な職種(すべての職種から)を選ぶ。
    motives: [
      { id: "pay", label: "もっと給料のいい仕事に就きたかった", note: "収入の水準が高めの職種", jobFilter: (j, s) => j.mult >= 1.25 && (!s || j.id !== s.job) },
      { id: "newfield", label: "別の業界に挑戦してみたかった", note: "いまの分野とは、ちがう大分類の職種", jobFilter: (j, s) => !s || s.occ === "none" || j.occ !== s.occ },
      { id: "stable", label: "安定した仕事に就きたかった", note: "公務員・資格職・インフラなど", jobFilter: (j) => STABLE_JOBS.includes(j.id) },
      { id: "passion", label: "好きなことを仕事にしたかった", note: "表現・ものづくり・食・スポーツなど", jobFilter: (j) => j.group === "芸能・表現" || PASSION_JOBS.includes(j.id) },
      { id: "help", label: "人の役に立つ仕事がしたかった", note: "医療・福祉・教育・安全を守る仕事", jobFilter: (j) => ["医療", "福祉・保育", "教育"].includes(j.group ?? "") || HELP_JOBS.includes(j.id) },
      { id: "own", label: "自分で事業を起こしたかった", note: "経営・独立・自営に近い仕事", jobFilter: (j) => OWN_JOBS.includes(j.id) || j.occ === "mgmt" },
      { id: "other", label: "その他(すべての職種から選ぶ)" },
    ],
  },
  place: {
    label: "住む場所",
    defaultAge: 22,
    minAge: 15,
    options: [
      ...(["tokyo", "metro", "local", "rural"] as const).map<BranchOption>((r) => ({
      id: r,
      label: { tokyo: "東京23区で暮らす", metro: "大阪・名古屋・福岡などの大都市で暮らす", local: "地方都市で暮らす", rural: "郊外・農村部で暮らす" }[r],
      matches: (s) => s.region === r,
      apply: (p, rng, d) => `${moveTo(p, rng, d, r)}で暮らし始めた`,
    })),
      { id: "abroad", label: "海外で暮らす", matches: () => false, apply: (p, rng, d) => `${moveAbroad(p, rng, d)}で暮らし始めた` },
    ],
    motives: [
      { id: "city", label: "にぎやかな都会で暮らしたかった", options: ["tokyo", "metro"] },
      { id: "calm", label: "のんびりした土地で暮らしたかった", options: ["local", "rural"] },
      { id: "world", label: "海外で、新しい世界を見たかった", options: ["abroad"] },
      { id: "other", label: "その他" },
    ],
  },
  family: {
    label: "家族",
    defaultAge: 28,
    minAge: 20,
    options: [
      { id: "married", label: "結婚する", matches: (s) => s.married, apply: (p, r, d) => ((p.married = true), (p.withParents = false), (p.partner = randomPartner(r, d, p.age, "married", p.mbti, p)), `${fullName(p.partner)}さんと結婚した`) },
      { id: "single", label: "ひとりで生きていく", matches: (s) => !s.married, apply: (p) => ((p.stayingSingle = true), (p.married = false), (p.marriageBias = 0.1), "ひとりで生きていくと決めた") },
      { id: "child", label: "子どもを持つ", matches: (s) => s.kids > 0, apply: (p, r, d) => ((p.married = true), (p.childWish = 2), (p.partner = randomPartner(r, d, p.age, "married", p.mbti, p)), `${fullName(p.partner)}さんと結婚して、子どもを持つと決めた`) },
      { id: "childfree", label: "子どもを持たない", matches: (s) => s.kids === 0 && s.married, apply: (p) => ((p.childFree = true), "子どもを持たない暮らしを選んだ") },
    ] satisfies BranchOption[],
    motives: [
      { id: "family", label: "もっと早く、家族をもちたかった", options: ["married", "child"] },
      { id: "free", label: "もっと、自由に生きたかった", options: ["single", "childfree"] },
      { id: "other", label: "その他" },
    ],
  },
};


// ---- 進路(18歳) ----
const MAJORS: { id: Major; label: string; note: string; learn: number }[] = [
  { id: "humanities", label: "文系(法・経済・文学など)", note: "進路の幅が広い。就職先は、一般企業や公務員が中心。", learn: 4 },
  { id: "science", label: "理工系", note: "技術職やITに進みやすく、給料はやや高め。実験や課題で忙しい。", learn: 8 },
  { id: "medical", label: "医療・薬・看護系", note: "資格があり、需要が安定している。学ぶ期間は長く、大変。", learn: 10 },
  { id: "education", label: "教育系", note: "教員を目指す人が多い。採用は年度ごとに変わる。", learn: 5 },
  { id: "art", label: "芸術・スポーツ系", note: "好きを深められるが、収入が安定する仕事は限られる。", learn: 2 },
];

const majorQuestion = (): TurningQuestion => ({
  title: "何を学ぶ?",
  prompt: "学ぶ分野は、卒業後の仕事と給料にも関わってきます。",
  options: MAJORS.map((m) => ({
    id: m.id,
    label: m.label,
    apply: (p) => ((p.major = m.id), bump(p, { learn: m.learn }), `専攻は、${m.label.split("(")[0]}を選んだ`),
    detail: (p, env, data) => `${m.note} ${payText(p, env, data, { age: 25, edu: "univ", major: m.id, occ: "office", firm: "mid", region: p.region })}`,
  })),
});

type UnivKind = { id: string; label: string; cost: string; away: boolean; priv: boolean };
const UNIVS: UnivKind[] = [
  { id: "pub_local", label: "国公立・実家から通える大学", cost: "学費は4年間で約250万円。実家から通えるので、生活費の負担は小さい。", away: false, priv: false },
  { id: "pub_away", label: "国公立・都市部の大学へ(一人暮らし)", cost: "学費は約250万円。家賃と生活費が加わり、4年間で約700〜900万円の負担になる。", away: true, priv: false },
  { id: "pri_local", label: "私立・実家から通える大学", cost: "学費は4年間で約400〜550万円(文系は約400万、理系は約550万)。", away: false, priv: true },
  { id: "pri_away", label: "私立・上京して通う大学", cost: "学費と生活費で、4年間に約1,000〜1,400万円。奨学金を使う人も多い。", away: true, priv: true },
];

// 志望校のレベル: 頭の良さ(と学び)で、合格する確率が決まる。届かなければ、一段やさしい大学に進む。
const LEVELS = [
  { id: "hard", label: "難関校をめざす", diff: 70, mult: 1.06, cheaper: "standard" },
  { id: "standard", label: "標準的な大学", diff: 55, mult: 1.0, cheaper: "easy" },
  { id: "easy", label: "入りやすい大学", diff: 42, mult: 0.96, cheaper: "easy" },
] as const;

const tuitionText = (u: UnivKind, level: (typeof LEVELS)[number]["id"]) => {
  if (!u.priv) return "学費は4年間で約250万円(国公立)";
  return level === "hard" ? "学費は4年間で約450〜600万円(私立の難関校)" : "学費は4年間で約400〜550万円(私立)";
};

const levelQuestion = (u: UnivKind): TurningQuestion => ({
  title: "どのレベルの大学をめざす?",
  prompt: "合格できるかどうかは、あなたの素質と、これまでの学びで決まります。",
  options: LEVELS.map((l) => ({
    id: l.id,
    label: l.label,
    auto: l.id === "standard",
    apply: (p, rng) => {
      const r = passRate(p, l.diff + (u.priv ? -6 : 0));
      let got: (typeof LEVELS)[number] = l;
      let text = `${l.label.replace("をめざす", "")}に合格した`;
      // 届かなければ、一段やさしい大学に進む(最後は入りやすい大学)。
      if (rng() > r) {
        got = LEVELS.find((x) => x.id === l.cheaper)!;
        text = got.id === l.id ? "志望校には届かなかったが、なんとか進学先を見つけた" : `第一志望には届かず、${got.label.replace("をめざす", "")}に進んだ`;
      }
      p.payMult *= got.mult;
      bump(p, { learn: got.id === "hard" ? 4 : 0 });
      return text;
    },
    detail: (p) => `合格率の目安は約${pctText(passRate(p, l.diff + (u.priv ? -6 : 0)))}(${abilityText(p)})。${tuitionText(u, l.id)}。`,
    children: majorQuestion,
  })),
});

const univQuestion = (): TurningQuestion => ({
  title: "どんな大学?",
  prompt: "学費と暮らし方が、ここで大きく変わります。",
  options: UNIVS.map((u) => ({
    id: u.id,
    label: u.label,
    auto: u.id === "pub_local",
    apply: (p, r, d) => {
      const text = setEdu(p, r, d, "univ", u.away);
      bump(p, { money: u.priv ? -3 : 0 });
      p.occ = null;
      return `${u.priv ? "私立" : "国公立"}の${text}`;
    },
    detail: (p) => `${u.cost}${p.background === "tight" ? " あなたの家計では、奨学金が必要になりそう。" : p.background === "comfortable" ? " あなたの家計なら、無理なく通えそう。" : ""}`,
    children: () => levelQuestion(u),
  })),
});
const vocationalQuestion = (): TurningQuestion => ({
  title: "どの分野の専門学校?",
  prompt: "2〜3年で資格や技術を身につけ、早く働き始められます。",
  options: [
    { id: "care", label: "医療・福祉", note: "資格を取れば、全国で働ける。", mult: 1.1, learn: 6 },
    { id: "it", label: "IT・デザイン", note: "技術職に進みやすい。流行の移り変わりは速い。", mult: 1.0, learn: 5 },
    { id: "craft", label: "調理・美容", note: "技術で勝負する世界。独立を目指す人もいる。", mult: 0.85, learn: 3 },
    { id: "tech", label: "工業・技術", note: "製造や設備の現場で、求められる。", mult: 1.0, learn: 4 },
  ].map((v) => ({
    id: v.id,
    label: v.label,
    apply: (p: Person, r: Rng, d: CountryData) => {
      const ok = r() < passRate(p, 40);
      p.payMult = v.mult;
      bump(p, { learn: v.learn });
      return ok ? `${setEdu(p, r, d, "vocational")}(${v.label})` : `第一志望の専門学校には届かず、別の学校の${v.label}に進んだ`;
    },
    detail: (p: Person, env: Env, data: CountryData) => `${v.note} 合格率の目安は約${pctText(passRate(p, 40))}(${abilityText(p)})。学費は2〜3年で約200〜400万円。${payText(p, env, data, { age: 22, edu: "vocational", occ: "office", firm: "mid", payMult: v.mult })}`,
  })),
});

const workQuestion = (): TurningQuestion => ({
  title: "どんな仕事で働く?",
  prompt: "高校を出て、すぐに働き始めます。",
  options: (
    [
      ["factory", "製造・物流", "factory" as Occ, "地元にも求人が多い。交代勤務がある。"],
      ["trade", "建設・技能の仕事", "factory" as Occ, "腕を磨くほど給料が上がる。体力が必要。"],
      ["shop", "販売・サービス", "service" as Occ, "接客が中心。休みが不規則になりやすい。"],
      ["gov", "公務員(初級)", "public" as Occ, "試験に受かる必要があるが、安定している。"],
    ] as const
  ).map(([id, label, occ, note]) => ({
    id,
    label,
    apply: () => "",
    detail: (p: Person, env: Env, data: CountryData) => `${note} ${payText(p, env, data, { age: 22, edu: "hs_work", occ, firm: "mid" })}`,
    children: (): TurningQuestion => ({
      title: "働く場所は?",
      prompt: "地元に残るか、都市へ出るか。",
      options: [
        {
          id: "local",
          label: "地元で働く",
          auto: id === "factory",
          apply: (p, r, d) => `${setEdu(p, r, d, "hs_work")}(地元の${label})` && ((p.occ = occ), `高校を出て、地元で${label}の仕事に就いた`),
          detail: (p, env, data) => `実家から通え、暮らしの費用は抑えられる。${payText(p, env, data, { age: 22, edu: "hs_work", occ, region: p.birthRegion })}`,
        },
        {
          id: "city",
          label: "都市部に出て働く",
          apply: (p, r, d) => {
            setEdu(p, r, d, "hs_work");
            p.occ = occ;
            const city = moveTo(p, r, d, metroOrTokyo(r));
            bump(p, { money: -2, bonds: -2 });
            return `高校を出て、${city}で${label}の仕事に就いた`;
          },
          detail: (p, env, data) => `給料は地方より高いが、家賃などの生活費もかかる。${payText(p, env, data, { age: 22, edu: "hs_work", occ, region: "metro" })}`,
        },
      ],
    }),
  })),
});

const pathOptions: TurningOption[] = [
  {
    id: "univ",
    label: "大学に進学する",
    apply: () => "",
    detail: (p, env, data) => `4年間の学費の目安は、国公立で約250万円、私立で約400〜550万円。${payText(p, env, data, { age: 25, edu: "univ", occ: "office", firm: "mid" })}`,
    children: univQuestion,
  },
  {
    id: "vocational",
    label: "専門学校に進学する",
    apply: () => "",
    detail: (p, env, data) => `学費は2〜3年で約200〜400万円。早く働き始められる。${payText(p, env, data, { age: 22, edu: "vocational", occ: "office", firm: "mid" })}`,
    children: vocationalQuestion,
  },
  {
    id: "work",
    label: "高校を出て働く",
    apply: () => "",
    detail: (p, env, data) => `4年早く収入を得られるが、生涯の年収は大卒より低い傾向。${payText(p, env, data, { age: 22, edu: "hs_work", occ: "office", firm: "mid" })}`,
    children: workQuestion,
  },
];

const opt = (id: string, label: string, apply: TurningOption["apply"], extra: Partial<TurningOption> = {}): TurningOption => ({ id, label, apply, ...extra });
const flowText = (t: string) => () => t;

// ---- 海外へ移住する: 国を選ぶ ----
const countryQuestion = (): TurningQuestion => ({
  title: "どの国へ?",
  prompt: "移り住む国で、現在地も、収入も、物価も変わります。",
  options: jpDataCountries().map((c) => ({
    id: c.id,
    label: `${c.name}(${c.cities.join("・")})`,
    apply: (p, r, d) => {
      const city = moveAbroad(p, r, d, c.id);
      return `${city}に移り住んだ`;
    },
    detail: () => `収入の水準は日本の約${Math.round(c.incomeFactor * 100)}%、物価は約${Math.round(c.costFactor * 100)}%。言葉や文化のちがいに、慣れるまで時間がかかる。`,
  })),
});
import { COUNTRIES } from "@/lib/sim/data/jp-countries";
function jpDataCountries() {
  return COUNTRIES;
}

// ---- 住まい(35歳): 地域ごとの価格の目安と、月々の返済 ----
export const HOME_PRICE: Record<Region, number> = { tokyo: 6500, metro: 4500, local: 3200, rural: 2500 };
const HOME_TYPES = [
  { id: "newflat", label: "新築マンション", f: 1.0, note: "設備が新しく、資産価値も保ちやすい。価格は高め。" },
  { id: "usedflat", label: "中古マンション", f: 0.65, note: "価格を抑えられる。修繕積立金などの費用がかかる。" },
  { id: "house", label: "郊外の戸建て", f: 0.85, note: "広さは確保できるが、車や通勤の負担が増える。" },
];
export const monthlyMan = (priceMan: number) => priceMan * 0.9 * 0.00306; // 頭金1割、35年、金利1.5%の目安

const homeQuestion = (): TurningQuestion => ({
  title: "どんな住まい?",
  prompt: "価格は、住む地域で大きく変わります。",
  options: HOME_TYPES.map((h) => ({
    id: h.id,
    label: h.label,
    apply: (p, r, d) => {
      const price = HOME_PRICE[p.region] * h.f;
      const takeHome = incomeOf(p, d, p.econ) * (p.married ? 1.35 : 1) * d.cashflow.takeHome;
      if (monthlyMan(price) * 12 > takeHome * 0.35 || (p.stats.money < 35 && p.background === "tight")) return "住宅の購入を考えたが、ローンの審査が通らなかった";
      p.owned = true;
      p.withParents = false;
      bump(p, { money: -3 });
      return `ローンを組んで、${h.label}を買った`;
    },
    detail: (p, env, data) => {
      const price = HOME_PRICE[p.region] * h.f;
      const m = monthlyMan(price);
      const income = incomeOf(p, data, env.econ) * (p.married ? 1.35 : 1);
      return `${h.note} ${data.regionLabel[p.region]}での価格の目安は約${Math.round(price / 10) * 10}万円。月々の返済は約${m.toFixed(1)}万円で、世帯の年収の約${Math.round(((m * 12) / Math.max(1, income)) * 100)}%。`;
    },
  })),
});

// ---- 子どもの、お年玉・お小遣いの使い道(毎年ではなく、数年おきに出る) ----
const kidMoney = (id: string, age: number, title: string): TurningPoint => ({
  id,
  age,
  title,
  prompt: "お正月にもらったお年玉や、ためたお小遣い。どうしよう。",
  options: [
    opt("save", "とっておく・ためる", (p) => (bump(p, { money: 3 }), "お年玉やお小遣いを、使わずに、ためておいた"), { auto: true, detail: () => "お金は減らない。ほしいものは、がまんすることになる。" }),
    opt("game", "ゲームやおもちゃ・お菓子に使う", (p) => ((p.cashDelta -= 5000), bump(p, { joy: 4 }), "お年玉で、ゲームやおもちゃ、お菓子を買った"), { detail: () => "5,000円ほど使う。楽しい気分になるが、すぐに使い切ることもある。" }),
    opt("book", "本や文房具、習いごとの道具に使う", (p) => ((p.cashDelta -= 4000), bump(p, { learn: 4 }), "お年玉で、本や文房具を買った"), { detail: () => "4,000円ほど使う。学ぶことが、少し楽しくなる。" }),
    opt("gift", "家族や友だちへのプレゼントに使う", (p) => ((p.cashDelta -= 3000), bump(p, { bonds: 5 }), "お年玉で、家族や友だちにプレゼントを贈った"), { detail: () => "3,000円ほど使う。つながりが、少し深まる。" }),
    opt("fav", "好きなこと・推しのために使う", (p) => ((p.cashDelta -= 8000), bump(p, { joy: 6, money: -1 }), "お年玉を、好きなことや推しのために使った"), { detail: () => "8,000円ほど使う。夢中になれる時間が増える。" }),
  ],
});

export const turningPoints: TurningPoint[] = [
  kidMoney("kidmoney8", 8, "お年玉の使い道"),
  kidMoney("kidmoney11", 11, "お年玉とお小遣いの使い道"),
  kidMoney("kidmoney14", 14, "お年玉とお小遣いの使い道"),
  kidMoney("kidmoney17", 17, "お年玉とお小遣いの使い道"),
  {
    id: "play6",
    age: 6,
    title: "小学校に入るころ",
    prompt: "放課後、あなたはどう過ごすことが多かっただろう。",
    options: [
      opt("out", "外で体を動かす", (p) => (bump(p, { health: 8, bonds: 3 }), "放課後は、外で体を動かして過ごした")),
      opt("study", "習い事や勉強に打ち込む", (p) => (bump(p, { learn: 8 }), "習い事や勉強に打ち込む日々を送った"), { detail: (p) => (p.background === "tight" ? "家計に余裕がなく、習い事は限られそう。" : "習い事には、月に数千〜1万円ほどかかる。") }),
      opt("friends", "友だちと過ごす", (p) => (bump(p, { bonds: 8 }), "友だちと過ごす時間がいちばん長かった"), { auto: true }),
      opt("alone", "ひとりで本やゲームに没頭する", (p) => (bump(p, { learn: 4, bonds: -2 }), "ひとりで本やゲームに没頭して過ごした")),
    ],
  },
  {
    id: "teen12",
    age: 12,
    title: "中学生になるころ",
    prompt: "部活や毎日の過ごし方を、どうするだろう。",
    options: [
      opt("sports", "運動部に入る", (p) => (bump(p, { health: 6, bonds: 5 }), "運動部に打ち込んだ"), { auto: true }),
      opt("culture", "文化部に入る", (p) => (bump(p, { learn: 4, bonds: 3 }), "文化部で、好きなことに時間を使った")),
      opt("free", "部活に入らず自由に過ごす", (p) => (bump(p, { health: 2 }), "部活には入らず、自由に過ごした")),
      opt("exam", "受験に向けて塾に通う", (p) => (bump(p, { learn: 8, health: -2 }), "受験に向けて、塾に通う日々が始まった"), { detail: (p) => `塾代は年に数十万円かかる。${p.background === "tight" ? "家計には重い負担になりそう。" : ""}` }),
    ],
  },
  {
    id: "hs15",
    age: 15,
    title: "高校を選ぶ",
    prompt: "どんな高校に進むだろう。",
    options: [
      {
        id: "academic",
        label: "進学校の普通科",
        apply: (p, rng) => {
          if (rng() < passRate(p, 62)) return (bump(p, { learn: 8 }), "進学校の普通科に合格し、進んだ");
          return (bump(p, { bonds: 4, health: 2 }), "進学校には届かず、家から通える地元の高校に進んだ");
        },
        detail: (p) => `大学進学の選択肢が広がる。勉強の競争は厳しい。合格率の目安は約${pctText(passRate(p, 62))}(${abilityText(p)})。公立の学費は3年間で約150万円、私立は約300万円。`,
      },
      {
        id: "vocational",
        label: "商業・工業・農業などの専門高校",
        apply: (p, rng) => {
          if (rng() < passRate(p, 45)) return (bump(p, { learn: 2, money: 3 }), "専門高校に合格し、手に職をつける学びを始めた");
          return (bump(p, { bonds: 4 }), "専門高校には届かず、家から通える地元の高校に進んだ");
        },
        detail: (p) => `資格が取れ、就職に強い。地元企業とのつながりも深い。合格率の目安は約${pctText(passRate(p, 45))}(${abilityText(p)})。公立の学費は3年間で約150万円。`,
      },
      opt("local", "家から通える地元の高校", (p) => (bump(p, { bonds: 4, health: 2 }), "家から通える地元の高校に進んだ"), { auto: true, detail: (p) => `通学の負担が小さく、友人関係が地元に根づく。合格率の目安は約${pctText(passRate(p, 34))}。学費は3年間で約150万円(公立)。` }),
    ],
  },
  { id: "path18", age: 18, title: "進路を決める", prompt: "高校を卒業したあと、どうするだろう。", options: pathOptions },
  {
    id: "job",
    // 専門学校・大学・大学院は、卒業の1年前に聞く(高校は、卒業の年の「進路を決める」で聞く)。
    age: (p) => {
      const g = p.gradAge ?? (p.edu === "grad" ? 24 : p.edu === "univ" ? 22 : p.edu === "vocational" ? 20 : 18);
      return g >= 20 && p.occ === null && !p.history.graduated ? g - 1 : g;
    },
    title: "卒業後の進路",
    prompt: "学びの先に、どんな道を選ぶだろう。大学院、留学、仕事探し、就職など、選べます。",
    promptFn: (p) => {
      const g = p.gradAge ?? (p.edu === "grad" ? 24 : p.edu === "univ" ? 22 : p.edu === "vocational" ? 20 : 18);
      // 大学院は、大学を出た人だけが選べる。大学院を出た人には、書かない。
      const ways = p.edu === "univ" ? "大学院、留学、仕事探し、就職など" : "留学、仕事探し、就職など";
      return p.age < g ? `一年後に、卒業が控えています。卒業したあと、どうするか。${ways}、いまのうちに決めておきましょう(卒業のときから、その道に進みます)。` : `学びの先に、どんな道を選ぶだろう。${ways}、選べます。`;
    },
    // 留学中は、聞かない(留学を終えたときに、次の道を選ぶ)。
    // 卒業してから、6年までの間だけ。長く職についていない大人や、専業主婦(夫)などには、聞かない。
    when: (p) => p.occ === null && p.jobPlan === null && p.abroad?.visa !== "student" && !p.abroad?.study && p.age - (p.gradAge ?? (p.edu === "grad" ? 24 : p.edu === "univ" ? 22 : p.edu === "vocational" ? 20 : 18)) <= 6,
    repeatWhile: (p) => p.occ === null,
    options: [
      {
        id: "grad",
        label: "大学院に進学する",
        show: (p) => p.edu === "univ",
        apply: () => "",
        detail: (p) => `大学に在籍している人だけが選べる道。学費は2年で約100〜250万円。専門職・研究職・技術職で有利になる一方、働き始めは2年遅れる。国内の合格率の目安は約${pctText(passRate(p, 58))}(${abilityText(p)})。`,
        children: () => ({
          title: "どこで学ぶ?",
          prompt: "国内の大学院に進むか、海外の大学院に留学するか。",
          options: [
            {
              id: "grad_jp",
              label: "国内の大学院",
              auto: true,
              apply: (p, r, d) => {
                if (r() > passRate(p, 58)) return "大学院の入試に届かず、就職の道を考え直すことになった";
                p.gradAge = null;
                return setEdu(p, r, d, "grad");
              },
              detail: (p) => `合格率の目安は約${pctText(passRate(p, 58))}(${abilityText(p)})。届かなければ、就職の道を考え直す。`,
            },
            { id: "grad_abroad", label: "海外の大学院に留学する", apply: () => "", detail: () => "2年間。費用は大きい(奨学金や、家族の支えを使えることもある)。", children: (p) => studyCountryQuestion("grad", p) },
          ],
        }),
      },
      {
        id: "univ",
        label: "大学に進学する(編入・入学)",
        show: (p) => (p.edu === "hs_work" || p.edu === "vocational") && p.age <= 24,
        apply: () => "",
        detail: () => "高校や専門学校を出たあとに、大学で学ぶ道。学費は4年間で約250〜550万円(国公立・私立で、ちがう)。",
        children: () => ({
          title: "どこで学ぶ?",
          prompt: "国内の大学に進むか、海外の大学に留学するか。",
          options: [
            {
              id: "univ_jp",
              label: "国内の大学",
              auto: true,
              apply: (p, r, d) => {
                if (r() > passRate(p, 52)) return "大学の入試に届かず、別の道を考え直すことになった";
                return setEdu(p, r, d, "univ");
              },
              detail: (p) => `合格率の目安は約${pctText(passRate(p, 52))}(${abilityText(p)})。`,
            },
            { id: "univ_abroad", label: "海外の大学に留学する", apply: () => "", detail: () => "3年ほど。費用は大きい(奨学金や、家族の支えを使えることもある)。", children: (p) => studyCountryQuestion("college", p) },
          ],
        }),
      },
      {
        id: "abroad",
        label: "留学する",
        apply: () => "",
        detail: (p) => `語学留学なら1年、大学や専門学校なら3年${p.edu === "univ" ? "(大学院への留学は、「大学院に進学する」から選べます)" : ""}。費用は、家計と奨学金で、まかなえる範囲の道だけが出ます。留学を終えたら、現地で働くか、国を変えるか、帰国するかを選べます。`,
        children: () => ({
          title: "どんな留学?",
          prompt: "留学のかたちを選びます。そのあと、行き先の国を選びます。",
          options: [
            { id: "lang", label: "語学留学(1年)", apply: () => "", cost: (p) => studyHide(p, 150), detail: () => "費用は約150万円。語学と視野が広がる。就職には、直接はつながりにくい。", children: (p) => studyCountryQuestion("lang", p) },
            { id: "college", label: "大学・専門学校に留学(3年)", apply: () => "", cost: (p) => studyHide(p, 600), detail: () => "費用は約600万円。大卒の資格が得られ、現地での就職の道も開ける。", children: (p) => studyCountryQuestion("college", p) },
          ],
        }),
      },
      {
        id: "search",
        label: "まだ職を探す",
        apply: (p) => (bump(p, { money: -2, joy: -2, learn: 1 }), "すぐには職を決めず、しばらく、職を探すことにした"),
        detail: () => "焦らず、納得できる仕事を探せる。そのあいだ、収入はなく、貯金や家族の支えで暮らすことになる。数年たっても決まらないと、働き口は、そのときの状況で決まる。",
      },
      {
        id: "work",
        label: "職につく",
        auto: true,
        apply: () => "",
        detail: () => "専攻や学びを活かせる仕事を中心に、そのほかの仕事も、候補から選べます。",
        children: (p) => graduateWorkQuestion(p),
      },
    ],
  },
  {
    id: "career25",
    age: 25,
    title: "働き方を見つめ直す",
    prompt: "いまの仕事と、これからをどう考えるだろう。",
    when: (p) => p.occ !== null,
    options: [
      {
        id: "stay",
        label: "いまの仕事を続ける",
        auto: true,
        apply: () => "",
        detail: (p, env, data) => `${p.age}歳から先も、年とともに給料は上がっていく。いまの年収は約${round10(incomeOf(p, data, env.econ))}万円${econNote(env)}。`,
        children: () => ({
          title: "どう続ける?",
          prompt: "同じ仕事でも、向き合い方で道が分かれます。",
          options: [
            opt("rise", "昇進をめざして、成果を出す", (p) => ((p.payMult *= 1.05), bump(p, { money: 4, health: -2, bonds: -1 }), "昇進をめざして、成果を出すことに力を注いだ"), { detail: () => "責任と収入は増えるが、休みと時間は減りやすい。" }),
            opt("steady", "無理せず、自分のペースで続ける", (p) => (bump(p, { health: 3, bonds: 2 }), "無理せず、自分のペースで働き続けることにした"), { auto: true, detail: () => "収入の伸びは緩やか。そのぶん、暮らしの時間と健康を保てる。" }),
          ],
        }),
      },
      {
        id: "switch",
        label: "転職する",
        apply: () => "",
        detail: (p, env) => `転職の成否は、景気に左右される。いまは${env.econLabel}。${env.econ < -0.4 ? "求人は少なく、条件のよい転職は難しい時期。" : env.econ > 0.6 ? "求人が多く、条件を上げやすい時期。" : ""}`,
        children: () => ({
          title: "どんな転職?",
          prompt: "どこへ移るかで、収入も暮らしも変わります。",
          options: [
            opt("up", "同じ業界で、より条件のよい会社へ", (p, r) => {
              if (p.econ < -0.6 && r() < 0.45) return "条件のよい転職を目指したが、不況で決まらなかった";
              p.payMult *= 1.1;
              if (p.firm === "small") p.firm = "mid";
              else if (p.firm === "mid") p.firm = "large";
              return "同じ業界の、より条件のよい会社に移った";
            }, { detail: (p, env, data) => `年収は1〜2割増えることが多い。いまの年収は約${round10(incomeOf(p, data, env.econ))}万円。` }),
            {
              id: "new",
              label: "未経験の業界に挑戦する",
              apply: () => "",
              detail: () => "行き先の業界と職種を、自分で選ぶ。最初は給料が下がることが多いが、新しい力がつく。",
              children: (p0) => industryQuestion({ factor: 0.9, exclude: (q) => q.occ as Occ | null, finish: (p, title) => (bump(p, { learn: 4 }), `${title}に、未経験から挑戦した`) }),
            },
            { id: "abroad", label: "海外で働く", apply: () => "", show: (p) => !p.abroad, detail: () => "収入は、働く国の水準になる。", children: countryQuestion },
            opt("home", "地元に戻って働く", (p) => ((p.region = p.birthRegion), (p.city = p.birthPlace), (p.withParents = false), bump(p, { bonds: 5 }), `地元の${p.city}に戻って、働くことにした`), {
              show: (p) => p.region !== p.birthRegion,
              detail: (p, env, data) => payText(p, env, data, { region: p.birthRegion }),
            }),
          ],
        }),
      },
      {
        id: "indep",
        label: "独立して挑戦する",
        apply: () => "",
        detail: (p, env) => `収入は大きく上下する。景気の影響を、もっとも受ける働き方。いまは${env.econLabel}。`,
        children: () => ({
          title: "どう独立する?",
          prompt: "始め方で、リスクが変わります。",
          options: [
            opt("side", "会社に勤めながら、副業で始める", (p, r) => (bump(p, { money: Math.round((r() - 0.35) * 12), learn: 3, health: -2 }), "会社に勤めながら、副業を始めた")),
            opt("quit", "退職して、本格的に独立する", (p, r) => ((p.employment = "self"), (p.sector = "private"), (p.payMult = 1), bump(p, { money: Math.round((r() - 0.4) * 24) }), "会社を辞めて、いまの仕事のまま独立した")),
          ],
        }),
      },
      {
        id: "relearn",
        label: "学び直す",
        apply: () => "",
        detail: () => "収入は一時的に下がるが、長い目では選択肢が広がる。",
        children: () => ({
          title: "どう学ぶ?",
          prompt: "働きながら学ぶか、離れて学ぶか。",
          options: [
            opt("cert", "働きながら、資格をとる", (p) => ((p.payMult *= 1.04), bump(p, { learn: 8, money: -2, health: -2 }), "働きながら、資格の勉強を続けた"), { detail: () => "費用は数万〜数十万円。時間のやりくりが大変。" }),
            opt("school", "仕事を減らして、大学院に通う", (p) => ((p.payMult *= 1.08), bump(p, { learn: 12, money: -8 }), "仕事を減らして、大学院に通い始めた"), { show: (q) => q.edu !== "grad", detail: () => "学費と収入減で、数年は家計が苦しくなる。" }),
          ],
        }),
      },
    ],
  },
  {
    id: "partner28",
    age: 28,
    title: "パートナーのこと",
    prompt: "人との関係を、どうしていくだろう。",
    when: (p) => !p.married && !p.stayingSingle,
    options: [
      {
        id: "propose",
        label: "いま付き合っている人と、結婚に向けて進む",
        show: (p) => p.partner?.status === "dating",
        apply: (p) => ((p.proposeAt = p.age), (p.marriageBias = 2), bump(p, { bonds: 4, joy: 3 }), `${p.partner ? fullName(p.partner) + "さん" : "いまの人"}との結婚を、意識しはじめた`),
        detail: (p) => `${p.partner ? `${fullName(p.partner)}さん${p.partner.mbti ? `(${typeCall(p.partner.mbti)}${p.mbti ? `・相性 ${compat(p.mbti, p.partner.mbti)}%` : ""})` : ""}と、` : ""}来年にも、結婚の話が出ます(結婚するかどうかは、そのとき選べます)。`,
      },
      {
        id: "seek",
        label: "結婚を意識して動く",
        show: (p) => p.partner?.status !== "dating",
        apply: () => "",
        detail: () => "出会い方によって、費用も、合う確率も変わる。",
        children: () => ({
          title: "どう出会う?",
          prompt: "出会いの方法を選びます。",
          options: [
            opt("intro", "職場や友人の紹介", (p) => ((p.marriageBias = 2), bump(p, { bonds: 4 }), "友人や職場のつながりから、出会いを探し始めた"), { detail: () => "費用はほとんどかからない。出会う機会は、人間関係の広さしだい。" }),
            opt("app", "マッチングアプリ", (p) => ((p.marriageBias = 2.6), bump(p, { bonds: 3, money: -1 }), "マッチングアプリで、出会いを探し始めた"), { auto: true, detail: () => "月に数千円。出会いの数は増えるが、見極めには時間がかかる。" }),
            opt("agency", "結婚相談所", (p) => ((p.marriageBias = 3.2), bump(p, { bonds: 3, money: -3 }), "結婚相談所に入会して、活動を始めた"), { detail: () => "入会金と年会費で、年に約30〜50万円。結婚を前提とした出会いになる。" }),
          ],
        }),
      },
      opt("distance", "いまの人とは、距離を置く", (p) => (p.partner && (p.partner.status = "ex"), bump(p, { bonds: -4, joy: -4 }), "いまの人とは、距離を置くことにした"), { show: (p) => p.partner?.status === "dating", detail: () => "関係はいったん終わり、あらためて、出会いを探すことになる。" }),
      opt("work", "いまは仕事を優先する", (p) => ((p.marriageBias = 0.5), bump(p, { money: 3 }), "いまは仕事を優先すると決めた"), { detail: () => "キャリアと収入は伸ばしやすい。出会いの機会は減る。" }),
      opt("alone", "ひとりで生きていくと決める", (p) => ((p.stayingSingle = true), (p.marriageBias = 0.1), "ひとりで生きていくと決めた"), { detail: () => "自由な時間とお金は増える。老後は、自分で備える必要がある。" }),
      opt("flow", "流れに任せる", (p) => ((p.marriageBias = 1), "出会いは流れに任せることにした"), { auto: true }),
    ],
  },
  {
    id: "kids31",
    age: 31,
    title: "子どもについて",
    prompt: "子どもを持つことを、どう考えるだろう。",
    when: (p) => p.married && !p.childFree && p.kids === 0,
    options: [
      opt("want", "子どもを望む", (p) => ((p.childWish = 1.8), "子どもを迎えたいと思うようになった"), { detail: (p) => `子ども1人を大学まで育てる費用は、1,500〜2,500万円ほど。${p.region === "tokyo" ? "東京では、住居費も重なる。" : ""}` }),
      opt("none", "子どもは持たないと決める", (p) => ((p.childFree = true), "子どもを持たない暮らしを選んだ"), { detail: () => "夫婦の時間とお金に余裕ができやすい。" }),
      opt("open", "授かれば受け入れる", (p) => ((p.childWish = 1), "子どものことは、授かりしだいと考えた"), { auto: true }),
    ],
  },
  {
    id: "home35",
    age: 35,
    title: "住まいを考える",
    prompt: "これからの住まいを、どうするだろう。",
    options: [
      { id: "buy", label: "家を買う", apply: () => "", detail: (p, env, data) => `${data.regionLabel[p.region]}の新築マンションの価格の目安は約${Math.round(HOME_PRICE[p.region] / 10) * 10}万円。ローンを組めるかは、世帯の年収しだい。`, children: homeQuestion },
      opt("rent", "賃貸のまま、身軽に暮らす", (p) => ((p.homeBias = 0.6), bump(p, { money: 2 }), "賃貸のまま、身軽に暮らすことにした"), { auto: true, detail: (p) => `家賃は年に約${p.region === "tokyo" ? 120 : p.region === "metro" ? 90 : 70}〜${p.region === "tokyo" ? 180 : p.region === "metro" ? 130 : 100}万円。引っ越しの自由は保てるが、住居費は払い続ける。` }),
      { id: "abroad", label: "海外へ移住する", apply: () => "", show: (p) => !p.abroad, detail: () => "収入も物価も、移り住む国の水準になる。", children: countryQuestion },
      opt("uturn", "地元に戻る", (p) => ((p.region = p.birthRegion), (p.city = p.birthPlace), (p.withParents = false), bump(p, { bonds: 5 }), `地元の${p.city}に戻った`), { show: (p) => p.region !== p.birthRegion, detail: (p, env, data) => `生活費は抑えられ、家族とも近くなる。${payText(p, env, data, { region: p.birthRegion })}` }),
      opt("city", "都会に移る", (p, r, d) => `${moveTo(p, r, d, metroOrTokyo(r))}に引っ越した`, { show: (p) => p.region === "local" || p.region === "rural", detail: (p, env, data) => `給料は上がるが、家賃などの費用も上がる。${payText(p, env, data, { region: "metro" })}` }),
    ],
  },
  {
    id: "career40",
    age: 40,
    title: "これからのキャリア",
    prompt: "働き方を、どうしていくだろう。",
    when: (p) => p.occ !== null && p.occ !== "retired",
    options: [
      {
        id: "lead",
        label: "責任ある立場を目指す",
        apply: () => "",
        detail: (p, env, data) => `いまの年収は約${round10(incomeOf(p, data, env.econ))}万円。管理職になると、1〜2割上がることが多い。`,
        children: () => ({
          title: "どんな立場を目指す?",
          prompt: "同じ昇進でも、道が分かれます。",
          options: [
            opt("manager", "管理職として、組織を率いる", (p) => ((p.payMult *= 1.15), bump(p, { money: 4, health: -4, bonds: -2 }), "管理職として、組織を率いるようになった"), { detail: () => "収入と責任が増え、人の問題に時間を取られる。" }),
            opt("expert", "専門職として、第一人者を目指す", (p) => ((p.payMult *= 1.07), bump(p, { learn: 6, money: 2 }), "専門を極めて、頼られる存在になっていった"), { auto: true, detail: () => "収入の伸びは緩やかだが、仕事の満足度は高い。" }),
          ],
        }),
      },
      opt("side", "副業や独立に踏み出す", (p, r) => (bump(p, { money: Math.round((r() - 0.4) * 20), learn: 3 }), "副業を始め、働き方を広げた"), { detail: (p, env) => `景気しだいで収入は大きく変わる。いまは${env.econLabel}。` }),
      opt("slow", "仕事を減らして、暮らしを大切にする", (p) => ((p.payMult *= 0.85), bump(p, { money: -5, health: 6, bonds: 5 }), "仕事を減らして、暮らしの時間を増やした"), { detail: (p, env, data) => `年収は約${round10(incomeOf(p, data, env.econ) * 0.85)}万円ほどに下がる。そのぶん、時間と健康に余裕が生まれる。` }),
    ],
  },
  {
    id: "parents50",
    age: 50,
    title: "親のこと",
    prompt: "年を重ねた親と、どう向き合うだろう。",
    options: [
      opt("care", "仕事を調整して、介護に向き合う", (p) => ((p.caregiving = true), (p.payMult *= 0.92), bump(p, { money: -5, bonds: 4, health: -4 }), "仕事を調整しながら、親の介護に向き合った"), { detail: () => "介護の費用は月に数万〜十数万円。仕事を減らすと、収入にも響く。" }),
      opt("service", "施設やサービスに頼る", (p) => (bump(p, { money: -6 }), "親のために、施設やサービスを頼ることにした"), { auto: true, detail: () => "施設の費用は月に約10〜20万円。自分の仕事と時間は守れる。" }),
      opt("far", "離れて暮らし、できる範囲で支える", (p) => (bump(p, { bonds: -2 }), "離れた場所から、できる範囲で親を支えた")),
    ],
  },
  {
    id: "later60",
    age: 55,
    title: "何歳まで働く?",
    prompt: "仕事をいつまで続けるか、そろそろ考えるときです。",
    when: (p) => p.occ !== null && p.occ !== "retired",
    options: [
      opt("r60", "60歳で退職して、早めにゆっくり暮らす", (p) => ((p.retireAt = 60), bump(p, { health: 4, joy: 3 }), "60歳で仕事を退くことに決めた"), { detail: () => "収入は早く止まり、年金も満額ではない。そのぶん、自由な時間と体力が残る。" }),
      opt("retire", "定年(65歳)まで勤め、その後はゆっくり暮らす", (p) => ((p.retireAt = 65), bump(p, { health: 3 }), "65歳の定年まで働くことに決めた"), { auto: true, detail: () => "65歳以降は年金が中心。年金の目安は、年に約200万円ほど。貯金の取り崩しが必要になることもある。" }),
      opt("r70", "70歳まで働く", (p) => ((p.retireAt = 70), bump(p, { money: 4, health: -2 }), "70歳まで働き続けることに決めた"), { detail: () => "70歳まで収入が続く。体力との相談になる。" }),
      opt("r75", "75歳まで、生涯現役をめざす", (p) => ((p.retireAt = 75), bump(p, { money: 6, health: -4, joy: 2 }), "75歳まで、生涯現役でいることに決めた"), { detail: () => "収入は長く続くが、体への負担は大きい。" }),
      opt("shop", "地元で小さな商いや畑を始める", (p) => ((p.occ = "agri"), (p.job = "farmer"), (p.employment = "self"), (p.sector = "private"), (p.payMult = 0.6), (p.region = p.birthRegion), (p.city = p.birthPlace), bump(p, { money: -3, health: 4 }), `地元の${p.city}で、小さな商いや畑を始めた`), { detail: () => "収入は多くないが、暮らしの費用は低く、体を動かす日々になる。" }),
    ],
  },
  {
    id: "pension65",
    age: 65,
    title: "年金の受け取り方",
    prompt: "年金を、いつから受け取りますか。遅らせるほど、受け取る額は増えます。",
    when: (p) => p.occ !== null,
    options: [
      opt("p65", "65歳から、受け取る", (p) => ((p.pensionFrom = undefined), (p.pensionMult = 1), "65歳から、年金を受け取ることにした"), { auto: true, detail: () => "ふつうの受け取り方。年に約200万円ほど。" }),
      opt("p70", "70歳まで遅らせて、増やして受け取る(約+42%)", (p) => ((p.pensionFrom = 70), (p.pensionMult = 1.42), bump(p, { money: 1 }), "年金を70歳まで遅らせ、増やして受け取ることにした"), { detail: () => "70歳まで、年金は受け取れない(働くか、貯金で暮らす)。70歳からは、約1.4倍になる。長生きするほど、得になる。" }),
      opt("p75", "75歳まで遅らせて、さらに増やす(約+84%)", (p) => ((p.pensionFrom = 75), (p.pensionMult = 1.84), bump(p, { money: 2, health: -1 }), "年金を75歳まで遅らせ、さらに増やして受け取ることにした"), { detail: () => "75歳まで、年金は受け取れない。75歳からは、約1.8倍になる。体力と貯金の見通しが、前提になる。" }),
    ],
  },
  {
    id: "late70",
    age: 70,
    title: "晩年の暮らし",
    prompt: "これからの暮らしの場所を、どうするだろう。",
    options: [
      opt("stay", "住み慣れた家で暮らし続ける", () => "住み慣れた家で、暮らし続けることにした", { auto: true }),
      opt("near", "家族や友人の近くへ移る", (p) => (bump(p, { bonds: 6 }), "家族や友人の近くへ移り住んだ")),
      opt("home", "高齢者向けの住まいに移る", (p) => (bump(p, { money: -4, health: 2 }), "高齢者向けの住まいに移った"), { detail: () => "入居には数百万円の一時金と、月に十数万円の費用がかかることがある。" }),
    ],
  },
];

void flowText;
