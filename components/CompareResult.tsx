"use client";

import { AchievementList } from "@/components/Achievements";
import { ShareButtons } from "@/components/ShareButtons";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { recordUnlocked } from "@/lib/achievementStore";
import { soften } from "@/lib/jp";
import { EventText } from "@/components/EventText";
import type { Messages } from "@/lib/i18n";
import { downloadBlob, renderCard } from "@/lib/card";
import { DeltaItem } from "@/components/Delta";
import { StatsCompare } from "@/components/StatsCompare";
import { DISEASES } from "@/lib/sim/data/jp-death";
import type { LifeSummary } from "@/lib/sim/types";

type Props = {
  t: Messages["result"];
  real: LifeSummary;
  alt: LifeSummary;
  onSave: (publish: boolean) => Promise<"cloud" | "local" | "failed">;
  canPublish: boolean;
  onAgain: () => void;
  // マルチバース: 同じ運命のまま、別の道を歩んだ、ほかの宇宙。
  altLabel?: string;
  others?: { label: string; life: LifeSummary }[];
  onMulti?: () => void;
  multiLeft?: number;
};

const STAT_KEYS = ["health", "money", "bonds", "learn", "joy"] as const;

export function CompareResult({ t, real, alt, onSave, canPublish, onAgain, altLabel, others = [], onMulti, multiLeft = 0 }: Props) {
  const [publish, setPublish] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const afterScene = 3;
  // 遊んだ人生で達成した実績を、この端末の記録(コレクション)に残す。
  useEffect(() => {
    recordUnlocked(alt.achievements ?? []);
  }, [alt]);

  return (
    <motion.article className="mx-auto w-full max-w-[120rem]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }}>
      <FadeIn delay={0.2}>
        <h2 className="text-center text-xl tracking-[0.35em] text-mist sm:text-2xl">{t.title}</h2>
        <p className="mx-auto mt-3 max-w-lg w-fit text-left text-xs leading-6 tracking-wider text-dim">※ これはあくまでシミュレーションです。占いや予言ではなくあなたの実際の人生や将来を、当てたり保証したりするものでは決してありません。</p>
        <p className="mx-auto mt-6 max-w-md w-fit text-left text-sm leading-8 tracking-wider text-haze">{t.lead}</p>
      </FadeIn>

      <FadeIn delay={0.6} className="mx-auto mt-12 max-w-7xl">
        <SeriesChart real={real} alt={alt} altLabel={altLabel} others={others} />
      </FadeIn>

      <FadeIn delay={0.8}>
        <StatsCompare
          lines={[
            { label: "現実のあなた", color: "var(--color-cool)", series: real.series ?? [], deathAge: real.deathAge },
            { label: others.length ? `宇宙1: ${altLabel ?? "分岐したあなた"}` : "分岐したあなた", color: "var(--color-warm)", series: alt.series ?? [], deathAge: alt.deathAge },
            ...others.map((o, i) => ({ label: `宇宙${i + 2}: ${o.label}`, color: OTHER_COLORS[i % OTHER_COLORS.length], series: o.life.series ?? [], deathAge: o.life.deathAge })),
          ]}
        />
      </FadeIn>

      <div className="mx-auto mt-16 grid max-w-7xl gap-16 md:grid-cols-2 md:gap-x-10 md:gap-y-0">
        <LifeCard t={t} heading={t.realHeading} life={real} delay={0.8} accent="cool" />
        <LifeCard t={t} heading={t.altHeading} life={alt} delay={1.2} accent="warm" />
      </div>

      {others.length > 0 && (
        <FadeIn delay={1.6} className="mx-auto mt-14 max-w-7xl">
          <h3 className="text-center text-sm tracking-[0.3em] text-mist">同じ運命のほかの宇宙</h3>
          <p className="mt-1 text-center text-xs tracking-wider text-dim">景気・空模様・めぐり合わせは同じで、選んだ道だけがちがう人生です</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {others.map((o, i) => (
              <div key={i} className="rounded-sm border border-line bg-panel/80 px-5 py-4" style={{ borderTop: `2px solid ${OTHER_COLORS[i % OTHER_COLORS.length]}` }}>
                <p className="text-sm tracking-[0.15em]" style={{ color: OTHER_COLORS[i % OTHER_COLORS.length] }}>宇宙{i + 2}: {o.label}</p>
                <p className="mt-2 text-sm leading-7 tracking-wider text-mist">
                  {o.life.deathAge}歳で{o.life.deathCause ? `(${o.life.deathCause})` : ""}人生を終えた ・ 資産 {o.life.assets.total.toLocaleString("ja-JP")}万円 ・ 幸福度 {Math.round(o.life.stats.joy)}
                </p>
                {o.life.turning && o.life.turning[0] && <p className="mt-1 text-xs leading-6 tracking-wider text-dim">いちばんの分かれ目: {o.life.turning.slice().sort((x, y) => y.impact - x.impact)[0].age}歳「{o.life.turning.slice().sort((x, y) => y.impact - x.impact)[0].event}」</p>}
              </div>
            ))}
          </div>
        </FadeIn>
      )}

      <FadeIn delay={afterScene} className="mt-24 flex flex-col items-center gap-6">
        {onMulti && multiLeft > 0 && (
          <div className="text-center">
            <button type="button" onClick={onMulti} className="border border-warm/70 bg-warm/10 px-8 py-3 text-base font-bold tracking-[0.2em] text-mist transition-colors hover:border-warm">
              同じ運命のまま、別の道を試す(あと{multiLeft}つ)
            </button>
            <p className="mt-2 text-xs leading-6 tracking-wider text-dim">ターニングポイントまで巻き戻します。景気や空模様は同じまま選ぶ道だけを変えて、並べて比べられます。</p>
          </div>
        )}
        {canPublish && (
          <label className="flex max-w-md cursor-pointer items-start gap-3 text-sm leading-7 tracking-wider text-haze">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="mt-2 accent-[#f0c994]" />
            <span>
              {t.publish}
              <span className="block text-xs text-dim">{t.publishHint}</span>
            </span>
          </label>
        )}
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm tracking-[0.2em]">
          <button
            type="button"
            disabled={saving || (saved !== null && saved !== t.saveFailed)}
            onClick={async () => {
              setSaving(true);
              const r = await onSave(publish);
              setSaving(false);
              setSaved(r === "cloud" ? t.savedCloud : r === "local" ? t.savedLocal : t.saveFailed);
            }}
            className="border border-warm/60 bg-warm/5 px-6 py-3 text-mist transition-colors hover:border-warm disabled:opacity-50"
          >
            {saved ?? t.save}
          </button>
          <button
            type="button"
            onClick={async () => {
              const blob = await renderCard(real, alt);
              if (blob) downloadBlob(blob, "betsu-uchu-card.png");
            }}
            className="border border-line px-6 py-3 text-mist transition-colors hover:border-haze"
          >
            {t.card}
          </button>
        </div>
        <ShareButtons text="選ばなかった道の先にもわたしの人生があった。もうひとつの人生を歩いてみた。" path="/" />
        <button type="button" onClick={onAgain} className="text-xs tracking-[0.3em] text-haze underline-offset-8 transition-colors hover:text-mist hover:underline">
          {t.again}
        </button>
        <p className="mx-auto mt-8 max-w-md w-fit text-left text-xs leading-6 tracking-wider text-dim">{t.disclaimer}</p>
      </FadeIn>
    </motion.article>
  );
}

