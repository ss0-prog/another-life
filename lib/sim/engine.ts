import { happinessOf, minWageFactor, mortalityOf, prefOf } from "@/lib/sim/regional";
import { SINCE, lessonAvailable, partTimeAvailable, yearOf } from "@/lib/sim/era";
import { jpData } from "@/lib/sim/data/jp";
import { housingOf } from "@/lib/sim/data/jp-scene";
import { pickMoment } from "@/lib/sim/data/jp-moments";
import { HISTORY_EVENTS } from "@/lib/sim/data/jp-history-events";
import { SIM_NOW_YEAR } from "@/lib/sim/data/jp-history";
import { prefectureOf } from "@/lib/sim/salary";
import { vitalsOf } from "@/lib/sim/survey";
import { DEFAULT_JOB, jobById } from "@/lib/sim/data/jp-jobs";
import { causeOfDeath } from "@/lib/sim/data/jp-events";
import { lessonById } from "@/lib/sim/data/jp-lessons";
import { shopById, yearlyCosts } from "@/lib/sim/shop";
import { MEET_LIMIT, meetById } from "@/lib/sim/data/jp-meet";
import { buildDeathNote } from "@/lib/sim/data/jp-death";
import { breakupChance, breakupText, coupleEvent } from "@/lib/sim/data/jp-couple";
import { CARE_LABEL, careYear } from "@/lib/sim/childcare";
import { intelChance } from "@/lib/sim/intel";
import { BG_INTEL, BG_LEARN, BG_MONEY, BG_RISK, SOLO_RATE, absentWho, lessonBlock, monthlyAllowance, newYearGift } from "@/lib/sim/family";
import { concernEvent, concernResolved } from "@/lib/sim/data/jp-concern";
import { livingCosts } from "@/lib/sim/living";
import { CRIMES, judge, type CrimeId } from "@/lib/sim/data/jp-crime";
import { olympicYear, sportById } from "@/lib/sim/data/jp-sports";
import { SUMMIT_BY_JOB, SUMMIT_BY_OCC, summitChance } from "@/lib/sim/data/jp-summit";
import { savingsRate } from "@/lib/sim/economy";
import { LENDERS, LENDER_ORDER, lenderAvailable } from "@/lib/sim/data/jp-debt";
import { fitMult, fitScore } from "@/lib/sim/mbti";
import { isResponsible, jobLabel, leaveLocal, moveHome, kidCall, kidTitle, condOf, addDebt, assignJob, bump, chargeWithDebt, clamp, debtTotal, fullName, lifeLabel, moveTo, newCity, noBearer, randomPartner } from "@/lib/sim/helpers";
import { birthYearOf, cpiAt, economyAt, unemploymentAt } from "@/lib/sim/economy";
import { WEATHER_EVENT, weatherAt } from "@/lib/sim/weather";
import { marketOf, priceAt } from "@/lib/sim/market";
import { drawChangeFactor, incomeOf } from "@/lib/sim/salary";
import { consumptionTaxOf, householdTax, netIncome, sideTax, taxSnap, type TaxResult } from "@/lib/sim/tax";
import { createRng, interpolate, interpolateLog, pick, weighted, type Rng } from "@/lib/sim/rng";
import { MAX_LESSONS } from "@/lib/sim/types";
import type {
  ActTag,
  EventFx,
  Marital,
  Partner,
  SeriesPoint,
  Stats,
  TurningMoment,
  AssetId,
  Background,
  Choice,
  CountryData,
  Env,
  KidInfo,
  CurrentSelf,
  Edu,
  Firm,
  Major,
  GameEvent,
  GameState,
  Interpretation,
  LenderId,
  LifeSummary,
  Money,
  Occ,
  Person,
  Region,
  Setup,
  Tag,
  TurningOption,
  TurningPoint,
  TurningQuestion,
  Wallet,
} from "@/lib/sim/types";
import type { Echo, TimelineEntry } from "@/lib/types";
import { evaluate } from "@/lib/achievements";

// 寿命の上限。(公式に確認された世界最高齢は、122歳。)
export const MAX_AGE = 123;
// 働ける上限の年齢。これをこえると、仕事は、退くことになり、新しく始めることもできない。
export const WORK_LIMIT = 90;
const SNAP_AGE = 70;
// 運の共有: 病気・死亡・結婚などの乱数は「種+年齢+種類」で決まるので、
// 二つの人生(分岐した/しなかった)は同じ運のもとで比べられる。
const S = { workEnd: 95, death: 1, illness: 2, marriage: 3, birth: 4, job: 5, move: 6, buy: 7, parents: 9, layoff: 12, sudden: 60, allow: 70, lesson: 80, ev: 30, evPick: 32, evApply: 36, q: 40, qPick: 41, name: 50, small: 10, smallPick: 11, choice: 20, jobPick: 15, movePick: 16, moment: 97 } as const;

function streamRng(seed: number, age: number, stream: number): Rng {
  return createRng((seed ^ Math.imul(age + 1, 2654435761) ^ Math.imul(stream, 40503)) >>> 0);
}
const roll = (seed: number, age: number, stream: number) => streamRng(seed, age, stream)();

const LIVING: Record<string, string> = {
  parents: "実家で暮らしている",
  rent_single: "賃貸でひとり暮らし",
  rent_family: "賃貸で家族と暮らしている",
  owned_house: "ローンを抱えた持ち家の一軒家",
  owned_flat: "ローンを抱えた持ち家のマンション",
};

const pickMajorEngine = (rng: () => number) => weighted<Major>(rng, { humanities: 45, science: 28, medical: 8, education: 7, art: 4, sports: 3 });

const HOUSING_KIND_TEXT = { lodging: "友人や親戚の家に身を寄せて暮らしている", dorm: "寮や社宅で暮らしている", share: "シェアハウスで暮らしている", facility: "施設や病院で暮らしている", homeless: "定まった住まいがなく、転々としている" } as const;

const cond = condOf;

// 年齢に応じて、健康の土台は少しずつ下がる。
const healthAt = (base: number, age: number) => clamp(base - Math.max(0, age - 40) * 0.4);

// 子どもの名前の候補(男子・女子の名前に、ときどき中性的な名前をまぜる)。
const kidNamePool = (data: CountryData, sex: "boy" | "girl") => [...data.names[sex], ...data.names[sex], ...data.names.neutral];
const sexLabel = (sex: "boy" | "girl") => (sex === "boy" ? "男子" : "女子");

// 親が亡くなる年齢を、生命表から抽選する(子が生まれたとき、親は offset 歳で、生きていたとする)。
function parentDeathAge(data: CountryData, sex: "female" | "male", offset: number, u: number): number {
  const curve = data.curves.mortality[sex];
  const surv: number[] = [1];
  for (let age = 0; age < MAX_AGE; age++) surv.push(surv[age] * (1 - Math.min(1, interpolateLog(curve, age))));
  const start = Math.min(MAX_AGE, Math.round(offset));
  const target = surv[start] * u;
  for (let age = start; age <= MAX_AGE; age++) if (surv[age] <= target) return age;
  return MAX_AGE;
}

// 配偶者の名前が書かれていれば、それを使う(書かなければ、ランダムのまま)。
function namedPartner(pt: Partner, name?: string): Partner {
  const n = (name ?? "").trim().slice(0, 12);
  return n ? { ...pt, family: "", given: n } : pt;
}

// 指定した年齢時点の人物をつくる。real = 今の自分(入力どおり)、false = 分岐した人生の出発点。
function personAt(self: CurrentSelf, seed: number, age: number, data: CountryData, real: boolean): Person {
  const rng = createRng(seed ^ 0x5bd1e995);
  const background = weighted<Background>(rng, data.prior.background);
  const pref = data.prefectures.find((p) => p.name === self.prefecture) ?? data.prefectures[0];
  const enrolled = (self.school ?? "none") !== "none" && real;
  const ailmentId = self.ailment ?? "none";
  // 今の自分は、いまの持病を抱えている。分岐した人生では、現在の年齢になったころに、およそ6割の確率で発症する。
  const hasNow = real || age >= self.age;
  const onsetHit = !real && ailmentId !== "none" && self.age > age && createRng(seed ^ 0x2468ace)() < 0.6;
  const c = condOf(data, { condition: self.condition, ailment: hasNow ? ailmentId : "none" } as Person);
  const young = age <= 18;
  const region: Region = young ? pref.region : self.region;
  const city = young ? pref.name : newCity(createRng(seed ^ 0x1234567), data, region);
  // 子どもが生まれた年齢がわかっていれば、それを使う。分岐する前に生まれていた子どもは、分岐した人生にも、いる(名前も性別もまだない)。
  const birthAges = self.kidBirthAges && self.kidBirthAges.length ? self.kidBirthAges.slice(0, self.kids) : null;
  const kidSexAt = (i: number): "boy" | "girl" | "unknown" => self.kidSexes?.[i] ?? "unknown";
  const earlyKids = birthAges ? birthAges.map((b, i) => ({ b, sex: kidSexAt(i), idx: i })).filter((x) => x.b < age) : [];
  const bornBefore = earlyKids.length;
  const marital: Marital = self.marital ?? (self.married ? "married" : "single");
  const everMarried = self.married || marital === "divorced" || marital === "widowed";
  const married = real ? self.married : everMarried && (age >= 30 || bornBefore > 0);
  const nKids = real ? self.kids : birthAges ? bornBefore : married && age >= 32 ? self.kids : 0;
  const kidList: KidInfo[] = Array.from({ length: nKids }, (_, i) => {
    // 名前が決まっている子ども(ランダムで始めたとき)は、分岐した人生でも、その名前でいる。
    if (!real && birthAges) {
      const given = self.kidNames?.[earlyKids[i].idx];
      return given ? { name: given, sex: earlyKids[i].sex, bornAge: earlyKids[i].b } : { name: "", sex: earlyKids[i].sex, anon: true, bornAge: earlyKids[i].b };
    }
    const given = kidSexAt(i);
    const rolled: "boy" | "girl" = rng() < 0.5 ? "boy" : "girl";
    const sex: "boy" | "girl" = given === "unknown" ? rolled : given;
    const rolledName = pick(rng, kidNamePool(data, sex));
    return { name: self.kidNames?.[i] || rolledName, sex, bornAge: birthAges?.[i] ?? Math.max(20, age - 7 - i * 3) };
  });
  // ひとり親家庭(育ててくれた親は、母がほとんど)。ほかの乱数に影響しないよう、別の乱数で決める。
  const soloParent: "mother" | "father" | undefined = createRng(seed ^ 0x51dec0de)() < SOLO_RATE[background] ? (createRng(seed ^ 0x7a11)() < 0.85 ? "mother" : "father") : undefined;
  const mOff = 24 + rng() * 10;
  const fOff = 26 + rng() * 10;
  const parentDeath = { mother: Math.round(parentDeathAge(data, "female", mOff, rng()) - mOff), father: Math.round(parentDeathAge(data, "male", fOff, rng()) - fOff) };
  const pet0 = real && self.age > 60 ? 0 : 0;
  void pet0;
  return {
    age,
    ailment: hasNow ? ailmentId : "none",
    ailmentOnset: onsetHit ? { age: self.age, id: ailmentId } : null,
    housingKind: real && (self.housing === "lodging" || self.housing === "dorm" || self.housing === "share" || self.housing === "facility" || self.housing === "homeless") ? self.housing : null,
    parttime: null,
    office: null,
    npc: {},
    kidFundYen: 0,
    jobOffer: null,
    jobOfferJob: null,
    jobOfferFactor: 1,
    treatMan: 0,
    jobPlan: null,
    inheritMan: 0,
    habit: null,
    temptKind: "gamble",
    owns: {},
    extra: { stress: 35, trust: 50, career: Math.max(0, Math.min(70, (age - 20) * 3)), charm: 50 },
    leftNote: "",
    treatLabel: "",
    nisaYen: 0,
    healthAdj: 0,
    proposeAt: null,
    // 在学中の人は、「あと何年で卒業」と答えた年が、卒業の年になる(浪人や留年があっても、その答えどおり)。分かれた人生でも、分かれた時点で18歳以上なら、すでに在学していたので、同じ年に卒業する。
    gradAge: (self.school ?? "none") !== "none" && (real || age >= 18) ? self.age + Math.max(0, self.yearsLeft ?? 1) : null,
    sex: self.sex,
    genderId: self.genderId,
    orientation: self.orientation,
    condition: self.condition,
    mbti: self.mbti,
    background,
    soloParent,
    birthPlace: pref.name,
    birthRegion: pref.region,
    edu: self.edu,
    region,
    city,
    occ: real ? (self.retired && !enrolled ? "retired" : self.occ === "none" || enrolled ? null : self.occ) : age >= data.workStartAge[self.edu] && self.occ !== "none" ? self.occ : null,
    job: self.occ === "none" ? null : (jobById(self.job)?.id ?? DEFAULT_JOB[self.occ]),
    sector: self.workStyle === "public" ? "public" : "private",
    intel: clamp(Math.round(50 + Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-9))) * Math.cos(2 * Math.PI * rng()) * 15 + BG_INTEL[background]), 5, 98),
    prev: null,
    cashDelta: 0,
    // 高校生の年(18歳以下)から始めた人生だけ、大学や大学院の「レベル」を選べる・表示される。
    history: self.age <= 18 ? { hsStart: 1 } : {},
    lessons: [],
    bankrupt: null,
    abroad: null,
    partner: married
      ? namedPartner(randomPartner(rng, data, Math.max(20, age - 4), "married", self.mbti, self), self.partnerName)
      : real && marital === "partnered"
        ? namedPartner(randomPartner(rng, data, Math.max(20, age - 2), "dating", self.mbti, self), self.partnerName)
        : real && (marital === "divorced" || marital === "widowed")
          ? randomPartner(rng, data, Math.max(20, age - 8), "ex", self.mbti, self)
          : null,
    scheduled: [],
    mood: "ok",
    moodYears: 0,
    sick: false,
    kidList,
    pets: [],
    parentDeath,
    parentOffset: { mother: Math.round(mOff), father: Math.round(fOff) },
    married,
    kids: nKids,
    owned: real ? self.housing === "owned" : false,
    withParents: real ? self.housing === "parents" : age < 22,
    stayingSingle: false,
    childFree: false,
    caregiving: false,
    workLong: false,
    retireAt: null,
    employment: self.workStyle === "self" ? "self" : self.workStyle === "nonregular" ? "nonregular" : "regular",
    firm: weighted<Firm>(rng, { large: 25, mid: 30, small: 45 }),
    major: self.edu === "univ" || self.edu === "grad" ? (self.major ?? weighted<Major>(rng, { humanities: 45, science: 28, medical: 8, education: 7, art: 4, sports: 3 })) : null,
    field: self.field ?? null,
    payMult: self.occ === "none" ? 1 : (jobById(self.job)?.mult ?? jobById(DEFAULT_JOB[self.occ])?.mult ?? 1),
    birthYear: birthYearOf(self.age),
    econ: economyAt(seed, age, birthYearOf(self.age)),
    marriageBias: real ? (marital === "partnered" ? 1.8 : marital === "divorced" ? 0.7 : marital === "widowed" ? 0.5 : 1) : 1,
    childWish: 1,
    homeBias: 1,
    stats: {
      health: healthAt(c.healthBase, age),
      money: BG_MONEY[background],
      joy: 62,
      bonds: 50,
      learn: 50 + { univ: 8, grad: 16, vocational: 3, hs_work: 0 }[self.edu],
    },
  };
}

// 性格と活動の向き不向きで、効果の大きさを変える(向いていれば、よい効果は大きく、苦手なら、よい効果は小さく、負担は大きい)。
function fitScaled(effect: Partial<Stats>, mbti: string | null, tags: ActTag[] | undefined): Partial<Stats> {
  const m = fitMult(fitScore(mbti, tags));
  const out: Partial<Stats> = {};
  for (const k of Object.keys(effect) as (keyof Stats)[]) {
    const v = effect[k] ?? 0;
    out[k] = v >= 0 ? v * m : v * (2 - m);
  }
  return out;
}

// 出来事のあいだに、能力値と資産がどれだけ動いたかを測る。
type FxSnap = { s: Stats; n: number };
const fxSnap = (st: GameState): FxSnap => ({ s: { ...st.person.stats }, n: st.wallet.cash + st.person.cashDelta - debtTotal(st.wallet.debts) });
function fxSince(st: GameState, snap: FxSnap): EventFx | undefined {
  const stats: Partial<Stats> = {};
  for (const k of Object.keys(snap.s) as (keyof Stats)[]) {
    const d = Math.round(st.person.stats[k] - snap.s[k]);
    if (Math.abs(d) >= 1) stats[k] = d;
  }
  const money = Math.round(fxSnap(st).n - snap.n);
  const fx: EventFx = {};
  if (Object.keys(stats).length) fx.stats = stats;
  if (Math.abs(money) >= (st.person.age < 18 ? 500 : 10000)) fx.money = money;
  return fx.stats || fx.money !== undefined ? fx : undefined;
}

// 学校を卒業する歳。
export const gradAgeOf = (p: Person) => p.gradAge ?? (p.edu === "grad" ? 24 : p.edu === "univ" ? 22 : p.edu === "vocational" ? 20 : 18);
const ageOf = (tp: TurningPoint, p: Person) => (typeof tp.age === "function" ? tp.age(p) : tp.age);
const clone = <T>(v: T): T => structuredClone(v);

