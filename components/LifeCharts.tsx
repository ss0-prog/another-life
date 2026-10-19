"use client";

import { useState } from "react";
import { chipClass } from "@/components/controls";
import type { SeriesPoint } from "@/lib/sim/types";

type Line = { label: string; color: string; pick: (p: SeriesPoint) => number | undefined };
type Metric = { id: string; label: string; note: string; unit: string; lines: Line[]; zero?: boolean; fmt?: (v: number) => string };

const man = (v: number) => `${Math.round(v).toLocaleString("ja-JP")}万`;

const METRICS: Metric[] = [
  {
    id: "stats", label: "能力値", note: "健康・経済・つながり・学び・幸福度の移り変わり。", unit: "0〜100",
    lines: [
      { label: "健康", color: "var(--color-s-health)", pick: (p) => p.health },
      { label: "経済", color: "var(--color-s-money)", pick: (p) => p.money },
      { label: "つながり", color: "var(--color-s-bonds)", pick: (p) => p.bonds },
      { label: "学び", color: "var(--color-s-learn)", pick: (p) => p.learn },
      { label: "幸福度", color: "var(--color-s-joy)", pick: (p) => p.joy },
    ],
  },
  {
    id: "extra", label: "暮らしの数値", note: "ストレス・信用・実績・魅力の移り変わり。", unit: "0〜100",
    lines: [
      { label: "ストレス", color: "var(--color-down)", pick: (p) => p.stress },
      { label: "信用", color: "var(--color-cool)", pick: (p) => p.trust },
      { label: "実績", color: "var(--color-warm)", pick: (p) => p.career },
      { label: "魅力", color: "var(--color-s-bonds)", pick: (p) => p.charm },
    ],
  },
  {
    id: "net", label: "資産", note: "借金を引いた資産の合計。", unit: "万円",
    lines: [{ label: "資産", color: "var(--color-warm)", pick: (p) => p.net }], zero: true, fmt: man,
  },
  {
    id: "mix", label: "内訳", note: "貯金・運用資産・借金のそれぞれ。", unit: "万円",
    lines: [
      { label: "貯金", color: "var(--color-cool)", pick: (p) => p.cash },
      { label: "運用", color: "var(--color-up)", pick: (p) => p.inv },
      { label: "借金", color: "var(--color-down)", pick: (p) => p.debt },
    ], fmt: man,
  },
  {
    id: "income", label: "年収", note: "年収の目安(額面)。", unit: "万円",
    lines: [{ label: "年収", color: "var(--color-warm)", pick: (p) => p.inc }], fmt: man,
  },
  {
    id: "take", label: "手取り", note: "世帯の手取りと、引かれた税・社会保険料(結婚すると、配偶者のぶんをふくむ。簡略版の計算)。", unit: "万円",
    lines: [
      { label: "手取り", color: "var(--color-up)", pick: (p) => p.take },
      { label: "所得税・住民税", color: "var(--color-warm)", pick: (p) => p.tax },
      { label: "社会保険料", color: "var(--color-cool)", pick: (p) => p.soc },
    ], fmt: man,
  },
  {
    id: "flow", label: "収支", note: "1年のお金の増えた分(黒字)・減った分(赤字)。", unit: "万円",
    lines: [{ label: "年間の収支", color: "var(--color-up)", pick: (p) => p.flow }], zero: true, fmt: man,
  },
  {
    id: "econ", label: "景気", note: "世の中のお金の巡り(乱数でつくった架空の動き)。0がふつう、上は好況、下は不況。", unit: "指数",
    lines: [{ label: "景気", color: "var(--color-cool)", pick: (p) => p.econ }], zero: true, fmt: (v) => v.toFixed(1),
  },
  {
    id: "family", label: "家族", note: "ともに暮らす家族の人数(自分・配偶者・子ども)。", unit: "人",
    lines: [{ label: "家族の人数", color: "var(--color-s-bonds)", pick: (p) => 1 + (p.mar ? 1 : 0) + (p.kids ?? 0) }], fmt: (v) => `${Math.round(v)}人`,
  },
];

const W = 300;
const H = 110;
const PL = 36;

// 暮らしの推移を、いくつかの切り口のグラフで見る。
export function LifeCharts({ series }: { series: SeriesPoint[] }) {
  const [id, setId] = useState("stats");
  const m = METRICS.find((x) => x.id === id) ?? METRICS[0];
  if (series.length < 2) return null;
  const data = m.lines.map((l) => ({ ...l, pts: series.map((s) => ({ age: s.age, v: l.pick(s) })).filter((p): p is { age: number; v: number } => typeof p.v === "number") }));
  const all = data.flatMap((d) => d.pts.map((p) => p.v));
  if (all.length < 2) return null;
  const lo = m.id === "stats" || m.id === "extra" ? 0 : Math.min(m.zero ? 0 : Infinity, ...all);
  const hi = m.id === "stats" || m.id === "extra" ? 100 : Math.max(m.zero ? 0 : -Infinity, ...all, lo + 1);
  const minAge = series[0].age;
  const maxAge = series[series.length - 1].age;
  const x = (a: number) => PL + ((a - minAge) / Math.max(1, maxAge - minAge)) * (W - PL - 4);
  const y = (v: number) => H - 14 - ((v - lo) / Math.max(1e-9, hi - lo)) * (H - 24);
  const fmt = m.fmt ?? ((v: number) => `${Math.round(v)}`);
  return (
    <div className="mt-6 rounded-sm border border-line bg-panel/60 px-3 py-3">
      <p className="text-xs tracking-[0.3em] text-warm">グラフ</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {METRICS.map((x) => (
          <button key={x.id} type="button" onClick={() => setId(x.id)} className={`${chipClass(x.id === id)} !px-2 !py-0.5 !text-[11px]`}>
            {x.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-4 tracking-wider text-dim">{m.note}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-32 w-full" role="img" aria-label={m.label}>
        <g fontSize={8} fill="var(--color-dim)">
          {[lo, (lo + hi) / 2, hi].map((v, i) => (
            <g key={i}>
              <line x1={PL} x2={W - 4} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={0.5} strokeDasharray="2 3" />
              <text x={PL - 3} y={y(v) + 3} textAnchor="end">{fmt(v)}</text>
            </g>
          ))}
          <text x={PL} y={H - 3}>{minAge}歳</text>
          <text x={W - 4} y={H - 3} textAnchor="end">{maxAge}歳</text>
        </g>
        {m.zero && lo < 0 && hi > 0 && <line x1={PL} x2={W - 4} y1={y(0)} y2={y(0)} stroke="var(--color-haze)" strokeWidth={0.6} />}
        {data.map((d, i) => d.pts.length > 1 && <polyline key={i} fill="none" stroke={d.color} strokeWidth={1.6} strokeLinejoin="round" points={d.pts.map((p) => `${x(p.age).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")} />)}
      </svg>
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tracking-wider">
        {data.map((d, i) => (
          <span key={i} className="keep" style={{ color: d.color }}>
            ━ {d.label} {d.pts.length ? fmt(d.pts[d.pts.length - 1].v) : ""}
          </span>
        ))}
      </p>
    </div>
  );
}
