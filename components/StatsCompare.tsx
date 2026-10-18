"use client";

import { FIRST_BIRTH_MOTHER, FIRST_MARRIAGE, SALARY_BY_AGE, SAVINGS_BY_AGE, survival } from "@/lib/benchmarks";
import type { SeriesPoint } from "@/lib/sim/types";

export type Line = { label: string; color: string; series: SeriesPoint[]; deathAge: number };

const W = 700;
const H = 170;
const PAD = { l: 44, r: 10, t: 10, b: 22 };

// 世の中の統計と、シミュレーションの人生を、見比べる図。
export function StatsCompare({ lines }: { lines: Line[] }) {
  return (
    <section className="mx-auto mt-16 max-w-5xl">
      <h3 className="text-center text-sm tracking-[0.3em] text-mist">世の中の統計と見比べる</h3>
      <p className="mx-auto mt-2 max-w-xl w-fit text-left text-xs leading-6 tracking-wider text-dim">灰色の部分が公表されている統計です。あなたの人生がどこにあたるかを見てみましょう。(出典と読むときの注意は「出典」のページに書いています)</p>
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 [&>*]:min-w-0">
        <IncomeChart lines={lines} />
        <SavingsChart lines={lines} />
        <SurvivalChart lines={lines} />
        <EventChart lines={lines} />
      </div>
    </section>
  );
}

function Box({ title, note, source, children }: { title: string; note: string; source: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-sm border border-line bg-panel/80 px-4 py-4">
      <p className="text-sm tracking-[0.2em] text-mist">{title}</p>
      <p className="mt-1 text-[11px] leading-5 tracking-wider text-dim">{note}</p>
      {children}
      <p className="mt-2 text-[10px] leading-4 tracking-wider text-dim">出典: {source}</p>
    </div>
  );
}

const Legend = ({ lines, extra }: { lines: Line[]; extra?: string }) => (
  <p className="mt-2 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs tracking-wider">
    {extra && <span className="keep text-haze">▇ {extra}</span>}
    {lines.map((l, i) => (
      <span key={i} className="keep" style={{ color: l.color }}>━ {l.label}</span>
    ))}
  </p>
);

function scaleX(min: number, max: number) {
  return (a: number) => PAD.l + ((a - min) / Math.max(1, max - min)) * (W - PAD.l - PAD.r);
}
function scaleY(lo: number, hi: number) {
  return (v: number) => H - PAD.b - ((v - lo) / Math.max(1e-9, hi - lo)) * (H - PAD.t - PAD.b);
}
function Axis({ x, y, ticksX, ticksY, fmtY }: { x: (a: number) => number; y: (v: number) => number; ticksX: number[]; ticksY: number[]; fmtY: (v: number) => string }) {
  return (
    <g fontSize={11} fill="var(--color-dim)">
      {ticksY.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={0.6} strokeDasharray="3 4" />
          <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end">{fmtY(v)}</text>
        </g>
      ))}
      {ticksX.map((a) => (
        <text key={a} x={x(a)} y={H - 6} textAnchor="middle">{a}歳</text>
      ))}
    </g>
  );
}

// 年収: 国税庁の年齢別の平均給与(棒)と、あなたの年収(線)。
function IncomeChart({ lines }: { lines: Line[] }) {
  const x = scaleX(20, 65);
  const maxV = Math.max(700, ...lines.flatMap((l) => l.series.filter((s) => s.age <= 65).map((s) => s.inc ?? 0)));
  const hi = Math.ceil(maxV / 200) * 200;
  const y = scaleY(0, hi);
  return (
    <Box title="年収" note="年齢別の平均給与(男女計)とあなたの年収(額面の目安)。全国の平均にはパートや非正規の人もふくむので、正社員で働き続ける人生は高めに出ます。" source="国税庁「民間給与実態統計調査」令和5年分(給与所得者の平均)">
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-44 w-full">
        <Axis x={x} y={y} ticksX={[20, 30, 40, 50, 60]} ticksY={[0, hi / 2, hi]} fmtY={(v) => `${v}万`} />
        {SALARY_BY_AGE.map((b) => (
          <g key={b.from}>
            <rect x={x(b.from)} y={y(b.man)} width={x(b.to + 1) - x(b.from) - 2} height={H - PAD.b - y(b.man)} fill="var(--color-line)" opacity={0.75} />
            <text x={(x(b.from) + x(b.to + 1)) / 2} y={y(b.man) - 3} textAnchor="middle" fontSize={10} fill="var(--color-dim)">{b.man}</text>
          </g>
        ))}
        {lines.map((l, i) => {
          const pts = l.series.filter((s) => s.age >= 20 && s.age <= 65 && s.inc !== undefined);
          return pts.length > 1 ? <polyline key={i} fill="none" stroke={l.color} strokeWidth={2.2} strokeLinejoin="round" points={pts.map((s) => `${x(s.age).toFixed(1)},${y(s.inc!).toFixed(1)}`).join(" ")} /> : null;
        })}
      </svg>
      <Legend lines={lines} extra="全国の平均" />
    </Box>
  );
}