function doneBefore(p: Person, data: CountryData): string[] {
  // まだ決まっていない進路(職を探している最中など)は、済んだことにしない。
  return data.turningPoints.filter((tp) => ageOf(tp, p) <= p.age && !(tp.repeatWhile && tp.repeatWhile(p))).map((tp) => tp.id);
}

const toYen = (man: number) => Math.round(man * 10000);

function startWallet(p: Person, data: CountryData, savingsMan: number | null): Wallet {
  // 18歳未満は、お小遣い(円)。年齢と家計で、持っている額が違う。
  if (p.age < 18) {
    // 6歳になるまでは、自分のお金は持たない(家族が管理する)。困窮した家庭では、お小遣いはない。
    const pocket = p.age < 6 || p.background === "poverty" ? 0 : Math.min(30000, Math.round((1500 + Math.max(0, p.age - 6) * 1100) * data.cashflow.backgroundFactor[p.background] / 100) * 100);
    return { cash: pocket, units: { index: 0, world: 0, balanced: 0, reit: 0, gold: 0, growth: 0, crypto: 0, bond: 0 }, contributed: 0, stocks: false, debts: [] };
  }
  const guess = interpolate(data.cashflow.startSavings, p.age) * data.cashflow.backgroundFactor[p.background];
  return { cash: toYen(savingsMan ?? guess), units: { index: 0, world: 0, balanced: 0, reit: 0, gold: 0, growth: 0, crypto: 0, bond: 0 }, contributed: 0, stocks: false, debts: [] };
}

// 1年ぶんの貯金の増減(万円)。税と社会保険料を引いた手取りから生活費を引き、黒字の一部が貯金に回る。
// 内訳(税・社会保険料・手取り・消費税の目安)も返す。
export type YearMoney = { flow: number; tax: TaxResult; need: number };
function yearlyMoney(p: Person, data: CountryData, econ: number, inDebt = false): YearMoney {
  if (p.occ === null) {
    // 働いていない大人(求職中など): 収入がなくても、生活費・固定費は、かかりつづける(切りつめて、貯金からとりくずす)。
    if (!p.married && p.age >= 20 && p.history.graduated !== undefined && !p.withParents) {
      const need = livingCosts(p, data).total * 0.7;
      return { flow: -need, tax: householdTax(p, data, econ), need };
    }
    return { flow: 0, tax: householdTax(p, data, econ), need: 0 };
  }
  // 生活費・固定費は、費目ごとの内訳(家賃・ローン・食費・光熱水道・交通通信・医療・教育など)から出す。
  const base = livingCosts(p, data).total;
  const t = householdTax(p, data, econ);
  // 収入の低い人は、暮らしの水準を、収入にあわせて切り詰める(生活費は、手取りの9割ちょっとが上限)。
  const need = p.occ === "retired" ? Math.max(data.cashflow.retiredNeed * 0.85, base * 0.9) : Math.min(base, t.net * 0.93);
  const surplus = t.net - need;
  // 借金があるあいだは、暮らしを切り詰めて、黒字の大半を返済にまわす。
  const flow = surplus > 0 ? surplus * (inDebt ? 0.9 : data.cashflow.saveRate) : surplus;
  return { flow, tax: { ...t, consumption: consumptionTaxOf(need) }, need };
}

// 分岐した人生: 分岐した年齢から再スタートし、選ばなかった道を反映する。
export function startAlt(setup: Setup, data: CountryData = jpData): GameState {
  const { self, branch, seed } = setup;
  const p = personAt(self, seed, branch.age, data, false);
  const option = data.branches[branch.kind].options.find((o) => o.id === branch.option);
  // 仕事の分岐では、具体的な職種(職種の id)が選ばれる。
  const job = branch.kind === "job" && !option ? jobById(branch.option) : undefined;
  let event = option ? option.apply(p, streamRng(seed, branch.age, S.choice), data) : "別の道を選んだ";
  if (job) {
    if (data.workStartAge[p.edu] > p.age) p.edu = p.age >= 22 ? "univ" : p.age >= 20 ? "vocational" : "hs_work";
    event = `${assignJob(p, job.occ, streamRng(seed, branch.age, S.choice), data, job.id)}として働く道に進んだ`;
  }
  // 入力した「いまのあなた」の条件は、分かれた人生のはじまりにも、そのまま使う(入力した資産・事前の調査の答え・借金が、はじまりの値になる)。
  const altSavings = self.savings !== null && self.savings !== undefined && branch.age >= 18 ? Math.max(0, self.savings) : null;
  const vit = vitalsOf(self.survey);
  for (const k of Object.keys(vit) as (keyof typeof vit)[]) p.stats[k] = vit[k] as number;
  const wallet = startWallet(p, data, altSavings);
  const st: GameState = { seed, person: p, events: [{ age: branch.age, event, weight: 100 }], done: doneBefore(p, data), wallet, later: [], queue: [], naming: [], deathAge: null, deathCause: null, salt: 1, snap: p.age >= SNAP_AGE ? clone(p) : null };
  // 入力した借金(奨学金など)も、そのまま、はじまりから抱えている。
  if ((self.debt ?? "none") === "scholarship" && branch.age >= 18) addDebt(st, "bank", 3000000);
  return st;
}

// 分岐しなかった、今のままの自分。
export function startReal(setup: Setup, data: CountryData = jpData): GameState {
  const { self, seed } = setup;
  const p = personAt(self, seed, self.age, data, true);
  // いまの暮らしや、これまでの出来事が、心と体に残している影響。
  // 事前の調査の答えが、はじまりの能力値になる。体の調子は、年齢相応の健康との差を、健康の土台にも反映する(すぐに、もとの値にもどらないように)。
  const vit = vitalsOf(self.survey);
  if (vit.health !== undefined) {
    const expectedNow = healthAt(condOf(data, p).healthBase, p.age);
    p.healthAdj = Math.max(-45, Math.min(12, (vit.health - expectedNow) * 0.8));
  }
  for (const k of Object.keys(vit) as (keyof typeof vit)[]) p.stats[k] = vit[k] as number;
  const hk = p.housingKind;
  if (hk === "homeless") bump(p, { health: -10, joy: -12, money: -15, bonds: -5 });
  else if (hk === "lodging") bump(p, { joy: -3, bonds: -2, money: -4 });
  else if (hk === "facility") bump(p, { health: -6, joy: -4 });
  const mar = self.marital;
  if (mar === "divorced") bump(p, { bonds: -5, joy: -5 });
  else if (mar === "widowed") bump(p, { bonds: -8, joy: -9, health: -2 });
  else if (mar === "partnered") bump(p, { bonds: 3, joy: 3 });
  const label = lifeLabel(p, data);
  const st: GameState = {
    seed,
    person: p,
    events: [{ age: p.age, event: `${p.age}歳。${p.city}で、${label}として暮らしている`, weight: 100 }],
    done: doneBefore(p, data),
    wallet: startWallet(p, data, self.savings),
    later: [],
    queue: [],
    naming: [],
    deathAge: null,
    deathCause: null,
    salt: 2,
    snap: p.age >= SNAP_AGE ? clone(p) : null,
  };
  // いまの借金(奨学金・ローンなど)。
  const debtYen = { none: 0, scholarship: 3000000, several: 5000000, huge: 15000000 }[self.debt ?? "none"];
  if (debtYen > 0) addDebt(st, self.debt === "scholarship" ? "bank" : self.debt === "huge" ? "card" : "bank", debtYen);
  return st;
}

// 何かの値が欠けたり、数でなくなったりしても、画面に NaN を出さない(古い状態を引き継いだときの保険)。
function sanitize(next: GameState) {
  const p = next.person;
  if (!Number.isFinite(next.wallet.cash)) next.wallet.cash = 0;
  p.npc ??= {};
  p.field ??= null;
  p.housingKind ??= null;
  p.kidFundYen ??= 0;
  p.jobOffer ??= null;
  p.jobOfferJob ??= null;
  p.jobOfferFactor ??= 1;
  p.treatMan ??= 0;
  p.jobPlan ??= null;
  p.inheritMan ??= 0;
  p.habit ??= null;
  p.temptKind ??= "gamble";
  p.owns ??= {};
  p.extra ??= { stress: 35, trust: 50, career: 30, charm: 50 };
  for (const k of ["world", "balanced", "reit", "gold", "crypto"] as const) next.wallet.units[k] ??= 0;
  p.leftNote ??= "";
  p.treatLabel ??= "";
  p.nisaYen ??= 0;
  p.healthAdj ??= 0;
  p.proposeAt ??= null;
  p.parttime ??= null;
  p.office ??= null;
  for (const k of Object.keys(p.stats) as (keyof typeof p.stats)[]) if (!Number.isFinite(p.stats[k])) p.stats[k] = 50;
  if (!Number.isFinite(p.payMult)) p.payMult = 1;
  if (!p.employment) p.employment = "regular";
  if (!p.firm) p.firm = "mid";
  if (!p.sector) p.sector = "private";
  if (!Number.isFinite(p.intel)) p.intel = 50;
  p.cashDelta = Number.isFinite(p.cashDelta) ? p.cashDelta : 0;
  p.scheduled ??= [];
  p.history ??= {};
  p.abroad ??= null;
  p.bankrupt ??= null;
  next.wallet.debts ??= [];
  p.lessons ??= [];
  p.kidList ??= [];
  p.pets ??= [];
  // 引っ越しの軌跡: 暮らす場所が変わったら、その年齢と場所を、書きとめる。
  p.homes ??= [{ age: p.age, place: p.city }];
  if (p.homes[p.homes.length - 1].place !== p.city) p.homes.push({ age: p.age, place: p.city });
  next.later ??= [];
  next.salt ??= 1;
  next.deathCause ??= null;
  next.queue ??= [];
  next.naming ??= [];
}

// 貯金の増減を、「(-30万円)」「(+5,000円)」の形で表す。
function moneyTag(deltaYen: number, debtDelta = 0): string {
  const fmt = (n: number) => (n >= 10000 ? `${Math.round(n / 10000).toLocaleString("ja-JP")}万円` : `${n.toLocaleString("ja-JP")}円`);
  const parts: string[] = [];
  const r = Math.round(deltaYen);
  if (r !== 0) parts.push(`${r > 0 ? "+" : "-"}${fmt(Math.abs(r))}`);
  if (debtDelta > 0) parts.push(`借金+${fmt(Math.round(debtDelta))}`);
  return parts.length ? ` (${parts.join("、")})` : "";
}

// ---- 借金: 利息がつき、返せるだけ返す。返せないと、督促・自己破産・取り立てなどが起こる ----
function processDebts(next: GameState, a: number, data: CountryData, push: (text: string, weight: number) => void) {
  const p = next.person;
  const w = next.wallet;
  const name: Record<LenderId, string> = { family: "家族", friend: "友人", bank: "銀行", card: "カードローン", shark: "闇金" };
  if (w.debts.length === 0) {
    // 完済してからしばらくは、経済の状態が、少しずつ戻る。
    if (p.history.debtCleared !== undefined && a - p.history.debtCleared <= 6) p.stats.money = clamp(Math.min(40, p.stats.money + 6));
    return;
  }
  w.debts.sort((x, y) => y.rate - x.rate);
  for (const d of w.debts) d.amount *= 1 + d.rate;
  const buffer = 100000;
  for (const d of w.debts) {
    const before = d.amount;
    const pay = Math.min(d.amount, Math.max(0, w.cash - buffer));
    d.amount -= pay;
    w.cash -= pay;
    const minPay = before * (d.rate > 0 ? 0.12 : 0.05);
    d.missed = d.amount > 1 && pay < minPay ? d.missed + 1 : 0;
  }
  const rng = streamRng(next.seed, a, S.name + 30);
  let bankrupt = false;
  for (const d of [...w.debts]) {
    if (d.amount <= 1) continue;
    if (d.lender === "family" || d.lender === "friend") {
      if (d.missed >= 4) {
        push(`返せないまま年月がたち、${name[d.lender]}との関係が、決定的に壊れた`, 64);
        bump(p, { bonds: -10, joy: -8 });
        w.debts = w.debts.filter((x) => x !== d);
      } else if (d.missed >= 1) {
        push(`返済が遅れ、${name[d.lender]}との間に、気まずい空気が流れた`, 46);
        bump(p, { bonds: -2, joy: -2 });
      }
    } else if (d.lender === "bank") {
      if (d.missed >= 3) bankrupt = true;
      else if (d.missed >= 1) {
        push("返済が滞り、銀行から督促状が届いた", 52);
        bump(p, { joy: -5 });
      }
    } else if (d.lender === "card") {
      if (d.missed >= 2) bankrupt = true;
      else if (d.missed >= 1) {
        push("カードローンの返済が滞り、督促の電話が鳴りやまなくなった", 54);
        bump(p, { joy: -7, bonds: -2 });
      }
    } else {
      if (d.missed >= 3) {
        push("弁護士に相談して債務整理をし、闇金の借金から、ようやく抜け出した", 66);
        bump(p, { joy: -10, health: -2 });
        w.debts = w.debts.filter((x) => x !== d);
      } else if (d.missed >= 2) {
        push("夜逃げ同然で、住み慣れた街を離れた", 68);
        moveTo(p, rng, data, weighted<Region>(rng, { tokyo: 20, metro: 40, local: 30, rural: 10 }));
        bump(p, { bonds: -20, joy: -15, health: -3 });
        d.amount *= 0.6;
      } else if (d.missed >= 1) {
        push("闇金の取り立てが続き、職場や家にまで押しかけてきた", 66);
        bump(p, { health: -6, joy: -12, bonds: -6 });
      }
    }
  }
  if (bankrupt) {
    push("返済のめどが立たず、自己破産を選んだ", 72);
    w.debts = w.debts.filter((d) => d.lender !== "bank" && d.lender !== "card");
    p.bankrupt = a;
    p.extra.trust = clamp(p.extra.trust - 25);
    bump(p, { joy: -15, bonds: -6 });
  }
  const remain = w.debts.filter((d) => d.amount > 1);
  if (remain.length < w.debts.length || (remain.length === 0 && w.debts.length > 0)) {
    if (remain.length === 0) {
      push("借金を、すべて返し終えた", 58);
      bump(p, { joy: 8 });
      p.history.debtCleared = a;
    }
  }
  w.debts = remain;
  // 借金があるあいだ、経済は、底にはりつく。
  if (w.debts.length) p.stats.money = Math.min(p.stats.money, 8);
}

// ---- 出来事の理由づけ(直近の出来事と、いまの暮らしの状態から決める) ----
const recent = (p: Person, key: string, years: number) => p.age - (p.history[key] ?? -99) <= years;

// うつ状態になった理由。
function depressionReason(p: Person): string {
  if (recent(p, "bully", 4)) return "いじめを受けた傷が癒えないまま";
  if (recent(p, "parentDied", 3)) return "大切な人を失った悲しみが癒えないまま";
  if (recent(p, "divorce", 3) || recent(p, "spouseCheat", 3)) return "家庭での痛手を抱えたまま";
  if (recent(p, "layoff", 3)) return "仕事を失った不安を抱えたまま";
  if (recent(p, "breakup", 2)) return "別れの痛手が癒えないまま";
  if (recent(p, "overtime", 2)) return "過労が重なって";
  const s = p.stats;
  const lowest = Math.min(s.bonds, s.health, s.money);
  if (lowest === s.bonds && s.bonds < 45) return "人とのつながりが薄れ、孤独が深まるなかで";
  if (lowest === s.health && s.health < 45) return "体の不調が長引くなかで";
  if (lowest === s.money && s.money < 45) return "お金の不安に追われ続けるなかで";
  return "はっきりした理由は見つからないまま、少しずつ心がすり減って";
}

// 深刻な病気が見つかった理由。
function illnessReason(p: Person): string {
  if (p.mood === "depressed") return "心の不調が体にまで及び";
  if (recent(p, "overtime", 3)) return "無理を重ねてきた体が悲鳴をあげ";
  if (p.age >= 60) return "年齢を重ねた体に、衰えが重なり";
  if (p.stats.money < 35) return "お金の不安から受診をためらううちに";
  return "健康診断や検査で";
}

// 選択などで予約された出来事・貯金の増減を反映し、名前のない子ども・ペットの名づけを待ちに入れる。
function flush(next: GameState) {
  sanitize(next);
  const p = next.person;
  // こどもNISA: 積み立てたお金を、日本株インデックスの値動きに乗せる(子どもの将来のための資産。自分の資産には数えない)。
  if (p.parttime && p.occ !== null && p.occ !== "retired") {
    p.leftNote = p.leftNote || `仕事に就いたため、アルバイト(${jpData.partTimes.find((x) => x.id === p.parttime!.id)?.label ?? ""})はやめた`;
    p.parttime = null;
  }
  if (p.leftNote) {
    next.events.push({ age: p.age, event: p.leftNote, weight: 42 });
    p.leftNote = "";
  }
  // NISA: 積み立てたお金を、日本株インデックスの値動きに乗せる(自分の資産)。株の欄が、使えるようになる。
  if (p.nisaYen > 0) {
    const price = priceAt(marketOf(next.seed, jpData), "index", p.age, 0);
    next.wallet.units.index += p.nisaYen / price;
    next.wallet.contributed += p.nisaYen;
    next.wallet.stocks = true;
    p.nisaYen = 0;
  }
  if (p.kidFundYen > 0) {
    const price = priceAt(marketOf(next.seed, jpData), "index", p.age, 0);
    const f = (next.wallet.kidFund ??= { units: 0, contributed: 0 });
    f.units += p.kidFundYen / price;
    f.contributed += p.kidFundYen;
    p.kidFundYen = 0;
  }
  if (p.cashDelta) {
    // 出費が貯金をこえたら、足りない分は、借金になる。
    // 子どもは、借金はできない。手持ちのお小遣いの範囲で、使う。
    if (p.cashDelta < 0 && p.age < 18) next.wallet.cash = Math.max(0, next.wallet.cash + p.cashDelta);
    else if (p.cashDelta < 0) chargeWithDebt(next, -p.cashDelta);
    else next.wallet.cash += p.cashDelta;
    p.cashDelta = 0;
  }
  for (const sc of p.scheduled) {
    const { years, ...rest } = sc;
    next.later.push({ ...rest, age: p.age + years });
  }
  p.scheduled = [];
  p.kidList.forEach((k, i) => {
    if (!k.name && !k.anon && !next.naming.some((n) => n.kind === "child" && n.index === i)) next.naming.push({ kind: "child", index: i, label: kidTitle(p, i) });
  });
  p.pets.forEach((pt, i) => {
    if (!pt.name && !next.naming.some((n) => n.kind === "pet" && n.index === i)) next.naming.push({ kind: "pet", index: i, label: pt.kind });
  });
}

