import { SINCE, yearOf } from "@/lib/sim/era";
import { manText as moneyText } from "@/lib/money";
import { isStudent, moveAftermath } from "@/lib/sim/data/jp-move";
import { jobById, JOBS as allJobs, OCC_LABEL } from "@/lib/sim/data/jp-jobs";
import { LOTTERY_PRIZES, drawLottery } from "@/lib/sim/data/jp-lottery";
import { industryQuestion } from "@/lib/sim/data/jp-industry";
import { applyChangeIncome, changeIncome, incomeOf, round10 } from "@/lib/sim/salary";
import { leaveLoss, man as manText, retirementTax } from "@/lib/sim/tax";
import { STUDY_MAIN, STUDY_OTHERS, countryById } from "@/lib/sim/data/jp-countries";
import type { TurningQuestion } from "@/lib/sim/types";
import { addDebt, assignJob, bump, isResponsible, chargeWithDebt, friendName, fullName, kidCall, moveAbroad, moveHome, moveTo, bearerOf, noBearer, npcMbti, partnerCall, randomPartner } from "@/lib/sim/helpers";
import { WAITLIST, parentsAround, partnerWorks } from "@/lib/sim/childcare";
import { compat, compatMark, idealChance, isE, isJ, isN, isT, IDEAL, typeCall } from "@/lib/sim/mbti";
import { interpolate, weighted } from "@/lib/sim/rng";
import { MAX_LESSONS } from "@/lib/sim/types";
import { CRIMES, yearsToArrest, type CrimeId } from "@/lib/sim/data/jp-crime";
import { MEETS, SPORTS, athleteScore, meetWinChance, olympicResult, sportById } from "@/lib/sim/data/jp-sports";
import type { AutoEvent, CountryData, EventQuestionDef, GameState, Occ, Person, Region, TurningOption } from "@/lib/sim/types";

// 選択を求めない出来事(風邪で寝込んだ、いじめにあった、事故、昇格・降格…)と、選択を求める出来事(不倫・裁判・ペットなど)。
// どれも「あなたの年齢・仕事・家族・地域・景気・健康」で、起きやすさが変わる。確率は設計上の仮定。

const working = (p: Person) => p.occ !== null && p.occ !== "retired";
const inAge = (p: Person, a: number, b: number) => p.age >= a && p.age <= b;
const man = (n: number) => moneyText(n);
const money = (s: GameState, manYen: number) => {
  // 18歳未満は、まとまったお金の出入りは、親が負担する(お小遣いには、影響しない)。
  if (s.person.age < 18) return;
  if (manYen < 0) {
    // ふいの出来事で、資産が大きく減らないよう、ひとつの出来事の自己負担は、手持ちの4割(最低5万円)までにとどめる(保険・公的な支援・家族の助けがあるため)。
    const cap = Math.max(5, (s.wallet.cash / 10000) * 0.4);
    // 出費が貯金をこえたら、足りない分は、借金になる。
    chargeWithDebt(s, Math.round(Math.min(-manYen, cap) * 10000));
  } else s.wallet.cash += Math.round(manYen * 10000);
};
// 家や暮らしにかかる出費。実家で暮らしている間は、親が払ったり(6割)、折半したり(4割)する。
const homeMoney = (s: GameState, r: () => number, manYen: number) => money(s, (s.person.withParents ? manYen * (r() < 0.6 ? 0 : 0.5) : manYen) * (manYen < 0 && s.person.owns?.fire !== undefined ? 0.35 : 1));
// 恋人・配偶者との相性(0〜100)。相手のタイプが決まっていなければ、ふつう(50)。
const partnerCompat = (p: Person) => compat(p.mbti, p.partner?.mbti);
const bossCompat = (p: Person) => compat(p.mbti, p.npc?.boss);
const friendCompat = (p: Person) => compat(p.mbti, p.npc?.friend);
// 相性が悪いほど揉めやすく、よいほど揉めにくい。
const clash = (score: number) => (score < 48 ? 1.7 : score >= 80 ? 0.55 : 1);
// 告白がうまくいく確率: つながり・外向き・相性。
export const confessChance = (p: Person) => Math.min(0.9, Math.max(0.1, 0.3 + (p.extra.charm - 50) / 400 + p.stats.bonds / 200 + (isE(p.mbti) ? 0.1 : 0) + (partnerCompat(p) - 50) / 250));
const jpDataLabel = (o: Occ) => OCC_LABEL[o];
// 健康度が高いほど、体の不調の出来事は、まれになる(20を切ると、ほぼ毎年。50ほどで、5〜10年に一度。80以上では、めったにない)。
const hg = (p: Person) => (p.stats.health < 20 ? 5 : p.stats.health < 35 ? 1.2 : p.stats.health < 55 ? 0.12 : p.stats.health < 75 ? 0.08 : 0.04);
// 治療が必要になったとき、治療を受けるかどうかを、自分で選ぶ(費用は、選んだあとに払う)。18歳未満は、親が出す。
const needTreat = (s: GameState, manYen: number, label: string) => {
  const p = s.person;
  if (p.age < 18) return;
  const ins = p.history.medIns ? 0.3 : 1; // 医療保険に入っていると、自己負担が軽い
  p.treatMan = Math.max(1, Math.round(manYen * ins));
  p.treatLabel = label;
  if (!s.queue.includes("treat")) s.queue.push("treat");
};
const kidName = (p: Person, i = 0) => (p.kidList[i] ? kidCall(p, i) : "子ども");
const REGION_NAME: Record<Region, string> = { tokyo: "東京23区", metro: "大都市", local: "地方都市", rural: "郊外・農村部" };
const DISASTERS = ["大規模な地震", "記録的な豪雨", "大型の台風", "感染症の急速な拡大"];
const rural = (p: Person) => (p.region === "rural" || p.region === "local" ? 1.3 : 1);

const recent = (p: Person, key: string, years: number) => p.age - (p.history[key] ?? -99) <= years;
const mark = (p: Person, key: string) => {
  p.history[key] = p.age;
};
// 孫・ひ孫の、名前と性別(ランダム。男の子と女の子は半々で、名前はときどき中性的なものがまざる)。
const descendant = (r: () => number, d: CountryData) => {
  const boy = r() < 0.5;
  const pool = [...d.names[boy ? "boy" : "girl"], ...d.names[boy ? "boy" : "girl"], ...d.names.neutral];
  return `${pickOne(r, pool)}・${boy ? "男の子" : "女の子"}`;
};
const ev = (id: string, weight: AutoEvent["weight"], apply: AutoEvent["apply"], importance?: number): AutoEvent => ({ id, weight, apply, importance });

