import type { Person } from "@/lib/sim/types";

// アスリートの、競技・大会・オリンピック。
// オリンピックの数字は、実際の統計(文部科学省・JOC の資料)をもとにしている:
//   東京2020: 日本代表583人・メダル58個(金27・銀14・銅17)
//   パリ2024: 日本代表409人・メダル45個(金20・銀12・銅13)・入賞(8位以内)115
// 国内の大会の勝ちやすさは、出場者の規模から見た、設計上の仮定。

export type Sport = { id: string; label: string; season: "summer" | "winter"; note: string };

export const SPORTS: Sport[] = [
  { id: "athletics", label: "陸上競技", season: "summer", note: "走る・跳ぶ・投げる。記録がはっきり出る競技。" },
  { id: "swimming", label: "水泳", season: "summer", note: "競泳。若いうちに力が伸びる競技。" },
  { id: "judo", label: "柔道", season: "summer", note: "階級別の個人戦。日本の伝統の競技。" },
  { id: "gymnastics", label: "体操", season: "summer", note: "技の難しさと美しさを競う。体への負担が大きい。" },
  { id: "tabletennis", label: "卓球", season: "summer", note: "反応の速さと戦術。長く続けやすい競技。" },
  { id: "badminton", label: "バドミントン", season: "summer", note: "俊敏さと持久力。国際大会が多い。" },
  { id: "wrestling", label: "レスリング", season: "summer", note: "階級別の組み技。減量などの負担も大きい。" },
  { id: "skateboard", label: "スケートボード", season: "summer", note: "若い選手が活躍する、新しい競技。" },
  { id: "tennis", label: "テニス", season: "summer", note: "世界を転戦する。遠征の費用がかかる。" },
  { id: "figureskate", label: "フィギュアスケート", season: "winter", note: "冬の競技。技と表現を競う。" },
  { id: "speedskate", label: "スピードスケート", season: "winter", note: "冬の競技。氷の上のスピード勝負。" },
  { id: "ski", label: "スキー・スノーボード", season: "winter", note: "冬の競技。雪のある土地で練習を重ねる。" },
];
export const sportById = (id?: string) => SPORTS.find((s) => s.id === id);

// 夏の大会は、西暦が4で割りきれる年。冬の大会は、4で割って2あまる年(2022・2026・2030…)。
export const olympicYear = (year: number, season: Sport["season"]) => (season === "summer" ? year % 4 === 0 : year % 4 === 2);

// 総合力(0〜1): 実績・魅力・信用・健康。
export const athleteScore = (p: Person) => (p.extra.career * 0.4 + p.extra.charm * 0.2 + p.extra.trust * 0.2 + p.stats.health * 0.2) / 100;

// 健康が高いほど勝ちやすい(50で1倍、100でおよそ1.6倍、20でおよそ0.5倍)。
const healthFactor = (p: Person) => 0.2 + (p.stats.health / 100) * 1.4;

export type Meet = { id: string; label: string; field: string; base: number; gain: number; minCareer: number; note: string };
// base: 優勝の確率の目安(実力が平均のとき)。gain: 優勝したときに増える「実績」。
export const MEETS: Meet[] = [
  { id: "prefecture", label: "地域・県の大会", field: "出場者は数十人ほど", base: 0.3, gain: 10, minCareer: 0, note: "まずは、ここで結果を残す。" },
  { id: "national", label: "全国大会・日本選手権", field: "全国から数百人が出る", base: 0.12, gain: 16, minCareer: 30, note: "全国の強い選手が集まる。優勝すれば、実績が大きく伸びる。" },
  { id: "world", label: "国際大会・世界選手権", field: "世界から、各国の代表が出る", base: 0.06, gain: 24, minCareer: 60, note: "世界の頂点を争う。勝てば、実績が大きく伸びる。" },
];

export function meetWinChance(p: Person, m: Meet): number {
  return Math.min(0.7, m.base * healthFactor(p) * (0.6 + p.extra.career / 150 + p.extra.charm / 400));
}

// オリンピックでの結果。入賞(8位以内)は、パリ2024の実数(115/409=約28%)を基準にする。
// メダルは、実数(東京58/583・パリ45/409=約10〜11%)を基準にして、総合力が高いほど上がる。
// メダルの色の割合は、2大会の実数(金47・銀26・銅30)から。
export function olympicResult(p: Person, r: () => number): "gold" | "silver" | "bronze" | "finalist" | "none" {
  const score = athleteScore(p);
  const medal = Math.min(0.55, 0.105 * (0.5 + Math.max(0, score - 0.5) * 3.2) * healthFactor(p) * 0.85);
  const final = Math.min(0.85, 0.28 * (0.6 + score * 0.8) * healthFactor(p) * 0.9);
  const x = r();
  if (x < medal) {
    const c = r();
    return c < 47 / 103 ? "gold" : c < (47 + 26) / 103 ? "silver" : "bronze";
  }
  return x < medal + final ? "finalist" : "none";
}
