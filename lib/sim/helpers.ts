import { jobAvailable, yearOf } from "@/lib/sim/era";
import { pickPartnerMbti, randomMbti } from "@/lib/sim/mbti";
import { pick, type Rng } from "@/lib/sim/rng";
import type { CountryData, Debt, GameState, LenderId, Occ, Partner, PartnerGender, Person, Region, Stats } from "@/lib/sim/types";
import { LENDERS } from "@/lib/sim/data/jp-debt";
import { DEFAULT_JOB, jobById } from "@/lib/sim/data/jp-jobs";

export const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

// 能力値を増減する(0〜100に収める)。
export function bump(p: Person, d: Partial<Stats>) {
  for (const k of Object.keys(d) as (keyof Stats)[]) p.stats[k] = clamp(p.stats[k] + (d[k] ?? 0));
  // 幸福度は、つながり・健康・お金の変化に、ゆるくついていく(直接の指定があれば、それを優先)。
  if (d.joy === undefined) {
    const dj = 0.45 * (d.bonds ?? 0) + 0.35 * (d.health ?? 0) + 0.3 * (d.money ?? 0);
    if (dj) p.stats.joy = clamp(p.stats.joy + dj);
  }
}

export function newCity(rng: Rng, data: CountryData, region: Region, avoid?: string): string {
  const pool = data.cities[region].filter((c) => c !== avoid);
  return pick(rng, pool.length ? pool : data.cities[region]);
}

// 住む場所が変わると、通っていた習い事・アルバイト・議員の職は、続けられない。
export function leaveLocal(p: Person, data: CountryData) {
  const gone: string[] = [];
  if (p.lessons.length) gone.push(`習い事(${p.lessons.map((l) => data.lessons.find((x) => x.id === l.id)?.label ?? "").filter(Boolean).join("・")})`);
  if (p.parttime) gone.push(`アルバイト(${data.partTimes.find((x) => x.id === p.parttime!.id)?.label ?? ""})`);
  if (p.office) gone.push(`議員などの職(${data.offices.find((x) => x.id === p.office!.id)?.label ?? ""})`);
  p.lessons = [];
  p.parttime = null;
  p.office = null;
  if (gone.length) p.leftNote = `${gone.join("と")}は、通えなくなり、やめた`;
}

// 議員・総理大臣・会社の経営者など、責任ある立場にあるか(あるあいだは、引っ越しの話も、転職の話も出ない)。
// (頂点に立った人のうち、組織のトップ・役職についた人もふくむ: 取締役・社長・院長・学長・校長・看護部長など)
const SUMMIT_LEADERS = ["manager", "doctor", "prof", "school_teacher", "lawyer", "pilot", "nurse", "accountant"];
export const isResponsible = (p: Person) =>
  !!p.office || ["ceo", "founder", "owner", "politician"].includes(p.job ?? "") || (p.history.summit !== undefined && SUMMIT_LEADERS.includes(p.job ?? ""));

export function moveTo(p: Person, rng: Rng, data: CountryData, region: Region, city?: string): string {
  leaveLocal(p, data);
  p.abroad = null; // 国内に移れば、海外暮らしではなくなる。
  p.housingKind = null; // 引っ越せば、居候や寮などの暮らしではなくなる。
  p.region = region;
  p.city = city ?? newCity(rng, data, region, p.city);
  p.withParents = false;
  return p.city;
}

// 大分類の中から、職種を決めて、状態に反映する(資格が必要な職種は、選ばれにくくする)。
export function assignJob(p: Person, occ: Occ, rng: Rng, data: CountryData, jobId?: string): string {
  const pool = data.jobs.filter((j) => j.occ === occ && !j.qual && jobAvailable(j.id, yearOf(p)));
  const chosen = jobById(jobId) ?? (pool.length ? pool[Math.floor(rng() * pool.length)] : jobById(DEFAULT_JOB[occ])!);
  if (p.parttime) {
    p.leftNote = `仕事に就いたため、アルバイト(${data.partTimes.find((x) => x.id === p.parttime!.id)?.label ?? ""})はやめた`;
    p.parttime = null;
  }
  p.occ = occ;
  p.job = chosen.id;
  p.payMult = chosen.mult;
  return chosen.title;
}

// 画面に出す職業名(職種があれば職種、なければ大分類)。
export function jobLabel(p: Person, data: CountryData): string {
  if (p.occ === null) return p.age < 23 ? data.occLabel.student : data.stageLabel(p.age, null);
  if (p.occ === "retired") return data.occLabel.retired;
  return jobById(p.job)?.title ?? data.occLabel[p.occ];
}

// 子ども・学生・退職後も含めた、その時点の暮らしの名前(働いていれば職種)。
export function lifeLabel(p: Person, data: CountryData): string {
  return p.occ === null || p.occ === "retired" ? data.stageLabel(p.age, p.occ) : jobLabel(p, data);
}