const namePool = (data: CountryData, kind: "child" | "pet", petKind?: string, kidSex?: "boy" | "girl") =>
  kind === "child" ? kidNamePool(data, kidSex ?? "boy") : petKind === "犬" ? data.names.dog : petKind === "猫" ? data.names.cat : data.names.small;

// 名づけの候補(画面に出す)。
export function suggestNames(state: GameState, data: CountryData = jpData, n = 4): string[] {
  const req = state.naming[0];
  if (!req) return [];
  const pool = namePool(data, req.kind, state.person.pets[req.index]?.kind, state.person.kidList[req.index]?.sex as "boy" | "girl" | undefined);
  const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
  return picks;
}

// 名前をつける。raw が空・null なら、おまかせ。
export function setName(state: GameState, raw: string | null, data: CountryData = jpData): GameState {
  const req = state.naming[0];
  if (!req) return state;
  const next = clone(state);
  next.naming.shift();
  const p = next.person;
  const rng = streamRng(next.seed, p.age, S.name + req.index);
  const typed = (raw ?? "").trim().slice(0, 12);
  if (req.kind === "child") {
    const k = p.kidList[req.index];
    k.name = typed || pick(rng, namePool(data, "child", undefined, k.sex === "unknown" ? "boy" : k.sex));
    next.events.push({ age: p.age, event: `${kidTitle(p, req.index)}に「${k.name}」と名づけた`, weight: 72 });
  } else {
    const pt = p.pets[req.index];
    pt.name = typed || pick(rng, namePool(data, "pet", pt.kind));
    next.events.push({ age: p.age, event: `${pt.kind}に「${pt.name}」と名づけた`, weight: 60 });
    // ペットの寿命は、十数年。
    next.later.push({ age: p.age + 6 + Math.floor(rng() * 13), event: `${pt.kind}の「${pt.name}」が、天国へ旅立った`, weight: 64, delta: { bonds: -5, health: -1, joy: -8 }, petDied: pt.name });
  }
  return next;
}

// いま選択を求められている場面。なければ null。
// 選択を求める出来事が、選べる選択肢を、2つ以上もっているか。お金が足りないなどで、「行かない」しか選べない出来事は、出さない(出来事にも、残さない)。
function hasChoice(def: { question: (p: Person) => { options: { show?: (p: Person) => boolean; auto?: boolean; cost?: (p: Person) => number }[] } }, p: Person, cashYen: number): boolean {
  const q = def.question(p);
  const visible = q.options.filter((o) => (!o.show || o.show(p)) && (o.auto || !o.cost || p.age < 18 || o.cost(p) * 10000 <= cashYen));
  return visible.length >= 2;
}

// 選択の場面が、その年の何か月めに来るか(0〜11)。年のはじめにまとめて出さず、時間が進むなかで出す。
// 年のはじめの選択が、年のおわりの選択に影響するため。同じ人・同じ年なら、いつも同じ月になる。
export function choiceMonth(seed: number, age: number, id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 100003;
  return Math.floor(roll(seed + h, age, 91) * 12);
}

// いま選択を求められている場面。month は、いまの月(0〜11)。まだ来ていない月の場面は、出さない(省くと、すべて出る)。
export function pending(state: GameState, data: CountryData = jpData, month = 11): TurningPoint | null {
  const p = state.person;
  if (p.prison) return null;
  let best: { tp: TurningPoint; when: number } | null = null;
  // 選択を求める出来事(不倫・裁判・ペットなど)が、順番待ちならそれを先に出す。
  const def = state.queue.length ? data.eventQuestions.find((e) => e.id === state.queue[0]) : undefined;
  if (def && hasChoice(def, p, state.wallet.cash)) {
    const q = def.question(p);
    best = { tp: { id: `ev:${def.id}`, age: p.age, title: q.title, prompt: q.prompt, why: def.intro(p), options: q.options }, when: def.id.startsWith("meet_") ? 0 : choiceMonth(state.seed, p.age, def.id) };
  }
  for (const tp of data.turningPoints) {
    if (state.done.includes(tp.id)) continue;
    const at = ageOf(tp, p);
    if (at > p.age) continue;
    const window = tp.repeatWhile ? Infinity : 3;
    if (p.age - at > window) continue;
    if (tp.when && !tp.when(p)) continue;
    // くり返し聞く場面は、同じ年には、二度聞かない(答えたあと、まだ決まっていなくても、来年まで待つ)。
    if (tp.repeatWhile && p.history[`asked_${tp.id}`] === p.age) continue;
    // 前の年から持ち越した節目は、すぐ出す。この年の節目は、この年のなかの、決まった月に出す。
    const when = at < p.age ? 0 : choiceMonth(state.seed, p.age, tp.id);
    if (!best || when < best.when) best = { tp: tp.promptFn ? { ...tp, prompt: tp.promptFn(p) } : tp, when };
    break;
  }
  return best && best.when <= month ? best.tp : null;
}

const TAG_EFFECT: Record<Tag, (p: Person, rng: Rng) => void> = {
  challenge: (p, r) => bump(p, { money: Math.round((r() - 0.4) * 20), learn: 3 }),
  stable: (p) => bump(p, { money: 4 }),
  learn: (p) => bump(p, { learn: 8 }),
  bond: (p) => bump(p, { bonds: 8 }),
  rest: (p) => bump(p, { health: 6 }),
};

export function suggestTag(text: string, data: CountryData = jpData): Tag | null {
  return data.tags.find((t) => t.keywords.test(text))?.id ?? null;
}

// 選択の場面に添える、いまの景気。
export function envAt(state: GameState, data: CountryData = jpData): Env {
  const econ = economyAt(state.seed, state.person.age, state.person.birthYear);
  return { econ, econLabel: data.econLabel(econ) };
}

// 根から path の順にたどって、選んだ選択肢を集める。途中で次の質問があれば、その質問の選択肢へ進む。
export function resolvePath(tp: TurningPoint, path: string[], p: Person): TurningOption[] {
  const picked: TurningOption[] = [];
  let options = tp.options;
  for (const id of path) {
    const node = options.find((o) => o.id === id);
    if (!node) break;
    picked.push(node);
    options = node.children ? node.children(p).options : [];
  }
  return picked;
}

// 金額の読み取り: 「4万円」「300万」「1億」「5千円」「三十万円」など。万円単位で返す。
const KANJI: Record<string, number> = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function kanjiToNumber(text: string): number | null {
  let total = 0;
  let cur = 0;
  for (const ch of text) {
    if (ch in KANJI) cur = KANJI[ch];
    else if (ch === "十") (total += (cur || 1) * 10), (cur = 0);
    else if (ch === "百") (total += (cur || 1) * 100), (cur = 0);
    else if (ch === "千") (total += (cur || 1) * 1000), (cur = 0);
    else return null;
  }
  return total + cur || null;
}