export const lifeEvents: AutoEvent[] = [
  // ---- 体調・けが ----
  ev("cold", (p) => (p.age >= 1 ? 3.5 * hg(p) : 0), (s) => (bump(s.person, { health: -2 }), "風邪をひいて、数日寝込んだ"), 30),
  ev("flu", (p) => (p.age >= 2 ? 1.6 * hg(p) : 0), (s) => (bump(s.person, { health: -3 }), "インフルエンザにかかり、しばらく休んだ"), 32),
  ev("injury", (p) => (inAge(p, 5, 75) ? 1.3 * hg(p) : 0), (s, r) => {
    bump(s.person, { health: -6 });
    needTreat(s, 1 + r() * 3, "けがの治療が必要になった");
    return pickOne(r, ["転んで、足を骨折した", "スポーツ中にけがをして、しばらく通院した", "階段から落ちて、腕を痛めた"]);
  }, 45),
  ev("checkup", (p) => (p.age >= 40 ? 1.4 : 0), (s, r) => {
    if (r() < 0.6) return "健康診断で再検査と言われたが、異常はなかった";
    bump(s.person, { health: -3 });
    return "健康診断で数値の異常を指摘され、生活を見直すことになった";
  }, 40),
  ev("dental", (p) => (p.age >= 6 ? 1.4 : 0), (s) => (money(s, -3), "歯の治療に通った"), 25),
  ev("allergy", (p) => (inAge(p, 10, 75) ? 0.9 * hg(p) : 0), (s) => (bump(s.person, { health: -1 }), "花粉症がひどくなり、つらい春を過ごした"), 25),
  ev("hospital", (p) => (p.age >= 30 ? 0.7 * hg(p) * 2 : 0), (s, r) => {
    const p = s.person;
    bump(p, { health: -5, joy: -6 });
    needTreat(s, 2 + r() * 6, "入院して、治療を受けるかを、決めるときがきた");
    const reason = recent(p, "overtime", 2) ? "過労がたたって" : p.condition !== "none" ? "持病が悪化して" : p.age >= 60 ? "年齢による体の衰えから" : pickOne(r, ["急な発熱と痛みで", "検査で異常が見つかり", "無理が重なった体が、悲鳴をあげて"]);
    return `${reason}、体調を崩して、入院することになった`;
  }, 55),
  ev("burnout", (p) => (working(p) && p.stats.health < 58 ? 1.0 * hg(p) * 2 : 0), (s) => {
    const p = s.person;
    bump(p, { health: -6, money: -3, joy: -8 });
    const reason = recent(p, "overtime", 2) ? "長時間の残業が続き" : recent(p, "conflict", 2) ? "職場の人間関係に疲れ果て" : p.stats.money < 40 ? "お金の不安から、休めずに働き続けて" : "責任の重さと忙しさが重なり";
    return `${reason}、体調を崩した`;
  }, 55),
  ev("low_mood", (p) => (inAge(p, 14, 70) && p.stats.bonds < 42 ? 0.7 : 0), (s) => {
    const p = s.person;
    bump(p, { health: -7, bonds: -3, joy: -16 });
    const reason = recent(p, "parentDied", 2) ? "大切な人を失った悲しみが癒えず" : recent(p, "breakup", 2) ? "別れの痛手が癒えず" : recent(p, "bully", 3) ? "いじめの傷が残ったまま" : p.stats.bonds < 30 ? "話せる相手がいない孤独のなかで" : "つながりの薄さを感じ続けて";
    return `${reason}、気持ちが沈む日が続き、休養が必要になった`;
  }, 55),
  ev("heat", (p) => (inAge(p, 1, 90) ? 0.7 : 0), (s) => (bump(s.person, { health: -2 }), "記録的な猛暑で、体調を崩した"), 28),
  ev("jogging", (p) => (inAge(p, 15, 70) ? 1.0 : 0), (s) => (bump(s.person, { health: 4 }), "朝の散歩やジョギングが、習慣になった"), 30),
  ev("legs", (p) => (p.age >= 68 ? 2.0 : 0), (s) => (bump(s.person, { health: -3 }), "足腰が弱ってきたと感じるようになった"), 40),

  // ---- 男女で、ちがう体の節目 ----
  ev("menopause", (p) => (p.sex === "female" && inAge(p, 46, 54) && !p.history.menopause ? 2 : 0), (s) => {
    const p = s.person;
    mark(p, "menopause");
    bump(p, { health: -4, joy: -5 });
    p.extra.stress = Math.min(100, p.extra.stress + 8);
    return "更年期のゆらぎで、ほてりや気分の落ち込みに、悩まされるようになった";
  }, 44),
  ev("prostate", (p) => (p.sex === "male" && inAge(p, 55, 78) && !p.history.prostate ? 0.45 : 0), (s) => {
    const p = s.person;
    mark(p, "prostate");
    bump(p, { health: -2, joy: -2 });
    return "健康診断で、前立腺の数値を指摘され、定期的に通院することになった";
  }, 42),

  // ---- 子どもの時代・学校 ----
  ev("bully", (p) => (inAge(p, 7, 16) ? 1.5 : 0), (s, r) => {
    const p = s.person;
    bump(p, { bonds: -8, health: -4, joy: -10 });
    mark(p, "bully");
    s.later.push({ age: p.age + 2, event: "支えてくれる友だちに出会い、少しずつ元気を取り戻した", weight: 55, delta: { bonds: 6, health: 3, joy: 8 } });
    if (!s.queue.includes("bully_help")) s.queue.push("bully_help");
    // きっかけ(理由)も、あわせて残す。
    const trigger = p.history.transfer !== undefined && recent(p, "transfer", 1) ? "転校してきたばかりで、なじめないまま" : pickOne(r, ["ささいな言い争いがきっかけで", "目立つことをしたのを、ねたまれて", "はっきりした理由のないまま、空気が変わって", "グループの仲たがいに巻き込まれて", "いつも一緒だった友だちに、突然、距離を置かれて"]);
    const form = pickOne(r, ["クラスで無視されるようになり", "持ち物を隠されたり、からかわれたりして", ...(yearOf(p) >= SINCE.sns ? ["SNSで悪口を書かれ"] : ["黒板や机に、悪口を書かれ"]), "仲間はずれにされ"]);
    return `${trigger}、${form}、学校に行くのがつらくなった`;
  }, 64),
  ev("bystander", (p) => (inAge(p, 8, 17) ? 0.6 : 0), (s) => (bump(s.person, { bonds: -1, joy: -3 }), "同じクラスの子がいじめられているのを見て、胸が痛んだ"), 40),
  ev("sns_attack", (p) => (inAge(p, 13, 45) && yearOf(p) >= SINCE.sns ? 0.4 : 0), (s) => (bump(s.person, { bonds: -3, health: -2, joy: -8 }), "SNSで心ない言葉を浴び、しばらく画面を見るのが怖くなった"), 56),
  ev("truancy", (p) => (inAge(p, 10, 17) ? 0.5 : 0), (s, r) => {
    const p = s.person;
    let reason: string;
    if (recent(p, "bully", 3)) reason = "いじめを受けた恐怖で、教室に入れなくなり";
    else if (p.stats.health < 50) reason = "体調がすぐれず、朝になると体が動かず";
    else if (p.stats.joy < 35) reason = "気持ちが落ち込み、学校に行く気力がわかず";
    else if (recent(p, "parentIll", 2)) reason = "親の病気が心配で、家を離れられず";
    else if (recent(p, "cram", 2)) reason = "受験のプレッシャーに押しつぶされそうになり";
    else reason = pickOne(r, ["クラスに居場所を感じられず", "環境の変化についていけず", "朝になると頭やお腹が痛くなり"]);
    bump(p, { learn: -3, bonds: -2, joy: -9 });
    return `${reason}、学校に行けない日が続いた`;
  }, 55),
  ev("best_friend", (p) => (inAge(p, 6, 18) ? 1.6 : 0), (s, r, d) => {
    const f = npcMbti(s.person, "friend", r);
    const c = compat(s.person.mbti, f);
    const nm = friendName(s.person, "best", r, d);
    bump(s.person, { bonds: c >= 62 ? 7 : 5, joy: c >= 80 ? 3 : 0 });
    return `${nm}という、${typeCall(f)}の、親友と呼べる友だちができた${s.person.mbti ? `(相性 ${compatMark(c)})` : ""}`;
  }, 50),
  ev("first_love", (p) => (inAge(p, 12, 19) ? 1.2 : 0), (s) => (bump(s.person, { bonds: 3 }), "はじめて、誰かを好きになった"), 50),
  ev("sports_day", (p) => (inAge(p, 6, 15) ? 1.2 : 0), (s) => (bump(s.person, { health: 2, bonds: 3 }), "運動会で活躍して、みんなに驚かれた"), 35),
  ev("teacher", (p) => (inAge(p, 8, 18) ? 1.0 : 0), (s) => (bump(s.person, { learn: 4 }), "心に残る先生に出会った"), 45),
  ev("cram", (p) => (inAge(p, 14, 18) ? 1.2 : 0), (s, r) => {
    bump(s.person, { learn: 4, health: -2 });
    mark(s.person, "cram");
    return pickOne(r, ["志望校に届くかどうか不安で、受験勉強に追われる日々が続いた", "周りが次々に塾へ通い始めたのに焦り、受験勉強に追われた", "親の期待を重く感じながら、受験勉強に追われた"]);
  }, 38),
  ev("transfer_school", (p) => (inAge(p, 6, 15) ? 0.5 : 0), (s, r) => ["親の転勤で、転校することになった", ...moveAftermath(s.person, r)], 45),
  ev("contest", (p) => (inAge(p, 8, 18) ? 0.8 : 0), (s) => (bump(s.person, { learn: 3, bonds: 2 }), "作文や絵のコンクールで入賞した"), 42),
  ev("club_win", (p) => (inAge(p, 12, 17) ? 0.8 : 0), (s) => (bump(s.person, { health: 2, bonds: 4 }), "部活の大会で、県の舞台に立った"), 42),

  // ---- 仕事 ----
  ev("promotion", (p, e) => (working(p) && p.employment === "regular" && inAge(p, 27, 58) && p.occ !== "mgmt" ? (0.9 * (p.stats.learn + 30)) / 80 * (e < -0.5 ? 0.5 : 1) * (bossCompat(p) >= 80 ? 1.25 : bossCompat(p) < 48 ? 0.8 : 1) : 0), (s, r, d) => {
    const p = s.person;
    p.payMult *= 1.04;
    p.extra.career = Math.min(100, p.extra.career + 6);
    bump(p, { money: 3, learn: 1 });
    // 35歳をこえた昇進は、管理職(部長・課長など)になることがある。
    if (p.age >= 35 && p.occ && p.occ !== "retired" && r() < 0.5) {
      p.prev = { occ: p.occ, job: p.job, payMult: p.payMult };
      // 管理職になっても、給料は、いまの約1.2倍まで(管理職の職種の水準にそのまま合わせると、高くなりすぎる)。
      const before = incomeOf(p, d, p.econ);
      p.occ = "mgmt";
      p.job = "manager";
      applyChangeIncome(p, d, p.econ, before * 1.2);
      bump(p, { health: -2 });
      return "昇進して、課長や部長など、部下をもつ立場になった";
    }
    void d;
    return "昇格して、役職がついた";
  }, 62),
  ev("demotion", (p, e) => (working(p) && p.employment === "regular" && p.age >= 35 ? 0.35 + (e < -0.4 ? 0.5 : 0) + (p.stats.health < 45 ? 0.3 : 0) : 0), (s) => {
    const p = s.person;
    bump(p, { money: -3, bonds: -2, joy: -7 });
    const reason = p.econ < -0.4 ? "不況で会社の業績が悪化し" : p.stats.health < 45 ? "体調不良で、思うように成果が出せず" : recent(p, "conflict", 3) ? "職場でのいざこざが評価に響き" : "ミスが重なり、評価が下がって";
    if (p.occ === "mgmt" && p.prev) {
      p.occ = p.prev.occ;
      p.job = p.prev.job;
      p.payMult = p.prev.payMult * 0.95;
      p.prev = null;
      return `${reason}、降格となり、管理職を外れた`;
    }
    p.payMult *= 0.92;
    return `${reason}、降格となって給料が下がった`;
  }, 62),
  ev("raise", (p, e) => (working(p) && p.employment === "regular" ? 1.4 * (e > 0 ? 1.5 : 0.8) : 0), (s) => (s.person.payMult *= 1.012, "給料が上がった"), 38),
  ev("bonus_cut", (p, e) => (working(p) && p.employment === "regular" && e < -0.4 ? 1.8 : 0), (s) => (bump(s.person, { money: -3 }), "不況で、ボーナスが減らされた"), 45),
  ev("transfer", (p) => (working(p) && p.firm !== "small" && inAge(p, 26, 56) ? 1.0 : 0), (s) => (bump(s.person, { learn: 2, bonds: -1 }), "異動で、新しい部署に移った"), 38),
  ev("overtime", (p) => (working(p) && p.age < 60 ? 1.6 : 0), (s, r) => {
    const p = s.person;
    bump(p, { health: -3, money: 1 });
    mark(p, "overtime");
    return `${pickOne(r, ["人手が足りず", "大きな案件が重なり", "締め切りが迫り", "同僚が辞めた穴を埋めるため"])}、残業の続く日々になった`;
  }, 36),
  ev("conflict", (p) => (working(p) ? 0.8 * clash(bossCompat(p)) : 0), (s, r) => {
    const p = s.person;
    const boss = npcMbti(p, "boss", r);
    const low = compat(p.mbti, boss) < 48;
    bump(p, { bonds: low ? -4 : -3, health: -2, joy: low ? -8 : -6 });
    mark(p, "conflict");
    return `${pickOne(r, [`配属が変わって、${typeCall(boss)}の上司とは${low ? "考え方が合わず" : "うまく呼吸が合わず"}`, "仕事の進め方をめぐって同僚と意見がぶつかり", "手柄の取り合いのような空気に巻き込まれ", "人手不足で余裕がなくなり、職場がぎすぎすして"])}、職場の人間関係に悩んだ`;
  }, 42),
  ev("award", (p) => (working(p) && p.stats.learn > 45 ? 0.7 : 0), (s) => (bump(s.person, { money: 3, learn: 2 }), "仕事の成果が認められ、表彰された"), 55),
  ev("mistake", (p) => (working(p) ? 0.8 : 0), (s) => (bump(s.person, { money: -1, bonds: -1 }), "大きなミスをして、頭を下げることになった"), 42),
  ev("mentor", (p) => (working(p) && inAge(p, 28, 55) ? 1.0 : 0), (s) => (bump(s.person, { learn: 2, bonds: 2 }), "後輩の指導を任された"), 38),
  ev("colleague_left", (p) => (working(p) ? 1.0 : 0), (s, r) => {
    bump(s.person, { bonds: -2 });
    return `${pickOne(r, ["キャリアアップを目指して", "家庭の事情で", "職場の雰囲気に疲れて", "地元に戻ることになって"])}、仲のよかった同僚が、会社を去っていった`;
  }, 35),
  ev("power_harass", (p) => (working(p) && p.age < 60 ? 0.5 * (isT(p.npc?.boss) && isJ(p.npc?.boss) ? 1.8 : p.npc?.boss?.[2] === "F" ? 0.5 : 1) * clash(bossCompat(p)) : 0), (s, r) => {
    const p = s.person;
    const boss = npcMbti(p, "boss", r);
    bump(p, { health: -5, bonds: -3, joy: -10 });
    s.later.push({ age: p.age + 2, event: "異動で環境が変わり、少しずつ持ち直した", weight: 50, delta: { health: 4, bonds: 2 } });
    return `${typeCall(boss)}の上司の、${isT(boss) && isJ(boss) ? "結果だけを求める厳しい言葉" : "きつい言葉"}に追い詰められる日々が続いた`;
  }, 58),
  ev("exam_pass", (p) => (working(p) && inAge(p, 22, 55) && p.lessons.some((l) => l.id === "qualification") ? 0.8 : 0), (s) => (s.person.payMult *= 1.02, bump(s.person, { learn: 4 }), "資格試験に合格した"), 48),

  // ---- 家族 ----
  ev("child_fever", (p) => (p.kids > 0 && p.age < 62 ? 2.0 : 0), (s) => (bump(s.person, { health: -2, bonds: 2 }), `${kidName(s.person)}が熱を出し、看病で眠れない夜が続いた`), 36),
  ev("spouse_fight", (p) => (p.married ? 1.2 * clash(partnerCompat(p)) : 0), (s, r) => {
    const p = s.person;
    bump(p, { bonds: -3 });
    const reason = p.stats.money < 38 ? "家計の不安から" : recent(p, "overtime", 2) ? "仕事の忙しさで会話が減り" : p.kids > 0 ? "子育ての分担をめぐって" : (p.partner?.mbti && p.mbti && p.mbti[3] !== p.partner.mbti[3] && r() < 0.5 ? "予定の立て方のちがいから" : p.partner?.mbti && p.mbti && p.mbti[2] !== p.partner.mbti[2] && r() < 0.5 ? "気持ちの伝え方のちがいから" : pickOne(r, ["ささいな行き違いから", "お互いの疲れがたまり", "将来の考え方のちがいから"]));
    return `${reason}、${partnerCall(p)}とのあいだで、すれ違いが続いた`;
  }, 42),
  ev("spouse_job", (p) => (p.married && p.age < 62 ? 0.5 : 0), (s, r) => {
    bump(s.person, { money: -3 });
    return `${pickOne(r, ["勤め先の業績悪化で", "体調を崩して", "転職をきっかけに", "介護のために"])}、${partnerCall(s.person)}の仕事が変わり、家計がゆれた`;
  }, 42),
  ev("anniversary", (p) => (p.married ? 1.5 : 0), (s) => (money(s, -2), bump(s.person, { bonds: 3 }), `結婚記念日に、${partnerCall(s.person)}と食事に出かけた`), 35),
  ev("sibling_wedding", (p) => (inAge(p, 22, 46) ? 0.8 : 0), (s) => (money(s, -3), bump(s.person, { bonds: 3 }), "きょうだいが結婚し、家族が集まった"), 42),
  ev("grandchild", (p) => (p.kids > 0 && inAge(p, 55, 88) ? 1.0 : 0), (s, r, d) => (bump(s.person, { bonds: 6 }), mark(s.person, "grandchild"), `孫が生まれた(${descendant(r, d)})`), 60),
  // ひ孫: 孫が生まれてから、ある程度の年月がたったあと。
  ev("great_grandchild", (p) => (p.history.grandchild != null && p.age - p.history.grandchild >= 20 && inAge(p, 76, 110) ? 0.6 : 0), (s, r, d) => (bump(s.person, { bonds: 4, joy: 3 }), `ひ孫が生まれた(${descendant(r, d)})`), 58),
  ev("in_laws", (p) => (p.married && inAge(p, 27, 55) ? 0.5 : 0), (s, r) => {
    const p = s.person;
    const inlaw = npcMbti(p, "inlaw", r);
    const c = compat(p.mbti, inlaw);
    if (c >= 80) {
      bump(p, { bonds: 3, joy: 3 });
      return `${typeCall(inlaw)}の義理の家族に、温かく迎えられ、居心地のよい関係が築けた`;
    }
    bump(p, { bonds: c < 48 ? -3 : -1, joy: c < 48 ? -4 : 0 });
    return c < 48 ? `${typeCall(inlaw)}の義理の家族と、考え方が合わず、気をつかう日々が続いた` : "義理の家族との関係に、気をつかう日々が続いた";
  }, 34),
  // 恋人・配偶者のタイプによる、日々のちがい。
  ev("partner_trait", (p) => ((p.partner?.status === "dating" || p.partner?.status === "married") && p.partner.mbti ? 0.9 : 0), (s, r) => {
    const p = s.person;
    const m = p.partner!.mbti!;
    const who = partnerCall(p);
    const c = partnerCompat(p);
    const warm = c >= 62 ? 1 : 0;
    const lines: [string, () => void][] = [
      [isE(m) ? `${who}の誘いで、友人たちを招き、にぎやかな食卓になった` : `${who}と、家で静かに過ごす休日が、心地よかった`, () => bump(p, isE(m) ? { bonds: 3 + warm, joy: 2 } : { joy: 4 + warm, health: 1 })],
      [m[3] === "J" ? `${who}と一緒に、家計と予定を整理した` : `${who}の思いつきで、予定のない小旅行に出かけた`, () => (m[3] === "J" ? bump(p, { money: 2, joy: 1 }) : (money(s, -2), bump(p, { joy: 5, bonds: 2 })))],
      [m[2] === "F" ? `${who}が、話をじっくり聞いてくれて、気持ちが軽くなった` : `${who}の冷静な助言で、悩みごとが整理できた`, () => bump(p, m[2] === "F" ? { joy: 5, bonds: 2 } : { joy: 2, learn: 1, money: 1 })],
      [isN(m) ? `${who}と、将来の夢について、夜遅くまで語り合った` : `${who}と、いまの暮らしを大切にする時間を過ごした`, () => bump(p, isN(m) ? { learn: 1, joy: 3, bonds: 2 } : { joy: 3, health: 1, bonds: 2 })],
    ];
    const [text, fx] = pickOne(r, lines);
    fx();
    return text;
  }, 36),
  // 上司のタイプによる、職場のちがい。
  ev("boss_trait", (p) => (working(p) && p.employment !== "self" && p.age < 62 ? 0.7 : 0), (s, r) => {
    const p = s.person;
    const boss = npcMbti(p, "boss", r);
    const c = compat(p.mbti, boss);
    const call = `${typeCall(boss)}の上司`;
    if (boss[2] === "F") {
      bump(p, { bonds: 3, joy: 4 + (c >= 62 ? 2 : 0) });
      return `${call}が、親身に相談にのってくれ、働きやすい日々が続いた`;
    }
    if (isJ(boss)) {
      bump(p, { learn: 2, health: -1, money: c >= 62 ? 2 : 0 });
      return `${call}に、段取りと期限の大切さを、きびしく教え込まれた`;
    }
    bump(p, { learn: 2, joy: c >= 62 ? 3 : -1 });
    return `${call}が、細かいことは任せてくれて、自分のやり方で仕事を進められた`;
  }, 36),
  // 友人のタイプによる、つきあいのちがい。
  ev("friend_trait", (p) => (inAge(p, 10, 85) ? 0.8 : 0), (s, r, d) => {
    const p = s.person;
    const f = npcMbti(p, "friend", r);
    const call = `${typeCall(f)}の友人の${friendName(p, "friend", r, d)}`;
    if (isE(f)) {
      bump(p, { bonds: 4, joy: 3 });
      return `${call}に誘われ、大勢で集まる楽しい夜を過ごした`;
    }
    if (isN(f)) {
      bump(p, { learn: 2, joy: 2, bonds: 2 });
      return `${call}が、思いもよらなかった考え方を教えてくれた`;
    }
    if (f[2] === "F") {
      bump(p, { joy: 5, bonds: 2 });
      return `${call}が、つらい気持ちを、静かに聞いてくれた`;
    }
    bump(p, { bonds: 2, money: 1 });
    return `${call}が、実務的に、こまごまと助けてくれた`;
  }, 34),
  ev("home_visit", (p) => (inAge(p, 20, 80) && !p.withParents ? 1.0 : 0), (s) => (bump(s.person, { bonds: 3 }), "久しぶりに実家に帰り、家族と食卓を囲んだ"), 32),

  // ---- 友人 ----
  ev("friend_wedding", (p) => (inAge(p, 24, 40) ? 2.4 : 0), (s, r, d) => (money(s, -3), bump(s.person, { bonds: 2 }), `友人の${friendName(s.person, "friend", r, d)}の結婚式に招かれた(ご祝儀3万円)`), 42),
  ev("reunion", (p) => (inAge(p, 25, 75) ? 1.2 : 0), (s) => (bump(s.person, { bonds: 3 }), "同窓会で、懐かしい顔ぶれと再会した"), 38),
  ev("friend_fight", (p) => (inAge(p, 12, 70) ? 0.6 * clash(friendCompat(p)) : 0), (s, r, d) => {
    const friend = npcMbti(s.person, "friend", r);
    bump(s.person, { bonds: -3, joy: -4 });
    return `${pickOne(r, ["ささいな言い違いがきっかけで", "お金の貸し借りがもとで", "価値観のちがいが表に出て", "長く連絡をとらずにいたうちに"])}、親しい${typeCall(friend)}の友人の${friendName(s.person, "friend", r, d)}と、気まずくなってしまった`;
  }, 38),
  ev("friend_passed", (p) => (p.age >= 42 ? 0.8 + (p.age - 42) * 0.03 : 0), (s, r, d) => (bump(s.person, { bonds: -3, health: -1, joy: -6 }), `旧友の${friendName(s.person, "old", r, d)}の訃報が届いた`), 55),
  ev("friend_success", (p) => (inAge(p, 25, 60) ? 0.7 : 0), (s, r, d) => (bump(s.person, { bonds: 1, learn: 1 }), `友人の${friendName(s.person, "friend", r, d)}が、仕事で大きな成功をおさめたと聞いた`), 34),
  ev("neighbor", (p) => (p.age >= 22 ? 0.5 : 0), (s) => (bump(s.person, { bonds: -1 }), "近所づきあいで、小さなトラブルがあった"), 32),

  // ---- 恋愛 ----
  ev("crush", (p) => (!p.married && inAge(p, 16, 45) && (!p.partner || p.partner.status === "ex") ? 1.2 : 0), (s, r, d) => {
    const p = s.person;
    p.partner = randomPartner(r, d, p.age, "crush", p.mbti, p);
    bump(p, { bonds: 2 });
    return `気になる人ができた。${typeCall(p.partner.mbti)}の${fullName(p.partner)}さんのことが、気になりはじめた${p.mbti && p.partner.mbti ? `(相性 ${compatMark(compat(p.mbti, p.partner.mbti))} ${compat(p.mbti, p.partner.mbti)}%)` : ""}`;
  }, 42),
  ev("breakup", () => 0, (s, r) => {
    const p = s.person;
    bump(p, { bonds: -4, joy: -9 });
    mark(p, "breakup");
    const who = p.partner ? `${p.partner.given}さん` : "恋人";
    if (p.partner) p.partner.status = "ex";
    return `${pickOne(r, ["すれ違いが続き", "仕事の忙しさで会えない日が重なり", "価値観のちがいが大きくなり", "遠距離になって、気持ちが離れ", "将来の考え方が合わず"])}、長くつきあった${who}と、別れた`;
  }, 50),
  ev("spouse_cheat", (p) => (p.married && inAge(p, 28, 58) ? 0.28 * clash(partnerCompat(p)) * (isE(p.partner?.mbti) ? 1.3 : 0.85) : 0), (s, r) => {
    const p = s.person;
    bump(p, { bonds: -9, health: -3, money: -2, joy: -18 });
    if (r() < 0.5) {
      s.later.push({ age: p.age + 1, event: "話し合いを重ねたが、離婚を選んだ", weight: 62, delta: { bonds: -4, money: -4 } });
      p.marriageBias = 0.4;
    } else s.later.push({ age: p.age + 1, event: "時間をかけて、関係を立て直そうとした", weight: 50, delta: { bonds: 3 } });
    return `${partnerCall(p)}の浮気が発覚し、家庭が大きく揺れた`;
  }, 66),

  // ---- 事故・事件 ----
  ev("traffic_victim", (p) => (inAge(p, 4, 88) ? 0.22 * rural(p) : 0), (s, r) => {
    bump(s.person, { health: -8, joy: -8 });
    needTreat(s, 2 + r() * 6, "交通事故のけがの治療が必要になった");
    return "交通事故にあい、けがを負って入院した";
  }, 64),
  ev("traffic_offender", (p) => (inAge(p, 18, 82) ? 0.12 * rural(p) : 0), (s, r) => {
    const p = s.person;
    bump(p, { bonds: -2, money: -3 });
    // 多くは自動車保険でまかなわれ、自己負担は、免責額や、等級が下がる分にとどまる。
    money(s, -(5 + r() * 35));
    if (r() < 0.25) s.queue.push("lawsuit");
    return "運転中に事故を起こし、示談金を支払うことになった";
  }, 64),
  ev("burglary", (p) => (p.age >= 18 ? 0.1 : 0), (s, r) => (homeMoney(s, r, -(3 + r() * 10)), bump(s.person, { bonds: -1, health: -1 }), "空き巣に入られ、気持ちが落ち着かない日々が続いた"), 52),
  ev("scam", (p) => (p.age >= 24 ? 0.1 * (p.age >= 65 ? 3 : 1) : 0), (s, r) => {
    if (r() < 0.5) {
      money(s, -(10 + r() * 40));
      bump(s.person, { health: -1, bonds: -2 });
      mark(s.person, "scamVictim");
      return "詐欺にあい、まとまったお金をだましとられた";
    }
    return "詐欺の電話に気づき、事なきを得た";
  }, 56),
  ev("bike_stolen", (p) => (inAge(p, 8, 60) ? 0.5 : 0), (s) => (money(s, -2), "自転車を盗まれた"), 28),

  // ---- 災害・天候 ----
  ev("typhoon", (p) => 0.35 * rural(p), (s, r) => (homeMoney(s, r, -(1 + r() * 4)), "台風で、停電や浸水の被害があった"), 44),
  ev("snowstorm", (p) => (p.region === "rural" || p.region === "local" ? 0.45 : 0.1), (s) => (bump(s.person, { health: -1 }), "記録的な大雪で、暮らしが止まった"), 38),
  ev("quake", () => 0.22, (s, r) => (bump(s.person, { health: -2, bonds: 2 }), homeMoney(s, r, -(1 + r() * 5)), "大きな地震が起き、避難生活を送った"), 62),

  // ---- お金 ----
  ev("windfall", (p) => (p.age >= 18 ? 0.4 : 0), (s, r) => {
    const v = 10 + r() * 40;
    money(s, v);
    return `思いがけず、${man(v)}ほどの臨時収入があった`;
  }, 48),
  // 宝くじの高額当せん(100万円以上): 1枚あたり約5万分の1(3等以上)。毎年、買う人が、数枚〜数十枚ほど買うと仮定して、年に約0.01%。当たるのは、ほとんどが3等(100万円)。
  ev("lottery", (p) => (p.age >= 18 ? 0.0001 : 0), (s, r) => {
    const big = [LOTTERY_PRIZES[0], LOTTERY_PRIZES[1], LOTTERY_PRIZES[2], LOTTERY_PRIZES[3]];
    let x = r() * big.reduce((a, b) => a + b.count, 0);
    let pz = big[3];
    for (const b of big) { if (x < b.count) { pz = b; break; } x -= b.count; }
    money(s, pz.yen / 10000);
    return `宝くじで、${pz.name}が当たった(${man(pz.yen / 10000)})`;
  }, 66),
  ev("appliance", (p) => (p.age >= 20 ? 0.8 : 0), (s, r) => (homeMoney(s, r, -(3 + r() * 8)), "冷蔵庫や洗濯機が壊れて、思わぬ出費になった"), 30),
  ev("debt", (p) => (working(p) && p.stats.money < 32 ? 0.25 : 0), (s, r) => {
    const p = s.person;
    const amt = Math.round((30 + r() * 100) * 10000);
    const bankrupt = p.bankrupt !== null && p.age - (p.bankrupt ?? 0) < 7;
    const lender = bankrupt ? "friend" : "card";
    addDebt(s, lender, amt);
    s.wallet.cash += amt;
    bump(p, { money: -5, health: -2, joy: -9 });
    return lender === "card" ? "生活が苦しく、カードローンに頼って、借金をした" : "生活が苦しく、知人にお金を借りた";
  }, 55),

  // ---- 現実的な災厄(お金が足りなければ、借金になる) ----
  ev("fire", (p) => (p.age >= 20 && !p.history.catastrophe ? 0.02 : 0), (s, r) => {
    // 大きな災害は、一生に一度あるかないか。火災保険で、多くはまかなわれる。自己負担は、家財や仮住まいなどの費用。
    const loss = 10 + r() * 50;
    mark(s.person, "catastrophe");
    homeMoney(s, r, -loss);
    bump(s.person, { joy: -12, health: -2, bonds: 1 });
    return pickOne(r, ["火事で、家の一部が焼けてしまった", "隣家からの火事がうつり、家が焼けてしまった"]);
  }, 68),
  ev("flood", (p) => (p.age >= 8 && !p.history.catastrophe ? 0.03 * rural(p) : 0), (s, r) => {
    mark(s.person, "catastrophe");
    homeMoney(s, r, -(10 + r() * 30));
    bump(s.person, { joy: -6, health: -1 });
    return "豪雨で川があふれ、家が浸水して、家財の多くがだめになった";
  }, 62),
  ev("pandemic", () => 0.12, (s, r) => {
    const p = s.person;
    bump(p, { health: -2, joy: -5, bonds: -2 });
    if (working(p) && (p.occ === "service" || p.occ === "sales")) {
      p.payMult *= 0.94;
      money(s, -(5 + r() * 25));
    }
    return "感染症が広がり、人と会えない日々のなかで、仕事も暮らしも大きく変わった";
  }, 60),
  ev("company_bankrupt", (p, e) => (working(p) && p.sector === "private" && p.employment === "regular" && p.firm === "small" && e < -0.2 ? 0.5 : 0), (s, r) => {
    const p = s.person;
    p.employment = "nonregular";
    p.payMult *= 0.85;
    money(s, -(10 + r() * 30));
    bump(p, { money: -6, joy: -10, bonds: -2 });
    mark(p, "layoff");
    return "勤め先が倒産し、給料の未払いを抱えたまま、職を失った";
  }, 68),
  ev("guarantor", (p) => (inAge(p, 28, 60) ? 0.04 : 0), (s, r) => {
    const loss = 30 + r() * 120;
    money(s, -loss);
    bump(s.person, { bonds: -8, joy: -12 });
    return "友人の借金の連帯保証人になっていて、その肩代わりをすることになった";
  }, 68),
  ev("spouse_passed", (p) => (p.married && p.age >= 45 ? 0.05 + (p.age - 45) * 0.02 : 0), (s) => {
    const p = s.person;
    const who = p.partner ? `${p.partner.given}さん` : "配偶者";
    p.married = false;
    if (p.partner) p.partner.status = "ex";
    bump(p, { bonds: -15, joy: -25, health: -6 });
    return `${who}が亡くなり、ひとりで残された`;
  }, 74),
  ev("child_accident", (p) => (p.kids > 0 && p.age < 60 ? 0.25 : 0), (s, r) => {
    const nm = kidName(s.person);
    money(s, -(10 + r() * 50));
    bump(s.person, { bonds: -1, joy: -8, health: -2 });
    return `${nm}が大けがをして、長い入院になった`;
  }, 62),
  ev("quake_home", (p) => (p.history.catastrophe ? 0 : 0.01), (s, r) => {
    const p = s.person;
    mark(p, "catastrophe");
    homeMoney(s, r, -(80 + r() * 120));
    bump(p, { joy: -15, health: -3, bonds: 2 });
    if (p.owned) p.owned = false;
    return "大地震で自宅が大きく壊れ、住まいを失った";
  }, 72),
  ev("long_unemployed", (p, e) => (working(p) && recent(p, "layoff", 2) && e < -0.5 ? 0.9 : 0), (s, r) => {
    money(s, -(20 + r() * 40));
    bump(s.person, { joy: -8, money: -3 });
    return "なかなか再就職先が決まらず、お金が減っていった";
  }, 56),
  ev("medical_big", (p) => (p.age >= 45 ? 0.15 * hg(p) * 2 : 0), (s, r) => {
    // 高額療養費制度があるため、自己負担には上限がある。差額ベッド代や通院の費用などが重なる。
    needTreat(s, 10 + r() * 40, "大きな病気の治療が必要になった");
    bump(s.person, { health: -3, joy: -6 });
    return "大きな病気の治療費が、かさんだ";
  }, 60),
  ev("gambling", (p) => (inAge(p, 20, 60) && p.stats.joy < 45 ? 0.1 : 0), (s, r) => {
    money(s, -(20 + r() * 100));
    bump(s.person, { bonds: -6, joy: -8 });
    return "ギャンブルにのめり込み、気づけば大きな額を失っていた";
  }, 60),

  // ---- 海外暮らし ----
  ev("abroad_language", (p) => (p.abroad && p.age - p.abroad.since <= 2 ? 2.2 : 0), (s, r) => (bump(s.person, { learn: 1, joy: -3 }), pickOne(r, ["言葉の壁にぶつかり、思うように気持ちが伝わらず、悔しい思いをした", "現地の言葉で電話をかけるのが怖く、役所の手続きに半日かかった"])), 48),
  ev("abroad_homesick", (p) => (p.abroad ? 1.2 : 0), (s) => (bump(s.person, { joy: -5, bonds: -1 }), "日本の味と、家族の声が恋しくなり、ホームシックになった"), 46),
  ev("abroad_friend", (p) => (p.abroad ? 1.3 : 0), (s) => (bump(s.person, { bonds: 4, joy: 4 }), "現地の友人ができ、休日に、街を案内してもらった"), 46),
  ev("abroad_visa", (p) => (p.abroad ? 0.8 : 0), (s) => (money(s, -4), bump(s.person, { joy: -2 }), "ビザの更新の手続きに追われ、書類をそろえる日々が続いた"), 44),
  ev("abroad_cost", (p) => (p.abroad && p.abroad.costFactor > 1.15 ? 1.0 : 0), (s) => (bump(s.person, { money: -2, joy: -2 }), "物価と家賃の高さに、家計をやりくりする日々が続いた"), 44),
  ev("abroad_settle", (p) => (p.abroad && p.age - p.abroad.since >= 4 ? 1.3 : 0), (s) => (bump(s.person, { joy: 4, bonds: 2 }), `異国の暮らしにも慣れ、${s.person.abroad?.city ?? "この街"}が、第二の故郷になってきた`), 48),
  ev("abroad_visit", (p) => (p.abroad ? 0.8 : 0), (s) => (money(s, -15), bump(s.person, { bonds: 4, joy: 5 }), "久しぶりに日本に一時帰国し、家族と食卓を囲んだ"), 46),
  ev("abroad_festival", (p) => (p.abroad ? 0.8 : 0), (s) => (bump(s.person, { joy: 3, learn: 1 }), "現地の祭りに参加し、文化のちがいを楽しんだ"), 40),

  // ---- 趣味・暮らし ----
  ev("trip", (p) => (inAge(p, 16, 80) ? 1.0 : 0), (s) => (money(s, -5), bump(s.person, { bonds: 3 }), "友人たちと旅行に出かけ、いい思い出ができた"), 38),
  ev("concert", (p) => (inAge(p, 14, 70) ? 0.8 : 0), (s) => (money(s, -1), bump(s.person, { health: 1 }), "ライブに行き、日常を忘れる夜を過ごした"), 30),
  ev("book", (p) => (inAge(p, 10, 85) ? 0.8 : 0), (s) => (bump(s.person, { learn: 2 }), "一冊の本に出会い、考え方が少し変わった"), 32),
  ev("move_neighbor", (p) => (inAge(p, 20, 80) ? 0.4 : 0), (s) => (bump(s.person, { bonds: 2 }), "近所に、気の合う人が引っ越してきた"), 30),
];

