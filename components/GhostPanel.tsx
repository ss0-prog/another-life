"use client";

import type { SeriesPoint } from "@/lib/sim/types";

type Props = {
  age: number;
  selfAge: number;
  ghost: SeriesPoint[];
  netMan: number;
  joy: number;
};

const sign = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("ja-JP")}`;
const tone = (n: number) => (n >= 0 ? "var(--color-up)" : "var(--color-down)");

// 「現実のあなた」との、同じ年齢での見比べ。分かれた道のあなたが、いま、どれだけ違うかが、リアルタイムでわかる。
export function GhostPanel({ age, selfAge, ghost, netMan, joy }: Props) {
  const there = ghost.find((g) => g.age === age);
  const last = ghost[ghost.length - 1];
  return (
    <div className="mt-6 rounded-sm border border-cool/50 bg-panel/60 px-4 py-3">
      <p className="text-xs tracking-[0.3em]" style={{ color: "var(--color-cool)" }}>現実のあなた</p>
      <p className="mt-1 text-[11px] leading-4 tracking-wider text-dim">分かれずに歩いたあなたと同じ年齢で見比べます</p>
      {age < selfAge ? (
        <p className="mt-2 text-sm leading-7 tracking-wider text-haze">いまのあなたは{selfAge}歳。あと{selfAge - age}年で同じ年齢に追いつきます。</p>
      ) : there ? (
        <dl className="mt-2 space-y-1 text-sm tracking-wider">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-haze">資産</dt>
            <dd className="tabular-nums text-mist">
              {there.net.toLocaleString("ja-JP")}万円
              <span className="ml-2 font-bold" style={{ color: tone(netMan - there.net) }}>({sign(netMan - there.net)}万円)</span>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-haze">幸福度</dt>
            <dd className="tabular-nums text-mist">
              {there.joy}
              <span className="ml-2 font-bold" style={{ color: tone(joy - there.joy) }}>({sign(Math.round(joy) - there.joy)})</span>
            </dd>
          </div>
          <p className="text-[11px] leading-4 text-dim">かっこの中はあなたが現実のあなたよりどれだけ上か下か</p>
        </dl>
      ) : (
        <p className="mt-2 text-sm leading-7 tracking-wider text-haze">現実のあなたは、{last ? `${last.age}歳` : "この年齢より前"}で人生を終えています。</p>
      )}
    </div>
  );
}