export type LifeView = Pick<LifeSummary, "deathAge" | "stats" | "assets" | "turning" | "death" | "achievements"> & { deathCause?: string } & { echo: LifeSummary["echo"] };

export function LifeCard({ t, heading, life, delay, accent }: { t: Messages["result"]; heading: string; life: LifeView; delay: number; accent: "cool" | "warm" }) {
  const { echo } = life;
  return (
    <section className="rounded-sm border border-line bg-panel/80 px-6 py-10 backdrop-blur-sm md:row-span-6 md:grid md:grid-rows-subgrid" style={{ borderTop: `2px solid var(--color-${accent})` }}>
      <FadeIn delay={delay}>
        <p className="text-center text-sm tracking-[0.3em]" style={{ color: `var(--color-${accent})` }}>{heading}</p>
        <p className="mt-6 text-center text-4xl tabular-nums tracking-widest text-mist">
          {life.deathAge}
          <span className="ml-2 text-sm text-haze">{t.endAge}</span>
        </p>
        {life.deathCause && <p className="mt-2 text-center text-sm tracking-[0.2em] text-dim">{t.cause}: {life.deathCause}</p>}
      </FadeIn>
      {/* 以下の行は、左右の人生で、同じ高さにそろえる(内容が少ないほうは、空の行になる) */}
      <FadeIn delay={delay}>{life.death ? <DeathExplain death={life.death} /> : null}</FadeIn>
      <FadeIn delay={delay}>
        <p className="mx-auto mt-6 w-fit text-left text-base leading-8 tracking-wider text-mist">{soften(echo.status.summary)}</p>
        <dl className="mt-4 space-y-1 text-center text-base leading-7 tracking-wider text-haze">
          <dd>{echo.status.occupation}</dd>
          <dd>{echo.status.city}</dd>
          <dd>{echo.status.living}</dd>
        </dl>
      </FadeIn>
      <FadeIn delay={delay}>
        <div className="mx-auto mt-8 grid max-w-md grid-cols-5 gap-2 min-[480px]:gap-3">
          {STAT_KEYS.map((k) => (
            <div key={k} className="text-center">
              <p className="text-lg tabular-nums" style={{ color: `var(--color-s-${k})` }}>{Math.round(life.stats[k])}</p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-line">
                <div className="h-1.5 rounded-full" style={{ width: `${life.stats[k]}%`, background: `var(--color-s-${k})` }} />
              </div>
              <p className="mt-2 whitespace-nowrap text-[10px] tracking-[0.02em] text-haze min-[480px]:text-xs min-[480px]:tracking-[0.15em]">{t.stats[k]}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-base tracking-wider text-mist">
          <span className="text-sm text-haze">{t.assets}</span>{" "}
          <span className="text-xl tabular-nums">{life.assets.total.toLocaleString("ja-JP")}</span>
          <span className="text-sm text-haze"> {t.unit}</span>
        </p>
        <p className="mt-1 text-center text-sm tracking-wider text-haze">
          {t.pnl} {life.assets.pnl >= 0 ? "+" : ""}
          {life.assets.pnl.toLocaleString("ja-JP")}
          {t.unit}
        </p>
        {life.achievements && <AchievementList ids={life.achievements} />}
      </FadeIn>

      <FadeIn delay={delay + 0.8} className="mt-12">
        <p className="text-center text-sm tracking-[0.3em] text-haze">{t.timelineHeading}</p>
        <ol className="relative mx-auto mt-6 max-w-sm border-l border-line pl-7">
          {echo.timeline.map((item, i) => (
            <li key={i} className="relative pb-5 last:pb-0">
              <span className="absolute -left-[31px] top-2.5 h-1.5 w-1.5 rounded-full bg-haze" />
              <span className="text-sm tracking-[0.2em] text-warm">{item.age}歳</span>
              <EventText text={item.event} className="mt-1 text-sm leading-7 tracking-wider text-mist" />
            </li>
          ))}
        </ol>
      </FadeIn>

      {life.turning && life.turning.length > 0 ? (
        <FadeIn delay={delay + 1.2} className="mt-12">
          <p className="text-center text-sm tracking-[0.3em] text-haze">人生の大きな分かれ目</p>
          <p className="mt-1 text-center text-xs tracking-wider text-dim">能力値や資産が大きく動いた出来事です</p>
          <ol className="mx-auto mt-5 max-w-sm space-y-4">
            {life.turning.map((m, i) => (
              <li key={i} className="border-l-2 pl-4" style={{ borderColor: `var(--color-${accent})` }}>
                <span className="text-sm font-bold tracking-[0.2em] text-warm">{m.age}歳</span>
                <EventText text={m.event} className="mt-1 text-base font-bold leading-7 tracking-wider text-mist" />
                {m.fx && (
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs font-bold tabular-nums">
                    {m.fx.money !== undefined && (
                      <DeltaItem label="資産" color="var(--color-s-money)" up={m.fx.money >= 0}>
                        {Math.abs(m.fx.money) >= 10000 ? `${Math.round(Math.abs(m.fx.money) / 10000).toLocaleString("ja-JP")}万円` : `${Math.abs(m.fx.money).toLocaleString("ja-JP")}円`}
                      </DeltaItem>
                    )}
                    {STAT_KEYS.filter((k) => m.fx?.stats?.[k]).map((k) => (
                      <DeltaItem key={k} label={t.stats[k]} color={`var(--color-s-${k})`} up={(m.fx!.stats![k] ?? 0) > 0}>
                        {Math.abs(m.fx!.stats![k] ?? 0)}
                      </DeltaItem>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </FadeIn>
      ) : (
        <div />
      )}
    </section>
  );
}

// 亡くなった原因・理由と、その病気(出来事)の説明と出典。
function DeathExplain({ death }: { death: NonNullable<LifeSummary["death"]> }) {
  const d = DISEASES[death.disease];
  return (
    <div className="mx-auto mt-6 max-w-md rounded-sm border border-line bg-void/40 px-4 py-4 text-left">
      <p className="text-xs tracking-[0.3em] text-haze">なぜ亡くなったのか</p>
      <p className="mt-2 text-sm font-bold tracking-wider text-mist">原因: {death.cause}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-7 tracking-wider text-haze">
        {death.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
      {d && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs tracking-[0.3em] text-haze">{d.label}について</p>
          <p className="mt-1 text-sm leading-7 tracking-wider text-mist">{d.summary}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-6 tracking-wider text-haze">
            {d.facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-5 tracking-wider text-dim">
            出典:{" "}
            <a href={d.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-mist">
              {d.source.name}
            </a>
          </p>
        </div>
      )}
      <p className="mt-3 text-[10px] leading-4 tracking-wider text-dim">※ シミュレーションの結果です。実際の診断や医療の助言ではありません。</p>
    </div>
  );
}

function FadeIn({ delay, className, children }: { delay: number; className?: string; children: React.ReactNode }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 1.6, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}

const OTHER_COLORS = ["var(--color-s-bonds)", "var(--color-s-health)", "var(--color-s-joy)"];

// 人生の、資産と幸福度の移り変わり。現実のあなたと、分岐したあなた(複数の宇宙)を、重ねて見られる。
function SeriesChart({ real, alt, altLabel, others }: { real: LifeSummary; alt: LifeSummary; altLabel?: string; others: { label: string; life: LifeSummary }[] }) {
  const lines = [
    { label: "現実のあなた", color: "var(--color-cool)", series: real.series ?? [] },
    { label: others.length ? `宇宙1: ${altLabel ?? "分岐したあなた"}` : "分岐したあなた", color: "var(--color-warm)", series: alt.series ?? [] },
    ...others.map((o, i) => ({ label: `宇宙${i + 2}: ${o.label}`, color: OTHER_COLORS[i % OTHER_COLORS.length], series: o.life.series ?? [] })),
  ];
  const all = lines.flatMap((l) => l.series);
  if (all.length < 2) return null;
  const minAge = Math.min(...all.map((x) => x.age));
  const maxAge = Math.max(...all.map((x) => x.age));
  const W = 700;
  const H = 150;
  const x = (age: number) => ((age - minAge) / Math.max(1, maxAge - minAge)) * W;
  const charts: { title: string; note: string; pick: (p: { net: number; joy: number }) => number; fmt: (n: number) => string }[] = [
    { title: "資産の移り変わり", note: "万円(借金は引いています)", pick: (p) => p.net, fmt: (n) => `${Math.round(n).toLocaleString("ja-JP")}万円` },
    { title: "幸福度の移り変わり", note: "0〜100", pick: (p) => p.joy, fmt: (n) => `${Math.round(n)}` },
  ];
  return (
    <div className="grid gap-8 md:grid-cols-2">
      {charts.map((c) => {
        const data = lines.map((l) => ({ ...l, pts: l.series.map((p) => ({ age: p.age, v: c.pick(p) })) }));
        const vals = data.flatMap((d) => d.pts.map((p) => p.v));
        const lo = Math.min(0, ...vals);
        const hi = Math.max(1, ...vals);
        const y = (v: number) => H - ((v - lo) / Math.max(1e-9, hi - lo)) * (H - 10) - 5;
        return (
          <div key={c.title} className="rounded-sm border border-line bg-panel/80 px-4 py-4">
            <p className="text-sm tracking-[0.2em] text-mist">{c.title}<span className="ml-2 text-xs text-dim">{c.note}</span></p>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-40 w-full" preserveAspectRatio="none">
              <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              {data.map((d, i) => d.pts.length > 1 && <polyline key={i} points={d.pts.map((p) => `${x(p.age).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")} fill="none" stroke={d.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
            </svg>
            <div className="mt-1 flex justify-between text-xs tabular-nums text-dim">
              <span>{minAge}歳</span>
              <span>{maxAge}歳</span>
            </div>
            <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs tracking-wider">
              {data.map((d, i) => (
                <span key={i} className="keep" style={{ color: d.color }}>━ {d.label} {d.pts.length ? c.fmt(d.pts[d.pts.length - 1].v) : "—"}</span>
              ))}
            </p>
          </div>
        );
      })}
    </div>
  );
}
