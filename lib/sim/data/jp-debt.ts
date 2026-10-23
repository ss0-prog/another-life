import type { LenderDef, LenderId, Person } from "@/lib/sim/types";

// 借り先ごとの、金利と、人生への影響。金利や上限は、設計上の仮定(だいたいの目安)。
export const LENDERS: Record<LenderId, LenderDef> = {
  family: { id: "family", label: "家族に借りる", rate: 0, bonds: -8, joy: -8, health: 0, note: "利息はつかないが、頭を下げる負い目が残る。返せないと関係が壊れることもある。" },
  friend: { id: "friend", label: "友人に借りる", rate: 0, bonds: -6, joy: -6, health: 0, note: "利息はつかないが、お金の貸し借りは友情にひびを入れやすい。" },
  bank: { id: "bank", label: "銀行のローンを組む", rate: 0.04, bonds: 0, joy: -4, health: 0, note: "金利は年約4%。安定した収入が必要で、借りられる額に上限がある。返せないと自己破産に至ることもある。" },
  card: { id: "card", label: "カードローン・消費者金融で借りる", rate: 0.15, bonds: 0, joy: -9, health: -1, note: "金利は年約15%。すぐに借りられるが、利息が雪だるま式に増える。返せないと督促と自己破産が待っている。" },
  shark: { id: "shark", label: "闇金(違法な高利貸し)で借りる", rate: 1.5, bonds: -5, joy: -16, health: -4, note: "違法な超高金利。返せないと取り立てや脅しが続き、暮らしも体も壊される。最後の手段にしてはならない。" },
};

export const LENDER_ORDER: LenderId[] = ["family", "friend", "bank", "card", "shark"];

// その借り先から、この額を借りられるか(理由つき)。
export function lenderAvailable(p: Person, id: LenderId, amountYen: number, annualIncomeMan: number): { ok: boolean; why?: string } {
  const hasIncome = p.occ !== null && p.occ !== "retired" && annualIncomeMan > 0;
  const bankrupt = p.bankrupt !== null && p.age - (p.bankrupt ?? 0) < 7;
  switch (id) {
    case "family":
      return p.stats.bonds >= 20 || p.married || p.age < 40 ? { ok: true } : { ok: false, why: "頼れる家族がいない" };
    case "friend":
      return p.stats.bonds >= 30 ? { ok: true } : { ok: false, why: "お金を貸してくれる友人がいない" };
    case "bank":
      if (bankrupt) return { ok: false, why: "自己破産から7年は借りられない" };
      if (!hasIncome) return { ok: false, why: "安定した収入がないと借りられない" };
      return amountYen <= annualIncomeMan * 10000 * 3 ? { ok: true } : { ok: false, why: "年収の3倍までしか借りられない" };
    case "card":
      if (bankrupt) return { ok: false, why: "自己破産から7年は借りられない" };
      if (!hasIncome) return { ok: false, why: "安定した収入がないと借りられない" };
      return amountYen <= (annualIncomeMan * 10000) / 3 ? { ok: true } : { ok: false, why: "年収の3分の1までしか借りられない" };
    case "shark":
      return { ok: true };
  }
}