// 自分の性(性自認)。シスジェンダーなら、生まれたときの性別と同じ。答えていなければ null。
type Who = { sex: Person["sex"]; genderId?: Person["genderId"]; orientation?: Person["orientation"] };
export function selfGender(p: Who): PartnerGender | null {
  const g = p.genderId ?? "cis";
  if (g === "trans_man") return "man";
  if (g === "trans_woman") return "woman";
  if (g === "nonbinary") return "nonbinary";
  if (g === "unsure") return null;
  return p.sex === "male" ? "man" : p.sex === "female" ? "woman" : null;
}

// 恋愛・性的指向と、自分の性から、これから出会う相手の性を決める。
// 異性・同性は、自分の性から決まる(ノンバイナリーや決めていない人は、どちらの人とも出会いうる)。両性は、どちらにも惹かれる。
export function pickPartnerGender(rng: Rng, p: Who): PartnerGender {
  const me = selfGender(p);
  const any = (): PartnerGender => { const x = rng(); return x < 0.45 ? "woman" : x < 0.9 ? "man" : "nonbinary"; };
  const o = p.orientation ?? "hetero";
  if (o === "bi" || o === "ace") return any();
  if (me === "man") return o === "homo" ? "man" : "woman";
  if (me === "woman") return o === "homo" ? "woman" : "man";
  if (me === "nonbinary") return o === "homo" ? "nonbinary" : rng() < 0.5 ? "man" : "woman";
  return any();
}

// 自分と相手が同じ性か(同性のカップルか)。
export const sameGender = (p: Who, pt: Partner | null | undefined) => !!pt && !!pt.gender && selfGender(p) === pt.gender && pt.gender !== "nonbinary";
// 子どもを産める体の人がいるか。いるなら、自分(1)か、相手(0)か。決まらなければ null。
export function bearerOf(rng: Rng, p: { sex: Person["sex"] }, pt: Partner | null | undefined): 0 | 1 | null {
  const me = p.sex === "female";
  const you = pt?.sex === "female";
  if (me && you) return rng() < 0.5 ? 1 : 0;
  if (me) return 1;
  if (you) return 0;
  return null;
}

// 二人とも、子どもを産める体ではないか(産める体の人がいなければ、養子縁組などの道になる)。相手が決まっていなければ、false。
export const noBearer = (p: { sex: Person["sex"]; partner: Partner | null }) => !!p.partner && p.sex !== "female" && p.partner.sex === "male";

// 名字と名前をランダムに組み合わせて、相手の名前を作る。相手の性は、自分の性と、恋愛・性的指向で決まる。
export function randomPartner(rng: Rng, data: CountryData, age: number, status: Partner["status"], mine?: string | null, me?: Who): Partner {
  const gender: PartnerGender = me ? pickPartnerGender(rng, me) : (rng() < 0.5 ? "woman" : "man");
  const pool = gender === "woman" ? data.names.girl : gender === "man" ? data.names.boy : data.names.neutral;
  // 体の性は、ここでは、性自認から決める(ノンバイナリーの人は、半々)。子どもを産める人がいるかに使う。
  const sex: "female" | "male" = gender === "woman" ? "female" : gender === "man" ? "male" : rng() < 0.5 ? "female" : "male";
  // 相性がよいとされるタイプの人が、出会いやすい。
  return { family: pick(rng, data.names.surname), given: pick(rng, pool), since: age, status, mbti: pickPartnerMbti(rng, mine), gender, sex };
}

// 周りの人(友人・上司・義理の家族)の MBTI。はじめて出会うときに決まる。
export function npcMbti(p: Person, role: string, rng: Rng): string {
  p.npc ??= {};
  return (p.npc[role] ??= randomMbti(rng));
}

export const fullName = (pt: Partner) => `${pt.family}${pt.given}`;
// 名前を呼ぶ形(「陽菜さん」)。いなければ、既定の言い方。
export const partnerRel = (pt: NonNullable<Person["partner"]>) => (pt.status === "married" ? "配偶者" : pt.status === "dating" ? "恋人" : pt.status === "crush" ? "気になる人" : "元恋人");
export const partnerCall = (p: Person, fallback = "パートナー") => (p.partner && p.partner.status !== "ex" ? `${partnerRel(p.partner)}の${p.partner.given}さん` : fallback);

// 身近な人を、続柄をつけて呼ぶ(長男・次女・犬 など)。
export function kidTitle(p: Person, i: number): string {
  const k = p.kidList[i];
  if (!k) return "子ども";
  if (k.sex === "unknown") return `第${i + 1}子`;
  const nth = p.kidList.slice(0, i).filter((x) => x.sex === k.sex).length;
  return (k.sex === "boy" ? ["長男", "次男", "三男", "四男"][nth] ?? "男子" : ["長女", "次女", "三女", "四女"][nth] ?? "女子");
}
export const kidCall = (p: Person, i: number) => (p.kidList[i]?.name ? `${kidTitle(p, i)}の${p.kidList[i].name}` : kidTitle(p, i));
export const petCall = (pt: { name: string; kind: string }) => (pt.name ? `${pt.kind}の${pt.name}` : pt.kind);

