import { prefKey, univRate, univRateNational } from "@/lib/sim/regional";
import { bump } from "@/lib/sim/helpers";
import { BG_RISK, absentWho, soloWho } from "@/lib/sim/family";
import type { AutoEvent, Person } from "@/lib/sim/types";

// 生まれた家庭の暮らし向き・ひとり親・頭の良さ・つながりで、起きやすさが変わる出来事。
// 統計(子どもの貧困・ひとり親世帯・非行や犯罪と家庭環境の関わり)を手がかりにした、設計上の仮定。
// どれも、運命ではなく、確率の差。同じ環境でも、多くの人は、そうならない。

const inAge = (p: Person, a: number, b: number) => p.age >= a && p.age <= b;
const mark = (p: Person, key: string) => {
  p.history[key] = p.age;
};
const stress = (p: Person, d: number) => {
  p.extra.stress = Math.min(100, Math.max(0, p.extra.stress + d));
};
const trust = (p: Person, d: number) => {
  p.extra.trust = Math.min(100, Math.max(0, p.extra.trust + d));
};
const poor = (p: Person) => p.background === "poverty" || p.background === "tight";
// 苦しさの倍率(困窮 1 / 余裕なし 0.4)。
const need = (p: Person) => (p.background === "poverty" ? 1 : p.background === "tight" ? 0.4 : 0);
const wealthy = (p: Person) => p.background === "rich" || p.background === "comfortable";
const ev = (id: string, weight: AutoEvent["weight"], apply: AutoEvent["apply"], importance?: number): AutoEvent => ({ id, weight, apply, importance });

// 非行に近づく起きやすさ: 家庭の貧しさ・ひとり親・頭の良さ・つながりの弱さ(どれも、確率を動かすだけ)。
const riskOf = (p: Person) => BG_RISK[p.background] * (p.soloParent ? 1.6 : 1) * (p.intel < 40 ? 1.5 : p.intel > 65 ? 0.7 : 1) * (p.stats.bonds < 35 ? 1.5 : p.stats.bonds > 65 ? 0.7 : 1);
const delinquent = (p: Person) => p.history.delinquent !== undefined || p.history.badCompany !== undefined;