const pickOne = <T,>(r: () => number, list: T[]): T => list[Math.floor(r() * list.length)];

// ---- 選択を求める出来事 ----
const opt = (id: string, label: string, apply: TurningOption["apply"], extra: Partial<TurningOption> = {}): TurningOption => ({ id, label, apply, ...extra });
const addCash = (p: Person, manYen: number) => {
  p.cashDelta += Math.round(manYen * 10000);
};

// 仕事に戻ったあとの、預け先を選ぶ。
const careQuestion = (p: Person): TurningQuestion => {
  const anyWork = working(p) || partnerWorks(p);
  return {
    title: "仕事のあいだ、子どもをどうする？",
    prompt: "仕事に戻ったあとの、預け先を選びます。預け先で、毎年の費用と、仕事・暮らしへの影響が変わります。",
    options: [
      opt("daycare", "認可保育園に預ける", (q, r) => {
        if (r() < (WAITLIST[q.region] ?? 0.1)) {
          // 入れなかったとき(待機)は、ほかの道に変わる。
          if (parentsAround(q)) { q.childcare = { kind: "grandparents", since: q.age }; bump(q, { bonds: 1, joy: -2 }); q.extra.stress = Math.min(100, q.extra.stress + 5); return "認可保育園に申し込んだが、入れなかった(待機になった)。親に頼って、預けることにした"; }
          q.childcare = { kind: "home_self", since: q.age };
          bump(q, { joy: -3 });
          q.extra.stress = Math.min(100, q.extra.stress + 8);
          return "認可保育園に申し込んだが、入れなかった(待機になった)。仕事を減らして、家で見ることになった";
        }
        q.childcare = { kind: "daycare", since: q.age };
        return "認可保育園に入れた。朝から夕方まで、見てもらえることになった";
      }, { auto: true, show: () => anyWork, detail: (q) => `0〜2歳は月に2〜3万円ほど(世帯の収入で変わる)、3歳からは無償化。ただ、${q.region === "tokyo" ? "東京23区などでは、入れないこと(待機)も、ある(約" + Math.round((WAITLIST.tokyo ?? 0.2) * 100) + "%と仮定)" : q.region === "metro" ? "都市部では、入れないこと(待機)も、ある(約" + Math.round((WAITLIST.metro ?? 0.1) * 100) + "%と仮定)" : "地方では、比較的入りやすい(待機は約" + Math.round((WAITLIST.local ?? 0.05) * 100) + "%と仮定)"}。` }),
      opt("grandparents", "親(祖父母)に預ける", (q) => {
        q.childcare = { kind: "grandparents", since: q.age };
        bump(q, { bonds: 3, joy: 2 });
        return "仕事のあいだは、親に子どもを預けることにした";
      }, { show: (q) => anyWork && parentsAround(q), detail: () => "費用はかからない。親との関係が深まるが、頼りすぎると、親の体への負担や、子育てのやり方での衝突が、起こることもある。" }),
      opt("sitter", "ベビーシッター・認可外保育を使う", (q) => {
        q.childcare = { kind: "sitter", since: q.age };
        q.extra.stress = Math.max(0, q.extra.stress - 2);
        return "ベビーシッターや、認可外の保育を使うことにした";
      }, { show: () => anyWork, detail: () => "時間の融通がきき、気持ちは楽になる。そのぶん、費用が大きい(年に100万円前後)。" }),
      opt("home_self", "自分が、仕事を減らして家で育てる", (q) => {
        q.childcare = { kind: "home_self", since: q.age };
        bump(q, { bonds: 3, joy: 2 });
        q.extra.career = Math.max(0, q.extra.career - 3);
        return "仕事を減らして、自分が家で子どもを育てることにした";
      }, { show: (q) => working(q), detail: () => "子どもとの時間は増えるが、収入が大きく減り(手取りの4割ほど。税や保険料も減るので、額面では、もう少し小さな割合になる)、キャリアにも響く。子どもが小学校に入るころまで、続く。" }),
      opt("home_partner", "パートナーが、家で育てる", (q) => {
        q.childcare = { kind: "home_partner", since: q.age };
        bump(q, { bonds: 2 });
        return `${q.partner ? q.partner.given + "さん" : "パートナー"}が家で、子どもを育てることになった`;
      }, { show: (q) => !!q.partner && q.partner.status !== "ex", detail: () => "自分は仕事に集中できる。世帯の収入は、パートナーの分だけ減る(自分の年収の3.5割ほどと仮定)。" }),
    ],
  };
};

// 留学を終えたあとに行く国の候補(主な国と、人気の留学先から、人ごとに決まる3つ)。
const nextCountryQuestion = (p: Person): TurningQuestion => {
  const seed = [...p.city].reduce((a, c) => a + c.charCodeAt(0), 0) + p.age * 13;
  const hash = (id: string) => [...id].reduce((h, c) => (h * 33 + c.charCodeAt(0) + seed) % 1000003, seed);
  const others = [...STUDY_OTHERS].sort((x, y) => hash(x) - hash(y)).slice(0, 3);
  return {
    title: "どの国へ移る？",
    prompt: "主な国と、人気の国から、いくつか出ています。そこで就労ビザを取って働きます。",
    options: [...STUDY_MAIN, ...others].map((id) => {
      const c = countryById(id)!;
      return {
        id,
        label: `${c.name}(${c.cities.join("・")})`,
        // 渡航・ビザ・住まいの準備にかかる費用。
        cost: () => 50,
        apply: (q: Person, r: () => number, d: CountryData) => (moveAbroad(q, r, d, id), (q.cashDelta -= 500000), q.abroad && (q.abroad.visa = "work"), q.employment = "regular", ""),
        detail: () => `収入の水準は日本の約${Math.round(c.incomeFactor * 100)}%、物価は約${Math.round(c.costFactor * 100)}%。就労ビザは、更新が必要で、認められないこともある。あとで、働く業界と職種を選ぶ。`,
        children: () => industryQuestion({ factor: 1, finish: (q, title) => `${q.city.split("・")[0]}に移り、就労ビザで、${title}として働き始めた` }),
      } as TurningOption;
    }),
  };
};

// 自分で選んで、別の業界へ転職するときの年収。業界の給料の水準のちがいが、かなり効く(未経験の分、少し下がる)。
const selfChange = (p: Person, d: CountryData, econ: number, occ: Occ, id: string, mult: number) => {
  const base = changeIncome(p, d, econ, { occ, id, mult }, p.jobOfferFactor);
  const cur = p.occ && p.occ !== "retired" ? d.income.base[p.occ] : d.income.base.office;
  const level = Math.max(0.65, Math.min(1.35, Math.pow(d.income.base[occ] / cur, 0.6)));
  return { now: base.now, next: base.now * p.jobOfferFactor * level * (p.occ === occ ? 1 : 0.95) };
};

// 宝くじの当せん金と本数は、jp-lottery.ts にある。
const lottery = (p: Person, r: () => number, yen: number) => {
  p.history.lotCount = (p.history.lotCount ?? 0) + 1;
  const n = Math.floor(yen / 300);
  const { win, top } = drawLottery(r, n);
  addCash(p, (win - n * 300) / 10000);
  if (top === "1等") return (bump(p, { joy: 30, money: 40, bonds: -5 }), "宝くじで、1等が当たった。受け取ったのは、数億円。人生が、大きく動きはじめた");
  if (win >= 100000) return (bump(p, { joy: 12, money: 6 }), `宝くじで、${Math.round(win / 10000)}万円が当たった`);
  return (bump(p, { joy: win > n * 300 * 0.5 ? 2 : -1 }), `宝くじを${n}枚買って、${win.toLocaleString("ja-JP")}円が戻ってきた(買った額は${(n * 300).toLocaleString("ja-JP")}円)`);
};

// 出会いの場での、結果。確率は、設計上の仮定(魅力・つながり・外向きで、出会いやすさが変わる)。
type MeetOdds = { friend?: number; love?: number; skill?: number; chance?: number; trouble?: number };
const meetResult = (p: Person, r: () => number, d: CountryData, odds: MeetOdds, where: string): string => {
  const lift = (0.7 + p.extra.charm / 150) * (0.8 + p.stats.bonds / 250) * (isE(p.mbti) ? 1.1 : 1);
  const x = r();
  const e = { friend: (odds.friend ?? 0) * lift, love: p.married ? 0 : (odds.love ?? 0) * lift, skill: odds.skill ?? 0, chance: (odds.chance ?? 0) * (p.occ !== null ? 1 : 0.4), trouble: odds.trouble ?? 0 };
  let acc = 0;
  if (x < (acc += e.love)) {
    if (p.partner?.status === "dating") {
      bump(p, { bonds: 3, joy: 3 });
      return `${where}で、気の合う人と話が弾んだ`;
    }
    p.partner = randomPartner(r, d, p.age, "crush", p.mbti, p);
    bump(p, { bonds: 4, joy: 6 });
    return `${where}で、${p.partner.given}さんと出会い、連絡先を交換した。気になる存在になった`;
  }
  if (x < (acc += e.friend)) {
    npcMbti(p, "friend", r);
    bump(p, { bonds: 6, joy: 4 });
    return `${where}で、気の合う友人ができた。これからも、会う約束をした`;
  }
  if (x < (acc += e.skill)) {
    bump(p, { learn: 6, joy: 2 });
    p.extra.career = Math.min(100, p.extra.career + 3);
    return `${where}で、新しい知識や技を教わり、自分のスキルが一段上がった`;
  }
  if (x < (acc += e.chance)) {
    if (p.occ !== null && p.occ !== "retired") {
      p.payMult *= 1.03;
      p.extra.career = Math.min(100, p.extra.career + 6);
      bump(p, { money: 3, bonds: 3, joy: 3 });
      return `${where}で知り合った人から、仕事を紹介され、収入と実績につながった`;
    }
    bump(p, { bonds: 3, learn: 3 });
    return `${where}で、仕事や進路の、よい話を聞くことができた`;
  }
  if (x < (acc += e.trouble)) {
    addCash(p, -(3 + r() * 12));
    bump(p, { joy: -5, bonds: -2 });
    return `${where}で、お酒や出費で失敗し、いやな思いをした`;
  }
  bump(p, { joy: 1 });
  return `${where}に参加したが、とくに、大きな出会いはなかった`;
};

