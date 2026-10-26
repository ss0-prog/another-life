"use client";

import { useEffect, useMemo, useState } from "react";
import { AchievementMark } from "@/components/Achievements";
import { ShareButtons } from "@/components/ShareButtons";
import { PageShell } from "@/components/PageShell";
import { soften } from "@/lib/jp";
import { ACHIEVEMENTS, GROUPS, groupOf, type Achievement, type Rarity } from "@/lib/achievements";
import { unlockedAll } from "@/lib/achievementStore";

const RARITY: Record<Rarity, { label: string }> = { common: { label: "ふつう" }, rare: { label: "レア" }, legend: { label: "超レア" } };

// コレクション: これまでに解除した実績と、まだ解除していない実績。
export default function CollectionPage() {
  const [got, setGot] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setGot(unlockedAll());
    setReady(true);
  }, []);

  const total = ACHIEVEMENTS.length;
  const count = ACHIEVEMENTS.filter((a) => got[a.id]).length;
  const byRarity = useMemo(
    () =>
      (["common", "rare", "legend"] as Rarity[]).map((r) => {
        const all = ACHIEVEMENTS.filter((a) => a.rarity === r);
        return { r, all: all.length, got: all.filter((a) => got[a.id]).length };
      }),
    [got],
  );

  const share = ready ? (
    <div className="py-2">
      <ShareButtons label="実績を共有する" path="/" text={`「別の宇宙のあなた」で、実績を ${count} / ${total} 集めた。`} />
    </div>
  ) : null;

  const card = (a: Achievement) => {
    const on = Boolean(got[a.id]);
    const secret = !on && Boolean(a.secret);
    return (
      <li key={a.id} className={`flex items-start gap-3 rounded-sm border p-4 ${on ? "border-line bg-panel/80" : "border-line/50 bg-panel/40"}`}>
        <span className={on ? "" : "opacity-40 grayscale"}>
          <AchievementMark a={secret ? { ...a, mark: "？" } : a} size={44} />
        </span>
        <div className="font-gothic min-w-0">
          <p className={`text-sm font-bold tracking-wider ${on ? "text-mist" : "text-dim"}`}>
            {secret ? "？？？" : a.name}
            <span className="ml-2 text-[11px] font-normal text-dim">{RARITY[a.rarity].label}</span>
          </p>
          <p className={`mt-1 text-xs leading-5 tracking-wider ${on ? "text-haze" : "text-dim"}`}>{secret ? "ひみつの実績。達成するまで条件はわかりません。" : soften(a.desc, 16)}</p>
          {on && a.trivia && <p className="mt-1 text-xs leading-5 tracking-wider text-mist">{soften(a.trivia, 16)}</p>}
          {on && a.source && <p className="mt-0.5 text-[10px] leading-4 tracking-wider text-dim">{a.source}</p>}
          {on && <p className="mt-1 text-[10px] tracking-wider text-warm">{new Date(got[a.id]).toLocaleDateString("ja-JP")} に解除</p>}
        </div>
      </li>
    );
  };

  return (
    <PageShell title="コレクション" lead="遊びの中で達成した実績を集めて、ならべます。まだ見つけていない実績もあります。">
      <section>
        <div className="font-gothic mx-auto max-w-xl text-center">
          <p className="text-xs tracking-[0.3em] text-warm">解除した実績</p>
          <p className="mt-2 text-4xl tabular-nums tracking-widest text-mist">
            {ready ? count : "–"}
            <span className="text-lg text-haze"> / {total}</span>
          </p>
          <div className="mx-auto mt-4 h-2 w-full overflow-hidden rounded-full bg-line/70" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={count} aria-label="解除した実績の数">
            <div className="h-2 rounded-full bg-warm transition-all duration-700" style={{ width: `${(count / total) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs tracking-wider text-dim">{ready ? `${Math.round((count / total) * 100)}% を集めた` : ""}</p>
          <div className="mt-4 flex justify-center gap-5 text-xs tracking-wider text-haze">
            {byRarity.map((x) => (
              <span key={x.r}>
                {RARITY[x.r].label} <span className="tabular-nums text-mist">{x.got}</span>/{x.all}
              </span>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-5 tracking-wider text-dim">この記録は、この端末のブラウザの中にだけ保存されています。ブラウザのデータを消すとなくなります。</p>
          <div className="mt-5">{share}</div>
        </div>
      </section>

      {GROUPS.map((g) => {
        const list = ACHIEVEMENTS.filter((a) => groupOf(a.id) === g);
        if (!list.length) return null;
        const n = list.filter((a) => got[a.id]).length;
        return (
          <section key={g}>
            <h2 className="border-l-2 border-warm pl-4 text-xl tracking-[0.2em] text-warm">
              {g}
              <span className="font-gothic ml-3 text-xs tracking-wider text-dim">
                {n} / {list.length}
              </span>
            </h2>
            <ul className="mt-5 grid gap-3 md:grid-cols-2">{list.map(card)}</ul>
          </section>
        );
      })}
      {share}
    </PageShell>
  );
}