export function parseAmountMan(raw: string): number | null {
  const t = raw
    .replace(/[,，]/g, "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const k = t.match(/([一二三四五六七八九十百千]+)万/);
  if (k) {
    const n = kanjiToNumber(k[1]);
    if (n) return n;
  }
  const oku = t.match(/(\d+(?:\.\d+)?)\s*億/);
  if (oku) return Number(oku[1]) * 10000;
  const man = t.match(/(\d+(?:\.\d+)?)\s*万/);
  if (man) return Number(man[1]);
  const sen = t.match(/(\d+(?:\.\d+)?)\s*千円/);
  if (sen) return Number(sen[1]) / 10;
  const yen = t.match(/(\d+)\s*円/);
  if (yen) return Number(yen[1]) / 10000;
  return null;
}

// 手入力の文章を、辞書で読み取る。AI は使わない。
// 議員の職にあるあいだは、できないこと(副業・転職・独立・退職)。
const OFFICE_BLOCKED = new Set(["side_job", "job_change", "go_self", "retire", "reduce_work", "business"]);

export function interpret(text: string, data: CountryData = jpData): Interpretation {
  const actions = data.intents.filter((r) => r.test.test(text) && (!r.also || r.also.test(text))).slice(0, 5);
  let category: Interpretation["category"] = null;
  let best = 0;
  for (const c of data.spendCategories) {
    const n = (text.match(new RegExp(c.test.source, "g")) ?? []).length;
    if (n > best) {
      best = n;
      category = c.id;
    }
  }
  return { actions, category, amountMan: parseAmountMan(text) };
}

// 手入力(選択の場面の「自分で書く」と、資産の使い方)を、人生に反映する。
// 辞書で読み取れた出来事を実際の状態に反映し、お金の使い道は、その人の特徴から、
// 直後に始めたことと、数年後の結果を年表に残す。読み取れなければ、近い方向(tag)で反映する。
export function freeAction(
  state: GameState,
  opts: { text: string; tag: Tag | null; yen: number | null; month: number },
  data: CountryData = jpData,
): GameState | null {
  if (state.person.prison) return null; // 服役中は、できない
  const text = opts.text.trim();
  if (!text || state.deathAge !== null) return null;
  const interp = interpret(text, data);
  const yen = opts.yen ?? (interp.amountMan !== null ? Math.round(interp.amountMan * 10000) : null);
  if (yen !== null && yen > state.wallet.cash) return null;
  if (interp.actions.length === 0 && !interp.category && !opts.tag) return null;

  const next = clone(state);
  const p = next.person;
  const age = p.age;
  const rng = streamRng(next.seed, age, S.choice);
  const cat = interp.category ? data.spendCategories.find((c) => c.id === interp.category) : undefined;
  const tagLabel = (t: Tag) => data.tags.find((x) => x.id === t)?.label ?? "";
  const label = cat?.label ?? interp.actions[0]?.label ?? (opts.tag ? tagLabel(opts.tag) : "");
  const spent = yen !== null && cat?.id !== "save";
  const man = yen !== null ? yen / 10000 : 10;

  next.events.push({
    age,
    event: spent ? (yen! < 100000 ? `「${text}」に、お小遣いから${Math.round(yen!).toLocaleString("ja-JP")}円を使った` : `「${text}」に、${Math.round(man).toLocaleString("ja-JP")}万円(=${Math.round(yen!).toLocaleString("ja-JP")}円)を使った`) : `「${text}」`,
    weight: 85,
    tag: opts.tag ?? undefined,
    free: true,
    label,
    ...(spent && cat?.id !== "invest" ? { fx: { money: -yen! } } : {}),
  });
  if (spent) next.wallet.cash -= yen!;

  // 1) 読み取れた出来事を、そのまま人生に反映する。
  let changed = false;
  // 金額つきで使うときは、使い道の分類が表す出来事(学び・旅・投資など)は、二重に読み取らない。
  const covered = cat && yen !== null ? (cat.subsumes ?? []) : [];
  for (const rule of interp.actions) {
    if (covered.includes(rule.id)) continue;
    const m = text.match(rule.test);
    if (!m) continue;
    // 議員(総理大臣をふくむ)は、副業・転職・独立・退職はできない。
    if (p.office && OFFICE_BLOCKED.has(rule.id)) {
      next.events.push({ age, event: "議員の職にあるあいだは、副業・転職・独立・退職はできない", weight: 40 });
      continue;
    }
    const ev = rule.apply(next, rng, data, m);
    if (ev) {
      next.events.push({ age, event: ev, weight: 70 });
      changed = true;
    }
  }

  // 2) お金の使い道は、その人の特徴から、直後の行動と数年後の結果をつくる。
  const remaining = interp.actions.filter((r) => !covered.includes(r.id));
  if (cat && !(p.office && cat.id === "business") && (remaining.length === 0 || yen !== null)) {
    let firstStocks = false;
    if (cat.id === "invest") {
      firstStocks = !next.wallet.stocks;
      next.wallet.stocks = true;
      // 使った金額は、日本株インデックスの購入にあてる(支払いは、上で引いてある)。
      if (yen) {
        const price = priceAt(marketOf(next.seed, data), "index", age, opts.month);
        next.wallet.units.index += yen / price;
        next.wallet.contributed += yen;
      }
    }
    const pl = cat.plan(p, man, rng, data, p.econ, text);
    const fxBefore = fxSnap(next);
    bump(p, pl.effect);
    const planFx = fxSince(next, fxBefore);
    next.events.push({ age, event: cat.id === "invest" && !firstStocks ? "株式への投資を増やした" : pl.start, weight: 60, ...(planFx ? { fx: planFx } : {}) });
    changed = true;
    if (pl.payoff) {
      const luck = roll(next.seed, age, S.choice + 2);
      const r = luck < pl.payoff.chance ? pl.payoff.good : pl.payoff.bad;
      if (r) next.later.push({ age: age + pl.payoff.years, event: r.event, weight: 60, delta: r.delta, payMult: (r as { payMult?: number }).payMult });
    }
  } else if (remaining.length === 0 && opts.tag) {
    TAG_EFFECT[opts.tag](p, rng);
    changed = true;
  }
  flush(next);
  return changed || spent ? next : null;
}

// 手入力が反映できるかを、画面で先に調べる(反映できれば、読み取った内容を見せる)。
export const canInterpret = (text: string, data: CountryData = jpData) => {
  const i = interpret(text, data);
  return i.actions.length > 0 || i.category !== null;
};

// 画面に出す「読み取った内容」(出来事の名前と、使い道の種類、金額)。
export function describeText(text: string, data: CountryData = jpData): { labels: string[]; amountMan: number | null } {
  const i = interpret(text, data);
  const cat = i.category ? data.spendCategories.find((c) => c.id === i.category) : undefined;
  const labels = [...i.actions.map((a) => a.label), ...(cat && !i.actions.some((a) => a.label === cat.label) ? [`使い道: ${cat.label}`] : [])];
  return { labels, amountMan: i.amountMan };
}

export function answer(state: GameState, tp: TurningPoint, choice: Choice, data: CountryData = jpData): GameState {
  let next = clone(state);
  const cashBefore = next.wallet.cash;
  const debtBefore = debtTotal(next.wallet.debts);
  const eventsBefore = next.events.length;
  const p = next.person;
  const rng = streamRng(next.seed, p.age, S.choice);
  // 卒業の1年前に決めた進路は、いまは実行せず、卒業のときに実行する。
  if (tp.id === "job" && choice.kind === "option" && p.occ === null && p.age < gradAgeOf(p)) {
    p.jobPlan = choice.path;
    p.history.asked_job = p.age;
    const labels = resolvePath(tp, choice.path, p).map((n) => n.label.replace(/する$/, ""));
    next.events.push({ age: p.age, event: `卒業したあとは、「${labels.join(" → ")}」の道に進むことにした`, weight: 70 });
    flush(next);
    return next;
  }
  if (choice.kind === "option") {
    for (const node of resolvePath(tp, choice.path, p)) {
      const snap = fxSnap(next);
      const text = node.apply(p, rng, data);
      if (text) {
        const fx = fxSince(next, snap);
        next.events.push({ age: p.age, event: text, weight: 75, ...(fx ? { fx } : {}) });
      }
    }
  } else {
    next = freeAction(next, { text: choice.text, tag: choice.tag, yen: null, month: 0 }, data) ?? next;
  }
  next.lastQ = tp.id;
  if (tp.id.startsWith("ev:")) next.queue.shift();
  else if (!tp.repeatWhile?.(next.person)) next.done.push(tp.id);
  else next.person.history[`asked_${tp.id}`] = next.person.age;
  // 付き合っていない人との結婚の話は、取り下げる(距離を置いた・別れたなど)。
  next.queue = next.queue.filter((id) => !(id === "marry" && (next.person.married || next.person.partner?.status !== "dating")));
  flush(next);
  // 選択で貯金が増減したら、その結果の出来事に「-〇〇万円」を添える(手入力の使い道は、すでに金額を書いている)。
  if (choice.kind === "option" && next.events.length > eventsBefore) {
    const tag = moneyTag(next.wallet.cash - cashBefore, debtTotal(next.wallet.debts) - debtBefore);
    if (tag) next.events[next.events.length - 1].event += tag;
  }
  return next;
}

// 習い事を始める。同時にできるのは MAX_LESSONS つまで。始められなければ null。
export function startLesson(state: GameState, id: string, data: CountryData = jpData): GameState | null {
  if (state.person.prison) return null; // 服役中は、できない
  const def = data.lessons.find((l) => l.id === id);
  const p = state.person;
  if (!def || state.deathAge !== null) return null;
  if (p.lessons.length >= MAX_LESSONS || p.lessons.some((l) => l.id === id)) return null;
  if (p.age < def.minAge || (def.maxAge !== undefined && p.age > def.maxAge)) return null;
  if (lessonBlock(p, def.costMan)) return null;
  if (!lessonAvailable(id, yearOf(p))) return null;
  const next = clone(state);
  next.person.lessons.push({ id, since: p.age });
  next.events.push({ age: p.age, event: `習い事「${def.label}」を始めた`, weight: 52 });
  return next;
}

// アルバイトを始める(同時にひとつ)。始められなければ null。
export function startPartTime(state: GameState, id: string, data: CountryData = jpData): GameState | null {
  if (state.person.prison) return null; // 服役中は、できない
  const def = data.partTimes.find((x) => x.id === id);
  const p = state.person;
  if (!def || state.deathAge !== null || p.age < def.minAge || p.age >= 75) return null;
  if (!partTimeAvailable(id, yearOf(p))) return null;
  // 仕事に就いている人は、アルバイトはできない。
  if (p.occ !== null && p.occ !== "retired") return null;
  if (p.age >= WORK_LIMIT) return null;
  const next = clone(state);
  next.person.parttime = { id, since: p.age };
  next.events.push({ age: p.age, event: `アルバイトを始めた。「${def.label}」(年に約${Math.round(def.yearlyMan * minWageFactor(yearOf(p), prefOf(p)) * (p.occ !== null && p.occ !== "retired" ? 0.6 : p.age < 18 ? 0.5 : 1))}万円)`, weight: 52 });
  return next;
}

export function stopPartTime(state: GameState, data: CountryData = jpData): GameState {
  const p = state.person;
  const def = p.parttime ? data.partTimes.find((x) => x.id === p.parttime!.id) : undefined;
  if (!p.parttime) return state;
  const next = clone(state);
  next.person.parttime = null;
  next.events.push({ age: p.age, event: `アルバイト「${def?.label ?? ""}」をやめた`, weight: 40 });
  return next;
}

// 当選の目安(0〜1)。頭の良さ(素質)・つながり・お金のゆとりが効く。
export function officeChance(p: Person, od: { win: number }): number {
  return Math.min(0.65, od.win * (0.7 + p.extra.trust / 140) * (0.5 + p.intel / 200) * (0.6 + p.stats.bonds / 125) * (0.75 + p.stats.money / 200) * (p.age >= 40 ? 1.1 : 1));
}

// 出馬する。供託金や選挙運動の費用がかかり、当選すれば議員などになる。出せなければ null。
export function runForOffice(state: GameState, id: string, data: CountryData = jpData): GameState | null {
  if (state.person.prison) return null; // 服役中は、できない
  const od = data.offices.find((x) => x.id === id);
  const p0 = state.person;
  if (!od || state.deathAge !== null || p0.age < od.minAge || p0.office || p0.age > 80) return null;
  if (state.wallet.cash < od.costMan * 10000) return null;
  const next = clone(state);
  const p = next.person;
  const snap = fxSnap(next);
  next.wallet.cash -= od.costMan * 10000;
  const win = roll(next.seed, p.age, S.choice + 7) < officeChance(p, od);
  // 供託金は、当選か、一定の得票があれば戻る(得票が基準に届かないと、没収される)。
  const refunded = win || roll(next.seed, p.age, S.choice + 8) < 0.55;
  if (refunded) next.wallet.cash += od.depositMan * 10000;
  if (win) {
    if (!p.prev && p.occ !== null && p.occ !== "retired") p.prev = { occ: p.occ, job: p.job, payMult: p.payMult };
    p.occ = "tech";
    p.job = "politician";
    p.payMult = od.payMult;
    p.employment = "regular";
    p.sector = "public";
    p.office = { id, since: p.age, terms: 1 };
    bump(p, { bonds: 6, joy: 12, health: -3, learn: 2 });
  } else {
    bump(p, { bonds: -2, joy: -9, money: -3 });
  }
  const fx = fxSince(next, snap);
  next.events.push({ age: p.age, event: win ? `${od.label}に立候補し、当選した(供託金${od.depositMan}万円は戻り、選挙運動に約${od.campaignMan}万円を使った)` : `${od.label}に立候補したが、落選した(選挙運動に約${od.campaignMan}万円を使い、供託金${od.depositMan}万円は${refunded ? "戻った" : "没収された"})`, weight: 80, ...(fx ? { fx } : {}) });
  flush(next);
  return next;
}

// 総理大臣の経済対策。ひどい不況のとき、年に一度だけ、税金などを動かせる。
export const PM_POLICIES: { id: string; label: string; note: string }[] = [
  { id: "consumption_cut", label: "消費税を引き下げる", note: "暮らしが楽になり、支持は上がる。財源への批判が、あとから出てくる。" },
  { id: "income_cut", label: "所得税・住民税を減税する", note: "働く人の手取りが増え、支持が上がる。税収が減り、批判も出る。" },
  { id: "cash_benefit", label: "国民に給付金を出す", note: "すぐに家計を支えられ、支持が上がる。一度きりで、効果は長続きしない。" },
  { id: "tax_hike", label: "増税して財政を立て直す", note: "国の財政は守られるが、不況のなかの増税で、支持は大きく下がる。" },
];

// 経済対策ができる状態か(総理大臣で、ひどい不況で、今年まだ使っていない)。
export function pmPolicyReady(state: GameState): boolean {
  const p = state.person;
  return state.deathAge === null && p.office?.rank === "pm" && p.econ < -0.6 && p.history.pmPolicy !== p.age;
}

export function pmPolicy(state: GameState, id: string): GameState | null {
  if (state.person.prison) return null; // 服役中は、できない
  const def = PM_POLICIES.find((x) => x.id === id);
  if (!def || !pmPolicyReady(state)) return null;
  const next = clone(state);
  const p = next.person;
  const snap = fxSnap(next);
  p.history.pmPolicy = p.age;
  const t = (d: number) => (p.extra.trust = Math.min(100, Math.max(0, p.extra.trust + d)));
  let text = "";
  if (id === "consumption_cut") {
    t(7);
    bump(p, { joy: 3, bonds: 2 });
    next.later.push({ age: p.age + 2, event: "消費税の減税の財源をめぐり、批判が強まった", weight: 55, delta: { bonds: -2 } });
    text = "不況のなか、消費税の引き下げを決めた。家計への支えとして、国民の支持が集まった";
  } else if (id === "income_cut") {
    t(5);
    bump(p, { joy: 2, bonds: 2 });
    next.later.push({ age: p.age + 2, event: "減税による税収の落ちこみが、国会で問われた", weight: 55, delta: { bonds: -2 } });
    text = "不況のなか、所得税と住民税の減税を決めた。働く人の手取りが増えた";
  } else if (id === "cash_benefit") {
    t(6);
    bump(p, { joy: 2 });
    next.later.push({ age: p.age + 1, event: "給付金の効果は一時的で、景気の回復には、つながらなかったとの指摘が出た", weight: 50, delta: { bonds: -1 } });
    text = "不況のなか、国民への給付金を決めた。すぐに家計を支える対策として、受け入れられた";
  } else {
    t(-9);
    bump(p, { joy: -3, bonds: -3 });
    next.later.push({ age: p.age + 3, event: "増税の効果で、国の財政に、少しゆとりが出てきた", weight: 55, delta: { joy: 2 } });
    text = "不況のなか、増税による財政の立て直しに踏み切った。国民の反発は強く、支持は大きく下がった";
  }
  const fx = fxSince(next, snap);
  next.events.push({ age: p.age, event: text, weight: 80, ...(fx ? { fx } : {}) });
  flush(next);
  return next;
}

// こどもNISA(子どもの将来のための積立)。親が積み立て、いちばん下の子が18歳になるとき、子どもの新しい道のために使われる。
export function contributeKidFund(state: GameState, yen: number): GameState | null {
  if (state.person.prison) return null; // 服役中は、できない
  const p = state.person;
  const youngest = p.kidList.some((k) => p.age - k.bornAge < 18);
  if (state.deathAge !== null || p.age < 18 || !youngest || yen <= 0 || state.wallet.cash < yen) return null;
  const next = clone(state);
  const snap = fxSnap(next);
  next.wallet.cash -= yen;
  next.person.kidFundYen += yen;
  flush(next);
  const fx = { money: -yen };
  void snap;
  next.events.push({ age: p.age, event: `こどもNISAに、${Math.round(yen / 10000).toLocaleString("ja-JP")}万円を積み立てた(子どもの将来のための投資。値動きがあり、減ることもある)`, weight: 58, fx });
  return next;
}

// 出会いの場に出かける(「活動する」から)。出かけた先で、選択の場面が出る。1年に3回まで。
export function goMeet(state: GameState, id: string): GameState | null {
  if (state.person.prison) return null; // 服役中は、できない
  const def = meetById(id);
  const p = state.person;
  if (!def || state.deathAge !== null || !def.show(p) || state.queue.length > 0) return null;
  const used = p.history.meetYear === p.age ? (p.history.meetCount ?? 0) : 0;
  if (used >= MEET_LIMIT) return null;
  const yen = def.costMan * 10000;
  if (p.age >= 18 && state.wallet.cash < yen) return null;
  const next = clone(state);
  if (next.person.age >= 18) next.wallet.cash -= yen;
  next.person.history.meetYear = next.person.age;
  next.person.history.meetCount = used + 1;
  next.queue.push(def.question);
  next.events.push({ age: p.age, event: def.did, weight: 40 });
  return next;
}

// 売買: 買う。足りなければ null。
export function shopBuy(state: GameState, id: string): GameState | null {
  if (state.person.prison) return null; // 服役中は、できない
  const it = shopById(id);
  const p = state.person;
  if (!it || state.deathAge !== null || !it.visible(p) || it.id === "home_sell") return null;
  const yen = it.costMan(p) * 10000;
  if (state.wallet.cash < yen) return null;
  const next = clone(state);
  const snap = fxSnap(next);
  next.wallet.cash -= yen;
  const text = it.apply(next.person);
  const fx = fxSince(next, snap);
  next.events.push({ age: p.age, event: text, weight: 55, ...(fx ? { fx } : {}) });
  return next;
}

// 売買: 手放す(売る)。
export function shopSell(state: GameState, id: string): GameState | null {
  if (state.person.prison) return null; // 服役中は、できない
  const it = shopById(id);
  const p = state.person;
  if (!it || !it.sellMan || !it.sellApply || state.deathAge !== null) return null;
  if (id === "home_sell" ? !it.visible(p) : p.owns[id] === undefined) return null;
  const next = clone(state);
  const snap = fxSnap(next);
  const yen = Math.round(it.sellMan(next.person) * 10000);
  const text = it.sellApply(next.person);
  next.wallet.cash += yen;
  const fx = fxSince(next, snap);
  next.events.push({ age: p.age, event: `${text}${yen > 0 ? `(+${Math.round(yen / 10000).toLocaleString("ja-JP")}万円)` : ""}`, weight: 50, ...(fx ? { fx } : {}) });
  return next;
}

// 習い事をやめる。いつでもやめられる。
export function stopLesson(state: GameState, id: string, data: CountryData = jpData): GameState {
  const def = data.lessons.find((l) => l.id === id);
  if (!def || !state.person.lessons.some((l) => l.id === id)) return state;
  const next = clone(state);
  next.person.lessons = next.person.lessons.filter((l) => l.id !== id);
  next.events.push({ age: next.person.age, event: `習い事「${def.label}」をやめた`, weight: 36 });
  return next;
}

// ---- 貯金が足りないとき、借りて使う ----
export type LenderOffer = { id: LenderId; label: string; note: string; ok: boolean; why?: string; rateText: string };

// 足りない額(円)。0 なら、借りなくてよい。
export const shortfallFor = (state: GameState, yen: number) => Math.max(0, Math.round(yen - state.wallet.cash));

// 借り先の候補(借りられない理由つき)。子どもは、借りられない。
export function lenderOffers(state: GameState, shortfallYen: number, data: CountryData = jpData): LenderOffer[] {
  const income = incomeOf(state.person, data, state.person.econ);
  return LENDER_ORDER.map((id) => {
    const def = LENDERS[id];
    const av = state.person.age < 18 ? { ok: false, why: "子どもは、お金を借りられない" } : lenderAvailable(state.person, id, shortfallYen, income);
    return { id, label: def.label, note: def.note, ok: av.ok, why: av.why, rateText: def.rate === 0 ? "利息なし" : `年利 約${Math.round(def.rate * 100)}%` };
  });
}

// 借りて、そのお金で使う。経済は底に落ち、幸福度やつながりが下がる。借りられなければ null。
export function borrowAndSpend(
  state: GameState,
  lender: LenderId,
  opts: { text: string; tag: Tag | null; yen: number; month: number },
  data: CountryData = jpData,
): GameState | null {
  if (state.person.prison) return null; // 服役中は、できない
  const short = shortfallFor(state, opts.yen);
  if (short <= 0 || state.deathAge !== null) return null;
  const offer = lenderOffers(state, short, data).find((o) => o.id === lender);
  if (!offer?.ok) return null;
  const next = clone(state);
  const def = LENDERS[lender];
  addDebt(next, lender, short);
  next.wallet.cash += short;
  bump(next.person, { bonds: def.bonds, joy: def.joy, health: def.health });
  // 借りた時点で、経済は、いちばん下まで落ちる。
  next.person.stats.money = 0;
  const from: Record<LenderId, string> = { family: "家族に頭を下げて", friend: "友人に頼んで", bank: "銀行のローンで", card: "カードローン・消費者金融で", shark: "闇金で" };
  const amount = short >= 10000 ? `${Math.round(short / 10000).toLocaleString("ja-JP")}万円(=${short.toLocaleString("ja-JP")}円)` : `${short.toLocaleString("ja-JP")}円`;
  next.events.push({ age: next.person.age, event: `お金が足りず、${from[lender]}${amount}を借りた`, weight: 66 });
  return freeAction(next, { text: opts.text, tag: opts.tag, yen: opts.yen, month: opts.month }, data) ?? null;
}

// 本人が、株を始める(始めるかどうかは選択)。
export function startStocks(state: GameState): GameState {
  if (state.wallet.stocks || state.deathAge !== null) return state;
  const next = clone(state);
  next.wallet.stocks = true;
  next.events.push({ age: next.person.age, event: "株式投資を始めた", weight: 50 });
  return next;
}

// 1年進める。亡くなったら deathAge が入る。
export function tick(state: GameState, data: CountryData = jpData): GameState {
  const next = clone(state);
  if (next.deathAge !== null) return next;
  const p = next.person;
  const a = p.age + 1;
  // 選べる道が、ひとつもなくなった(お金が足りなくなった)順番待ちの選択は、取り除く。
  next.queue = next.queue.filter((id) => {
    const d = data.eventQuestions.find((e) => e.id === id);
    // 結婚の話は、付き合っている人がいるときだけ。別れていたら、取り下げる。
    if (id === "marry" && (p.married || p.partner?.status !== "dating")) return false;
    if (id === "move_ask" && isResponsible(p)) return false;
    return !d || hasChoice(d, p, next.wallet.cash);
  });
  const seed = next.seed;
  // 直前の出来事から、能力値と資産がどれだけ動いたかを、年表の出来事に添える。
  let last = fxSnap(next);
  const mark = () => {
    last = fxSnap(next);
  };
  const push = (event: string, weight: number) => {
    const fx = fxSince(next, last);
    last = fxSnap(next);
    next.events.push({ age: a, event, weight, ...(fx ? { fx } : {}) });
  };
  // いまの仕事に就いた年齢を、記録しておく(仕事が変わったら、数えなおす)。
  const jk = p.occ === null || p.occ === "retired" ? "" : `${p.occ}:${p.job ?? ""}`;
  if (jk && p.jobKey !== jk) {
    p.jobKey = jk;
    p.jobSince = a - 1;
  }
  if (!jk) p.jobKey = undefined;
  const c = cond(data, p);
  p.age = a;
  p.econ = economyAt(seed, a, p.birthYear);

  // 実際に日本で起きた、大きな出来事(災害・経済・社会)。生まれた年と年齢から決まる、その年だけ、年表にはさむ。
  if (p.birthYear !== undefined && a >= 3) {
    const year = (p.birthYear ?? 0) + a;
    for (const he of HISTORY_EVENTS) {
      if (he.year !== year || year > SIM_NOW_YEAR) continue;
      const pref = p.abroad ? null : prefectureOf(p.city);
      const hit = !!pref && !!he.hit?.includes(pref);
      mark();
      bump(p, (hit ? he.hitBump : he.bump) ?? {});
      push(hit && he.hitText ? he.hitText : he.text, 62);
    }
  }

  // あとから持病が見つかる(分岐した人生で、現在の年齢になったころ)。
  if (p.ailmentOnset && a >= p.ailmentOnset.age) {
    const ad = data.ailments.find((x) => x.id === p.ailmentOnset!.id);
    p.ailment = p.ailmentOnset.id;
    p.ailmentOnset = null;
    if (ad) {
      p.stats.health = clamp(p.stats.health + ad.healthDelta);
      bump(p, { joy: ad.joy });
      push(`検査で「${ad.label}」と診断され、通院しながらの暮らしが始まった`, 70);
    }
  }

  // 健康は、年齢とともに少しずつ下がり、病気のあとはゆっくり戻る。「年齢相応の健康」からの差が死亡率に効く。
  const expected = healthAt(c.healthBase, a);
  p.stats.health = clamp(p.stats.health - (a > 65 ? 0.8 : a > 40 ? 0.4 : 0));
  if (p.stats.health < expected) p.stats.health = Math.min(expected, p.stats.health + 1.5);

  // 幸福度は、つながり・健康・お金などの暮らしの目標に、少しずつ近づく。うつ状態のあいだは、さらに下がる。
  {
    const st = p.stats;
    // 都道府県による、幸福度(調査の点数)のちがいを、目標に足す(「幸福度調査2024」)。
    const target = Math.min(100, Math.max(0, 0.35 * st.bonds + 0.3 * st.health + 0.25 * st.money + 0.1 * st.learn + 8 + happinessOf(p)));
    st.joy = clamp(st.joy + (target - st.joy) * 0.3 - (p.mood === "depressed" ? 4 : 0));
    if (p.sick) st.health = clamp(st.health - 2);
    if (p.mood === "depressed") p.moodYears += 1;
    // 暮らしの数値: ストレス・信用・仕事の実績・魅力。
    const x = p.extra;
    const w = p.occ !== null && p.occ !== "retired";
    const debt = debtTotal(next.wallet.debts) > 0;
    const stressNow = (w ? 14 : 0) + (p.age - (p.history.overtime ?? -99) <= 1 ? 14 : 0) + (debt ? 10 : 0) + (st.money < 30 ? 8 : 0) + (p.kidList.some((k) => p.age - k.bornAge < 6) ? 6 : 0) + (p.caregiving ? 10 : 0) + (p.mood === "depressed" ? 12 : 0) + (p.housingKind === "homeless" ? 25 : 0) + 36 - 0.12 * st.joy - 0.1 * st.bonds - 2 * p.lessons.length - (p.occ === "retired" ? 8 : 0);
    x.stress = clamp(x.stress + (stressNow - x.stress) * 0.35);
    if (x.stress > 75) {
      st.health = clamp(st.health - (x.stress > 90 ? 3 : 1.5));
      st.joy = clamp(st.joy - 2);
    }
    const trustTarget = 40 + (w && p.employment === "regular" ? 12 : 0) + (p.owned ? 8 : 0) + (p.married ? 6 : 0) + (a >= 30 ? 8 : 0) + (a >= 45 ? 6 : 0) - (debt ? 15 : 0) - (p.bankrupt !== null && a - p.bankrupt <= 7 ? 25 : 0);
    x.trust = clamp(x.trust + (trustTarget - x.trust) * 0.25);
    if (w && p.job === "athlete" && p.sport) {
      // 選手の実績は、大会の結果で決まる(大会に出なければ、少しずつ、薄れる)。
      x.career = clamp(x.career - 1);
    } else if (w) {
      const careerTarget = 15 + 0.35 * st.learn + (p.employment === "regular" ? 10 : 0) + Math.min(22, Math.max(0, a - 24) * 1.1);
      x.career = clamp(x.career + (careerTarget - x.career) * 0.12);
    } else if (p.occ !== "retired") x.career = clamp(x.career - 2);
    const charmTarget = 0.3 * st.health + 0.2 * st.joy + 0.2 * st.bonds + 0.15 * st.learn + 15 - Math.max(0, a - 40) * 0.4;
    x.charm = clamp(x.charm + (charmTarget - x.charm) * 0.25);
  }

  mark();
  // 亡くなる確率: 年齢・性別の生命表に、持病と健康の度合いで補正をかける。
  const healthMult = Math.min(2.2, Math.max(0.6, 1 + (expected - p.stats.health) / 80));
  // 亡くなる確率の土台(生命表)。事故・急病など「出来事によるもの」は、健康や心の状態に左右されない。
  // 病気によるものは、健康・持病・うつ状態・深刻な病気で、増減する。二つの人生で、乱数は別々。
  // 都道府県による、平均寿命のちがい(2020年の都道府県別生命表)を、死亡率に反映する。
  const base = interpolateLog(data.curves.mortality[p.sex], a) * Math.sqrt(c.illness) * mortalityOf(p);
  const share = Math.min(0.9, Math.max(0, interpolate(data.curves.suddenShare, a)));
  const qSudden = Math.min(1, base * share);
  // 病気による死は、病気・うつなどで死期が早まる設計の影響を、全体の平均寿命が公表値に合うよう、係数でならす。
  const qOther = Math.min(1, data.curves.mortalityScale[p.sex] * base * (1 - share) * healthMult * (p.sick ? 2.4 : 1) * (p.mood === "depressed" ? 1.5 : 1));
  const suddenHit = roll(seed + next.salt * 7919, a, S.sudden) < qSudden;
  if (a >= MAX_AGE || suddenHit || roll(seed + next.salt * 104729, a, S.death) < qOther) {
    next.deathAge = a;
    next.snap ??= clone(p);
    const info = a >= MAX_AGE ? { label: "老衰", text: (age: number) => `${age}歳。このゲームの最大寿命まで、生き抜いた。眠るように、人生を終えた` } : causeOfDeath(p, suddenHit && a < MAX_AGE, streamRng(seed + next.salt * 7919, a, S.sudden + 1));
    next.deathCause = info.label;
    next.deathNote = buildDeathNote(p, info.label, suddenHit && a < MAX_AGE, p.ailment !== "none" ? (data.ailments.find((x) => x.id === p.ailment)?.label ?? "") : "", p.condition !== "none" ? (data.conditions.find((x) => x.id === p.condition)?.label ?? "") : "", p.occ && p.occ !== "retired" ? jobLabel(p, data) : null);
    push(info.text(a), 100);
    return next;
  }

  if (a >= 3 && roll(seed, a, S.illness) < interpolate(data.curves.illnessRate, a) * c.illness * (p.stats.health < 20 ? 2.6 : p.stats.health < 35 ? 1.3 : p.stats.health < 55 ? 0.45 : p.stats.health < 75 ? 0.25 : 0.15)) {
    bump(p, { health: -9 });
    push("大きな病気をした", 55);
    if (a >= 18) {
      p.treatMan = Math.max(1, Math.round((6 + roll(seed, a, S.illness + 5) * 24) * (p.history.medIns ? 0.3 : 1)));
      p.treatLabel = "大きな病気で、治療が必要になった。";
      if (!next.queue.includes("treat")) next.queue.push("treat");
    }
  }

  // 幸福度が0に近づくと、うつ状態になる。心か体が深く傷つくと、深刻な病気になる。どちらも、救いの選択を求める。
  // 幸福度が低いほど、うつ状態になりやすい(6以下では、ほぼ確実)。
  const depRisk = p.stats.joy <= 6 ? 1 : p.stats.joy <= 30 ? ((30 - p.stats.joy) / 24) * 0.3 : 0;
  if (p.mood === "ok" && a >= 10 && depRisk > 0 && roll(seed, a, S.ev + 12) < depRisk) {
    p.mood = "depressed";
    p.moodYears = 0;
    bump(p, { health: -15 });
    push(`${depressionReason(p)}、幸福を感じられなくなり、うつ状態になった`, 68);
    if (!next.queue.includes("rescue_mind")) next.queue.push("rescue_mind");
  }
  if (!p.sick && ((p.stats.health <= 16 && a < 80) || (p.mood === "depressed" && p.moodYears >= 3 && roll(seed, a, S.ev + 11) < 0.5))) {
    p.sick = true;
    p.history.sick = a;
    bump(p, { health: -25 });
    push(`${illnessReason(p)}、深刻な病気が見つかり、体力が大きく落ちた`, 72);
    if (!next.queue.includes("rescue_body")) next.queue.push("rescue_body");
  }

  // 数年前に使ったお金や、手入力の選択の結果が、ここで年表に現れる。
  if (next.later.length) {
    const due = next.later.filter((l) => l.age <= a);
    next.later = next.later.filter((l) => l.age > a);
    for (const l of due) {
      if (l.delta) bump(p, l.delta);
      if (l.payMult && p.occ && p.occ !== "retired") p.payMult *= l.payMult;
      if (l.cashMan) {
        if (l.cashMan < 0) chargeWithDebt(next, Math.round(-l.cashMan * 10000));
        else next.wallet.cash += Math.round(l.cashMan * 10000);
      }
      if (l.divorce) {
        p.married = false;
        if (p.partner) p.partner.status = "ex";
      }
      if (l.petDied) {
        const pet = p.pets.find((x) => x.name === l.petDied);
        if (pet) pet.died = true;
      }
      if (l.fired && p.occ && p.occ !== "retired") {
        p.employment = "nonregular";
        p.payMult *= 0.6;
      }
      push(l.cashMan ? `${l.event}${moneyTag(Math.round(l.cashMan * 10000))}` : l.event, l.weight);
    }
  }

  const mbtiSocial = p.mbti ? (p.mbti.startsWith("E") ? 1.1 : 0.92) : 1;
  const mbtiJob = p.mbti ? (p.mbti[3] === "J" ? 0.85 : 1.15) : 1;
  const mbtiHome = p.mbti ? (p.mbti[3] === "J" ? 1.15 : 0.9) : 1;

  // 学校を卒業した年は、出来事として残し、そのあとの進路を問う(選択の場面が出る)。
  if (p.occ === null && !p.history.graduated && a === (p.gradAge ?? data.workStartAge[p.edu]) && !p.abroad?.study && p.abroad?.visa !== "student") {
    p.history.graduated = a;
    if (p.jobPlan) {
      const plan = p.jobPlan;
      p.jobPlan = null;
      p.history.asked_job = a;
      push(`${({ hs_work: "高校", vocational: "専門学校", univ: "大学", grad: "大学院" } as const)[p.edu]}を卒業した。決めていた進路に、進みはじめる`, 66);
      const jtp = data.turningPoints.find((x) => x.id === "job");
      if (jtp) {
        const prng = streamRng(seed, a, S.choice + 3);
        for (const node of resolvePath(jtp, plan, p)) {
          const text = node.apply(p, prng, data);
          if (text) push(text, 75);
        }
      }
    } else push(`${({ hs_work: "高校", vocational: "専門学校", univ: "大学", grad: "大学院" } as const)[p.edu]}を卒業した。これからの進路を、考えるときがきた`, 66);
  }
  // 留学を終えたら、学歴が上がり、そのあとの道(残る・国を変える・帰国する)を選ぶ。
  if (p.abroad?.study && a >= p.abroad.study.until) {
    const st = p.abroad.study;
    p.abroad.study = undefined;
    if (st.kind === "college" && (p.edu === "hs_work" || p.edu === "vocational")) {
      p.edu = "univ";
      p.major = pickMajorEngine(streamRng(seed, a, S.jobPick + 7));
    }
    if (st.kind === "grad") p.edu = "grad";
    p.gradAge = null;
    push(`${p.abroad.country}での留学を終えた。これから、どうするかを、考えるときがきた`, 66);
    if (!next.queue.includes("study_end")) next.queue.push("study_end");
  }
  // 就労ビザ: 更新が認められないことがある。永住権は、決まった年のあとで認められる。
  if (p.abroad?.visa === "work") {
    if (p.abroad.permAt !== undefined && a >= p.abroad.permAt) {
      p.abroad.visa = "permanent";
      p.abroad.permAt = undefined;
      bump(p, { joy: 6, money: 2 });
      push(`${p.abroad.country}の永住権が認められた。ビザの更新を、気にしなくてよくなった`, 66);
    } else if (roll(seed, a, S.job + 55) < 0.04) {
      const country = p.abroad.country;
      moveHome(p, streamRng(seed, a, S.movePick + 5), data);
      p.payMult *= 0.9;
      bump(p, { joy: -8, money: -4 });
      push(`${country}のビザの更新が認められず、日本に帰ることになった`, 72);
    }
  }

  if (p.occ === null && a >= (p.gradAge ?? data.workStartAge[p.edu]) + 3 && a >= 22 && p.abroad?.visa !== "student") {
    const r = streamRng(seed, a, S.jobPick);
    const title = assignJob(p, weighted<Occ>(r, { ...data.transition.occ, mgmt: 0 }), r, data);
    push(`${title}として働き始めた`, 60);
  }

  // 子どもが生まれたあとの年に、育休を取るかを聞く。
  if (p.history.leaveAsk !== undefined && p.history.leaveAsk < a) {
    delete p.history.leaveAsk;
    // 自分が働いているか、働いているパートナーがいるときに、育休と預け先を聞く。
    const someoneWorks = (p.occ !== null && p.occ !== "retired") || (!!p.partner && p.partner.status !== "ex");
    if (someoneWorks && !next.queue.includes("parental_leave")) next.queue.push("parental_leave");
  }
  // 交際: 付き合って何年めかを数える。毎年、二人の出来事が起こり、別れることもある。
  let datingYears = -1;
  if (p.partner?.status === "dating" && !p.married) {
    p.history.datingSince ??= a;
    datingYears = a - p.history.datingSince;
    if (datingYears >= 1) {
      const rr = streamRng(seed, a, S.ev + 71);
      if (roll(seed, a, S.ev + 70) < breakupChance(p, datingYears)) {
        push(breakupText(p, datingYears, rr), 62);
        bump(p, { bonds: -4, joy: -9 });
        p.history.breakup = a;
        p.partner.status = "ex";
        delete p.history.datingSince;
        delete p.history.cohab;
        datingYears = -1;
      } else if (roll(seed, a, S.ev + 72) < 0.9) {
        const ce = coupleEvent(p, datingYears, rr);
        if (ce) {
          bump(p, ce.delta);
          push(ce.text, 40);
        }
      }
    }
    // 2年めからは、同棲を考える(一度だけ)。
    if (datingYears >= 2 && !p.history.cohabAsked && !p.withParents && !next.queue.includes("cohabit")) {
      p.history.cohabAsked = a;
      next.queue.push("cohabit");
    }
  } else if (p.history.datingSince !== undefined) {
    delete p.history.datingSince;
  }

  if (!p.married && a >= 20) {
    const rate = interpolate(data.curves.marriageRate, a) * (p.orientation === "ace" ? 0.4 : 1) * (p.concern?.kind === "romance" ? 1.8 : 1) * (0.8 + p.extra.charm / 250) * data.regionFactor.marriage[p.region] * (p.stayingSingle ? 0.1 : 1) * p.marriageBias * mbtiSocial * (0.7 + (p.stats.bonds / 100) * 0.6) * (datingYears < 0 ? 1 : datingYears < 1 ? 0.25 : datingYears < 2 ? 0.8 : 1.8);
    const proposing = p.partner?.status === "dating" && p.proposeAt !== null && a > p.proposeAt;
    if (p.partner?.status === "dating") {
      // 結婚の話は、付き合っている人とだけ。付き合って1年以上たってから(自分から切り出す場合を除く)。
      if ((proposing || (p.occ !== null && datingYears >= 1 && roll(seed, a, S.marriage) < rate)) && !next.queue.includes("marry")) {
        p.proposeAt = null;
        push(`${fullName(p.partner)}さんと、結婚の話が出た`, 66);
        next.queue.push("marry");
      }
    } else if (p.occ !== null && a <= 46 && roll(seed, a, S.marriage) < rate * 0.8 && !next.queue.includes("romance") && !next.queue.includes("asked_out")) {
      // 付き合っている人がいなければ、まず、出会い(付き合うかどうかの選択)から。
      const qid = roll(seed, a, S.marriage + 3) < 0.5 ? "asked_out" : "romance";
      // 相手(名前)は、質問が出る前に決めておく。
      data.eventQuestions.find((e) => e.id === qid)?.prepare?.(next, streamRng(seed, a, S.qPick + 5), data);
      next.queue.push(qid);
    }
  }
  if (p.married && !p.childFree && p.kids < 3 && a <= 44) {
    // 二人とも産める体でないときは、養子縁組や里親などの道になるので、子どもを持つ人は少なくなる(設計上の仮定)。
    const rate = interpolate(data.curves.birthRate, a) * (p.kids === 0 ? 1 : 0.7) * p.childWish * (noBearer(p) ? 0.25 : 1);
    if (roll(seed, a, S.birth) < rate && !next.queue.includes("have_child")) {
      // 子どもを持つかどうかも、自分で選ぶ。
      push(p.kids === 0 ? `${p.partner ? p.partner.given + "さん" : "パートナー"}と、子どもを持つかどうかを話し合った` : "もうひとり子どもを持つかどうか、家族で話し合った", 55);
      next.queue.push("have_child");
    }
  }
  // 深い不況では、勤め先の規模や雇用形態によっては、職を失うことがある。
  const econNow = economyAt(seed, a, p.birthYear);
  if (p.occ && p.occ !== "retired" && p.employment !== "self" && p.sector !== "public" && a < 62 && econNow < -1.1) {
    // 実際の統計がある年は、完全失業率が高い年ほど、職を失いやすい(2.5%のときを1として、0.5〜2.2倍)。
    const un = unemploymentAt(p.birthYear, a);
    const unMult = un === undefined ? 1 : Math.max(0.5, Math.min(2.2, un / 2.5));
    const risk = (p.firm === "small" || p.employment === "nonregular" ? 0.05 : 0.012) * unMult;
    if (roll(seed, a, S.layoff) < risk) {
      p.employment = "nonregular";
      p.payMult = Math.min(p.payMult, 0.9);
      bump(p, { money: -8, bonds: -2, joy: -10 });
      push("景気の悪化で職を失い、次の仕事を探すことになった", 70);
      p.history.layoff = a;
    }
  }
  // 引っ越しは、勝手には起きない。実家暮らしと、18歳未満(子ども〜高校生)をのぞいて、引っ越すかどうかを、かならず聞く。
  // 議員や経営者など、責任ある立場のあいだは、引っ越しの話は出ない(退いたら、もとの確率にもどる)。
  if (a >= 18 && !p.withParents && !isResponsible(p) && !next.queue.includes("move_ask") && roll(seed, a, S.move) < interpolate(data.curves.moveRate, a)) {
    // 行き先は、話が出たときに決めておき、選ぶ場面で「どこからどこへ」を見せる。
    const mr = streamRng(seed, a, S.move + 7);
    const toRegion = weighted<Region>(mr, data.transition.region[p.region]);
    p.moveOffer = { region: toRegion, city: newCity(mr, data, toRegion, p.city) };
    push(`${p.city}から${p.moveOffer.city}への、引っ越しの話が出た`, 40);
    next.queue.push("move_ask");
  }
  if (!p.owned && p.occ !== null && p.occ !== "retired" && roll(seed, a, S.buy) < interpolate(data.curves.purchaseRate, a) * data.regionFactor.purchase[p.region] * (p.married ? 1.6 : 0.5) * p.homeBias * mbtiHome) {
    p.owned = true;
    p.housingKind = null;
    p.withParents = false;
    p.owns.home = a;
    push("ローンを組んで、住まいを買った", 50);
  }
  if (p.withParents && a >= 24 && roll(seed, a, S.parents) < 0.06) p.withParents = false;

  const retire = p.retireAt ?? (p.workLong ? data.retireAge + 5 : data.retireAge);
  if (a === retire && p.occ && !isResponsible(p) && (p.employment !== "self" || p.retireAt !== null) && p.occ !== "retired") {
    p.occ = "retired";
    push("仕事を退いた", 55);
  }
  // 定年を過ぎても働いている人: 年齢が上がるほど、定年退職や、体調による退職を、せまられやすい。
  // 90歳をこえると、仕事は、続けられない。
  if (p.occ && p.occ !== "retired" && a >= retire) {
    if (isResponsible(p) && a < WORK_LIMIT) {
      // 議員・経営者など責任ある立場は、定年も、途中の退職もない(議員は、任期の終わりの選挙で決まる)。
    } else if (a >= WORK_LIMIT) {
      p.occ = "retired";
      p.parttime = null;
      p.office = null;
      push(`${a}歳。体力の限界を感じて、仕事を退いた`, 60);
    } else if (!next.queue.includes("work_end")) {
      const frail = p.stats.health < 45 || p.sick;
      const q = (a < 70 ? 0.4 : a < 80 ? 0.55 : 0.75) + (frail ? 0.3 : 0);
      if (roll(seed, a, S.workEnd) < Math.min(0.95, q)) next.queue.push("work_end");
    }
  }
  // 貯金の増減(1年ぶんを、年のはじめにまとめて反映する)。
  const econ = economyAt(seed, a, p.birthYear);
  const ym = yearlyMoney(p, data, econ, next.wallet.debts.length > 0);
  const flow = toYen(ym.flow);
  p.tax = taxSnap(ym.tax);
  // はじめての給与明細・年金の明細: 額面から、税と社会保険料が引かれて、手取りになる。
  if (p.tax.gross > 0 && p.occ !== "retired" && p.history.payslip === undefined) {
    p.history.payslip = a;
    if (p.employment === "self") p.history.selfTax = a;
    const t = p.tax;
    push(`はじめての${p.employment === "self" ? "確定申告" : "給与明細"}。年収${t.gross}万円から、所得税と住民税で${t.incomeTax + t.resident}万円、社会保険料で${t.social}万円が引かれ、手取りは${t.net}万円になった`, 47);
  } else if (p.tax.gross > 0 && p.occ === "retired" && p.history.pensionSlip === undefined) {
    p.history.pensionSlip = a;
    const t = p.tax;
    push(`年金の通知書が届いた。年${t.gross}万円のうち、税と保険料で${t.incomeTax + t.resident + t.social}万円が引かれ、手取りは${t.net}万円になった`, 47);
  }
  if (p.tax.gross > 0 && p.employment === "self" && p.occ !== "retired" && p.history.selfTax === undefined && p.history.payslip !== a) {
    p.history.selfTax = a;
    push(`独立して、会社が半分払っていた社会保険料を、全額自分で払うようになった。国民年金と国民健康保険で、年に${p.tax.pension + p.tax.health}万円ほど`, 46);
  }
  if (p.tax.gross > 0 && p.married && p.occ !== "retired" && p.history.marrySlip === undefined) {
    p.history.marrySlip = a;
    push("結婚して、配偶者の収入も世帯に加わった。税や社会保険料は、ひとりずつにかかるので、世帯の手取りは、ふたりの合計になる", 30);
  }
  for (const k of p.kidList) {
    if (a - k.bornAge === 16) push("子どもが16歳になった。扶養控除(所得税38万円・住民税33万円)の対象になり、税が少し軽くなった", 30);
  }
  next.wallet.cash = Math.max(0, next.wallet.cash + flow);
  // 普通預金の利息(年のはじめにまとめて)。金利は、景気で上下する、架空の水準。
  if (next.wallet.cash > 0 && a >= 15) {
    const interest = next.wallet.cash * savingsRate(econ);
    next.wallet.cash += interest;
    if (interest >= 100000) push(`普通預金の利息が、${Math.round(interest / 10000).toLocaleString("ja-JP")}万円ほどついた`, 12);
  }
  if (flow < 0 && next.wallet.cash === 0) bump(p, { money: -1 });
  // 積み立て投資: 毎月、同じ額ずつ買う(年の予定額を12回に分ける)。お金が足りない年は、できる範囲で。
  if (next.wallet.plans && a >= 18) {
    const market = marketOf(seed, data);
    for (const [pid, yen] of Object.entries(next.wallet.plans) as [AssetId, number][]) {
      if (!yen || yen <= 0) continue;
      const pay = Math.min(yen, Math.max(0, next.wallet.cash - 100000));
      if (pay <= 0) continue;
      let units = 0;
      for (let m = 0; m < 12; m++) units += pay / 12 / priceAt(market, pid, a, m);
      next.wallet.units[pid] = (next.wallet.units[pid] ?? 0) + units;
      next.wallet.cash -= pay;
      next.wallet.contributed += pay;
      next.wallet.stocks = true;
    }
  }
  mark();

  // 空模様が変わった年は、出来事としても残す(ささやかなもの)。
  if (weatherAt(seed, a) !== weatherAt(seed, a - 1)) push(WEATHER_EVENT[weatherAt(seed, a)], 4);

  // 親と子の節目、友人や家族の出来事。
  for (const [who, deathAge] of [["母", p.parentDeath.mother], ["父", p.parentDeath.father]] as const) {
    // ひとり親家庭で、離れて暮らしていたほうの親は、知らせを受けるかたちになる。
    const apart = p.soloParent && absentWho(p) === who;
    if (apart && a === deathAge - 2) {
      push(`離れて暮らしていた${who}が、病気で入院したと知らせが届いた`, 50);
      bump(p, { bonds: -1 });
      continue;
    }
    if (apart && a === deathAge) {
      push(`離れて暮らしていた${who}が亡くなったと、知らせが届いた`, 62);
      p.history.parentDied = a;
      bump(p, { bonds: -3, joy: -6 });
      continue;
    }
    if (a === deathAge - 2) {
      push(`${who}が病気で入院した`, 55);
      p.history.parentIll = a;
      bump(p, { bonds: -2, health: -1 });
    }
    if (a === deathAge) {
      push(`${who}が亡くなった`, 72);
      p.history.parentDied = a;
      bump(p, { bonds: -8, health: -3, joy: -14 });
      if (a >= 18 && roll(seed, a, S.ev + 7) < 0.4) {
        // 相続したお金は、使い道を選んで、はじめて手元に入る(貯金・株・家族のためなど)。
        const v = Math.round(100 + roll(seed, a, S.ev + 8) * 500);
        p.inheritMan = v;
        push(`相続の手続きに追われ、${v.toLocaleString("ja-JP")}万円ほどを受け継ぐことになった。使い道を、決めるときがきた`, 52);
        if (!next.queue.includes("inherit_use")) next.queue.push("inherit_use");
      }
    }
  }
  p.kidList.forEach((k, ki) => {
    const kage = a - k.bornAge;
    const nm = kidCall(p, ki);
    const kr = roll(seed, a, S.ev + 9 + k.bornAge);
    if (kage === 6) push(`${nm}が小学校に入学した`, 52);
    else if (kage === 12) push(`${nm}が中学校に入学した`, 48);
    else if (kage === 15) push(`${nm}が高校受験に挑み、進む学校が決まった`, 50);
    else if (kage === 18) {
      push(`${nm}が、大学や就職など、新しい道に進んだ`, 56);
      // こどもNISAは、いちばん下の子が18歳になるときに、使われる。
      if (next.wallet.kidFund && next.wallet.kidFund.units > 0 && !p.kidList.some((o) => o.bornAge > k.bornAge)) {
        const value = next.wallet.kidFund.units * priceAt(marketOf(seed, data), "index", a, 0);
        const man = Math.round(value / 10000);
        const paid = Math.round(next.wallet.kidFund.contributed / 10000);
        next.wallet.kidFund = undefined;
        bump(p, { bonds: 3, joy: 4, money: 3 });
        push(`こどもNISAで積み立てた${man.toLocaleString("ja-JP")}万円(積立は${paid.toLocaleString("ja-JP")}万円${man >= paid ? "、運用でふえた" : "、値下がりで目減りした"})が、${nm}の進学や独立の支えになった`, 64);
      }
      bump(p, { bonds: 1, money: -2 });
    } else if (kage === 22) push(`${nm}が社会人になった`, 50);
    else if (kage === 28 && kr < 0.55) {
      push(`${nm}が結婚した`, 62);
      next.wallet.cash = Math.max(0, next.wallet.cash - 30000);
      bump(p, { bonds: 3 });
    }
  });

  // 起きる出来事(選択を求めないもの)。何もない時間を少なくするため、毎年、たいてい1つは起きる。
  {
    const econ = p.econ;
    const elig = data.lifeEvents.map((e) => ({ e, w: e.weight(p, econ) })).filter((x) => x.w > 0);
    const n = (roll(seed, a, S.ev) < 0.88 ? 1 : 0) + (roll(seed, a, S.ev + 1) < 0.3 ? 1 : 0);
    const used = new Set<string>();
    for (let i = 0; i < n; i++) {
      const pool = elig.filter((x) => !used.has(x.e.id));
      const total = pool.reduce((sum, x) => sum + x.w, 0);
      if (!total) break;
      let r = roll(seed, a, S.evPick + i) * total;
      let chosen = pool[pool.length - 1].e;
      for (const x of pool) {
        r -= x.w;
        if (r < 0) {
          chosen = x.e;
          break;
        }
      }
      used.add(chosen.id);
      mark();
      const cashBefore = next.wallet.cash;
      const debtBefore = debtTotal(next.wallet.debts);
      const out = chosen.apply(next, streamRng(seed, a, S.evApply + i), data);
      const tag = moneyTag(next.wallet.cash - cashBefore, debtTotal(next.wallet.debts) - debtBefore);
      let first = true;
      for (const text of Array.isArray(out) ? out : [out])
        if (text) {
          push(first ? `${text}${tag}` : text, chosen.importance ?? 45);
          first = false;
        }
    }
    // 選択を求める出来事(不倫・裁判・ペットなど)。
    if (a >= 14 && next.queue.length === 0 && next.naming.length === 0) {
      const pool = data.eventQuestions.map((d) => ({ d, w: d.weight(p, econ) })).filter((x) => x.w > 0 && `ev:${x.d.id}` !== next.lastQ && hasChoice(x.d, p, next.wallet.cash));
      const total = pool.reduce((sum, x) => sum + x.w, 0);
      // 起きうる出来事が少ない年齢では、選択の場面も、ほとんど起きない(相対的な重みだけで決めない)。
      if (total && roll(seed, a, S.q) < 0.12 * Math.min(1, total / 2.5)) {
        let r = roll(seed, a, S.qPick) * total;
        let chosen = pool[pool.length - 1].d;
        for (const x of pool) {
          r -= x.w;
          if (r < 0) {
            chosen = x.d;
            break;
          }
        }
        chosen.prepare?.(next, streamRng(seed, a, S.qPick + 3), data);
        push(chosen.intro(p), 66);
        next.queue.push(chosen.id);
      }
    }
  }

  processDebts(next, a, data, push);
  // 住まいを失う(ホームレス): 仕事も貯金もなく、頼れる人も少ないとき、運が悪いと、起こる。
  if (p.housingKind === "homeless") {
    bump(p, { health: -3, joy: -3 });
    if (roll(seed, a, S.job + 61) < 0.22 + p.stats.bonds / 400) {
      p.housingKind = null;
      p.history.homelessEnd = a;
      bump(p, { joy: 8, bonds: 3, health: 2 });
      push("支援団体や自治体の窓口につながり、アパートで暮らせるようになった", 78);
    }
  } else if (a >= 18 && !p.withParents && !p.owned && !p.abroad && !p.married && next.wallet.cash < 300000 && !(p.occ === "retired") && p.stats.money < 28) {
    const jobless = p.occ === null && p.history.graduated !== undefined && a >= 20;
    const broke = p.bankrupt !== null && a - p.bankrupt <= 2;
    const heavyDebt = debtTotal(next.wallet.debts) > 3000000;
    if (jobless || broke || heavyDebt) {
      const risk = 0.09 * (p.stats.bonds < 30 ? 2 : p.stats.bonds < 50 ? 1 : 0.35) * (next.wallet.cash < 50000 ? 1.5 : 1) * (broke ? 1.6 : 1);
      if (roll(seed, a, S.job + 62) < risk) {
        leaveLocal(p, data);
        p.housingKind = "homeless";
        p.history.homeless = a;
        bump(p, { health: -8, joy: -12, bonds: -5, money: -6 });
        push(`家賃が払えず、住まいを失った。${yearOf(p) >= SINCE.netCafe ? "ネットカフェや路上" : "駅や公園"}で、夜を過ごすようになった`, 90);
        if (!next.queue.includes("homeless_help")) next.queue.push("homeless_help");
      }
    }
  }

  // 子どもは、毎年、お年玉とお小遣いをもらう。使い道は、自動では決めない(節目の場面で、自分で選ぶ)。
  // お年玉は、多くても3万円まで。お小遣いは、月に5千円ほどで、上限は1万円。
  if (a < 18) {
    // 家庭の暮らし向きで、お小遣いもお年玉も大きく違う(困窮した家庭では、高校生になっても、お小遣いはない)。
    const monthly = monthlyAllowance(p.background, a);
    const allow = monthly * 12;
    const otoshidama = newYearGift(p.background, a);
    // ふだんのお菓子や遊びで、お金の多くは、気づかないうちに、なくなっていく(出来事としては、書かない)。
    const gain = allow + otoshidama;
    const everyday = Math.round((gain * (0.82 + 0.14 * roll(seed, a, S.allow))) / 100) * 100;
    if (a >= 6) {
      next.wallet.cash += gain - everyday;
      push(
        monthly > 0
          ? `お正月に、お年玉を${otoshidama.toLocaleString("ja-JP")}円もらった。お小遣いは、月に${monthly.toLocaleString("ja-JP")}円`
          : `お正月に、お年玉を${otoshidama.toLocaleString("ja-JP")}円もらった。家計に余裕がなく、お小遣いはない`,
        18,
      );
    } else if (a >= 3) {
      // 3〜5歳: お年玉はもらうが、お金は親が預かる。お小遣いは、まだない。
      push("お正月に、親戚からお年玉をもらった。お金は、親が預かってくれた", 18);
    }
  }

  // 物価: 実際の統計がある年は、その年の物価上昇率を使う。ない年(未来)は、毎回ランダム。物価が大きく上がった年は、暮らしが苦しくなる。
  if (a >= 18) {
    const cpi = cpiAt(p.birthYear, a) ?? Math.round((1.2 + 1.8 * (roll(seed, a, S.ev + 97) - 0.5) * 2) * 10) / 10;
    if (cpi >= 4) {
      bump(p, { money: -Math.min(4, Math.round(cpi / 3)), joy: -1 });
      push(`物価が前の年より${cpi}%も上がり、暮らしが苦しくなった`, 54);
    } else if (cpi <= -0.8 && p.occ !== null && p.occ !== "retired") {
      bump(p, { money: -1 });
      push("物価が下がり続けるなか、給料も伸びにくく、暮らしに余裕が出なかった", 36);
    }
  }

  // 子どもの預け先: いちばん下の子が小学校に入るまで、毎年、費用と影響が出る。3歳になったときは、通い先を選び直す。
  if (p.kidList.length > 0) {
    const youngest = a - Math.max(...p.kidList.map((k) => k.bornAge));
    if (p.childcare && youngest >= 0 && youngest <= 5) {
      const cy = careYear(p, p.childcare.kind, youngest, Math.round(netIncome(p, data, economyAt(seed, a, p.birthYear), { married: false })), streamRng(seed, a, S.ev + 91));
      if (cy.costMan > 0) chargeWithDebt(next, Math.round(cy.costMan * 10000));
      bump(p, cy.bump);
      p.extra.stress = Math.min(100, Math.max(0, p.extra.stress + cy.stress));
      p.extra.career = Math.min(100, Math.max(0, p.extra.career + cy.career));
      if (cy.text) push(cy.text, 45);
    } else if (p.childcare && youngest >= 6) {
      push(`子どもが小学校に入り、${CARE_LABEL[p.childcare.kind]}の日々が、ひと区切りになった`, 50);
      p.extra.stress = Math.max(0, p.extra.stress - 3);
      delete p.childcare;
    }
    // 3歳になった年: 幼稚園・保育園・こども園のどれにするか(一度だけ)。
    const born = p.kidList.find((k) => a - k.bornAge === 3 && p.history[`care3_${k.bornAge}`] === undefined);
    if (born && p.childcare && youngest === 3 && !next.queue.includes("kid_three")) {
      p.history[`care3_${born.bornAge}`] = a;
      next.queue.push("kid_three");
    }
  }

  // 人間関係の悩み: 向き合っている間は、毎年、それに関する出来事が起きる。解決すると、区切りがつく。
  if (p.concern) {
    const done = concernResolved(p);
    if (done) {
      push(done, 62);
      bump(p, { joy: 6, bonds: 3 });
      delete p.concern;
    } else if (roll(seed, a, S.ev + 95) < 0.7) {
      const ce = concernEvent(p, streamRng(seed, a, S.ev + 96), data);
      if (ce) {
        bump(p, ce.delta);
        push(ce.text, 44);
      }
    }
  }

  // 頭の良さ: 幼いころから、塾や、音楽・芸術などにふれるほど、伸びやすい(画面には、数字を出さない)。
  {
    // 家庭の余裕の差(塾・本・親の関わり)で、6〜17歳の「学び」は、年々、開いていく。
    if (a >= 6 && a < 18) bump(p, { learn: BG_LEARN[p.background] });
    const ic = intelChance(p, a);
    if (ic > 0 && roll(seed, a, S.ev + 93) < ic) {
      p.intel = Math.min(100, p.intel + (ic >= 0.3 && roll(seed, a, S.ev + 94) < 0.25 ? 2 : 1));
      bump(p, { learn: 1 }); // 頭の良さが上がった年は、「学び」も、少し伸びる
    }
    // 「学び」の能力値は、頭の良さに、ゆるくついていく(頭がよいほど、学びが積み上がりやすく、落ちにくい)。学校にいる間は、ついていく速さが、速い。
    const learnTarget = Math.min(100, 28 + 0.62 * p.intel + { univ: 6, grad: 12, vocational: 2, hs_work: 0 }[p.edu]);
    bump(p, { learn: (learnTarget - p.stats.learn) * (a < 23 ? 0.07 : a < 60 ? 0.04 : 0.02) });
  }

  // 習い事: 続けているあいだ、毎年、効果が積み重なる。節目の出来事も起きる。
  for (const taken of [...p.lessons]) {
    const def = lessonById(taken.id);
    if (!def) continue;
    const years = a - taken.since;
    const yearly = def.costMan * 10000;
    if (a >= 18 && p.occ !== null) {
      // 働いている大人は、自分で月謝を払う(学生のあいだは、親が払う)。払えなければ、やめざるをえない。
      if (next.wallet.cash < yearly) {
        p.lessons = p.lessons.filter((x) => x.id !== taken.id);
        push(`月謝が払えなくなり、「${def.label}」をやめた`, 40);
        continue;
      }
      next.wallet.cash -= yearly;
    }
    {
      // 道具をそろえていると、効果がふえる。
      const eff = p.owns[`gear:${taken.id}`] !== undefined ? (Object.fromEntries(Object.entries(def.effect).map(([k, v]) => [k, (v as number) * 1.35])) as typeof def.effect) : def.effect;
      bump(p, fitScaled(eff, p.mbti, def.tags));
    }
    const m = def.milestones.find((x) => x.years === years);
    if (m) {
      push(`「${def.label}」で、${m.text}`, 50);
      if (m.delta) bump(p, m.delta);
    }
    // 気持ちや体に余裕がないと、続けられなくなることもある。
    const quitP = 0.04 + (p.stats.joy < 30 ? 0.12 : 0) + (p.stats.health < 35 ? 0.1 : 0) - 0.02 * Math.max(0, fitScore(p.mbti, def.tags)) + 0.03 * Math.max(0, -fitScore(p.mbti, def.tags));
    if (roll(seed, a, S.lesson + taken.since) < quitP) {
      p.lessons = p.lessons.filter((x) => x.id !== taken.id);
      const why = p.stats.joy < 30 ? "気持ちに余裕がなくなり" : p.stats.health < 35 ? "体調がすぐれず" : p.kids > 0 ? "子育てが忙しくなり" : (p.occ !== null && p.occ !== "retired") ? "仕事が忙しくなり" : "気持ちが離れて";
      push(`${why}、「${def.label}」をやめてしまった`, 38);
    }
  }

  // のめり込んでいる習慣: 毎年、お金・健康・つながりをむしばむ。やめるかどうかは、数年おきに、選ぶ。
  if (p.habit && a >= 18) {
    const h = p.habit;
    const years = a - h.since;
    if (h.kind === "gamble") {
      const loss = Math.round(Math.min(Math.max(next.wallet.cash * 0.3, 300000), 800000));
      const paid = Math.min(loss, next.wallet.cash);
      next.wallet.cash -= paid;
      if (loss > paid) addDebt(next, "card", loss - paid);
      bump(p, { money: -3, bonds: -3, joy: -1, health: -0.5 });
      p.extra.stress = clamp(p.extra.stress + 5);
      p.extra.trust = clamp(p.extra.trust - 2);
      if (years % 2 === 0) push(`ギャンブルにお金をつぎこみ、この1年で${Math.round(loss / 10000)}万円ほどを失った`, 52);
    } else if (h.kind === "smoke") {
      next.wallet.cash = Math.max(0, next.wallet.cash - 80000);
      bump(p, { health: -1.6, money: -0.3 });
      if (years % 3 === 1) push("タバコの本数が増え、息切れや咳が気になるようになった", 46);
    } else {
      next.wallet.cash = Math.max(0, next.wallet.cash - 100000);
      bump(p, { health: -1.3, bonds: -1, joy: 0.5 });
      p.extra.stress = clamp(p.extra.stress - 1);
      if (years % 3 === 1) push("お酒の量が増え、翌日に響くようになった", 46);
    }
    // 数年おきに、やめるかどうかを、考える。
    if (years >= 2 && years % 3 === 2 && !next.queue.includes("habit_quit")) next.queue.push("habit_quit");
  }

  // 持っているものの維持費(車・保険など)。払えなければ、手放す・解約する。
  for (const it of yearlyCosts(p)) {
    const yen = (it.yearlyMan?.(p) ?? 0) * 10000;
    if (a < 18 || yen <= 0) continue;
    if (next.wallet.cash >= yen) next.wallet.cash -= yen;
    else if (it.sellApply) {
      const worth = Math.round((it.sellMan?.(p) ?? 0) * 10000);
      const text = it.sellApply(p);
      next.wallet.cash += worth;
      push(`維持費が払えなくなり、手放した(${text})`, 44);
    }
    if (it.id.startsWith("car_") && p.owns[it.id] !== undefined) bump(p, { joy: p.region === "rural" || p.region === "local" ? 0.8 : 0.3 });
  }

  // アルバイト: 続けているあいだ、毎年、収入と、体や気持ちへの影響がある。
  if (p.parttime) {
    const def = data.partTimes.find((x) => x.id === p.parttime!.id);
    const full = p.occ !== null && p.occ !== "retired";
    if (full) {
      // 仕事に就いたら、アルバイトはできない(続けられない)。
      p.parttime = null;
      push(`仕事に就いたため、アルバイト「${def?.label ?? ""}」はやめた`, 44);
    } else if (!def || a < def.minAge || a >= 75) {
      p.parttime = null;
    } else {
      // 社会人の副業は、収入が少なく、体への負担が大きい。18歳未満は、働ける時間が短い。
      const pay = def.yearlyMan * minWageFactor(yearOf(p), prefOf(p)) * (full ? 0.6 : a < 18 ? 0.5 : 1) * (1 + p.econ * 0.03) * 10000;
      // 税: 働いていない人は年に約103万円まで引かれない。働いている人の副業は、20万円をこえると税がかかる。
      const sideMan = pay / 10000;
      const sideT = sideTax(p, data, econ, sideMan);
      next.wallet.cash += Math.round(pay - sideT * 10000);
      const load = full ? 1.6 : 1;
      bump(p, fitScaled(Object.fromEntries(Object.entries(def.effect).map(([k, v]) => [k, (v as number) * (v < 0 ? load : 1)])) as Partial<Stats>, p.mbti, def.tags));
      mark();
      const years = a - p.parttime.since;
      const m = def.milestones.find((x) => x.years === years);
      if (m) {
        if (m.delta) bump(p, m.delta);
        push(`アルバイト「${def.label}」で、${m.text}`, 48);
      }
      const quitP = 0.05 + (p.stats.joy < 30 ? 0.12 : 0) + (p.stats.health < 35 ? 0.12 : 0) + (full ? 0.05 : 0);
      if (roll(seed, a, S.lesson + 91) < quitP) {
        const why = p.stats.health < 35 ? "体調がすぐれず" : p.stats.joy < 30 ? "気持ちに余裕がなくなり" : full ? "本業が忙しくなり" : a >= 20 ? "学業や就職活動が忙しくなり" : "勉強に集中したくなり";
        p.parttime = null;
        push(`${why}、アルバイト「${def.label}」をやめた`, 40);
      }
    }
  }

  // 内閣総理大臣: 総理の座にあるあいだ、ストレスは大きく減る(国の頂点に立つ高揚と、周りの支え)。
  // 当選を重ね、信用を90以上に保ち続けるかぎり、退く必要はない。信用が下がると、退陣に追いこまれることがある。
  if (p.office?.rank === "pm") {
    p.extra.stress = Math.max(0, p.extra.stress - 18);
    // 毎年の政権運営のうごき: つながりが強いほど、信用はやや上がりやすい。
    p.extra.trust = Math.min(100, Math.max(0, p.extra.trust + Math.round((roll(seed, a, S.job + 45) - 0.45) * 8 + (p.stats.bonds - 50) / 40)));
    const tenure = a - (p.office.rankSince ?? a);
    const trustNow = p.extra.trust;
    if (trustNow < 35 && roll(seed, a, S.job + 46) < 0.7) {
      p.office.rank = "former_pm";
      push("支持率が落ちこみ、内閣は総辞職した。内閣総理大臣を退いた", 82);
      bump(p, { joy: -6, bonds: -3 });
    } else if (trustNow < 90 && tenure >= 2 + Math.floor(roll(seed, a, S.job + 43) * 4) && roll(seed, a, S.job + 44) < 0.5) {
      p.office.rank = "former_pm";
      push("内閣総理大臣を退いた。国のかじ取りの重責から、ようやく解き放たれた", 80);
      bump(p, { health: 2, joy: -3 });
    }
    // 総理として災害に見舞われる(年に約2割)。対応しだいで、信用が大きく動く。
    if (p.office.rank === "pm" && !next.queue.includes("pm_disaster") && roll(seed, a, S.job + 47) < 0.2) {
      next.queue.push("pm_disaster");
      push("国内で、大きな災害が起きた", 70);
    }
  }
  // ---- 犯罪: 追われる生活・逮捕・裁き・服役・出所 ----
  if (p.prison) next.queue = [];
  if (p.prison) {
    bump(p, { health: -1, joy: -2, bonds: -3 });
    p.extra.stress = Math.min(100, p.extra.stress + 4);
    if (a >= p.prison.until) {
      const yrs = p.prison.until - (p.history.prisonFrom ?? p.prison.until);
      p.prison = null;
      const occs: Occ[] = ["construction", "production", "service", "logistics"];
      const r2 = streamRng(seed, a, S.job + 80);
      const title = assignJob(p, occs[Math.floor(r2() * occs.length)], r2, data);
      p.employment = "nonregular";
      p.sector = "private";
      p.payMult *= 0.8;
      p.history.release = a;
      bump(p, { joy: 3, health: 1 });
      push(`${yrs}年の刑期を終えて、出所した。前科が知られ、仕事探しは難航し、${title}として、非正規で働きはじめた`, 88);
    }
  } else if (p.crime) {
    const def = CRIMES[p.crime.kind as CrimeId];
    const cr = streamRng(seed, a, S.job + 81);
    if (def && p.crime.arrestAt !== null && a >= p.crime.arrestAt) {
      const prior = p.history.record !== undefined;
      const v = judge(def, cr, prior);
      const rec = () => {
        p.history.record = a;
        p.extra.trust = Math.max(0, p.extra.trust - 25);
        p.extra.career = Math.max(0, p.extra.career - 15);
        p.payMult *= 0.85;
        if (p.employment === "regular") p.employment = "nonregular";
        bump(p, { bonds: -8, joy: -10, money: -4 });
        if (p.married && cr() < 0.4) next.later.push({ age: a + 1, event: "前科が知られ、家庭にも亀裂が入り、離婚した", weight: 70, delta: { bonds: -6, joy: -6 }, divorce: true });
      };
      push(`${def.label}の疑いで逮捕された(${def.law})`, 90);
      if (v.kind === "none") {
        p.history.arrested = a;
        bump(p, { bonds: -4, joy: -6 });
        p.extra.trust = Math.max(0, p.extra.trust - 8);
        push("検察は、起訴を見送った(不起訴・起訴猶予)。前科はつかなかったが、逮捕されたことは、周囲に知られた", 80);
      } else if (v.kind === "fine") {
        next.wallet.cash = Math.max(0, next.wallet.cash - v.man * 10000);
        rec();
        push(`略式の手続きで、罰金${v.man}万円の刑に処された。前科がつき、就職や転職、海外への渡航などで、長く不利になる`, 88);
      } else if (v.kind === "suspended") {
        rec();
        if (p.occ && p.occ !== "retired" && cr() < 0.5) {
          p.occ = null;
          p.job = null;
          push("会社に知られ、解雇された", 70);
        }
        push(`拘禁刑${v.years}年・執行猶予つきの判決を受けた。刑務所には入らないが、前科がつき、猶予の間に罪を犯せば、実刑になる`, 90);
      } else {
        rec();
        p.history.prisonFrom = a;
        p.prison = { until: a + Math.max(1, Math.ceil(v.years)), kind: def.id };
        if (p.occ && p.occ !== "retired") {
          p.occ = null;
          p.job = null;
        }
        push(`拘禁刑${v.years}年の実刑判決を受け、刑務所に入った。仕事も、暮らしも、失った`, 95);
      }
      p.crime = null;
    } else if (a > p.crime.until) {
      p.crime = null;
      bump(p, { joy: 5 });
      p.extra.stress = Math.max(0, p.extra.stress - 15);
      push("公訴時効が成立し、罪に問われることはなくなった。長く続いた追われる日々が、ようやく終わった", 80);
    } else {
      bump(p, { joy: -3, bonds: -2 });
      p.extra.stress = Math.min(100, p.extra.stress + 6);
      p.extra.trust = Math.max(0, p.extra.trust - 2);
      if (cr() < 0.35) push("警察の影におびえながら、息をひそめて暮らしている", 55);
    }
  }
  // 犯罪に手を染めるか(だまされた・貧しい・住まいがないとき)。3年に一度までしか聞かない。
  if (!p.crime && !p.prison && a >= 18 && next.queue.length === 0 && (p.history.crimeAsk === undefined || a - p.history.crimeAsk >= 3)) {
    const scam = p.history.scamVictim !== undefined && a - p.history.scamVictim <= 1;
    const homeless = p.housingKind === "homeless";
    const poor = p.stats.money < 15 && next.wallet.cash < 100000 && p.occ !== "retired";
    const risk = Math.min(0.5, ((scam ? 0.3 : 0) + (homeless ? 0.25 : 0) + (poor ? 0.1 : 0)) * (p.stats.bonds < 40 ? 1.3 : 1));
    if (risk > 0 && roll(seed, a, S.job + 82) < risk) {
      p.history.crimeAsk = a;
      next.queue.push("crime_temptation");
    }
  }
  // アスリート: 競技を選び、毎年、大会に出るかを聞く。実績が90以上なら、4年に一度、オリンピックの代表に選ばれる。
  if (p.job === "athlete" && p.occ && p.occ !== "retired" && a >= 15 && a <= 44 && next.queue.length === 0) {
    if (!p.sport) {
      next.queue.push("athlete_sport");
      push("選手として、どの競技に打ちこむかを、決めるときが来た", 55);
    } else {
      const sp = sportById(p.sport);
      const year = (p.birthYear ?? 0) + a;
      if (sp && olympicYear(year, sp.season) && p.extra.career >= 90 && p.history.olympic !== a) {
        next.queue.push("athlete_olympic");
        push("オリンピックの代表に選ばれた", 70);
      } else if (roll(seed, a, S.job + 48) < 0.75) {
        next.queue.push("athlete_meet");
        push(`${sp?.label ?? "競技"}の大会に出る機会があった`, 40);
      }
    }
  }
  // 議員などの職: 任期の終わりに、再選の結果が出る。
  if (p.office) {
    const od = data.offices.find((x) => x.id === p.office!.id);
    if (!od) p.office = null;
    else if (a - p.office.since >= od.term) {
      const chance = Math.min(0.85, Math.max(0.2, od.win * 1.7 + p.stats.bonds / 300 + (p.stats.joy > 50 ? 0.05 : 0)));
      if (roll(seed, a, S.job + 33) < chance) {
        p.office.since = a;
        p.office.terms = (p.office.terms ?? 1) + 1;
        bump(p, { bonds: 3, joy: 5 });
        push(`${od.label}の選挙で再選され、もう一期、務めることになった`, 66);
        // 国会議員は、当選を重ねると、ごくまれに大臣になり、さらにまれに、内閣総理大臣になる(運しだい)。
        if (od.id === "lower" || od.id === "upper") {
          const o = p.office;
          const luck = roll(seed, a, S.job + 41);
          if (!o.rank && (o.terms ?? 0) >= 3 && luck < 0.09 + (p.stats.bonds + p.stats.learn) / 2500) {
            o.rank = "minister";
            o.rankSince = a;
            p.payMult *= 1.25;
            bump(p, { joy: 8, bonds: 4, health: -3 });
            push("閣僚に選ばれ、大臣として入閣した", 82);
          } else if (o.rank === "minister" && a - (o.rankSince ?? a) >= 3 && luck < 0.16 + p.stats.bonds / 1500) {
            o.rank = "pm";
            o.rankSince = a;
            p.payMult *= 1.3;
            p.history.pm = a;
            bump(p, { joy: 12, bonds: 6, health: -6 });
            push("党の代表に選ばれ、内閣総理大臣に就任した。いちばん高い座にのぼりつめた", 98);
          }
        }
      } else {
        p.office = null;
        bump(p, { bonds: -4, joy: -14, money: -4 });
        if (p.prev) {
          p.occ = p.prev.occ;
          p.job = p.prev.job;
          p.payMult = p.prev.payMult;
          p.prev = null;
          p.employment = "nonregular";
          p.sector = "private";
        } else {
          p.occ = null;
        }
        push(`${od.label}の選挙で落選し、議席を失った。生活を立て直すことになった`, 72);
      }
    }
  }

  // その職業の頂点: 運と実力がそろったときだけ、ごくまれに、一生に一度だけ起こる。
  if (p.occ && p.occ !== "retired" && p.job !== "politician" && !p.history.summit && a <= 72) {
    const sm = SUMMIT_BY_JOB[p.job ?? ""] ?? SUMMIT_BY_OCC[p.occ];
    if (a >= sm.minAge && roll(seed, a, S.job + 51) < summitChance(p, sm)) {
      p.history.summit = a;
      p.payMult *= sm.pay;
      bump(p, sm.delta);
      push(sm.text, 96);
    }
  }

  // 日常の小さな出来事。年表の彩りで、能力値に少しだけ効く。
  if (roll(seed, a, S.small) < 0.1) {
    const pool = data.smallEvents[a < 12 ? "child" : a < 18 ? "teen" : a < 30 ? "young" : a < 60 ? "mid" : "senior"];
    push(pool[Math.floor(roll(seed, a, S.smallPick) * pool.length)], 30);
    bump(p, { bonds: 2, health: 1 });
  }
  // 転職の話は、年のおわりの状態(昇進などのあと)で、年収の比べ方が正しくなるよう、いちばん最後に決める。
  if (p.occ && p.occ !== "retired" && !isResponsible(p) && p.employment !== "self" && a - (p.jobSince ?? a - 3) >= 3 && !(p.job === "athlete" && p.sport && a < 38) && a < 60 && roll(seed, a, S.job) < interpolate(data.curves.jobChange, a) * mbtiJob * Math.max(0.3, 1 + 0.3 * economyAt(seed, a, p.birthYear))) {
    // 転職は、勝手には決まらない。話が来たところで、選んでもらう(リストラは、この限りではない)。
    if (!next.queue.includes("job_change")) {
      const r = streamRng(seed, a, S.jobPick);
      const target = weighted<Occ>(r, { ...data.transition.occ, [p.occ]: 0 });
      // 移り先の職種も、ここで決める(選ぶときに、年収の変わり方まで見せる)。転職の話は、いまの年収の7割以上になる職種から来る(それより下がる話は、自分から断るので、出てこない)。
      const pool = data.jobs.filter((j) => j.occ === target && !j.qual);
      if (pool.length) {
        p.jobOfferFactor = drawChangeFactor(r);
        p.jobOffer = target;
        p.jobOfferJob = pool[Math.floor(r() * pool.length)].id;
        push(`${jobById(p.jobOfferJob)?.title ?? data.occLabel[target]}への、転職の話が出た`, 56);
        next.queue.push("job_change");
      }
    }
  }
  // 心に残る「ひとこま」(恋人・家族・友人・ペットなどとの、短い情景)。ときどき、年表にはさむ。
  {
    const m = pickMoment(p, a, streamRng(seed, a, S.moment));
    if (m) {
      mark();
      push(m.text, 52);
      p.history[`m:${m.id}`] = a;
      bump(p, { joy: m.joy ?? 0, bonds: m.bonds ?? 0 });
      mark();
    }
  }
  if (a === SNAP_AGE) next.snap = clone(p);
  flush(next);
  next.unlocked = [...new Set([...(next.unlocked ?? []), ...evaluate(next)])];
  (next.series ??= []).push({ age: a, net: Math.round(fxSnap(next).n / 10000), joy: Math.round(p.stats.joy), health: Math.round(p.stats.health), inc: p.occ === null ? 0 : Math.round(incomeOf(p, data, p.econ)), tax: p.tax ? p.tax.incomeTax + p.tax.resident : 0, soc: p.tax?.social ?? 0, take: p.tax?.net ?? 0, mar: p.married, kids: p.kids, stress: Math.round(p.extra.stress), trust: Math.round(p.extra.trust), career: Math.round(p.extra.career), charm: Math.round(p.extra.charm), money: Math.round(p.stats.money), bonds: Math.round(p.stats.bonds), learn: Math.round(p.stats.learn), cash: Math.round(next.wallet.cash / 10000), inv: Math.round(holdingsValue(next, 0, data) / 10000), debt: Math.round(debtTotal(next.wallet.debts) / 10000), econ: Math.round(p.econ * 100) / 100, flow: Math.round(flow / 10000) });
  return next;
}

// 選択を求められた場面を、標準の道で自動的に進める(今の自分の将来用)。
// 選択を求められた場面で、標準の道(枝分かれも含めて)を選んだときの path。
function autoPath(tp: TurningPoint, p: Person): string[] {
  const path: string[] = [];
  let options: TurningOption[] = tp.options;
  for (let depth = 0; depth < 6; depth++) {
    const shown = options.filter((o) => !o.show || o.show(p));
    const node = shown.find((o) => o.auto) ?? shown[0];
    if (!node) break;
    path.push(node.id);
    if (!node.children) break;
    options = node.children(p).options;
  }
  return path;
}

export function autoRun(state: GameState, data: CountryData = jpData): GameState {
  let s = state;
  while (s.deathAge === null) {
    s = tick(s, data);
    if (s.deathAge !== null) break;
    // 名づけは、おまかせにする。選択の場面は、標準の道で進める。
    for (let guard = 0; guard < 20; guard++) {
      if (s.naming.length) {
        s = setName(s, null, data);
        continue;
      }
      const tp = pending(s, data);
      if (!tp) break;
      s = answer(s, tp, { kind: "option", path: autoPath(tp, s.person) }, data);
    }
  }
  return s;
}

// 保有している資産の評価額(円)。age と month は、いまの時点。
export function holdingsValue(state: GameState, month: number, data: CountryData = jpData): number {
  const market = marketOf(state.seed, data);
  const age = state.person.age;
  return (Object.keys(state.wallet.units) as AssetId[]).reduce((sum, id) => sum + state.wallet.units[id] * priceAt(market, id, age, month), 0);
}

// 積み立て投資の設定(1年の額・円)。0 で、やめる。
export function setPlan(state: GameState, id: AssetId, yenPerYear: number): GameState | null {
  if (state.person.prison) return null; // 服役中は、できない
  if (state.deathAge !== null || state.person.age < 18 || !state.wallet.stocks || !Number.isFinite(yenPerYear) || yenPerYear < 0) return null;
  const next = clone(state);
  const plans = (next.wallet.plans ??= {});
  if (yenPerYear === 0) delete plans[id];
  else plans[id] = Math.round(yenPerYear);
  const label = jpData.assets.find((x) => x.id === id)?.label ?? "";
  next.events.push({ age: state.person.age, event: yenPerYear === 0 ? `${label}の積み立てを、やめた` : `${label}の積み立てを、はじめた(年に${Math.round(yenPerYear / 10000).toLocaleString("ja-JP")}万円、毎月ずつ)`, weight: 48 });
  return next;
}

// 売買する。yen > 0 で買う、yen < 0 で売る。足りなければ null。
export function trade(state: GameState, id: AssetId, yen: number, month: number, data: CountryData = jpData): GameState | null {
  if (state.person.prison) return null; // 服役中は、できない
  if (state.deathAge !== null || !Number.isFinite(yen) || yen === 0) return null;
  const price = priceAt(marketOf(state.seed, data), id, state.person.age, month);
  const next = clone(state);
  const w = next.wallet;
  if (yen > 0) {
    if (yen > w.cash) return null;
    w.cash -= yen;
    w.units[id] += yen / price;
    w.contributed += yen;
  } else {
    const sell = -yen;
    if (sell > w.units[id] * price + 1) return null;
    w.units[id] = Math.max(0, w.units[id] - sell / price);
    w.cash += sell;
    w.contributed -= sell;
  }
  return next;
}

function incomeBand(rng: Rng, data: CountryData, p: Person, econ: number): Money {
  if (p.occ === null) return "tight";
  const spread = p.employment === "self" ? 0.6 + rng() : 0.8 + rng() * 0.4;
  let income = incomeOf(p, data, econ) * spread;
  if (p.married && p.occ !== "retired") income *= 1.35;
  const need = 220 + p.kids * 70 + (p.owned ? 60 : 0) + (p.region === "tokyo" ? 40 : 0);
  const ratio = income / need;
  return ratio < 1.35 ? "tight" : ratio < 1.9 ? "modest" : ratio < 2.6 ? "comfortable" : "ample";
}

function pickTimeline(events: GameEvent[], seed: number): TimelineEntry[] {
  const rng = createRng(seed ^ 0x9e3779b9);
  const [first, ...rest] = events;
  const top = rest
    .map((e) => ({ e, score: e.weight + rng() * 20 }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 7)
    .map((x) => x.e);
  return [first, ...top].map(({ age, event }) => ({ age, event })).sort((x, y) => x.age - y.age);
}

// 人生ひとつ分を、比較画面に出す要約にする。
// 人生の大きな分かれ目: 能力値や資産が大きく動いた出来事・重い出来事を、影響の大きい順に選ぶ。
function turningMoments(events: GameEvent[]): TurningMoment[] {
  const scored = events.map((e) => {
    const statSum = Object.values(e.fx?.stats ?? {}).reduce((s, v) => s + Math.abs(v ?? 0), 0);
    const money = Math.abs(e.fx?.money ?? 0) / 100000;
    return { age: e.age, event: e.event, fx: e.fx, impact: statSum + Math.min(40, money) + e.weight / 25 };
  });
  return scored
    .filter((x) => x.impact >= 9)
    .sort((x, y) => y.impact - x.impact)
    .slice(0, 6)
    .sort((x, y) => x.age - y.age);
}

export function summarize(state: GameState, data: CountryData = jpData): LifeSummary {
  const p = state.snap ?? state.person;
  const rng = createRng(state.seed ^ 0x7f4a7c15);
  const housing = housingOf(p);
  const label = lifeLabel(p, data);
  const household = p.kids > 0 ? `子ども${p.kids}人と暮らす` : p.married ? "パートナーと二人で暮らす" : p.withParents ? "実家で暮らす" : "ひとりで暮らす";
  const echo: Echo = {
    status: {
      summary: `${p.age}歳のあなた。${p.city}で、${label}として、${household}`,
      occupation: label,
      city: `${p.city}(${p.abroad ? "海外" : data.regionLabel[p.region]})`,
      living: (p.housingKind ? HOUSING_KIND_TEXT[p.housingKind] : LIVING[housing]) + (p.kids > 0 ? `。子どもは${p.kids}人` : ""),
    },
    timeline: pickTimeline(state.events, state.seed),
    scene: data.compose(p, incomeBand(rng, data, p, economyAt(state.seed, p.age, p.birthYear)), rng, data),
  };
  // 公開用: 持病・MBTI・性自認・惹かれる相手の情報を消して情景を作り直し、自由記述は「近い方向」に置き換え、地名は地域の区分だけにする。
  const safePerson: Person = { ...p, condition: "none", mbti: null, genderId: undefined, orientation: undefined };
  const tagLabel = (t: Tag) => data.tags.find((x) => x.id === t)?.label ?? "";
  const safeEvents = state.events.map((e) => (e.free ? { ...e, event: `自分の言葉で選んだ(${e.label || (e.tag ? tagLabel(e.tag) : "")})` } : e));
  const places = [...Object.values(data.cities).flat(), ...data.prefectures.map((x) => x.name), ...data.countries.flatMap((c) => [c.name, ...c.cities])].sort((x, y) => y.length - x.length);
  const scrub = (text: string) => places.reduce((acc, name) => acc.split(name).join("どこかの街"), text);
  const pub: Echo = {
    status: {
      summary: scrub(echo.status.summary),
      occupation: echo.status.occupation,
      city: p.abroad ? "海外" : data.regionLabel[p.region],
      living: echo.status.living,
    },
    timeline: pickTimeline(safeEvents, state.seed).map((t) => ({ ...t, event: scrub(t.event) })),
    scene: data.compose(safePerson, incomeBand(createRng(state.seed ^ 0x7f4a7c15), data, p, economyAt(state.seed, p.age, p.birthYear)), createRng(state.seed ^ 0x7f4a7c15), data),
  };
  // 資産は、亡くなった時点(生きていれば今)で評価する。
  const endAge = state.deathAge ?? state.person.age;
  const atEnd = { ...state, person: { ...state.person, age: endAge } };
  const held = holdingsValue(atEnd, 0, data);
  const total = state.wallet.cash + held - debtTotal(state.wallet.debts);
  const toMan = (yen: number) => Math.round(yen / 10000);
  return {
    achievements: [...new Set([...(state.unlocked ?? []), ...evaluate({ ...state, person: p })])],
    deathAge: endAge,
    deathCause: state.deathCause ?? "",
    death: state.deathNote,
    echo,
    pub,
    turning: turningMoments(state.events),
    series: state.series ?? [],
    assets: { total: toMan(total), pnl: toMan(held - state.wallet.contributed) },
    stats: { ...state.person.stats },
    kids: state.person.kids,
    married: state.person.married,
  };
}

// ---- 開発者向けの道具(/dev から使う。ゲームの本編では使わない) ----

// 指定した年数だけ、標準の道で進める(名づけはおまかせ、選択は標準の道)。亡くなったら止まる。
export function devAdvance(state: GameState, years: number, data: CountryData = jpData): GameState {
  let s = state;
  const end = s.person.age + years;
  while (s.deathAge === null && s.person.age < end) {
    s = tick(s, data);
    if (s.deathAge !== null) break;
    for (let guard = 0; guard < 20; guard++) {
      if (s.naming.length) {
        s = setName(s, null, data);
        continue;
      }
      const tp = pending(s, data);
      if (!tp) break;
      s = answer(s, tp, { kind: "option", path: autoPath(tp, s.person) }, data);
    }
  }
  return s;
}

// 年齢を、指定した年齢の「ひとつ前」に合わせる。そのあと1年進めると、その年齢の出来事・節目が、順に出る。
export function devSetAge(state: GameState, target: number, data: CountryData = jpData): GameState {
  const next = clone(state);
  const p = next.person;
  p.age = Math.max(1, target - 1);
  p.econ = economyAt(next.seed, p.age, p.birthYear);
  // その年齢より前の節目は、済んだことにする(それより後の節目は、これから出る)。
  next.done = data.turningPoints.filter((tp) => ageOf(tp, p) < target - 3).map((tp) => tp.id);
  next.queue = [];
  next.naming = [];
  return next;
}

// 選択を求める出来事を、すぐに順番待ちに入れる。
export function devQueue(state: GameState, id: string, data: CountryData = jpData): GameState {
  const next = clone(state);
  data.eventQuestions.find((e) => e.id === id)?.prepare?.(next, streamRng(next.seed, next.person.age, S.qPick + 9), data);
  next.queue.push(id);
  return next;
}

// 選択のない出来事を、いますぐ起こす。
export function devEvent(state: GameState, id: string, data: CountryData = jpData): GameState {
  const def = data.lifeEvents.find((e) => e.id === id);
  if (!def) return state;
  const next = clone(state);
  const snap = fxSnap(next);
  const out = def.apply(next, streamRng(next.seed, next.person.age, S.evApply), data);
  const fx = fxSince(next, snap);
  let first = true;
  for (const text of Array.isArray(out) ? out : [out])
    if (text) {
      next.events.push({ age: next.person.age, event: text, weight: def.importance ?? 45, ...(first && fx ? { fx } : {}) });
      first = false;
    }
  flush(next);
  return next;
}

// 資産(円)・能力値・職・家族などを、直接書きかえる。
export function devSet(state: GameState, patch: { cashYen?: number; stats?: Partial<Stats>; mbti?: string | null; married?: boolean }): GameState {
  const next = clone(state);
  if (patch.cashYen !== undefined) next.wallet.cash = Math.max(0, patch.cashYen);
  if (patch.stats) for (const k of Object.keys(patch.stats) as (keyof Stats)[]) next.person.stats[k] = Math.max(0, Math.min(100, patch.stats[k] ?? next.person.stats[k]));
  if (patch.mbti !== undefined) next.person.mbti = patch.mbti;
  if (patch.married !== undefined) next.person.married = patch.married;
  return next;
}