export const eventQuestions: EventQuestionDef[] = [
  // ---- 引っ越し: 実家暮らし・18歳未満以外は、引っ越すかどうかを、かならず聞く ----
  {
    id: "move_ask",
    weight: () => 0,
    intro: () => "引っ越しの話が出た",
    question: (p) => {
      const offer = p.moveOffer;
      const route = offer ? `${p.city}(${REGION_NAME[p.region]})から、${offer.city}(${REGION_NAME[offer.region]})への引っ越しです。` : "";
      return {
        title: offer ? `引っ越し: ${p.city} → ${offer.city}` : "引っ越し",
        prompt: `${route}${isStudent(p) ? "新しい土地で暮らす話が出ました。いまの学校や友だちとは、はなれることになります。慣れない環境で、ストレスもかかります。" : "仕事や暮らしの事情で、新しい土地へ移る話が出ました。"}`,
        options: [
          opt("move", offer ? `${offer.city}に引っ越す` : "引っ越す", (q, r, d) => {
            const student = isStudent(q);
            const o = q.moveOffer;
            const from = q.city;
            const region = o?.region ?? weighted<Region>(r, d.transition.region[q.region]);
            const city = moveTo(q, r, d, region, o?.city);
            q.moveOffer = null;
            return [`${from}から${city}に引っ越した`, ...(student ? moveAftermath(q, r) : [])].join("。");
          }, { detail: (q) => (q.moveOffer ? `${q.city}を離れ、${q.moveOffer.city}で暮らす。地域が変わるため、仕事・家賃・人間関係も変わる。` : "") }),
          opt("stay", "いまの場所で暮らし続ける", (q) => ((q.moveOffer = null), "引っ越しはせず、いまの暮らしを続けることにした"), { auto: true }),
        ],
      };
    },
  },
  // ---- 政治の世界から、声がかかる(ごくまれ) ----
  {
    id: "political_call",
    weight: (p) => (working(p) && !p.office && inAge(p, 32, 66) && p.stats.bonds >= 45 && p.stats.learn >= 45 && p.intel >= 45 && !p.history.politicalCall ? 0.03 : 0),
    intro: () => "地元の有力者から、選挙に出ないかと声がかかった",
    question: () => ({
      title: "選挙への出馬",
      prompt: "「あなたなら、地域のために働けるはずだ」と、立候補を打診されました。",
      options: [
        opt("run", "立候補する", (p, r, d) => {
          mark(p, "politicalCall");
          const pick = r();
          const id = pick < 0.5 ? "city" : pick < 0.8 ? "pref" : pick < 0.93 ? "lower" : "upper";
          const od = d.offices.find((x) => x.id === id) ?? d.offices[0];
          addCash(p, -od.costMan);
          const chance = Math.min(0.65, od.win * (0.5 + p.intel / 200) * (0.6 + p.stats.bonds / 125) * (0.75 + p.stats.money / 200) * 1.2);
          if (r() < chance) {
            if (!p.prev && p.occ !== null && p.occ !== "retired") p.prev = { occ: p.occ, job: p.job, payMult: p.payMult };
            p.occ = "tech";
            p.job = "politician";
            p.payMult = od.payMult;
            p.employment = "regular";
            p.sector = "public";
            p.office = { id: od.id, since: p.age, terms: 1 };
            bump(p, { bonds: 6, joy: 12, health: -3, learn: 2 });
            addCash(p, od.depositMan);
            return `${od.label}に立候補し、当選した(供託金${od.depositMan}万円は戻り、選挙運動に約${od.campaignMan}万円を使った)`;
          }
          bump(p, { bonds: -2, joy: -9, money: -3 });
          const back = r() < 0.55;
          if (back) addCash(p, od.depositMan);
          return `${od.label}に立候補したが、落選した(選挙運動に約${od.campaignMan}万円を使い、供託金${od.depositMan}万円は${back ? "戻った" : "没収された"})`;
        }, { detail: () => "供託金や選挙運動の費用がかかり、落選すると戻らない。当選すれば、議員になる。" }),
        opt("no", "今の仕事を続ける", (p) => (mark(p, "politicalCall"), "声はかかったが、今の仕事を続けることにした"), { auto: true }),
      ],
    }),
  },
  // ---- 妊娠(女性は18〜40歳、男性は、パートナーの妊娠。交際者と相談して、産むかどうかを決める) ----
  {
    id: "pregnancy",
    weight: (p) => {
      const pt = p.partner;
      if (!pt || (pt.status !== "dating" && pt.status !== "married") || recent(p, "pregnancy", 2)) return 0;
      // 子どもを産める体の人が、二人のどちらかにいるときだけ。(ふたりとも男性の体なら、この出来事は起きない)
      const selfBears = p.sex === "female";
      const partnerBears = (pt.sex ?? (p.sex === "male" ? "female" : "male")) === "female";
      if (!selfBears && !partnerBears) return 0;
      if (p.married && (p.childFree || p.kids >= 3)) return 0;
      const fert = p.age <= 34 ? 1 : p.age <= 40 ? Math.max(0.15, 1 - (p.age - 34) * 0.14) : 0;
      const inRange = selfBears ? inAge(p, 18, 40) : inAge(p, 18, 50);
      return inRange ? (pt.status === "dating" ? 1.2 : 0.3) * fert : 0;
    },
    // 相手の気持ち(賛成・迷い・反対)は、相性・つながり・結婚しているかで、決まる。
    prepare: (s, r) => {
      const p = s.person;
      const c = p.partner && p.partner.mbti && p.mbti ? compat(p.mbti, p.partner.mbti) : 55;
      const support = Math.min(0.9, Math.max(0.1, 0.3 + (c - 50) / 200 + p.stats.bonds / 300 + (p.married ? 0.3 : 0)));
      const x = r();
      p.history.stance = x < support ? 2 : x < support + 0.25 ? 1 : 0;
      p.history.pregnancy = p.age;
      // 産む人: 自分(1)か、相手(0)か。二人とも産める体なら、半々。
      const b = bearerOf(r, p, p.partner ? { ...p.partner, sex: p.partner.sex ?? (p.sex === "male" ? "female" : "male") } : null);
      p.history.bearer = b ?? (p.sex === "female" ? 1 : 0);
    },
    intro: (p) => (p.history.bearer === 1 ? `妊娠していることが、わかった` : `${p.partner ? p.partner.given + "さん" : "パートナー"}から、妊娠したことを、告げられた`),
    question: (p) => {
      const n = p.partner ? `${p.partner.given}さん` : "パートナー";
      const st = p.history.stance ?? 1;
      const female = p.history.bearer === 1;
      const stanceText = st === 2 ? `${n}は、産んで、一緒に育てたいと言っている。` : st === 1 ? `${n}は、気持ちが決まらず、迷っている。` : `${n}は、いまは産むことに、反対している。`;
      return {
        title: female ? "妊娠がわかった" : `${n}の妊娠`,
        prompt: female
          ? `妊娠していることがわかりました。${n}と、話し合いました。${stanceText}産むかどうかは、あなたの体と人生にかかわる、大きな決断です。どうしますか？`
          : `${n}から、妊娠したと告げられました。${stanceText}最終的には、${n}の体と気持ちを、いちばんに考えて決めます。どうしますか？`,
        options: [
          opt("birth", female ? "産む" : "産んでほしい。一緒に育てる", (p, r) => {
            const st = p.history.stance ?? 1;
            const n = p.partner ? `${p.partner.given}さん` : "パートナー";
            p.kids += 1;
            const sex: "boy" | "girl" = r() < 0.5 ? "boy" : "girl";
            p.kidList.push({ name: "", bornAge: p.age, sex });
            if (p.history.bearer === 1) {
              // 出産・育児で、仕事を休む。
              bump(p, { health: -4, joy: 8, bonds: 6 });
              if (p.occ !== null && p.occ !== "retired") { p.payMult *= 0.94; p.extra.career = Math.max(0, p.extra.career - 3); }
            } else bump(p, { joy: 8, bonds: 6, money: -3 });
            p.history.leaveAsk = p.age;
            p.childFree = false;
            const baby = `${sex === "boy" ? "男の子" : "女の子"}が生まれた`;
            if (st === 2 || p.married) {
              if (p.partner && p.partner.status === "dating") { p.proposeAt = p.age; p.marriageBias = Math.max(p.marriageBias, 2); }
              return `${n}と話し合い、産むことにした。${baby}。二人で育てていく覚悟が、決まった`;
            }
            if (st === 1 && r() < 0.7) {
              if (p.partner && p.partner.status === "dating") { p.proposeAt = p.age; p.marriageBias = Math.max(p.marriageBias, 1.6); }
              return `迷っていた${n}も、話し合いの末、受け入れてくれた。${baby}`;
            }
            if (p.partner) p.partner.status = "ex";
            bump(p, { bonds: -4, joy: -4, money: -4 });
            p.extra.stress = Math.min(100, p.extra.stress + 15);
            return `${n}とは、考えが合わず、別れることになった。${baby}。ひとりで、育てていく道を選んだ`;
          }, {
            auto: true,
            detail: (p) => {
              const st = p.history.stance ?? 1;
              return st === 2 ? "二人で育てる意思が、そろっている。お金・時間・体力の負担は大きいが、家族が増える。" : st === 1 ? "相手は迷っている。話し合えば、受け入れてくれることが多いが、そうならないこともある。" : "相手は反対している。別れて、ひとりで育てることになる可能性が高い。";
            },
          }),
          opt("no", female ? "産まない選択をする" : "相手の気持ちを尊重し、産まない選択を受け入れる", (p, r) => {
            const st = p.history.stance ?? 1;
            const n = p.partner ? `${p.partner.given}さん` : "パートナー";
            bump(p, { joy: -8, health: p.history.bearer === 1 ? -4 : 0, bonds: -2 });
            p.extra.stress = Math.min(100, p.extra.stress + 10);
            if (st === 2 && p.partner && r() < 0.4) {
              p.partner.status = "ex";
              return `${n}と、何度も話し合い、産まないことを選んだ。${n}の悲しみは深く、二人の関係は、終わった`;
            }
            return `${n}と、何度も話し合い、産まないことを選んだ。心と体に、大きな負担が残った`;
          }, { detail: () => "心と体への負担が大きい。ひとりで抱えず、パートナーや専門の相談窓口に、支えてもらうことも大切(産む・産まないは、本人の意思が最も尊重される)。" }),
          opt("wait", "もう少し、二人で話し合う", (p, r) => {
            const st = p.history.stance ?? 1;
            const n = p.partner ? `${p.partner.given}さん` : "パートナー";
            bump(p, { bonds: 1, joy: -2 });
            p.extra.stress = Math.min(100, p.extra.stress + 6);
            p.history.stance = Math.min(2, st + (r() < 0.5 ? 1 : 0));
            return `${n}と、時間をかけて話し合った。気持ちが、少しずつ、そろってきた`;
          }, { show: (q) => (q.history.stance ?? 1) < 2, detail: () => "決断までの時間は限られる。話し合うほど、相手の気持ちが変わることもある。" }),
        ],
      };
    },
  },
  // ---- 育休と、子どもの預け先(子どもが生まれたあと) ----
  {
    id: "parental_leave",
    weight: () => 0,
    intro: () => "子どもが生まれて、仕事と育児を、どう分けるかを考えた",
    question: (p) => {
      const pn = p.partner ? `${p.partner.given}さん` : "パートナー";
      const hasPartner = !!p.partner && p.partner.status !== "ex";
      return {
        title: "育児休業と、預け先",
        prompt: hasPartner ? `子どもが生まれて、仕事と育児を、どう分けるかを決めます。まず、育児休業を、だれが取るか。そのあと、仕事に戻ったときの、預け先も選びます。` : "子どもが生まれて、仕事と育児を、どうするかを決めます。まず、育児休業を取るか。そのあと、仕事に戻ったときの、預け先も選びます。",
        options: [
          opt("take", "自分が、育休を長めに取る(約1年)", (p, r, d) => {
            addCash(p, -Math.round(leaveLoss(p, d, p.econ, 12)));
            bump(p, { bonds: 6, joy: 5, health: 1 });
            p.extra.career = Math.max(0, p.extra.career - 2);
            return "育児休業を、1年ほど取り、子どもとの時間を大切にした";
          }, { show: (q) => working(q), detail: (q, env, d) => `休業中は、育児休業給付(賃金の67%、6か月をこえると50%)が出る。給付には所得税も住民税もかからず、休業中は社会保険料も免除されるので、手取りで見た減りは、1年で約${manText(leaveLoss(q, d, q.econ, 12))}万円。取得した人の割合は、令和5年度で、女性約84%・男性約30%(厚生労働省「雇用均等基本調査」)。`, children: (q) => careQuestion(q) }),
          opt("short", "自分が、短く取る(数か月)", (p, r, d) => {
            addCash(p, -Math.round(leaveLoss(p, d, p.econ, 4)));
            bump(p, { bonds: 3, joy: 2 });
            return "育児休業を短く取り、早めに仕事に復帰した";
          }, { show: (q) => working(q), detail: (q, env, d) => `収入とキャリアへの影響は、小さくすむ。給付は税も保険料もかからず、4か月ほどの休業なら、手取りで見た減りは約${manText(leaveLoss(q, d, q.econ, 4))}万円。そのぶん、子どもとの時間は短くなる。`, children: (q) => careQuestion(q) }),
          opt("partner", `${hasPartner ? pn : "パートナー"}が、育休を取る`, (p, r, d) => {
            addCash(p, -Math.round(leaveLoss(p, d, p.econ, 12) * 0.9));
            bump(p, { bonds: 6, joy: 4 });
            p.extra.stress = Math.max(0, p.extra.stress - 3);
            p.extra.career = Math.min(100, p.extra.career + 1);
            return `${pn}が育児休業を取り、子どもを見てくれることになった。自分は、仕事を続けた`;
          }, { show: (q) => !!q.partner && q.partner.status !== "ex" && partnerWorks(q), detail: (q, env, d) => `世帯の収入は、一時的に減る(相手の収入は、自分と同じ程度と仮定すると、手取りで見て約${manText(leaveLoss(q, d, q.econ, 12) * 0.9)}万円。給付は税も保険料もかからない)。自分は仕事に集中でき、二人の関係にも、よい影響がある。`, children: (q) => careQuestion(q) }),
          opt("both", "ふたりで、分けて取る", (p, r, d) => {
            addCash(p, -Math.round(leaveLoss(p, d, p.econ, 6) * 2));
            bump(p, { bonds: 8, joy: 5 });
            p.extra.stress = Math.max(0, p.extra.stress - 2);
            p.extra.career = Math.max(0, p.extra.career - 1);
            return `${pn}と、育児休業を分け合って取り、ふたりで子どもを見ることにした`;
          }, { show: (q) => working(q) && !!q.partner && q.partner.status !== "ex" && partnerWorks(q), detail: (q, env, d) => `どちらの仕事への影響も、小さくすむ。収入は、手取りで見て世帯で約${manText(leaveLoss(q, d, q.econ, 6) * 2)}万円ほど減るが、二人の関係と、子どもとの時間が、増える。`, children: (q) => careQuestion(q) }),
          opt("none", "育休は取らず、働き続ける", (p) => {
            p.extra.stress = Math.min(100, p.extra.stress + 8);
            bump(p, { bonds: -2, health: -1 });
            p.extra.career = Math.min(100, p.extra.career + 1);
            return "育休は取らず、仕事を続けた。育児と仕事の両立で、慌ただしい日々が続く";
          }, { auto: true, show: (q) => working(q), detail: () => "収入とキャリアは守れるが、体力とパートナーとの関係に、負担がかかる。", children: (q) => careQuestion(q) }),
          // 自分が働いていないとき(パートナーが働いている)は、預け先だけを選ぶ。
          opt("care_only", "預け先を決める", () => "仕事に戻るときの、子どもの預け先を考えた", { auto: true, show: (q) => !working(q), detail: () => "パートナーが働いている間の、子どもの預け先を選びます。", children: (q) => careQuestion(q) }),
        ],
      };
    },
  },
  // 3歳になったときの、預け先(幼稚園・保育園・こども園)。
  {
    id: "kid_three",
    weight: () => 0,
    intro: () => "子どもが3歳になり、通う場所を考えた",
    question: (p) => ({
      title: "3歳からの、通い先",
      prompt: "子どもが3歳になりました。3歳から5歳の幼稚園・保育園・こども園は、利用料が無償になります(給食費や行事の費用などは別にかかります)。どこに通わせますか？",
      options: [
        opt("kindergarten", "幼稚園(預かり保育あり)", (p) => {
          p.childcare = { kind: "kindergarten", since: p.age };
          bump(p, { joy: 2 });
          return "幼稚園に通わせることにした。昼すぎに帰ってくるので、預かり保育も使うことになった";
        }, { detail: (q) => `午前から昼すぎまで。預かり保育で、夕方まで預けられることが多い。ふたりとも働いていると、送り迎えと時間のやりくりが大変になる。費用は、年に15〜18万円ほど。` }),
        opt("daycare", "認可保育園(そのまま・切りかえ)", (p) => {
          p.childcare = { kind: "daycare", since: p.age };
          return "保育園に、通わせ続けることにした。朝から夕方まで見てもらえて、仕事との両立がしやすい";
        }, { auto: true, detail: () => "朝から夕方まで。仕事との両立がしやすい。費用は、給食費などで、年に8万円ほど。" }),
        opt("kodomoen", "認定こども園", (p) => {
          p.childcare = { kind: "kodomoen", since: p.age };
          bump(p, { joy: 1 });
          return "認定こども園に通わせることにした。幼稚園と保育園の、よいところを合わせた場所だ";
        }, { detail: () => "幼稚園と保育園の、両方の役割を持つ。働いていても、いなくても、通える。費用は、年に12万円ほど。" }),
        opt("keep", "いまの預け先を、続ける", () => "預け先は、いまのまま、続けることにした", { show: (q) => !!q.childcare && q.childcare.kind !== "daycare" && q.childcare.kind !== "kindergarten" && q.childcare.kind !== "kodomoen", detail: () => "親や、シッターなどに、これまでどおり、見てもらう。" }),
      ],
    }),
  },
  // ---- 出会いの場(「活動する」から、自分で出かける) ----
  {
    id: "meet_party",
    weight: () => 0,
    intro: () => "飲み会・交流会に、顔を出した",
    question: (p) => ({
      title: "飲み会・交流会",
      prompt: "にぎやかな会場で、知らない人も多い。どう過ごしますか？",
      options: [
        opt("talk", "積極的に、いろいろな人に話しかける", (p, r, d) => meetResult(p, r, d, { friend: 0.4, love: 0.25, chance: 0.2, trouble: 0.1 }, "飲み会"), { detail: () => "出会いも、チャンスも、広がりやすい。飲みすぎて、失敗することも。" }),
        opt("one", "気になった人と、じっくり話す", (p, r, d) => meetResult(p, r, d, { friend: 0.25, love: 0.45, chance: 0.1, trouble: 0.05 }, "飲み会"), { show: (q) => !q.married, detail: () => "恋人候補に出会いやすい。" }),
        opt("listen", "聞き役に回って、早めに帰る", (p) => (bump(p, { bonds: 1, health: 1 }), "聞き役に回り、早めに帰って、ゆっくり休んだ"), { auto: true }),
      ],
    }),
  },
  {
    id: "meet_study",
    weight: () => 0,
    intro: () => "勉強会・セミナーに、参加した",
    question: () => ({
      title: "勉強会・セミナー",
      prompt: "同じ分野に関心のある人たちが集まっています。",
      options: [
        opt("ask", "積極的に質問し、講師や参加者と話す", (p, r, d) => meetResult(p, r, d, { skill: 0.5, chance: 0.3, friend: 0.15, love: 0.05 }, "勉強会"), { detail: () => "学びが深まり、仕事のチャンスにつながりやすい。" }),
        opt("cards", "名刺を交換して、人脈を広げる", (p, r, d) => meetResult(p, r, d, { chance: 0.45, friend: 0.3, skill: 0.15, love: 0.05 }, "勉強会"), { show: (q) => q.occ !== null, detail: () => "仕事の紹介や、転職の話が出ることも。" }),
        opt("note", "話を聞いて、メモをとって帰る", (p) => (bump(p, { learn: 3 }), (p.extra.career = Math.min(100, p.extra.career + 1)), "勉強会で、じっくり学んで帰った"), { auto: true }),
      ],
    }),
  },
  {
    id: "meet_circle",
    weight: () => 0,
    intro: () => "趣味やスポーツのサークルに、顔を出した",
    question: () => ({
      title: "サークル・仲間の集まり",
      prompt: "共通の趣味を持つ人たちの集まりです。",
      options: [
        opt("join", "輪に入って、一緒に楽しむ", (p, r, d) => meetResult(p, r, d, { friend: 0.5, love: 0.2, skill: 0.15 }, "サークル"), { detail: () => "気の合う仲間ができやすい。" }),
        opt("close", "気になる人と、仲良くなる", (p, r, d) => meetResult(p, r, d, { friend: 0.25, love: 0.4, skill: 0.1 }, "サークル"), { show: (q) => !q.married, detail: () => "恋人候補に出会いやすい。" }),
        opt("watch", "見学だけして、帰る", (p) => (bump(p, { joy: 1 }), "見学だけして、帰った"), { auto: true }),
      ],
    }),
  },
  {
    id: "meet_app",
    weight: () => 0,
    intro: () => "マッチングアプリで、会うことになった",
    question: () => ({
      title: "マッチングアプリ",
      prompt: "何人かとやりとりして、会う約束ができました。",
      options: [
        opt("meet", "実際に、会ってみる", (p, r, d) => meetResult(p, r, d, { love: 0.5, friend: 0.15, trouble: 0.15 }, "マッチングアプリ"), { detail: () => "いい出会いもあれば、がっかりすることも、だまされることもある。" }),
        opt("careful", "メッセージで、様子を見る", (p, r, d) => meetResult(p, r, d, { love: 0.2, friend: 0.1, trouble: 0.03 }, "マッチングアプリ"), { detail: () => "安全だが、進展はゆっくり。" }),
        opt("stop", "今日は、やめておく", (p) => "アプリを閉じて、今日は、やめておいた", { auto: true }),
      ],
    }),
  },
  {
    id: "meet_pet",
    weight: () => 0,
    intro: () => "保護犬・保護猫の譲渡会に、足を運んだ",
    question: (p) => ({
      title: "保護犬・保護猫の譲渡会",
      prompt: "家族を探している動物たちが、並んでいます。",
      options: [
        opt("dog", "保護犬を、家族に迎える", (p) => (p.pets.push({ name: "", kind: "犬", adoptedAge: p.age }), bump(p, { health: 3, bonds: 4, joy: 4 }), "保護犬を、家族に迎えた"), { show: (q) => q.pets.filter((x) => !x.died).length < 3, cost: () => 3, detail: () => "毎日の散歩で、健康になる。費用がかかり、世話も大変。(譲渡の費用 約3万円)" }),
        opt("cat", "保護猫を、家族に迎える", (p) => (p.pets.push({ name: "", kind: "猫", adoptedAge: p.age }), bump(p, { bonds: 4, joy: 4 }), "保護猫を、家族に迎えた"), { show: (q) => q.pets.filter((x) => !x.died).length < 3, cost: () => 3, detail: () => "気ままな同居人。(譲渡の費用 約3万円)" }),
        opt("help", "預かりボランティアの仲間に、加わる", (p, r, d) => meetResult(p, r, d, { friend: 0.6, love: 0.1 }, "ボランティア"), { detail: () => "動物好きの仲間ができる。" }),
        opt("look", "見学だけして、帰る", (p) => (bump(p, { joy: 2 }), "動物たちと触れ合い、心がなごんだ"), { auto: true }),
      ],
    }),
  },
  {
    id: "meet_local",
    weight: () => 0,
    intro: () => "地域のイベントに、参加した",
    question: () => ({
      title: "地域のイベント・ボランティア",
      prompt: "近所の人や、同じ思いの人たちが、集まっています。",
      options: [
        opt("help", "運営を手伝い、人と話す", (p, r, d) => meetResult(p, r, d, { friend: 0.5, love: 0.12, chance: 0.12, skill: 0.1 }, "地域のイベント"), { detail: () => "地域に、顔見知りが増える。" }),
        opt("fun", "客として楽しむ", (p) => (bump(p, { joy: 3, bonds: 1 }), "地域のイベントを、のんびり楽しんだ"), { auto: true }),
      ],
    }),
  },
  // ---- 遺産の使い方 ----
  {
    id: "inherit_use",
    weight: () => 0,
    intro: (p) => `${p.inheritMan}万円ほどの遺産の、使い道を考えた`,
    question: (p) => {
      const v = p.inheritMan;
      const young = p.kidList.some((k) => p.age - k.bornAge < 18);
      return {
        title: "遺産の使い方",
        prompt: `親から、${v}万円ほどを受け継ぎました。どう使いますか？`,
        options: [
          opt("save", "そのまま、貯金にする", (p) => (addCash(p, p.inheritMan), (p.inheritMan = 0), `受け継いだ${v}万円は、貯金にした`), { auto: true, detail: () => "いつでも使える。増えはしないが、減りもしない。" }),
          opt("stocks", "株・投資信託で運用する(日本株インデックス)", (p) => ((p.nisaYen += p.inheritMan * 10000), (p.inheritMan = 0), bump(p, { money: 3 }), `受け継いだ${v}万円を、株(日本株インデックス)で運用することにした`), { show: (p) => p.age >= 18, detail: () => "長い目では増えやすいが、値下がりすることもある(株価は架空)。運用は「資産」の株の欄から、続けられる。" }),
          opt("split", "半分は貯金、半分は株で運用する", (p) => (addCash(p, p.inheritMan / 2), (p.nisaYen += (p.inheritMan / 2) * 10000), (p.inheritMan = 0), bump(p, { money: 2 }), `受け継いだ${v}万円の半分を貯金、半分を株で運用することにした`), { show: (p) => p.age >= 18, detail: () => "値動きの影響を、半分におさえる。" }),
          opt("kid", "子どもの将来のために積み立てる(こどもNISA)", (p) => ((p.kidFundYen += p.inheritMan * 10000), (p.inheritMan = 0), bump(p, { bonds: 4, joy: 2 }), `受け継いだ${v}万円を、子どもの将来のために、積み立てることにした`), { show: (q) => young && yearOf(q) >= SINCE.kidsNisa, detail: () => "子どもが18歳になるとき、新しい道のために使われる。" }),
          opt("loan", "借金やローンの返済にあてる", (p) => (addCash(p, p.inheritMan), (p.inheritMan = 0), bump(p, { money: 4, joy: 3 }), `受け継いだ${v}万円を、借金やローンの返済にあてることにした`), { show: () => p.owned || p.stats.money < 35, detail: () => "毎年の返済の負担が軽くなる。" }),
          opt("memorial", "供養やお墓に一部を使い、残りは貯金にする", (p) => (addCash(p, p.inheritMan * 0.9), (p.inheritMan = 0), bump(p, { bonds: 4, joy: 3 }), "親の供養やお墓に一部を使い、残りは貯金にした"), { detail: () => "約1割を、供養やお墓にあてる。心が落ち着く。" }),
          opt("self", "旅や学びなど、自分のために使う", (p) => (addCash(p, p.inheritMan * 0.4), (p.inheritMan = 0), bump(p, { joy: 8, learn: 3, health: 1 }), "受け継いだお金の一部で、旅や学びに出かけた"), { detail: () => "約6割を使い、残りは貯金にする。" }),
        ],
      };
    },
  },
  // ---- 宝くじ(人生で、0〜2回) ----
  {
    id: "lottery",
    weight: (p) => (inAge(p, 20, 75) && (p.history.lotCount ?? 0) < 2 ? 0.25 : 0),
    intro: () => "宝くじ売り場の前を通りかかり、足が止まった",
    question: () => ({
      title: "宝くじを買う？",
      prompt: "年末ジャンボなどの宝くじが売り出されています。当たれば大きいが、戻ってくるお金は、買った額の半分ほどです。",
      options: [
        opt("small", "少しだけ買う(3千円)", (p, r) => lottery(p, r, 3000)),
        opt("big", "まとめて買う(3万円)", (p, r) => lottery(p, r, 30000), { cost: () => 3 }),
        opt("no", "買わない", (p) => (p.history.lotCount = (p.history.lotCount ?? 0) + 1, "宝くじは買わず、通り過ぎた"), { auto: true }),
      ],
    }),
  },
  // ---- 誘惑: ギャンブル・タバコ・お酒(幸福度が低いと起きやすい。人生で、0〜2回) ----
  {
    id: "tempt",
    weight: (p) => (inAge(p, 20, 70) && !p.habit && (p.history.addictCount ?? 0) < 2 && p.stats.joy < 62 ? 1.0 * (1 + (62 - p.stats.joy) / 12) : 0),
    prepare: (s, r) => {
      const p = s.person;
      const w = { gamble: 3 * (p.sex === "male" ? 1.3 : 0.8), smoke: p.age < 45 ? 2 : 0.5, drink: 3 };
      const t = r() * (w.gamble + w.smoke + w.drink);
      p.temptKind = t < w.gamble ? "gamble" : t < w.gamble + w.smoke ? "smoke" : "drink";
    },
    intro: (p) => ({ gamble: "満たされない気持ちから、ギャンブルの誘いが気になった", smoke: "気持ちを紛らわせたくて、タバコに手が伸びた", drink: "つらさをまぎらわせたくて、お酒の量が増えた" })[p.temptKind],
    question: (p) => {
      const k = p.temptKind;
      const label = { gamble: "ギャンブル(パチンコ・競馬・ネット賭博など)", smoke: "タバコ", drink: "お酒" }[k];
      const hint = { gamble: "のめり込むと、お金・信用・人間関係を失い、借金を抱えることもある。", smoke: "体に悪く、毎年の出費もかさむ。やめるのは、むずかしい。", drink: "飲みすぎると、体をこわし、人間関係にも響く。" }[k];
      return {
        title: `${label}との付き合い方`,
        prompt: `心が晴れない日が続くなか、${label}が、気晴らしになることに気づきました。どうしますか？(${hint})`,
        options: [
          opt("deep", "気晴らしに、のめり込む", (p) => {
            p.history.addictCount = (p.history.addictCount ?? 0) + 1;
            p.habit = { kind: p.temptKind, since: p.age };
            bump(p, { joy: 6 });
            return `${label}にのめり込むようになった。やめられない日々が、はじまった`;
          }, { detail: () => "一時の気晴らしにはなるが、毎年、お金・健康・つながりをむしばむ。数年おきに、やめるかどうかを選べる。" }),
          opt("some", "ほどほどに、つきあう", (p) => {
            p.history.addictCount = (p.history.addictCount ?? 0) + 1;
            bump(p, { joy: 3, health: -1 });
            return `${label}は、ほどほどにとどめることにした`;
          }, { detail: () => "気晴らしは得られるが、習慣にはならない。" }),
          opt("no", "手を出さない", (p) => {
            p.history.addictCount = (p.history.addictCount ?? 0) + 1;
            bump(p, { bonds: 1 });
            return `誘惑をふりきり、${label}には手を出さなかった`;
          }, { auto: true }),
        ],
      };
    },
  },
  // ---- 習慣をやめるか ----
  {
    id: "habit_quit",
    weight: () => 0,
    intro: (p) => `${({ gamble: "ギャンブル", smoke: "タバコ", drink: "お酒" })[p.habit?.kind ?? "gamble"]}をやめるべきか、考える日が増えた`,
    question: (p) => {
      const label = { gamble: "ギャンブル", smoke: "タバコ", drink: "お酒" }[p.habit?.kind ?? "gamble"];
      return {
        title: `${label}を、やめますか`,
        prompt: `${label}を続けて${p.habit ? p.age - p.habit.since : 0}年。体や暮らしへの影響が、見えてきました。`,
        options: [
          opt("quit", "専門の相談や通院で、本気でやめる", (p, r) => {
            const kind = p.habit?.kind;
            addCash(p, -5);
            if (r() < 0.5 + p.stats.bonds / 250) {
              p.habit = null;
              bump(p, { joy: 6, health: 3, bonds: 3 });
              p.extra.stress = Math.max(0, p.extra.stress - 8);
              return `専門の支えを受けて、${kind === "gamble" ? "ギャンブル" : kind === "smoke" ? "タバコ" : "お酒"}をやめることができた`;
            }
            bump(p, { joy: -3 });
            return "やめようと努めたが、ぶり返してしまった";
          }, { cost: () => 5, detail: (p) => `費用は約5万円。成功する確率は、約${Math.round((0.5 + p.stats.bonds / 250) * 100)}%(つながりが強いほど高い)。` }),
          opt("cut", "量をへらして、様子を見る", (p, r) => {
            if (r() < 0.25) {
              p.habit = null;
              bump(p, { joy: 3, health: 1 });
              return "少しずつ量をへらし、いつのまにか、やめられていた";
            }
            return "量をへらそうとしたが、あまり変わらなかった";
          }, { detail: () => "やめられる確率は低い。" }),
          opt("keep", "このまま、続ける", (p) => (bump(p, { joy: -1 }), "やめられないまま、日々が過ぎた"), { auto: true }),
        ],
      };
    },
  },
  // ---- 交際: 同棲するか ----
  {
    id: "cohabit",
    weight: () => 0,
    intro: (p) => `${p.partner ? p.partner.given + "さん" : "恋人"}と、一緒に暮らさないかという話になった`,
    question: (p) => ({
      title: "同棲するか？",
      prompt: `${p.partner ? fullName(p.partner) + "さん" : "恋人"}と、付き合って${Math.max(1, p.age - (p.history.datingSince ?? p.age))}年。一緒に暮らしますか？`,
      options: [
        opt("yes", "一緒に暮らす", (p) => (mark(p, "cohab"), (p.history.cohab = p.age), (p.withParents = false), bump(p, { bonds: 6, joy: 4, money: 2 }), `${p.partner ? p.partner.given + "さん" : "恋人"}との同棲をはじめた。二人で暮らすぶん、家賃や生活費が、わけあえる`), { auto: true, detail: () => "毎日を一緒に過ごせる。生活費をわけあえるが、相性が悪いと、ぶつかることもふえる。" }),
        opt("later", "もう少し、今の距離のままで", (p) => (bump(p, { bonds: 1 }), "同棲は見送り、今の距離を、大事にすることにした"), { auto: true }),
        opt("marry", "同棲より先に、結婚を考える", (p) => ((p.proposeAt = p.age), (p.marriageBias = Math.max(p.marriageBias, 1.8)), bump(p, { bonds: 4, joy: 2 }), "同棲より先に、結婚を考えたいと、伝えた"), { detail: () => "結婚の話が、近いうちに出やすくなる。" }),
      ],
    }),
  },
  // ---- 住まいを失ったとき ----
  {
    id: "homeless_help",
    weight: () => 0,
    intro: () => "住まいを失い、これからどうするかを、考えた",
    question: () => ({
      title: "住まいを失って",
      prompt: "夜をしのぐ場所もない状態です。どうしますか？",
      options: [
        opt("office", "自治体の窓口に相談する(生活困窮者の支援・生活保護)", (p, r) => (r() < 0.85 ? ((p.housingKind = null), bump(p, { joy: 6, health: 3, bonds: 2 }), "自治体の窓口に相談し、住まいと生活の支援が受けられた") : (bump(p, { joy: -2 }), "窓口に相談したが、手続きが進まず、住まいは、まだ見つからなかった")), { auto: true, detail: () => "支援が受けられることが多い。手続きに時間がかかることもある。" }),
        opt("friend", "友人や親戚を頼る", (p, r) => (r() < 0.35 + p.stats.bonds / 150 ? ((p.housingKind = "lodging"), bump(p, { bonds: -2, joy: 4 }), "友人の家に身を寄せることができた") : (bump(p, { bonds: -3 }), "頼れる人は、見つからなかった")), { auto: true, detail: (p) => `つながりが強いほど、受け入れてもらいやすい(約${Math.round(Math.min(0.9, 0.35 + p.stats.bonds / 150) * 100)}%)。` }),
        opt("work", "寮つきの仕事を探す", (p, r, d) => (r() < 0.5 ? (assignJob(p, "logistics", r, d), (p.employment = "nonregular"), (p.housingKind = "dorm"), bump(p, { joy: 5, money: 3 }), "寮つきの仕事が見つかり、住む場所と収入を得た") : (bump(p, { health: -3, joy: -4 }), "寮つきの仕事を探したが、見つからなかった")), { auto: true, detail: () => "うまくいけば、住まいと収入を同時に得られる(約5割)。" }),
        opt("self", "このまま、なんとか自力でしのぐ", (p) => (bump(p, { health: -3, joy: -3 }), "助けは求めず、なんとか日々をしのいだ"), { auto: true }),
      ],
    }),
  },
  // ---- 治療を受けるか ----
  {
    id: "treat",
    weight: () => 0,
    intro: (p) => p.treatLabel || "体の不調で、治療が必要になった",
    question: (p) => ({
      title: "治療を受けますか",
      prompt: `${p.treatLabel || "治療が必要です。"}どうしますか？${p.history.medIns ? "(医療保険に入っているので、自己負担は軽くなります)" : ""}`,
      options: [
        opt("full", "しっかり治療を受ける", (p) => (addCash(p, -p.treatMan), bump(p, { health: 4, money: -1 }), `しっかり治療を受け、体を立て直した(費用 約${p.treatMan}万円)`), { cost: (p) => p.treatMan, detail: (p) => `費用は約${p.treatMan}万円。体は、きちんと回復する。` }),
        opt("light", "通院や薬など、最低限の治療にとどめる", (p) => (addCash(p, -Math.max(1, Math.round(p.treatMan * 0.4))), bump(p, { health: 0, money: -1 }), "最低限の治療にとどめ、様子を見ることにした"), { cost: (p) => Math.max(1, Math.round(p.treatMan * 0.4)), detail: (p) => `費用は約${Math.max(1, Math.round(p.treatMan * 0.4))}万円。回復は、ゆっくりになる。` }),
        opt("none", "治療は受けない(様子を見る)", (p, r) => (bump(p, { health: -6, joy: -3 }), r() < 0.25 ? (bump(p, { health: -6 }), "治療を受けずにいたら、症状が悪化してしまった") : "治療は受けず、そのまま様子を見ることにした"), { auto: true, detail: () => "お金はかからない。体の状態は、悪くなることがある。" }),
      ],
    }),
  },
  // ---- 恋愛: 告白される ----
  {
    id: "asked_out",
    weight: (p) => (!p.married && inAge(p, 15, 42) && p.partner?.status !== "dating" && !recent(p, "askedOut", 4) ? 0.9 * (0.6 + p.extra.charm / 100) : 0),
    prepare: (s, r, d) => {
      const p = s.person;
      if (!p.partner || p.partner.status === "ex") p.partner = randomPartner(r, d, p.age, "crush", p.mbti, p);
    },
    intro: (p) => (p.partner ? `${fullName(p.partner)}さんから、付き合ってほしいと言われた` : "だれかに、付き合ってほしいと言われた"),
    question: (p) => ({
      title: p.partner ? `${fullName(p.partner)}さんからの告白` : "告白された",
      prompt: p.partner ? `${fullName(p.partner)}さんは、${typeCall(p.partner.mbti) || "どんな人か、まだよくわからない"}。${p.mbti && p.partner.mbti ? `あなたとの相性は${compatMark(partnerCompat(p))} ${partnerCompat(p)}%。` : ""}付き合いますか？` : "付き合いますか？",
      options: [
        opt("yes", "付き合う", (p) => (mark(p, "askedOut"), p.partner && (p.partner.status = "dating"), (p.marriageBias *= 1.6), bump(p, { bonds: 6, joy: 5 }), `${p.partner ? p.partner.given + "さん" : "その人"}と、付き合いはじめた`), { auto: true, detail: (p) => "毎日が、にぎやかになる。ただ、相性しだいで、別れることもある。" }),
        opt("friend", "友人としてなら", (p) => (mark(p, "askedOut"), p.partner && (p.partner.status = "crush"), bump(p, { bonds: 2 }), "友人として、これからもつきあうことにした"), { auto: true }),
        opt("no", "断る", (p) => (mark(p, "askedOut"), p.partner && (p.partner.status = "ex"), bump(p, { bonds: -1 }), "気持ちに応えられないと、はっきり伝えた"), { auto: true }),
      ],
    }),
  },
  // ---- 趣味を増やすか(人生で一度) ----
  {
    id: "hobby_offer",
    weight: (p) => (inAge(p, 18, 62) && !p.history.hobbyOffer && p.lessons.length < MAX_LESSONS ? 0.8 : 0),
    intro: () => "毎日に、もう一つ、楽しみがほしいと思った",
    question: () => ({
      title: "趣味を増やしますか",
      prompt: "新しい趣味をはじめるなら、どれにしますか？(習い事と趣味は、あわせて5つまで。あとで、習い事・趣味の欄からも、増やせます)",
      options: [
        ["hiking", "登山・ハイキング"], ["fishing", "釣り"], ["camp", "キャンプ"], ["reading", "読書・映画"], ["gardening", "園芸・家庭菜園"], ["running", "ランニング"], ["games", "ゲーム・ボードゲーム"], ["travel_club", "旅行・街歩き"],
      ].map(([id, label]) =>
        opt(id, `${label}をはじめる`, (p, r, d) => {
          mark(p, "hobbyOffer");
          if (p.lessons.length < 5 && !p.lessons.some((l) => l.id === id)) p.lessons.push({ id, since: p.age });
          const def = d.lessons.find((l) => l.id === id);
          return (bump(p, { joy: 4 }), `新しい趣味に、${label}をはじめた${def ? `(年に約${def.costMan}万円)` : ""}`);
        }, { show: (p) => p.lessons.length < MAX_LESSONS && !p.lessons.some((l) => l.id === id) }),
      ).concat([opt("skip", "今は、増やさない", (p) => (mark(p, "hobbyOffer"), "趣味は増やさず、今の毎日を大事にすることにした"), { auto: true })]),
    }),
  },
  // ---- NISAを始めるか(人生で一度) ----
  {
    id: "nisa_offer",
    weight: (p) => (inAge(p, 22, 58) && yearOf(p) >= SINCE.nisa && !p.history.nisaOffer && p.occ !== null && p.occ !== "retired" ? 0.7 : 0),
    intro: () => "職場や友人との話で、NISAのことが話題になった",
    question: () => ({
      title: "NISAを始めますか",
      prompt: "NISAは、投資の利益に税金がかからない制度です。株価は変動するので、減ることもあります。(このサイトの株価は、すべて架空です)",
      options: [
        ...[["small", 12, "年12万円(月1万円)"], ["mid", 36, "年36万円(月3万円)"], ["big", 120, "年120万円(月10万円)"]].map(([id, man, label]) =>
          opt(id as string, `NISAを始める(${label}を積み立てる)`, (p) => (mark(p, "nisaOffer"), addCash(p, -(man as number)), (p.nisaYen += (man as number) * 10000), bump(p, { money: 2 }), `NISAを始め、${label}の積み立てをはじめた`), { cost: () => man as number, detail: () => `今年は${man}万円を積み立てる。以後は「資産」の欄の株から、増やせる。` })),
        opt("skip", "今は、始めない", (p) => (mark(p, "nisaOffer"), "NISAは、見送ることにした"), { auto: true }),
      ],
    }),
  },
  // ---- 定年・体調による退職(定年を過ぎて働いている人に、エンジンが、高い確率でもちかける) ----
  {
    id: "work_end",
    weight: () => 0,
    intro: (p) => (p.stats.health < 45 || p.sick ? "体調のことを考えて、仕事を続けるかどうかを、決めるときが来た" : "定年を迎え、仕事の区切りを考えるときが来た"),
    question: (p) => {
      const frail = p.stats.health < 45 || p.sick;
      return {
        title: frail ? "体調と、仕事" : "定年のとき",
        prompt: frail ? "体がきつくなってきました。この先も、いまの仕事を、続けますか？" : "定年を迎えました。この先の仕事を、どうしますか？",
        options: [
          opt("retire", "定年で、仕事を退く", (q) => ((q.occ = "retired"), (q.parttime = null), bump(q, { joy: -1, health: 2 }), "定年を迎え、長年の仕事を退いた"), { auto: true, show: (q) => !(q.stats.health < 45 || q.sick), detail: () => "給料はなくなり、年金や貯金が中心の暮らしになる。時間はたっぷりできる。" }),
          opt("retire_health", "体調を優先して、退職する", (q) => ((q.occ = "retired"), (q.parttime = null), bump(q, { health: 5, joy: -2 }), "体調のことを考えて、仕事を退いた"), { auto: true, show: (q) => q.stats.health < 45 || !!q.sick, detail: () => "無理をしない暮らしになる。収入は、年金や貯金が中心になる。" }),
          opt("rehire", "再雇用・嘱託で、もう少し働く", (q) => ((q.payMult *= 0.6), (q.workLong = true), bump(q, { money: 2, health: -1, bonds: 1 }), "再雇用で、もうしばらく、働くことにした"), { show: (q) => q.age < 80 && !(q.stats.health < 45 || q.sick), detail: () => "収入は、これまでの6割ほどに下がる。体力の続くかぎり、働ける。" }),
          opt("push", "無理をしてでも、働きつづける", (q) => (bump(q, { health: -7, joy: -2, money: 2 }), "体にむち打って、働きつづけることにした"), { show: (q) => q.age < 80 && (q.stats.health < 45 || !!q.sick), detail: () => "収入は続くが、体への負担が大きい。また、退職をせまられることがある。" }),
        ],
      };
    },
  },
  // ---- 人生の後半(50代から晩年)の選択 ----
  {
    id: "retire_life",
    weight: (p) => (p.occ === "retired" && inAge(p, 60, 76) && !recent(p, "retireLife", 30) ? 1.4 : 0),
    intro: () => "仕事を退いた毎日を、どう過ごすかを考えた",
    question: () => ({
      title: "退職後の毎日",
      prompt: "時間がたっぷりできました。これからの毎日を、どう過ごしますか？",
      options: [
        opt("rest", "のんびり休み、暮らしを整える", (p) => (mark(p, "retireLife"), bump(p, { health: 4, joy: 4 }), "のんびり休みながら、暮らしを整えることにした"), { auto: true, detail: () => "体と心に、ゆとりができる。収入は年金だけになる。" }),
        opt("volunteer", "地域の活動やボランティアに参加する", (p) => (mark(p, "retireLife"), bump(p, { bonds: 8, joy: 4 }), "地域の活動に参加し、新しい仲間ができた"), { detail: () => "人とのつながりが、広がる。費用は、ほとんどかからない。" }),
        opt("learn", "大学の公開講座などで、学び直す", (p) => (mark(p, "retireLife"), addCash(p, -5), bump(p, { learn: 8, joy: 4, bonds: 2 }), "公開講座に通い、学ぶ楽しさを思い出した"), { cost: () => 5, detail: () => "年に約5万円。頭と心が、若返る。" }),
        opt("parttime", "パートやシルバー人材で、少し働く", (p) => (mark(p, "retireLife"), addCash(p, 90), bump(p, { money: 3, health: -1, bonds: 3 }), "パートで少し働き、収入と張り合いを得た"), { detail: () => "年に約90万円の収入。体への負担は、少しある。" }),
        opt("travel", "貯金を使って、旅に出る", (p) => (mark(p, "retireLife"), addCash(p, -80), bump(p, { joy: 10, bonds: 3, health: 2, money: -2 }), "友人や家族と、ゆっくり旅をして回った"), { cost: () => 80, detail: () => "約80万円。思い出と、元気が増える。" }),
      ],
    }),
  },
  {
    id: "grandchild_role",
    weight: (p) => (p.kidList.length > 0 && inAge(p, 58, 82) && !recent(p, "grandRole", 10) ? 0.6 : 0),
    intro: () => "孫との関わり方を、考えた",
    question: () => ({
      title: "孫との関わり",
      prompt: "孫と、どんなふうに関わっていきますか？",
      options: [
        opt("care", "進んで、孫の世話をする", (p) => (mark(p, "grandRole"), bump(p, { bonds: 8, joy: 6, health: -2 }), "孫の世話を、進んで引き受けることにした"), { detail: () => "にぎやかで、張り合いが出る。体力は使う。" }),
        opt("fit", "ほどよい距離で、見守る", (p) => (mark(p, "grandRole"), bump(p, { bonds: 4, joy: 3 }), "ほどよい距離で、孫を見守ることにした"), { auto: true, detail: () => "自分の時間も、守れる。" }),
        opt("far", "離れて、手紙や電話で見守る", (p) => (mark(p, "grandRole"), bump(p, { bonds: 1, joy: 1 }), "離れた場所から、孫を見守ることにした"), { detail: () => "気楽だが、会う機会は、減る。" }),
      ],
    }),
  },
  {
    id: "remarry",
    weight: (p) => (!p.married && inAge(p, 55, 80) && !p.stayingSingle && !recent(p, "remarry", 12) ? 0.35 : 0),
    intro: () => "これからの、ひとりの暮らしについて、考えた",
    question: () => ({
      title: "これからの、パートナー",
      prompt: "これからの人生を、ひとりで歩くか、だれかと歩むか、考えます。",
      options: [
        opt("meet", "新しい出会いを探し、パートナーをもつ", (p, r, d) => {
          mark(p, "remarry");
          if (r() < 0.55) {
            p.partner = randomPartner(r, d, p.age, "dating", p.mbti, p);
            bump(p, { bonds: 8, joy: 8 });
            return `${fullName(p.partner)}さんと出会い、これからを、ともに歩むことになった`;
          }
          bump(p, { bonds: -1, joy: -2 });
          return "新しい出会いを探したが、なかなか巡り会えなかった";
        }, { detail: () => "出会えるかは、運しだい(約55%)。出会えれば、毎日が、あたたかくなる。" }),
        opt("alone", "ひとりの暮らしを、大切にする", (p) => (mark(p, "remarry"), bump(p, { joy: 2, health: 1 }), "ひとりの暮らしを、大切にすることにした"), { auto: true, detail: () => "自分のペースで暮らせる。友人や家族とのつながりが、支えになる。" }),
      ],
    }),
  },
  {
    id: "license",
    weight: (p) => (inAge(p, 70, 88) && !recent(p, "license", 20) ? 0.5 : 0),
    intro: () => "運転を、これからも続けるかを、考えた",
    question: () => ({
      title: "運転免許",
      prompt: "年齢とともに、反応が鈍くなってきました。運転を、どうしますか？",
      options: [
        opt("return", "免許を、返納する", (p) => (mark(p, "license"), bump(p, { health: 1, bonds: -2, joy: -2 }), "免許を返納し、公共交通や家族の車に頼ることにした"), { auto: true, detail: () => "事故の心配は、なくなる。出かける自由は、少し減る。" }),
        opt("keep", "もうしばらく、運転を続ける", (p, r) => {
          mark(p, "license");
          if (r() < 0.12) {
            bump(p, { health: -6, joy: -8, bonds: -3 });
            addCash(p, -30);
            return "運転を続けたが、事故を起こしてしまい、免許を返納することになった";
          }
          bump(p, { joy: 3 });
          return "もうしばらく、運転を続けることにした";
        }, { detail: () => "自由は保てる。年に約12%の確率で、事故を起こす。" }),
      ],
    }),
  },
  {
    id: "will",
    weight: (p) => (inAge(p, 65, 88) && !recent(p, "will", 15) ? 0.6 : 0),
    intro: () => "人生の整理(終活)を、考えはじめた",
    question: () => ({
      title: "人生の整理(終活)",
      prompt: "これまでのものや、財産を、どう整理しておきますか？",
      options: [
        opt("will", "遺言を書き、身のまわりを整える", (p) => (mark(p, "will"), addCash(p, -10), bump(p, { joy: 3, bonds: 3 }), "遺言を書き、身のまわりを整理した"), { cost: () => 10, auto: true, detail: () => "約10万円。家族の負担が、軽くなる。気持ちも、すっきりする。" }),
        opt("gift", "家族に、生前に財産を分ける", (p) => (mark(p, "will"), addCash(p, -200), bump(p, { bonds: 8, joy: 4, money: -3 }), "家族に、生前に財産を分け、感謝された"), { cost: () => 200, show: (p) => p.kids > 0, detail: () => "約200万円。家族との絆は、深まる。自分の老後の資金は、減る。" }),
        opt("donate", "お世話になった団体に、寄付する", (p) => (mark(p, "will"), addCash(p, -100), bump(p, { bonds: 4, joy: 6 }), "お世話になった団体に、寄付をした"), { cost: () => 100, detail: () => "約100万円。社会に、お返しできる。" }),
        opt("none", "何もせず、いまの暮らしを続ける", (p) => (mark(p, "will"), "整理は、まだ先でよいと考えた"), { detail: () => "気楽だが、あとで、家族が困ることもある。" }),
      ],
    }),
  },
  {
    id: "treatment",
    weight: (p) => (inAge(p, 72, 90) && p.stats.health < 55 && !recent(p, "treatment", 6) ? 0.9 : 0),
    intro: () => "体の衰えから、これからの医療について、考えた",
    question: () => ({
      title: "これからの医療",
      prompt: "体の衰えと、どう向き合いますか？",
      options: [
        opt("active", "積極的に、治療を受ける", (p) => (mark(p, "treatment"), addCash(p, -20), bump(p, { health: 8, joy: -2, money: -2 }), "積極的に治療を受け、体調を立て直そうとした"), { cost: () => 20, detail: () => "約20万円。体の調子は上向くが、通院や入院の負担がある。" }),
        opt("calm", "穏やかに、自分らしく過ごす", (p) => (mark(p, "treatment"), bump(p, { joy: 6, health: -3 }), "無理な治療は選ばず、穏やかに過ごすことにした"), { auto: true, detail: () => "心は、おだやかになる。体の衰えは、早まることもある。" }),
        opt("talk", "家族と話し合い、方針を決める", (p) => (mark(p, "treatment"), bump(p, { bonds: 6, joy: 3, health: 2 }), "家族と話し合い、これからの方針を決めた"), { detail: () => "家族との絆が、深まる。納得感がある。" }),
      ],
    }),
  },
  {
    id: "facility",
    weight: (p) => (inAge(p, 76, 90) && p.stats.health < 45 && !recent(p, "facility", 8) ? 0.8 : 0),
    intro: () => "これからの暮らしの場所を、考えた",
    question: () => ({
      title: "これからの暮らしの場所",
      prompt: "体が思うように動かなくなってきました。どこで暮らしますか？",
      options: [
        opt("home", "住み慣れた家で、暮らし続ける", (p) => (mark(p, "facility"), bump(p, { joy: 4, health: -3 }), "住み慣れた家で、暮らし続けることにした"), { auto: true, detail: () => "安心感はある。体の負担や、家族の介護の負担が、増える。" }),
        opt("kids", "子どもの家で、いっしょに暮らす", (p) => (mark(p, "facility"), bump(p, { bonds: 8, joy: 3, health: 2 }), "子どもの家で、いっしょに暮らし始めた"), { show: (p) => p.kids > 0, detail: () => "家族のそばで、安心できる。気をつかうこともある。" }),
        opt("facility", "介護つきの施設に入る", (p) => (mark(p, "facility"), addCash(p, -150), bump(p, { health: 6, joy: -2, money: -3 }), "介護つきの施設に入り、手厚い世話を受けることになった"), { cost: () => 150, detail: () => "入居に約150万円。専門の介護が受けられ、体は守られる。" }),
      ],
    }),
  },
  {
    id: "last_place",
    weight: (p) => (inAge(p, 80, 90) && !recent(p, "lastPlace", 20) ? 0.4 : 0),
    intro: () => "人生の最期を、どこで迎えたいかを、考えた",
    question: () => ({
      title: "最期の迎え方",
      prompt: "人生の最期を、どこで迎えたいですか？",
      options: [
        opt("home", "住み慣れた家で、迎えたい", (p) => (mark(p, "lastPlace"), bump(p, { joy: 6, bonds: 4 }), "最期は、住み慣れた家で迎えたいと、家族に伝えた"), { auto: true, detail: () => "家族や在宅の医療に、支えてもらうことになる。" }),
        opt("hospital", "病院や施設で、迎えたい", (p) => (mark(p, "lastPlace"), bump(p, { health: 3, joy: 1 }), "最期は、病院や施設で迎えたいと、家族に伝えた"), { detail: () => "家族の負担は、軽くなる。" }),
        opt("undecided", "まだ決めない", (p) => (mark(p, "lastPlace"), ""), { detail: () => "考えが変わるまで、決めずにおく。" }),
      ],
    }),
  },
  {
    id: "study_end",
    weight: () => 0,
    intro: () => "留学を終えた",
    question: (p) => ({
      title: "留学を終えて、どうする？",
      prompt: `${p.abroad?.country ?? "現地"}での留学を終えました。これからの道を、選びます。`,
      options: [
        opt("stay", "現地で就職して、残る", () => "", {
          detail: () => "ビザや国籍の手続きが必要になる。どの在留資格を取るかも、次に選べる。",
          children: (): TurningQuestion => ({
            title: "在留資格は、どうする？",
            prompt: "現地で、働きながら暮らし続けるための、在留資格を選びます。",
            options: [
              {
                id: "work",
                label: "就労ビザで働く",
                auto: true,
                apply: () => "",
                detail: () => "手続きは、いちばん手軽。ただし、更新が必要で、毎年約4%の確率で、更新が認められず、帰国することになる。あとで、働く業界と職種を選ぶ。",
                children: () => industryQuestion({ factor: 1, finish: (q, title) => (q.abroad && (q.abroad.visa = "work"), (q.employment = "regular"), `現地の会社に就職した。${title}として、就労ビザで働き始めた`) }),
              },
              {
                id: "perm",
                label: "永住権をめざして、働く",
                apply: () => "",
                detail: () => "永住権が認められるまで、約5年。それまでは、就労ビザと同じで、更新が認められないおそれもある。認められれば、更新を気にしなくてよくなる。あとで、働く業界と職種を選ぶ。",
                children: () => industryQuestion({
                  factor: 1,
                  finish: (q, title) => {
                    if (q.abroad) {
                      q.abroad.visa = "work";
                      q.abroad.permAt = q.age + 5;
                    }
                    q.employment = "regular";
                    bump(q, { joy: 1 });
                    return `現地の会社に就職した。${title}として働きながら、永住権をめざすことにした`;
                  },
                }),
              },
              {
                id: "citizen",
                label: "現地の国籍を取得する",
                apply: () => "",
                detail: () => "ビザの心配が、なくなる。国によっては、日本国籍を手放す必要がある。日本の家族と離れた感覚が、強まることもある。あとで、働く業界と職種を選ぶ。",
                children: () => industryQuestion({
                  factor: 1,
                  finish: (q, title) => {
                    if (q.abroad) q.abroad.visa = "citizen";
                    q.employment = "regular";
                    bump(q, { bonds: -3, joy: 2, money: 2 });
                    return `現地の国籍を取得して、${title}として働きはじめた(国によっては、日本国籍を手放すことになる)`;
                  },
                }),
              },
            ],
          }),
        }),
        opt("move", "別の国へ移る", () => "", { detail: () => "別の国で、新しい暮らしと仕事を探す。", children: nextCountryQuestion }),
        opt("home", "日本に帰国して、職を探す", (q, r, d) => {
          moveHome(q, r, d);
          bump(q, { bonds: 4, joy: 2 });
          return "日本に帰国した。これから、職を探す";
        }, { auto: true, detail: () => "家族や友人のそばで、あらためて、仕事を探す。海外で学んだことが、強みになることもある。" }),
        opt("more", "現地の大学院に進む(さらに2年)", (q) => {
          if (q.abroad) {
            q.abroad.study = { until: q.age + 2, kind: "grad" };
            q.abroad.visa = "student";
          }
          q.cashDelta -= 300 * 10000;
          bump(q, { learn: 8 });
          return "現地の大学院に進み、さらに2年、学ぶことにした(費用は約300万円)";
        }, { show: (q) => q.edu === "univ", cost: () => 300, detail: () => "専門性が高まり、現地での就職にも強くなる。費用は約300万円。" }),
      ],
    }),
  },
  {
    id: "job_change",
    weight: () => 0,
    intro: () => "転職の話が出た",
    question: (p) => {
      const job = jobById(p.jobOfferJob);
      const label = job?.title ?? (p.jobOffer ? OCC_LABEL[p.jobOffer] : "別の仕事");
      return {
        title: "転職するか？",
        prompt: `「${label}」への転職の話が出ています。`,
        options: [
          opt("move", `${label}に転職する`, (p, r, d) => {
            const occ = p.jobOffer ?? "office";
            const id = p.jobOfferJob ?? undefined;
            const factor = p.jobOfferFactor;
            const jobDef = jobById(id);
            const target = changeIncome(p, d, p.econ, { occ, id: jobDef?.id ?? "", mult: jobDef?.mult ?? p.payMult }, factor).next;
            p.jobOffer = null;
            p.jobOfferJob = null;
            p.jobOfferFactor = 1;
            const title = assignJob(p, occ, r, d, id);
            // 転職後の年収は、前の年収に、倍率をかけたもの。
            applyChangeIncome(p, d, p.econ, target);
            // 慣れるまでは、学ぶことが多く、人間関係は、いったんリセットされる。
            bump(p, { learn: 3, bonds: -2, joy: -1 });
            return `${title}に転職した`;
          }, {
            auto: true,
            detail: (p, env, data) => {
              const j = jobById(p.jobOfferJob);
              const { now, next } = changeIncome(p, data, env.econ, { occ: p.jobOffer ?? "office", id: j?.id ?? "", mult: j?.mult ?? p.payMult }, p.jobOfferFactor);
              const a = round10(now);
              const b = round10(next);
              const diff = b - a;
              const rate = Math.round((p.jobOfferFactor - 1) * 100);
              return `年収の目安: いま約${a}万円 → 転職後 約${b}万円(${diff >= 0 ? "+" : "-"}${Math.abs(diff)}万円)。前の職との比べ方は、厚生労働省「雇用動向調査」(令和6年)で、転職した人の約40.5%が賃金が増え、約29.4%が減った、という分布から決めています(今回は ${rate === 0 ? "変わらず" : `${rate > 0 ? "+" : ""}${rate}%`})。学び+3、つながり-2、幸福度-1(慣れるまで)。${j ? j.note : ""}`;
            },
          }),
          // 話が来た職種以外にも、自分で、業界と職種を選んで、転職できる(未経験の業界も)。
          {
            id: "other",
            label: "別の業界・職種を、自分で選んで転職する",
            apply: () => "",
            detail: () => "業界を選び、その中の職種を選ぶ。未経験の業界では、年収が下がりやすい(前の職との比べ方は、いまの話と同じ割合で決まる)。",
            children: (p0) => ({
              title: "どの業界へ？",
              prompt: "転職したい業界を選んでください。",
              options: (Object.keys(OCC_LABEL) as Occ[])
                .filter((o) => o !== "mgmt" && o !== p0.occ)
                .map((o) => ({
                  id: o,
                  label: OCC_LABEL[o],
                  apply: () => "",
                  children: () => ({
                    title: `${OCC_LABEL[o]}の、どの職種へ？`,
                    prompt: "職種を選んでください(資格が必要な職種は、ここには出ません)。",
                    options: allJobs.filter((j) => j.occ === o && !j.qual).map((j) => ({
                      id: j.id,
                      label: j.title,
                      apply: (p: Person, r: () => number, d: CountryData) => {
                        const target = selfChange(p, d, p.econ, o, j.id, j.mult).next;
                        p.jobOffer = null;
                        p.jobOfferJob = null;
                        p.jobOfferFactor = 1;
                        const title = assignJob(p, o, r, d, j.id);
                        applyChangeIncome(p, d, p.econ, target);
                        bump(p, { learn: 4, bonds: -3, joy: -2 });
                        return `${title}へ、自分で選んで転職した`;
                      },
                      detail: (p: Person, env: { econ: number }, data: CountryData) => {
                        const { now, next } = selfChange(p, data, env.econ, o, j.id, j.mult);
                        const x = round10(now);
                        const y = round10(next);
                        return `年収の目安: いま約${x}万円 → 転職後 約${y}万円(${y - x >= 0 ? "+" : "-"}${Math.abs(y - x)}万円)。${j.note}`;
                      },
                    })),
                  }),
                })),
            }),
          },
          opt("stay", "いまの仕事を続ける", (p) => {
            p.jobOffer = null;
            p.jobOfferJob = null;
            bump(p, { joy: 1 });
            return "転職は見送り、いまの仕事を続けることにした";
          }, { detail: (p, env, data) => `年収の目安: いまの約${round10(incomeOf(p, data, env.econ))}万円のまま。幸福度+1。慣れた環境で、安定して働き続けられる。` }),
        ],
      };
    },
  },
  {
    id: "marry",
    weight: () => 0,
    intro: () => "結婚の話が出た",
    question: (p) => ({
      title: "結婚するか？",
      prompt: `${p.partner ? p.partner.family + p.partner.given + "さん" : "お相手"}${p.partner?.mbti ? `(${typeCall(p.partner.mbti)}${p.mbti ? `・あなたとの相性 ${compatMark(partnerCompat(p))} ${partnerCompat(p)}%` : ""})` : ""}と、結婚の話が出ました。`,
      options: [
        opt("yes", "結婚する", (p) => {
          p.married = true;
          p.withParents = false;
          if (p.partner) p.partner.status = "married";
          bump(p, { bonds: 6, joy: 8 });
          return `${p.partner ? fullName(p.partner) + "さん" : "お相手"}と結婚した`;
        }, { auto: true, detail: () => "家計が一つになり、支え合える。そのぶん、生活や自由は変わる。" }),
        opt("wait", "いまはまだ、結婚しない", (p) => {
          p.marriageBias *= 0.7;
          bump(p, { bonds: -1 });
          return "結婚の話は、もう少し先に延ばすことにした";
        }, { detail: () => "関係は続くが、話が自然に流れてしまうこともある。" }),
        opt("single", "結婚せず、ひとりで生きていく", (p) => {
          p.stayingSingle = true;
          if (p.partner) p.partner.status = "ex";
          bump(p, { bonds: -4, joy: -2, health: 1 });
          return "結婚せず、ひとりで生きていくことに決めた";
        }, { detail: () => "自由と気ままさを守れる。老後は、自分で備える必要がある。" }),
      ],
    }),
  },
  {
    id: "divorce_ask",
    // 夫婦の関係が冷えているほど、起きやすい(相性・つながり・年数)。一度聞かれたら、5年はあける。
    weight: (p) => (p.married && p.partner && inAge(p, 24, 66) && !(p.history.divorceAsk !== undefined && p.age - p.history.divorceAsk < 5) ? 0.35 * clash(partnerCompat(p)) * (p.stats.bonds < 35 ? 2.4 : p.stats.bonds < 55 ? 1.2 : 0.3) : 0),
    intro: (p) => `${p.partner ? p.partner.given + "さん" : "パートナー"}との関係を、見つめ直す日が増えた`,
    question: (p) => ({
      title: "離婚するか？",
      prompt: `${p.partner ? p.partner.family + p.partner.given + "さん" : "パートナー"}との暮らしが、すれ違いの多いものになっていきました。${p.kids > 0 ? `子ども(${p.kids}人)のことも、頭をよぎります。` : ""}これから先を、どう考えるだろう。`,
      options: [
        opt("stay", "話し合って、やり直す", (p, r) => {
          mark(p, "divorceAsk");
          if (r() < 0.6) return (bump(p, { bonds: 6, joy: 3 }), "時間をかけて話し合い、夫婦の関係を立て直した");
          bump(p, { bonds: -2, joy: -3 });
          return "話し合いを重ねたが、溝は、すぐには埋まらなかった";
        }, { auto: true, detail: () => "うまくいけば、絆は深まる。うまくいかないと、気まずさが続く。" }),
        opt("apart", "しばらく、距離を置く", (p) => {
          mark(p, "divorceAsk");
          bump(p, { bonds: -3, joy: -1, money: -1 });
          return "しばらく、距離を置いて、気持ちを整理することにした";
        }, { detail: () => "冷静に考える時間が持てる。そのあいだ、関係は宙に浮いたままになる。" }),
        opt("divorce", "離婚する", (p) => {
          mark(p, "divorceAsk");
          const who = p.partner ? `${p.partner.given}さんと` : "";
          p.married = false;
          p.marriageBias = 0.4;
          if (p.partner) p.partner.status = "ex";
          addCash(p, -60);
          bump(p, { bonds: -7, joy: -6, money: -4, health: -2 });
          return `${who}離婚した${p.kids > 0 ? "。子どものことは、話し合って決めた" : ""}`;
        }, { detail: (p) => `財産分与や手続きで、約60万円がかかる${p.kids > 0 ? "(子どもがいる場合は、養育費の取り決めも必要)" : ""}。気持ちは重くなるが、新しい暮らしを始められる。` }),
      ],
    }),
  },
  {
    id: "pm_disaster",
    weight: () => 0,
    intro: (p) => `${DISASTERS[p.age % DISASTERS.length]}への対応を、迫られた`,
    question: (p) => ({
      title: "災害への対応",
      prompt: `${DISASTERS[p.age % DISASTERS.length]}が起き、多くの人が被害を受けています。総理大臣として、どう動くだろう。対応しだいで、国民の信用が大きく動きます。`,
      options: [
        opt("lead", "自ら現地に入り、先頭に立って対応する", (p, r) => {
          const ok = r() < 0.55 + p.intel / 400 + p.stats.bonds / 400 + (p.extra.trust >= 70 ? 0.08 : 0);
          p.extra.stress = Math.min(100, p.extra.stress + 6);
          if (ok) {
            p.extra.trust = Math.min(100, p.extra.trust + 9);
            bump(p, { bonds: 3, health: -3, joy: 2 });
            return "災害の現場に自ら入り、迅速に支援をまとめた。対応は高く評価され、国民の信用が高まった";
          }
          p.extra.trust = Math.max(0, p.extra.trust - 6);
          bump(p, { health: -3, joy: -4 });
          return "先頭に立って対応したが、混乱が広がり、判断の遅れを批判された";
        }, { auto: true, detail: () => "うまくいけば、信用が大きく上がる。体への負担が大きく、失敗すれば批判を浴びる。" }),
        opt("delegate", "担当大臣に任せ、官邸から指揮をとる", (p, r) => {
          const ok = r() < 0.45 + p.intel / 500;
          if (ok) {
            p.extra.trust = Math.min(100, p.extra.trust + 3);
            return "担当大臣に権限を委ね、官邸から全体を指揮した。大きな混乱はなく、対応は堅実だと受け止められた";
          }
          p.extra.trust = Math.max(0, p.extra.trust - 8);
          bump(p, { joy: -3 });
          return "現場への指示が行き届かず、対応が後手に回ったと、厳しい批判を受けた";
        }, { detail: () => "安定した対応になりやすいが、現場から遠いと見られると、信用を失う。" }),
        opt("later", "ほかの政策を優先し、対応を後回しにする", (p, r) => {
          p.extra.trust = Math.max(0, p.extra.trust - 20);
          bump(p, { bonds: -4, joy: -6 });
          if (r() < 0.35 && p.office?.rank === "pm") {
            p.office.rank = "former_pm";
            return "災害への対応の遅れで、世論の批判が一気に高まり、内閣は総辞職に追いこまれた";
          }
          return "災害への対応を後回しにし、国民の信用を大きく失った";
        }, { detail: () => "信用が大きく下がる。退陣に追いこまれることもある。" }),
      ],
    }),
  },
  {
    id: "athlete_sport",
    weight: () => 0,
    intro: () => "選手として、どの競技に打ちこむかを決めるときが来た",
    question: () => ({
      title: "競技を選ぶ",
      prompt: "選手として、どの競技に打ちこむだろう。選んだ競技で、大会やオリンピックをめざします。",
      options: SPORTS.map((sp) => opt(sp.id, `${sp.label}(${sp.season === "summer" ? "夏季" : "冬季"}オリンピック競技)`, (p) => {
        p.sport = sp.id;
        p.extra.career = Math.max(p.extra.career, 40);
        bump(p, { health: 2, joy: 3 });
        return `${sp.label}の選手として、本格的に打ちこむことにした`;
      }, { detail: () => sp.note })),
    }),
  },
  {
    id: "athlete_meet",
    weight: () => 0,
    intro: (p) => `${sportById(p.sport)?.label ?? "競技"}の大会に、出場する機会があった`,
    question: (p) => ({
      title: "大会に出るか",
      prompt: `${sportById(p.sport)?.label ?? "競技"}の大会です。いまの実績は${Math.round(p.extra.career)}、健康は${Math.round(p.stats.health)}。健康が高いほど勝ちやすく、勝てば実績を積めます。`,
      options: [
        ...MEETS.map((m) => opt(m.id, `${m.label}に出る`, (q, r) => {
          const win = r() < meetWinChance(q, m);
          const place = !win && r() < 0.3;
          const name = sportById(q.sport)?.label ?? "競技";
          if (win) {
            q.extra.career = Math.min(100, q.extra.career + m.gain);
            q.extra.charm = Math.min(100, q.extra.charm + 2);
            bump(q, { joy: 8, bonds: 3, health: -1 });
            return `${name}の${m.label}で優勝した。実績が大きく伸びた`;
          }
          if (place) {
            q.extra.career = Math.min(100, q.extra.career + Math.round(m.gain / 3));
            bump(q, { joy: 2, health: -1 });
            return `${name}の${m.label}で、上位に入った`;
          }
          q.extra.career = Math.min(100, q.extra.career + 1);
          bump(q, { joy: -2, health: r() < 0.12 ? -6 : -1 });
          return `${name}の${m.label}に出たが、勝てなかった`;
        }, {
          show: (q) => q.extra.career >= m.minCareer,
          detail: (q) => `${m.field}。優勝できる目安は、約${Math.round(meetWinChance(q, m) * 100)}%(健康・実績・魅力で変わる)。${m.note}`,
        })),
        opt("rest", "今年は、練習と休養に専念する", (q) => (bump(q, { health: 4, joy: 1 }), (q.extra.stress = Math.max(0, q.extra.stress - 4)), "今年は大会を見送り、練習と体づくりに専念した"), { auto: true, detail: () => "体を休められる。実績は、あまり伸びない。" }),
      ],
    }),
  },
  {
    id: "athlete_olympic",
    weight: () => 0,
    intro: (p) => `${sportById(p.sport)?.season === "winter" ? "冬季" : "夏季"}オリンピックの代表に、選ばれた`,
    question: (p) => ({
      title: "オリンピックに出場するか",
      prompt: `実績が90をこえ、${sportById(p.sport)?.label ?? "競技"}の日本代表に選ばれました。4年に一度の舞台です。実績・魅力・信用・健康が高いほど、メダルを狙えます。`,
      options: [
        opt("go", "オリンピックに出場する", (q, r) => {
          const name = sportById(q.sport)?.label ?? "競技";
          const res = olympicResult(q, r);
          q.medals ??= { gold: 0, silver: 0, bronze: 0 };
          q.history.olympic = q.age;
          if (res === "gold" || res === "silver" || res === "bronze") {
            q.medals[res] += 1;
            if (res === "gold") q.history.olympicGold = q.age;
            q.extra.charm = Math.min(100, q.extra.charm + (res === "gold" ? 12 : 7));
            q.extra.trust = Math.min(100, q.extra.trust + 5);
            q.extra.career = 100;
            bump(q, { joy: res === "gold" ? 25 : 16, bonds: 6, money: res === "gold" ? 10 : 5, health: -2 });
            const label = { gold: "金", silver: "銀", bronze: "銅" }[res];
            return `オリンピックの${name}で、${label}メダルを獲得した`;
          }
          if (res === "finalist") {
            q.extra.career = Math.min(100, q.extra.career + 2);
            bump(q, { joy: 4, bonds: 2 });
            return `オリンピックの${name}に出場し、入賞(8位以内)を果たした`;
          }
          bump(q, { joy: -3 });
          return `オリンピックの${name}に出場したが、入賞には届かなかった`;
        }, { auto: true, detail: (q) => `メダルの目安は、約${Math.round(Math.min(0.55, 0.105 * (0.5 + Math.max(0, athleteScore(q) - 0.5) * 3.2) * (0.2 + (q.stats.health / 100) * 1.4) * 0.85) * 100)}%。(実数: 東京2020は583人で58個、パリ2024は409人で45個のメダル)` }),
        opt("skip", "辞退して、休養する", (q) => (bump(q, { health: 3 }), (q.history.olympic = q.age), "オリンピックの代表を辞退し、体を休めた"), { detail: () => "メダルは狙えないが、体は休まる。" }),
      ],
    }),
  },
  {
    id: "crime_temptation",
    weight: () => 0,
    intro: (p) => (p.history.scamVictim !== undefined && p.age - p.history.scamVictim <= 1 ? "だまされた悔しさと、追いつめられた気持ちが、頭を離れなくなった" : p.housingKind === "homeless" ? "その日の食べ物にも困り、追いつめられた" : "お金に困り、追いつめられた"),
    question: (p) => {
      const scam = p.history.scamVictim !== undefined && p.age - p.history.scamVictim <= 1;
      const homeless = p.housingKind === "homeless";
      const why = scam ? "人にだまされ、お金を失いました。" : homeless ? "住まいを失い、その日の食べ物にも困っています。" : "お金がなく、暮らしが立ちゆきません。";
      return {
        title: scam ? "報復や、犯罪に手を染めるか" : "犯罪に手を染めるか",
        prompt: `${why}どうするだろう。犯罪は、実際に検挙される確率があり、現行の法で裁かれます。懲役(拘禁刑)や罰金を受けると、前科がつき、就職や暮らしに長く響きます。`,
        options: [
          opt("endure", "耐えて、相談窓口や公的な支援を頼る", (q, r) => {
            bump(q, { bonds: 2, joy: -1 });
            if (scam && r() < 0.2) {
              q.cashDelta += 100000 + Math.round(r() * 300000);
              return "警察と消費生活センターに相談した。被害の一部が戻ってきた";
            }
            if (homeless) return "福祉事務所に相談し、支援につながる道を探しはじめた";
            return "自治体の窓口や支援団体に相談し、なんとか踏みとどまった";
          }, { auto: true, detail: () => "時間はかかるが、罪には問われない。生活保護や自治体の支援、弁護士の無料相談などの道がある。" }),
          ...(["assault", "theft", "fraud", "robbery"] as CrimeId[]).map((cid) => {
            const d = CRIMES[cid];
            return opt(cid, cid === "assault" ? "だました相手に、報復する(暴力をふるう)" : cid === "theft" ? "盗みに手を染める(窃盗)" : cid === "fraud" ? "だます側にまわる(詐欺・闇バイトなど)" : "強盗に手を染める", (q, r) => {
              const arrest = r() < d.clearance;
              q.crime = { kind: cid, since: q.age, arrestAt: arrest ? q.age + yearsToArrest(r) : null, until: q.age + d.limit };
              if (d.gain[1] > 0) q.cashDelta += Math.round((d.gain[0] + r() * (d.gain[1] - d.gain[0])) * 10000);
              q.extra.stress = Math.min(100, q.extra.stress + 10);
              bump(q, { bonds: -4, joy: cid === "assault" ? 2 : -2 });
              return cid === "assault" ? "怒りにまかせて、だました相手に暴力をふるった。警察に追われる身になった" : cid === "theft" ? "生きるために、盗みに手を染めた。警察に追われる身になった" : cid === "fraud" ? "だまされた側から、だます側にまわってしまった。警察に追われる身になった" : "強盗に手を染めた。警察に追われる身になった";
            }, {
              show: (q) => (cid === "assault" ? scam : cid === "robbery" ? homeless || q.stats.money < 12 : true),
              detail: () => `${d.law}。検挙率は約${Math.round(d.clearance * 100)}%(${d.clearanceNote})。公訴時効は${d.limit}年。${d.gain[1] > 0 ? `手に入るお金は、${d.gain[0]}〜${d.gain[1]}万円ほど。` : ""}`,
            });
          }),
        ],
      };
    },
  },
  {
    id: "have_child",
    weight: () => 0,
    intro: () => "子どものことを考えた",
    question: (p) => ({
      title: p.kids === 0 ? "子どもを持つか？" : "もうひとり、子どもを持つか？",
      prompt: noBearer(p) ? "ふたりとも、子どもを産める体ではありません。養子縁組や里親など、家族を迎える方法もあります。家族のかたちを、どうするだろう。" : "家族のかたちを、どうするだろう。",
      options: [
        opt("yes", noBearer(p) ? (p.kids === 0 ? "子どもを迎えたい(養子縁組・里親など)" : "もうひとり迎えたい") : p.kids === 0 ? "子どもを授かりたい" : "もうひとり授かりたい", (p, r) => {
          p.kids += 1;
          // 男子か女子かは、50%ずつ。
          const sex: "boy" | "girl" = r() < 0.5 ? "boy" : "girl";
          p.kidList.push({ name: "", bornAge: p.age, sex });
          const adopted = noBearer(p);
          // 産む人は、自分か相手か。二人とも産める体なら、半々。
          const selfBears = !adopted && p.sex === "female" && (p.partner?.sex !== "female" || r() < 0.5);
          bump(p, { bonds: 6, joy: 8, money: -3, health: selfBears ? -4 : -1 });
          // 出産・育児で、産んだ人は、仕事を休むことが多く、収入とキャリアに響きやすい。
          if (selfBears && p.occ !== null && p.occ !== "retired") { p.payMult *= 0.95; p.extra.career = Math.max(0, p.extra.career - 3); }
          p.history.bearer = selfBears ? 1 : 0;
          p.history.leaveAsk = p.age;
          const nth = p.kids === 1 ? "第一子" : `第${p.kids}子`;
          return adopted ? `${nth}(${sex === "boy" ? "男子" : "女子"})を、家族に迎えた` : `${nth}(${sex === "boy" ? "男子" : "女子"})が生まれた`;
        }, { auto: true, detail: () => "毎日はにぎやかになるが、お金・時間・体力の負担も大きい。" }),
        opt("later", "もう少し先にする", (p) => {
          p.childWish *= 0.7;
          return "子どものことは、もう少し先に考えることにした";
        }, { detail: () => "年齢が上がるほど、授かりにくくなる。" }),
        opt("no", "子どもは持たない", (p) => {
          p.childFree = true;
          bump(p, { money: 2, joy: -1 });
          return "子どもは持たないことに決めた";
        }, { detail: () => "夫婦(ふたり)の時間とお金を、自分たちのために使える。" }),
      ],
    }),
  },
  {
    id: "affair",
    weight: (p) => (p.married && inAge(p, 26, 56) ? 0.5 * (p.stats.bonds < 45 ? 2 : 1) * (p.mbti?.startsWith("E") ? 1.3 : 1) : 0),
    intro: () => "職場で、気持ちが傾く相手が現れた",
    question: () => ({
      title: "気持ちが傾く相手",
      prompt: "家庭のある身で、ほかの誰かに心がゆれています。",
      options: [
        opt("away", "距離を置いて、家庭を大切にする", (p) => (bump(p, { bonds: 3 }), "気持ちに蓋をして、家庭を大切にすることにした"), { auto: true, detail: () => "平穏は守られるが、胸にしこりが残るかもしれない。" }),
        opt("affair", "秘密の関係を持つ", (p, r) => {
          bump(p, { bonds: -2, health: -1 });
          // 隠し通せるとは限らない。発覚すると、家庭と生活が大きく揺らぐ。
          if (r() < 0.55) {
            const pay = 100 + r() * 200;
            const divorce = r() < 0.5;
            p.scheduled.push({ years: 1 + Math.floor(r() * 3), event: divorce ? "関係が発覚して慰謝料を求められ、家庭を失った" : "関係が発覚して慰謝料を求められたが、時間をかけて家庭を立て直そうとした", weight: 66, delta: { bonds: -12, money: -5, health: -3 }, cashMan: -pay, divorce });
            return "秘密の関係が始まった";
          }
          return "秘密の関係を続けたが、やがて自然に終わった";
        }, { detail: () => "発覚すれば、家庭を失い、慰謝料(数百万円)を求められることもある。" }),
        opt("confess", "パートナーに打ち明けて、話し合う", (p, r) => {
          if (r() < 0.6) return (bump(p, { bonds: 5 }), "パートナーに打ち明け、時間をかけて話し合った");
          bump(p, { bonds: -6, money: -2 });
          return "打ち明けたことで、夫婦のあいだに深い溝ができた";
        }, { detail: () => "関係が深まるか、壊れるかは、相手しだい。" }),
      ],
    }),
  },
  {
    id: "romance",
    weight: (p) => (!p.married && inAge(p, 18, 46) && p.partner?.status !== "dating" ? 1.1 : 0),
    // 気になる人がいなければ、ここで出会う(名前は、乱数で決まる)。
    prepare: (s, r, d) => {
      const p = s.person;
      if (!p.partner || p.partner.status === "ex") p.partner = randomPartner(r, d, p.age, "crush", p.mbti, p);
    },
    intro: (p) => (p.partner ? `気になる人の${fullName(p.partner)}さんと、距離が縮まった` : "気になる人と、距離が縮まった"),
    question: (p) => ({
      title: p.partner ? `気になる人: ${fullName(p.partner)}さん` : "気になる人",
      prompt: p.partner ? `${fullName(p.partner)}さんは、${typeCall(p.partner.mbti) || "どんなタイプかは、まだわからない"}。${p.mbti && p.partner.mbti ? `あなたとの相性は${compatMark(partnerCompat(p))} ${partnerCompat(p)}%。` : ""}気持ちを伝えるか、いまのままでいるか。` : "気持ちを伝えるか、いまのままでいるか。",
      options: [
        opt("confess", "気持ちを伝える", (p, r) => {
          const ok = r() < confessChance(p);
          const who = p.partner ? `${p.partner.given}さん` : "あの人";
          if (ok) {
            if (p.partner) p.partner.status = "dating";
            return ((p.marriageBias *= 1.8), bump(p, { bonds: 7 }), `${who}に気持ちを伝え、交際が始まった`);
          }
          if (p.partner) p.partner.status = "ex";
          return (bump(p, { bonds: -3 }), `${who}に気持ちを伝えたが、受け入れてもらえなかった`);
        }, { detail: (p) => `うまくいく確率は、約${Math.round(confessChance(p) * 100)}%(つながり・外向きの性格・相性による)。` }),
        opt("friend", "友人のままでいる", (p) => (bump(p, { bonds: 2 }), "友人のまま、いい距離を保つことにした"), { auto: true }),
        opt("pass", "気持ちを胸にしまう", (p) => (bump(p, { bonds: -1 }), "気持ちをしまい、そっと見守ることにした")),
      ],
    }),
  },
  {
    id: "lawsuit",
    weight: (p) => (p.age >= 20 ? 0.1 : 0),
    intro: () => "トラブルから、法的な争いになりかけた",
    question: () => ({
      title: "法的な争い",
      prompt: "相手との争いを、どう決着させるだろう。",
      options: [
        opt("court", "裁判で白黒をつける", (p, r) => {
          addCash(p, -80);
          if (r() < 0.5) return (addCash(p, 150), bump(p, { bonds: -2, health: -2 }), "裁判で主張が認められ、解決金を受け取った");
          bump(p, { bonds: -3, health: -3, money: -4 });
          addCash(p, -150);
          return "裁判で主張が認められず、賠償を命じられた";
        }, { cost: () => 80, detail: () => "弁護士費用だけで約80万円。勝てば得られるが、負ければ賠償も加わる。時間もかかる。" }),
        opt("settle", "示談で解決する", (p) => (addCash(p, -30), bump(p, { health: -1 }), "示談で話をまとめた"), { auto: true, detail: () => "約30万円で、早く終わらせられる。" }),
        opt("ignore", "応じずに放っておく", (p, r) => {
          if (r() < 0.5) return (bump(p, { money: -4, health: -2 }), "放っておいたが、のちに差し押さえの通知が届いた");
          return "放っておくうちに、相手も話を取り下げた";
        }, { detail: () => "うまくいくこともあるが、悪化するおそれもある。" }),
      ],
    }),
  },
  {
    id: "crime",
    weight: (p) => (inAge(p, 20, 60) && p.stats.money < 28 ? 0.45 : 0),
    intro: () => "お金に困り、道を踏み外しそうな誘いがあった",
    question: () => ({
      title: "追い詰められて",
      prompt: "生活が苦しく、危うい誘いが目の前にあります。",
      options: [
        opt("consult", "誘いを断り、誰かに相談する", (p) => (bump(p, { bonds: 3, money: 2 }), "誘いを断り、家族や相談窓口に助けを求めた"), { auto: true }),
        opt("borrow", "お金を借りて、なんとか乗り切る", (p) => (bump(p, { money: -4, health: -2 }), "借金をして、なんとか急場をしのいだ"), { detail: () => "利息が重なり、のちの暮らしを圧迫する。" }),
        opt("cross", "誘いに乗ってしまう", (p, r) => {
          p.scheduled.push({ years: 1 + Math.floor(r() * 2), event: "事件が明るみに出て逮捕され、仕事を失った", weight: 70, delta: { bonds: -15, money: -12, health: -4 }, cashMan: -80, fired: true });
          bump(p, { bonds: -2 });
          return "出来心で、してはならない一線を越えてしまった";
        }, { detail: () => "発覚すれば、仕事も、家族や友人の信頼も、大きく失う。" }),
      ],
    }),
  },
  {
    id: "pet",
    weight: (p) => (inAge(p, 22, 72) ? (p.pets.length === 0 ? 0.55 : p.pets.length === 1 ? 0.12 : 0) : 0),
    intro: () => "ペットを迎える機会があった",
    question: () => ({
      title: "ペットを迎える？",
      prompt: "新しい家族が増えると、暮らしが変わります。",
      options: [
        opt("dog", "犬を迎える", (p) => (addCash(p, -30), p.pets.push({ name: "", kind: "犬", adoptedAge: p.age }), bump(p, { health: 3, bonds: 4, money: -2 }), "犬を家族に迎えた"), { cost: () => 30, detail: () => "毎日の散歩で健康になるが、世話と費用(年に約30万円)がかかる。" }),
        opt("cat", "猫を迎える", (p) => (addCash(p, -15), p.pets.push({ name: "", kind: "猫", adoptedAge: p.age }), bump(p, { bonds: 4, money: -1 }), "猫を家族に迎えた"), { cost: () => 15, detail: () => "気ままな同居人。費用は年に約20万円。" }),
        opt("small", "小動物を迎える", (p) => (addCash(p, -5), p.pets.push({ name: "", kind: "小さな動物", adoptedAge: p.age }), bump(p, { bonds: 2 }), "小さな動物を家族に迎えた"), { cost: () => 5, detail: () => "手軽だが、寿命は短め。" }),
        opt("no", "迎えない", () => "", { auto: true }),
      ],
    }),
  },
  {
    id: "abroad",
    weight: (p) => (inAge(p, 19, 32) && p.stats.learn > 45 ? 0.5 : 0),
    intro: () => "海外留学の機会が巡ってきた",
    question: () => ({
      title: "留学のチャンス",
      prompt: "異国で学ぶ機会です。",
      options: [
        opt("long", "1年の長期留学に行く", (p) => {
          addCash(p, -300);
          bump(p, { learn: 10, bonds: 3, money: -6 });
          p.payMult *= 1.05;
          return "1年間、海外に留学した";
        }, { cost: () => 300, detail: () => "費用は約300万円。語学と視野が大きく広がる。" }),
        opt("short", "短期留学に行く", (p) => (addCash(p, -50), bump(p, { learn: 5, bonds: 2 }), "数週間、短期留学に行った"), { cost: () => 50, detail: () => "費用は約50万円。気軽に試せる。" }),
        opt("stay", "行かない", () => "", { auto: true }),
      ],
    }),
  },
  {
    id: "early_retire",
    weight: (p, e) => (working(p) && !isResponsible(p) && p.sector === "private" && p.employment !== "self" && inAge(p, 45, 60) ? (e < 0 ? 1.0 : 0.3) : 0),
    intro: () => "会社が、早期退職者を募集し始めた",
    question: () => ({
      title: "早期退職の募集",
      prompt: "割増の退職金と引きかえに、会社を離れる道です。",
      options: [
        opt("take", "応じて、会社を離れる", (p, r, d) => {
          const lump = Math.round(700 + r() * 800);
          addCash(p, lump - retirementTax(lump, p.age - 22));
          p.payMult *= 0.8;
          p.employment = "nonregular";
          bump(p, { money: -3, health: 2 });
          void d;
          return "早期退職に応じ、割増の退職金を受け取って、新しい道を探すことにした";
        }, { detail: (p) => `退職金に数百〜千数百万円が上積みされる。退職金には退職所得控除があり、税は軽い(勤続${Math.max(1, p.age - 22)}年なら、${(p.age - 22) <= 20 ? Math.max(80, 40 * (p.age - 22)) : 800 + 70 * (p.age - 22 - 20)}万円までは引かれない目安)。収入は下がり、次の仕事を探す必要がある。` }),
        opt("stay", "会社に残る", (p) => (bump(p, { money: 1 }), "会社に残る道を選んだ"), { auto: true, detail: (_p, env) => (env.econ < -0.6 ? "不況の今、残っても先行きは不透明。" : "") }),
      ],
    }),
  },
  {
    id: "relocation",
    weight: (p) => (working(p) && p.firm === "large" && p.sector === "private" && inAge(p, 28, 55) ? 0.6 : 0),
    intro: () => "転勤の辞令が出た",
    question: () => ({
      title: "転勤の辞令",
      prompt: "新しい任地に、どう向き合うだろう。",
      options: [
        opt("go", "受ける(単身赴任も覚悟する)", (p, r, d) => {
          p.payMult *= 1.05;
          const city = moveTo(p, r, d, "metro");
          bump(p, { bonds: -4, money: 2 });
          return `${city}への転勤を受けた`;
        }, { auto: true, detail: () => "収入や評価は上がるが、家族や友人と離れることもある。" }),
        opt("refuse", "断る", (p) => ((p.payMult *= 0.95), bump(p, { bonds: 2 }), "転勤を断り、いまの場所で働き続けることにした"), { detail: () => "評価には響くが、暮らしは変わらない。" }),
        {
          id: "quit",
          label: "転職する",
          apply: () => "",
          detail: () => "行き先の業界と職種を、自分で選ぶ。",
          children: () => industryQuestion({ factor: 0.95, exclude: (q) => q.occ as Occ | null, finish: (_p, title) => `転勤を機に、${title}に転職した` }),
        },
      ],
    }),
  },
  {
    id: "overseas_post",
    weight: (p) => (working(p) && p.sector === "private" && p.employment !== "self" && p.firm !== "small" && inAge(p, 28, 55) && !p.abroad ? 0.5 : 0),
    intro: () => "会社から、海外赴任の打診があった",
    question: () => ({
      title: "海外赴任の打診",
      prompt: "異国で働く機会です。",
      options: [
        opt("go", "赴任する", (p, r, d) => {
          p.payMult *= 1.1;
          const city = moveAbroad(p, r, d);
          return `${city}への海外赴任を受けた`;
        }, { detail: () => "収入は、赴任先の水準になる。言葉も、暮らしも変わる。帰国の時期は、あとで選べる。" }),
        opt("no", "断る", (p) => (bump(p, { bonds: 2 }), "海外赴任の打診を断り、いまの暮らしを続けることにした"), { auto: true }),
      ],
    }),
  },
  {
    id: "return_or_stay",
    weight: (p) => (p.abroad && p.age - p.abroad.since >= 5 ? 0.5 : 0),
    intro: (p) => `${p.abroad?.country ?? "異国"}で暮らしはじめて、数年がたった`,
    question: () => ({
      title: "帰るか、残るか",
      prompt: "このまま、この国で暮らし続けるか、日本に帰るか。",
      options: [
        opt("home", "日本に帰国する", (p, r, d) => {
          const city = moveHome(p, r, d);
          bump(p, { bonds: 5, joy: 3 });
          return `日本に帰国し、${city}で暮らし始めた`;
        }, { detail: () => "家族や友人に近くなる。収入は、日本の水準に戻る。" }),
        opt("stay", "この国で、暮らし続ける", (p) => (bump(p, { joy: 3, bonds: 1 }), `${p.abroad?.country ?? "この国"}で、暮らし続けることにした`), { auto: true }),
      ],
    }),
  },
  {
    id: "burnout_leave",
    weight: (p) => (working(p) && p.stats.health < 46 ? 1.2 : 0),
    intro: () => "心身が限界に近づいた",
    question: () => ({
      title: "限界のサイン",
      prompt: "無理を重ねた体と心が、悲鳴をあげています。",
      options: [
        opt("leave", "休職して、休む", (p) => ((p.payMult *= 0.94), bump(p, { health: 10, money: -2 }), "休職して、しばらく静かに過ごした"), { auto: true, detail: () => "収入は一時的に下がるが、回復のための時間が持てる。" }),
        opt("push", "無理して、続ける", (p, r) => {
          if (r() < 0.45) return (bump(p, { health: -12, money: -3 }), "無理を続けたあげく、倒れて入院した");
          return (bump(p, { health: -4 }), "なんとか踏ん張って、働き続けた");
        }, { detail: () => "倒れるおそれが高まる。" }),
        opt("quit", "仕事を辞める", (p) => ((p.payMult *= 0.8), (p.employment = "nonregular"), bump(p, { health: 6, money: -4 }), "仕事を辞めて、体と心を立て直すことにした")),
      ],
    }),
  },
  // ---- 救いの選択(ふだんは抽選されず、うつ状態・深刻な病気・いじめのときに出る) ----
  {
    id: "rescue_mind",
    weight: () => 0,
    intro: () => "うつ状態になった",
    question: () => ({
      title: "心が限界のとき",
      prompt: "何も感じられない日々が続いています。自分を救うために、どうするだろう。",
      options: [
        opt("clinic", "医療機関を受診して、治療を受ける", (p, r) => {
          addCash(p, -10);
          bump(p, { health: 10, joy: 25 });
          if (r() < 0.85) {
            p.mood = "ok";
            p.moodYears = 0;
            return "専門の医師につながり、治療を始めた。少しずつ、気持ちが軽くなっていった";
          }
          return "治療を始めたが、回復には時間がかかりそうだ";
        }, { auto: true, detail: () => "費用は数万〜十数万円。回復する確率は高い。" }),
        opt("confide", "家族や友人に、打ち明ける", (p, r) => {
          bump(p, { bonds: 5, joy: 15 });
          if (r() < 0.35 + p.stats.bonds / 150) {
            p.mood = "ok";
            p.moodYears = 0;
            return "大切な人に打ち明けて、抱え込んでいたものが、少し軽くなった";
          }
          return "打ち明けたことで気持ちは少し楽になったが、まだ霧は晴れない";
        }, { detail: (p) => `つながりが強いほど、支えになる(いまのつながり: ${Math.round(p.stats.bonds)})。` }),
        opt("rest", "仕事や学校を休んで、ゆっくり休む", (p, r) => {
          if (p.occ && p.occ !== "retired") p.payMult *= 0.93;
          bump(p, { joy: 12, health: 6 });
          if (r() < 0.5) {
            p.mood = "ok";
            p.moodYears = 0;
            return "思い切って休み、静かな時間のなかで、少しずつ回復していった";
          }
          return "しばらく休んだが、気持ちは重いままだ";
        }, { detail: () => "収入は一時的に下がる。" }),
        opt("endure", "ひとりで耐える", (p) => (bump(p, { joy: -6, health: -6 }), "誰にも言えないまま、ひとりで耐え続けた"), { detail: () => "悪化して、深刻な病気につながるおそれがある。" }),
      ],
    }),
  },
  {
    id: "rescue_body",
    weight: () => 0,
    intro: () => "深刻な病気が見つかった",
    question: () => ({
      title: "深刻な病気と向き合う",
      prompt: "体力が大きく落ちています。命を守るために、どうするだろう。",
      options: [
        opt("hospital", "入院して、治療に専念する", (p, r) => {
          addCash(p, -(10 + r() * 30));
          bump(p, { health: 20, joy: 6 });
          if (r() < 0.7) {
            p.sick = false;
            return "入院して治療に専念し、少しずつ、体力が戻ってきた";
          }
          return "入院して治療を受けたが、長い付き合いになりそうだ";
        }, { auto: true, detail: () => "費用は数万〜数十万円ほど(高額療養費制度で、自己負担には上限がある)。" }),
        opt("family", "家族に支えられながら、通院を続ける", (p, r) => {
          addCash(p, -20);
          bump(p, { bonds: 4, health: 12, joy: 8 });
          if (r() < 0.45 + p.stats.bonds / 300) {
            p.sick = false;
            return "家族に支えられながら通院を続け、病気を乗り越えた";
          }
          return "家族に支えられながら、病気と付き合う日々が続く";
        }, { detail: (p) => `つながりが強いほど、心の支えになる(いまのつながり: ${Math.round(p.stats.bonds)})。` }),
        opt("adjust", "仕事を調整して、療養に専念する", (p, r) => {
          if (p.occ && p.occ !== "retired") p.payMult *= 0.9;
          bump(p, { health: 15, joy: 4 });
          if (r() < 0.6) {
            p.sick = false;
            return "仕事を調整して療養に専念し、体調が持ち直した";
          }
          return "療養を続けているが、回復はゆるやかだ";
        }, { detail: () => "収入は下がるが、治療に時間を使える。" }),
        opt("ignore", "症状を気にせず、これまでどおり過ごす", (p) => (bump(p, { health: -6, joy: -3 }), "病気を気にしないふりをして、これまでどおり過ごした"), { detail: () => "悪化して、命にかかわるおそれが高まる。" }),
      ],
    }),
  },
  {
    id: "bully_help",
    weight: () => 0,
    intro: () => "いじめに苦しんでいる",
    question: () => ({
      title: "いじめを受けて",
      prompt: "毎日がつらいなか、あなたはどうするだろう。",
      options: [
        opt("tell", "先生や親に相談する", (p, r) => {
          bump(p, { bonds: 4, joy: 12 });
          if (r() < 0.65) return "先生や親に打ち明け、周りが動いてくれて、状況が少しずつ変わった";
          return "打ち明けたが、すぐには状況は変わらなかった。それでも、味方がいると思えた";
        }, { auto: true }),
        opt("endure", "誰にも言わず、耐える", (p) => (bump(p, { joy: -8, health: -4 }), "誰にも言えず、ひとりで耐え続けた"), { detail: () => "心が大きくすり減る。" }),
        opt("skip", "学校を休む", (p) => (bump(p, { learn: -3, health: 2, joy: 4 }), "しばらく学校を休み、家で静かに過ごした")),
        opt("move", "環境を変える(転校や進路の変更)", (p, r, d) => (bump(p, { bonds: -2, joy: 8 }), (p.region = p.birthRegion), "思い切って環境を変え、新しい場所でやり直すことにした")),
      ],
    }),
  },
  {
    id: "invest_scam",
    weight: (p) => (inAge(p, 25, 62) ? 0.4 : 0),
    intro: () => "友人から、もうけ話を持ちかけられた",
    question: () => ({
      title: "もうけ話",
      prompt: "「絶対に増える」という話が舞い込みました。",
      options: [
        opt("no", "断る", (p) => (bump(p, { bonds: -1 }), "もうけ話を断った"), { auto: true }),
        opt("small", "少額だけ出す", (p, r) => {
          addCash(p, -20);
          if (r() < 0.65) return (bump(p, { bonds: -2 }), "少額を出したが、お金は戻ってこなかった");
          addCash(p, 30);
          return "少額を出して、小さな利益を得た";
        }, { cost: () => 20, detail: () => "約20万円。戻らないことが多い。" }),
        opt("big", "大金をつぎこむ", (p, r) => {
          addCash(p, -200);
          if (r() < 0.8) return (bump(p, { money: -6, bonds: -4, health: -3 }), "大金をつぎこんだが、すべて失ってしまった");
          addCash(p, 500);
          return "大金をつぎこんだ話が、運よく大きな利益になった";
        }, { cost: () => 200, detail: () => "約200万円。多くは失われる。" }),
      ],
    }),
  },
];