// 海外へ移住する。現在地・収入・物価が、その国のものになる。countryId を省くと、国は乱数で決まる。
export function moveAbroad(p: Person, rng: Rng, data: CountryData, countryId?: string): string {
  const weights: Record<string, number> = { us: 25, ca: 10, au: 10, uk: 10, de: 9, sg: 8, kr: 8, cn: 6, th: 5, fr: 5, nz: 4, br: 3 };
  const pool = data.countries;
  let c = pool.find((x) => x.id === countryId);
  if (!c) {
    const total = pool.reduce((s, x) => s + (weights[x.id] ?? 3), 0);
    let r = rng() * total;
    c = pool[pool.length - 1];
    for (const x of pool) {
      r -= weights[x.id] ?? 3;
      if (r < 0) {
        c = x;
        break;
      }
    }
  }
  const city = pick(rng, c.cities);
  leaveLocal(p, data);
  p.abroad = { country: c.name, city, incomeFactor: c.incomeFactor, costFactor: c.costFactor, since: p.age };
  p.city = `${c.name}・${city}`;
  p.region = "metro";
  p.withParents = false;
  bump(p, { bonds: -5, learn: 3, joy: p.stats.learn < 45 ? -4 : 2 });
  return p.city;
}

// 日本へ帰国する。
export function moveHome(p: Person, rng: Rng, data: CountryData, region?: Region): string {
  p.abroad = null;
  return moveTo(p, rng, data, region ?? p.birthRegion);
}

// ---- 借金 ----
export const debtTotal = (debts: Debt[]) => debts.reduce((sum, d) => sum + d.amount, 0);

// 借りる。同じ借り先の借金は、ひとつにまとめる。
export function addDebt(s: GameState, lender: LenderId, amountYen: number) {
  if (amountYen <= 0) return;
  const found = s.wallet.debts.find((d) => d.lender === lender);
  if (found) found.amount += amountYen;
  else s.wallet.debts.push({ lender, amount: amountYen, rate: LENDERS[lender].rate, since: s.person.age, missed: 0 });
}

// 災厄などで、貯金を超える出費が出たとき、足りない分は、借金になる(自動で、頼れる借り先が決まる)。
// 返り値は、借金になった額(円)。
export function chargeWithDebt(s: GameState, lossYen: number): number {
  if (lossYen <= 0) return 0;
  if (s.wallet.cash >= lossYen) {
    s.wallet.cash -= lossYen;
    return 0;
  }
  const shortfall = lossYen - s.wallet.cash;
  s.wallet.cash = 0;
  const p = s.person;
  // 少額の不足(10万円未満)は、やりくりで乗り切る。借金にはしない。
  if (shortfall < 100000) {
    bump(p, { money: -2, joy: -1 });
    return 0;
  }
  const bankrupt = p.bankrupt !== null && p.age - (p.bankrupt ?? 0) < 7;
  const lender: LenderId = p.stats.bonds >= 55 && p.age < 50 ? "family" : !bankrupt && p.occ !== null && p.occ !== "retired" ? "bank" : !bankrupt ? "card" : "friend";
  addDebt(s, lender, shortfall);
  bump(p, { joy: -6, bonds: lender === "family" ? -6 : 0, money: -10 });
  return shortfall;
}

// 先天性の持病と、いまの持病を合わせた、健康の土台・病気のなりやすさ・収入への影響。
export function condOf(data: CountryData, p: Person) {
  const c = data.conditions.find((x) => x.id === p.condition) ?? data.conditions[0];
  const a = data.ailments.find((x) => x.id === p.ailment) ?? data.ailments[0];
  return { healthBase: c.healthBase + a.healthDelta + (p.healthAdj ?? 0), illness: c.illness * a.illness, income: c.income * a.income };
}

// 親友・友人・旧友などの名前。はじめて出会うときに、ランダムに決まり、そのあとも、同じ名前で出てくる。
export function friendName(p: Person, role: "best" | "friend" | "old", rng: Rng, data: CountryData): string {
  p.friendNames ??= {};
  if (!p.friendNames[role]) {
    const used = new Set(Object.values(p.friendNames));
    const r = rng();
    const pool = (r < 0.47 ? data.names.girl : r < 0.94 ? data.names.boy : data.names.neutral).filter((n) => !used.has(n) && n !== p.partner?.given);
    p.friendNames[role] = pool.length ? pool[Math.floor(rng() * pool.length)] : "友人";
  }
  return p.friendNames[role];
}