// 貯蓄: 家計調査の年齢別の平均(棒)と、あなたの資産(点)。
function SavingsChart({ lines }: { lines: Line[] }) {
  const x = scaleX(20, 90);
  const peak = Math.max(...SAVINGS_BY_AGE.map((b) => b.man), ...lines.flatMap((l) => l.series.map((s) => s.net)));
  const hi = Math.ceil(peak / 1000) * 1000;
  const lo = Math.min(0, ...lines.flatMap((l) => l.series.map((s) => s.net)));
  const y = scaleY(lo, hi);
  return (
    <Box title="貯蓄・資産" note="年齢別の貯蓄の平均(二人以上の世帯)と、あなたの資産(借金は引いた額)。世帯とひとりの違いがあるので目安として。" source="総務省「家計調査(貯蓄・負債編)」2020年平均">
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-44 w-full">
        <Axis x={x} y={y} ticksX={[20, 40, 60, 80]} ticksY={[0, Math.round(hi / 2), hi]} fmtY={(v) => `${v}万`} />
        {SAVINGS_BY_AGE.map((b) => (
          <g key={b.from}>
            <rect x={x(b.from)} y={y(b.man)} width={x(b.to + 1) - x(b.from) - 2} height={y(0) - y(b.man)} fill="var(--color-line)" opacity={0.75} />
            <text x={(x(b.from) + x(b.to + 1)) / 2} y={y(b.man) - 3} textAnchor="middle" fontSize={10} fill="var(--color-dim)">{b.man.toLocaleString("ja-JP")}</text>
          </g>
        ))}
        {lines.map((l, i) => (
          <polyline key={i} fill="none" stroke={l.color} strokeWidth={2.2} strokeLinejoin="round" points={l.series.filter((s) => s.age >= 20).map((s) => `${x(s.age).toFixed(1)},${y(s.net).toFixed(1)}`).join(" ")} />
        ))}
      </svg>
      <Legend lines={lines} extra="全国の平均" />
    </Box>
  );
}

// 寿命: 同じ年齢まで生きる人の割合(曲線)と、あなたの亡くなった年齢(縦線)。
function SurvivalChart({ lines }: { lines: Line[] }) {
  const curve = survival();
  // 100歳をこえて生きた人生があれば、横軸を、のばす(目盛りの数字は、100まで)
  const x = scaleX(0, Math.max(105, ...lines.map((l) => l.deathAge + 4)));
  const y = scaleY(0, 100);
  const pctAt = (age: number) => curve[Math.min(curve.length - 1, Math.max(0, Math.round(age)))].pct;
  return (
    <Box title="寿命" note="同じ年齢まで生きる人の全国での割合(曲線)と、あなたの亡くなった年齢(縦線)。" source="厚生労働省「簡易生命表」令和5年(平均余命に合わせた死亡率から計算。男女の平均)">
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-44 w-full">
        <Axis x={x} y={y} ticksX={[0, 20, 40, 60, 80, 100]} ticksY={[0, 50, 100]} fmtY={(v) => `${v}%`} />
        <polyline fill="var(--color-line)" fillOpacity={0.35} stroke="var(--color-haze)" strokeWidth={1.6} points={`${x(0)},${y(0)} ${curve.map((c) => `${x(c.age).toFixed(1)},${y(c.pct).toFixed(1)}`).join(" ")} ${x(105)},${y(0)}`} />
        {lines.map((l, i) => (
          <g key={i}>
            <line x1={x(l.deathAge)} x2={x(l.deathAge)} y1={y(pctAt(l.deathAge))} y2={y(0)} stroke={l.color} strokeWidth={2.2} />
            <circle cx={x(l.deathAge)} cy={y(pctAt(l.deathAge))} r={4} fill={l.color} />
          </g>
        ))}
      </svg>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tracking-wider">
        {lines.map((l, i) => (
          <span key={i} className="max-w-full" style={{ color: l.color }}>● {l.label} {l.deathAge}歳(同じ年まで生きる人は全国で約{Math.round(pctAt(l.deathAge))}%)</span>
        ))}
      </p>
    </Box>
  );
}