void jobById;
void interpolate;

// ---- 亡くなった原因 ----
// 突然の死(事故・急病・災害など)は、人生ごとに別の乱数で決まる。それ以外は、年齢相応の原因になる。
export type DeathInfo = { label: string; text: (age: number) => string };

const pickW = (r: () => number, items: [DeathInfo, number][]): DeathInfo => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [it, w] of items) {
    x -= w;
    if (x < 0) return it;
  }
  return items[items.length - 1][0];
};
const sudden = (label: string, phrase: string): DeathInfo => ({ label, text: (age) => `${age}歳のとき、${phrase}、突然、人生を終えた` });
const quiet = (label: string, phrase: string): DeathInfo => ({ label, text: (age) => `${age}歳で、${phrase}、静かに人生を終えた` });

export function causeOfDeath(p: Person, isSudden: boolean, r: () => number): DeathInfo {
  const job = p.occ && p.occ !== "retired" ? p.occ : null;
  if (isSudden) {
    const risky = job === "construction" || job === "transport" || job === "production" || job === "agri" ? 1.4 : 0.2;
    return pickW(r, [
      [sudden("交通事故", "交通事故にあい"), 1.0 * rural(p)],
      [sudden("仕事中の事故", "仕事中の事故で"), risky],
      [sudden("水の事故", "水辺の事故で"), p.age < 50 ? 0.4 : 0.15],
      [sudden("山や海の遭難", "山や海で遭難し"), p.age < 55 ? 0.3 : 0.05],
      [sudden("災害", "災害に巻き込まれ"), 0.3],
      [sudden("急な心臓や脳の病気", "急な心臓や脳の病気で"), p.age > 35 ? 1.0 : 0.2],
      [sudden("事件に巻き込まれた", "事件に巻き込まれ"), 0.15],
    ]);
  }
  // 深刻な病気から、2年以上たって亡くなったときだけ、「長い闘病」。
  if (p.sick && p.age - (p.history.sick ?? p.age) >= 2 && p.age < 85) return quiet("長い闘病", "長い闘病の末に");
  // 持病は、亡くなる原因に結びつく。
  const ail = p.ailment;
  const cond = p.condition;
  const kCancer = ail === "cancer" ? 6 : 1;
  const kHeart = ail === "heart_acq" || cond === "heart" ? 5 : 1;
  const kDia = ail === "diabetes2" || cond === "diabetes" ? 1 : 0;
  const kInt = ail === "intractable" ? 1 : 0;
  const kCong = cond === "heart" && p.age < 60 ? 1 : 0;
  if (p.age < 40) {
    return pickW(r, [
      [quiet("病気", "病気のため"), 1],
      [quiet("がん", "がんのため"), ail === "cancer" ? 3 : 0],
      [quiet("生まれつきの心臓の病気", "生まれつきの心臓の病気のため"), kCong * 3],
      [quiet("糖尿病の合併症", "糖尿病の合併症のため"), kDia * 1.5],
      [quiet("難病", "難病のため"), kInt * 3],
    ]);
  }
  if (p.age < 65)
    return pickW(r, [
      [quiet("がん", "がんのため"), 0.5 * kCancer],
      [quiet("心臓の病気", "心臓の病気のため"), 0.25 * kHeart],
      [quiet("脳の病気", "脳の病気のため"), 0.15],
      [quiet("病気", "病気のため"), 0.1],
      [quiet("糖尿病の合併症", "糖尿病の合併症のため"), 0.2 * kDia],
      [quiet("難病", "難病のため"), 0.25 * kInt],
      [quiet("生まれつきの心臓の病気", "生まれつきの心臓の病気のため"), 0.2 * kCong],
    ]);
  return pickW(r, [
    [quiet("老衰", "老衰のため"), p.age >= 85 ? 0.35 : 0.1],
    [quiet("がん", "がんのため"), 0.25 * kCancer],
    [quiet("心臓の病気", "心臓の病気のため"), 0.15 * kHeart],
    [quiet("肺炎", "肺炎のため"), ail === "none" && cond === "asthma" ? 0.25 : 0.15],
    [quiet("脳の病気", "脳の病気のため"), 0.1],
    [quiet("糖尿病の合併症", "糖尿病の合併症のため"), 0.1 * kDia],
    [quiet("難病", "難病のため"), 0.12 * kInt],
  ]);
}