export const familyEvents: AutoEvent[] = [
  // ---- 暮らす地域(実際の統計) ----
  ev("reg_peers", (p) => (inAge(p, 17, 18) && p.history.regPeers === undefined ? 2 : 0), (s) => {
    const p = s.person;
    mark(p, "regPeers");
    const rate = univRate(prefKey(p.birthPlace));
    const pct = Math.round(rate * 100);
    const nat = Math.round(univRateNational() * 100);
    if (rate >= univRateNational() + 0.08 && (p.edu === "hs_work" || p.edu === "vocational")) bump(p, { bonds: -1, joy: -1 });
    return `同じ高校の卒業生の${pct}%ほどが、大学や短大などへ進む地域だった(全国は約${nat}%)`;
  }, 36),
  // ---- 経済的に苦しい家庭 ----
  ev("fam_lunch_fee", (p) => (inAge(p, 6, 15) ? 0.9 * need(p) : 0), (s) => (bump(s.person, { bonds: -3, joy: -5 }), "給食費や教材費の支払いが遅れ、先生に声をかけられて、肩身の狭い思いをした"), 40),
  ev("fam_no_trip", (p) => (inAge(p, 11, 16) ? 0.6 * need(p) : 0), (s) => (bump(s.person, { bonds: -4, joy: -8 }), "修学旅行の積立金が払えず、みんなが出かけるなか、行けなかった"), 46),
  ev("fam_hand_me_down", (p) => (inAge(p, 7, 15) ? 0.7 * need(p) : 0), (s) => (bump(s.person, { bonds: -3, joy: -4 }), "お下がりの服や古い道具を、同級生にからかわれた"), 38),
  ev("fam_cram_envy", (p) => (inAge(p, 12, 17) && p.lessons.every((l) => l.id !== "cram") ? 0.7 * need(p) : 0), (s) => (bump(s.person, { learn: -3, joy: -4 }), "周りが塾に通うなか、自分は通えず、成績の差が少しずつ開いていった"), 42),
  ev("fam_work_for_home", (p) => (inAge(p, 14, 18) ? 0.8 * need(p) : 0), (s) => (bump(s.person, { learn: -2, health: -2, joy: -3 }), s.person.cashDelta += 30000, "家計を助けるために、放課後も働くようになった。勉強の時間は、削られていった"), 50),
  ev("fam_utilities", (p) => (inAge(p, 6, 17) ? 0.3 * need(p) : 0), (s) => (bump(s.person, { health: -2, joy: -6 }), stress(s.person, 4), "支払いが追いつかず、電気やガスが止まる日があった"), 48),

  // ---- ひとり親家庭 ----
  ev("fam_solo_busy", (p) => (p.soloParent && inAge(p, 3, 15) ? 1.0 : 0), (s) => {
    const who = soloWho(s.person);
    bump(s.person, { bonds: -2, joy: -3 });
    return `${who}は、朝から夜まで働きづめで、ひとりで夕食を食べる日が増えた`;
  }, 40),
  ev("fam_solo_missed", (p) => (p.soloParent && inAge(p, 6, 14) ? 0.5 : 0), (s) => {
    bump(s.person, { bonds: -2, joy: -4 });
    return `授業参観や運動会に、${soloWho(s.person)}が、仕事で来られない日があった`;
  }, 38),
  ev("fam_solo_carer", (p) => (p.soloParent && inAge(p, 10, 17) ? 0.5 * (p.background === "poverty" || p.background === "tight" ? 1.4 : 1) : 0), (s) => {
    bump(s.person, { learn: -2, joy: -3, bonds: 2 });
    stress(s.person, 3);
    return `${soloWho(s.person)}を支えようと、家のことを引き受けるうちに、自分のための時間が減っていった`;
  }, 44),
  ev("fam_absent_parent", (p) => (p.soloParent && inAge(p, 8, 22) && p.history.absentThought === undefined ? 0.4 : 0), (s) => {
    mark(s.person, "absentThought");
    bump(s.person, { joy: -4, bonds: -1 });
    return `離れて暮らす${absentWho(s.person)}のことを、ふと考える日があった。会えない理由は、まだうまく言葉にならなかった`;
  }, 44),

  // ---- 非行・犯罪(家庭・ひとり親・低い学力・弱いつながりで、確率が高まる) ----
  ev("fam_shoplift", (p) => (inAge(p, 12, 17) && p.history.delinquent === undefined ? 0.1 * riskOf(p) : 0), (s, r) => {
    const p = s.person;
    mark(p, "delinquent");
    if (r() < 0.55) {
      bump(p, { bonds: -6, joy: -6 });
      trust(p, -8);
      return "友だちに誘われて万引きをしてしまい、店の人に見つかって、補導された";
    }
    bump(p, { joy: -4 });
    return "友だちに誘われて万引きをした。見つからなかったが、罪悪感がずっと残った";
  }, 52),
  ev("fam_bad_company", (p) => (inAge(p, 14, 22) && delinquent(p) && p.history.badCompany === undefined ? 0.1 * riskOf(p) : inAge(p, 14, 20) && p.history.badCompany === undefined ? 0.03 * riskOf(p) : 0), (s) => {
    mark(s.person, "badCompany");
    bump(s.person, { learn: -4, bonds: -3, health: -1 });
    stress(s.person, 3);
    return "素行のよくない仲間とつるむようになり、学校や仕事から、足が遠のいていった";
  }, 52),
  ev("fam_dark_job", (p) => (inAge(p, 18, 28) && p.history.record === undefined ? 0.05 * riskOf(p) * (p.stats.money < 35 ? 1.6 : 1) : 0), (s, r) => {
    const p = s.person;
    if (r() < 0.7) {
      bump(p, { joy: -1 });
      return "「簡単に高収入」とうたうアルバイトの誘いがあったが、あやしいと感じて、断った";
    }
    mark(p, "record");
    bump(p, { bonds: -8, joy: -14, money: -8 });
    trust(p, -25);
    return "「簡単な仕事」と言われて、犯罪に加わってしまい、逮捕された。前科がついた";
  }, 62),
  ev("fam_arrest", (p) => (inAge(p, 18, 40) && delinquent(p) && p.history.record === undefined ? 0.06 * riskOf(p) : 0), (s) => {
    const p = s.person;
    mark(p, "record");
    bump(p, { bonds: -8, joy: -12, money: -8, health: -2 });
    trust(p, -20);
    return "窃盗などの罪で逮捕された。前科がつき、周りの目は大きく変わった";
  }, 64),

  // ---- 恵まれた家庭 ----
  ev("fam_talent", (p) => (inAge(p, 4, 14) && wealthy(p) && p.intel >= 55 && p.history.talent === undefined ? (p.background === "rich" ? 0.9 : 0.5) : 0), (s) => {
    mark(s.person, "talent");
    s.person.intel = Math.min(100, s.person.intel + 1);
    bump(s.person, { learn: 4, joy: 3 });
    return "幼いころから習い事に恵まれ、才能が花ひらいた。周りから、一目置かれるようになった";
  }, 56),
  ev("fam_private_school", (p) => (inAge(p, 11, 13) && wealthy(p) && p.history.privateSchool === undefined ? (p.background === "rich" ? 1.2 : 0.5) : 0), (s) => {
    mark(s.person, "privateSchool");
    bump(s.person, { learn: 3, bonds: -1 });
    return "私立の学校に進んだ。周りは似た暮らしの家庭の子ばかりで、外の世界を知らないまま日々が過ぎていった";
  }, 48),
  ev("fam_pressure", (p) => (inAge(p, 8, 17) && wealthy(p) ? (p.background === "rich" ? 1.3 : 0.8) : 0), (s) => {
    bump(s.person, { learn: 3, joy: -6 });
    stress(s.person, 5);
    return "親の期待が重く、習い事と受験の勉強に追われて、息つく暇のない日々だった";
  }, 46),
  ev("fam_overprotected", (p) => (inAge(p, 10, 20) && p.background === "rich" ? 0.6 : 0), (s) => {
    bump(s.person, { joy: -4, bonds: -1 });
    return "何でも与えられて育ち、自分の力で何かをやり遂げたという実感が、持てなかった";
  }, 42),
  ev("fam_cold_home", (p) => (inAge(p, 8, 18) && wealthy(p) ? 0.35 : 0), (s) => {
    bump(s.person, { joy: -5, bonds: -3 });
    return "親の不仲が続き、広い家の中は静かに冷えていった";
  }, 46),
  ev("fam_gold_digger", (p) => (inAge(p, 20, 45) && p.background === "rich" ? 0.5 : 0), (s) => {
    bump(s.person, { bonds: -2, joy: -3 });
    trust(s.person, -2);
    return "お金や家柄が目当ての人が、近づいてくるようになり、人を信じるのが怖くなった";
  }, 44),
  ev("fam_inherit_fight", (p) => (p.background === "rich" && p.history.parentDied !== undefined && p.age - p.history.parentDied <= 2 && p.history.inheritFight === undefined ? 1.4 : 0), (s) => {
    mark(s.person, "inheritFight");
    bump(s.person, { bonds: -6, joy: -8 });
    return "親の遺産をめぐってきょうだいと争いになり、そのまま疎遠になってしまった";
  }, 58),
];