// 結婚・出産の年齢: 全国の平均(縦の帯)と、あなたの年齢(点)。
function EventChart({ lines }: { lines: Line[] }) {
  const x = scaleX(18, 50);
  const rows = [
    { key: "mar", label: "結婚した年齢", lo: FIRST_MARRIAGE.wife, hi: FIRST_MARRIAGE.husband, text: `全国の初婚の平均: 妻${FIRST_MARRIAGE.wife}歳〜夫${FIRST_MARRIAGE.husband}歳` },
    { key: "kid", label: "はじめての子の年齢", lo: FIRST_BIRTH_MOTHER, hi: FIRST_BIRTH_MOTHER, text: `全国の第1子出生時の母の平均: ${FIRST_BIRTH_MOTHER}歳` },
  ] as const;
  const ageOf = (l: Line, key: "mar" | "kid") => {
    const s = l.series;
    if (s.length === 0) return null;
    if (key === "mar") {
      if (s[0].mar) return null; // 最初から結婚していた
      const f = s.find((p) => p.mar);
      return f ? f.age : undefined;
    }
    if ((s[0].kids ?? 0) > 0) return null;
    const f = s.find((p) => (p.kids ?? 0) > 0);
    return f ? f.age : undefined;
  };
  const rowH = 58;
  return (
    <Box title="結婚と子ども" note="全国の平均(灰色の帯)とあなたが結婚した年齢・はじめて子どもを授かった年齢。" source="厚生労働省「人口動態統計」2023年(確定数)">
      <svg viewBox={`0 0 ${W} ${rowH * 2 + 26}`} className="mt-2 h-44 w-full">
        {[20, 30, 40, 50].map((a) => (
          <g key={a} fontSize={11} fill="var(--color-dim)">
            <line x1={x(a)} x2={x(a)} y1={4} y2={rowH * 2} stroke="var(--color-line)" strokeWidth={0.6} strokeDasharray="3 4" />
            <text x={x(a)} y={rowH * 2 + 16} textAnchor="middle">{a}歳</text>
          </g>
        ))}
        {rows.map((r, ri) => (
          <g key={r.key}>
            <text x={PAD.l - 38} y={ri * rowH + 14} fontSize={11} fill="var(--color-haze)">{r.label}</text>
            <rect x={x(r.lo) - 5} y={ri * rowH + 20} width={x(r.hi) - x(r.lo) + 10} height={30} fill="var(--color-line)" opacity={0.8} />
            {lines.map((l, i) => {
              const a = ageOf(l, r.key);
              return typeof a === "number" ? <circle key={i} cx={x(a)} cy={ri * rowH + 35 + (i - (lines.length - 1) / 2) * 7} r={5} fill={l.color} /> : null;
            })}
          </g>
        ))}
      </svg>
      <p className="mt-1 text-[11px] leading-5 tracking-wider text-dim">{rows[0].text}。{rows[1].text}。</p>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs tracking-wider">
        {lines.map((l, i) => {
          const m = ageOf(l, "mar");
          const k = ageOf(l, "kid");
          const t = (v: number | null | undefined, what: string) => (v === null ? `${what}: 最初から` : v === undefined ? `${what}: なし` : `${what}: ${v}歳`);
          return <span key={i} className="max-w-full" style={{ color: l.color }}>● {l.label}({t(m, "結婚")}・{t(k, "子")})</span>;
        })}
      </p>
    </Box>
  );
}
