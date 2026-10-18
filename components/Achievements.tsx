"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ACHIEVEMENTS, achievementById, evaluate, type Achievement, type Rarity } from "@/lib/achievements";
import { recordUnlocked } from "@/lib/achievementStore";
import { soften } from "@/lib/jp";
import type { GameState } from "@/lib/sim/types";

const RARITY: Record<Rarity, { label: string; color: string }> = {
  common: { label: "", color: "var(--color-cool)" },
  rare: { label: "レア", color: "var(--color-s-bonds)" },
  legend: { label: "超レア", color: "var(--color-warm)" },
};

// 実績のしるし(丸い印)
export function AchievementMark({ a, size = 40 }: { a: Achievement; size?: number }) {
  const c = RARITY[a.rarity].color;
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full border font-bold"
      style={{ width: size, height: size, fontSize: size * 0.45, color: c, borderColor: c, background: `color-mix(in srgb, ${c} 14%, transparent)`, boxShadow: a.rarity === "legend" ? `0 0 14px color-mix(in srgb, ${c} 55%, transparent)` : undefined }}
    >
      {a.mark}
    </span>
  );
}

// 遊んでいる間、実績を達成したら、画面の左下に、知らせる(Steamのように)。
export function AchievementToaster({ state }: { state: GameState }) {
  const shown = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<{ id: string; first: boolean }[]>([]);
  const [current, setCurrent] = useState<{ id: string; first: boolean } | null>(null);

  // はじめの状態で、すでに満たしている実績は、知らせない(この人生で、新しく達成したものだけ)。
  useEffect(() => {
    const now = [...new Set([...(state.unlocked ?? []), ...evaluate(state)])];
    if (shown.current === null) {
      shown.current = new Set(now);
      return;
    }
    const fresh = now.filter((id) => !shown.current!.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => shown.current!.add(id));
    const firstTime = new Set(recordUnlocked(fresh));
    setQueue((q) => [...q, ...fresh.map((id) => ({ id, first: firstTime.has(id) }))]);
  }, [state]);

  useEffect(() => {
    if (current || !queue.length) return;
    setCurrent(queue[0]);
    setQueue((q) => q.slice(1));
  }, [queue, current]);

  useEffect(() => {
    if (!current) return;
    const id = window.setTimeout(() => setCurrent(null), 6000);
    return () => window.clearTimeout(id);
  }, [current]);

  const a = current ? achievementById(current.id) : null;
  return (
    <div className="pointer-events-none fixed bottom-14 left-2 z-[90] w-[min(15.5rem,calc(100vw-1rem))] sm:left-3 sm:w-[min(22rem,calc(100vw-1.5rem))] lg:bottom-12" aria-live="polite">
      <AnimatePresence>
        {a && current && (
          <motion.div
            key={a.id}
            initial={{ x: -380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -380, opacity: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 22 }}
            className="font-gothic flex items-center gap-2 rounded-sm border bg-panel px-2.5 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)] sm:gap-3 sm:px-4 sm:py-3"
            style={{ borderColor: RARITY[a.rarity].color }}
          >
            <span className="sm:hidden"><AchievementMark a={a} size={30} /></span>
            <span className="hidden sm:block"><AchievementMark a={a} size={46} /></span>
            <div className="min-w-0">
              <p className="text-[9px] tracking-[0.12em] text-dim sm:text-[11px] sm:tracking-[0.2em]">
                実績を解除しました{RARITY[a.rarity].label && <span className="ml-2" style={{ color: RARITY[a.rarity].color }}>{RARITY[a.rarity].label}</span>}
                {current.first && <span className="ml-2 text-warm">初</span>}
              </p>
              <p className="mt-0.5 text-xs font-bold tracking-wider text-mist sm:text-sm">{a.name}</p>
              <p className="mt-0.5 hidden text-[11px] leading-4 tracking-wider text-haze sm:block">{soften(a.desc, 16)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 振り返りの画面に出す、解除した実績の一覧。
export function AchievementList({ ids }: { ids: string[] | undefined }) {
  const got = (ids ?? []).map(achievementById).filter((x): x is Achievement => Boolean(x));
  return (
    <div className="mt-8 border-t border-line/60 pt-6">
      <p className="font-gothic text-center text-xs tracking-[0.3em] text-warm">
        解除した実績 <span className="tabular-nums text-haze">{got.length} / {ACHIEVEMENTS.length}</span>
      </p>
      {got.length === 0 ? (
        <p className="font-gothic mt-3 text-center text-xs tracking-wider text-dim">この人生で解除した実績はありません。</p>
      ) : (
        <ul className="font-gothic mt-4 space-y-3">
          {got.map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <AchievementMark a={a} size={34} />
              <div className="min-w-0 text-left">
                <p className="text-sm font-bold tracking-wider text-mist">
                  {a.name}
                  {RARITY[a.rarity].label && <span className="ml-2 text-[11px] font-normal" style={{ color: RARITY[a.rarity].color }}>{RARITY[a.rarity].label}</span>}
                </p>
                <p className="text-xs leading-5 tracking-wider text-haze">{soften(a.desc, 16)}</p>
                {a.trivia && <p className="mt-1 text-xs leading-5 tracking-wider text-mist">{soften(a.trivia, 16)}</p>}
                {a.source && <p className="mt-0.5 text-[10px] leading-4 tracking-wider text-dim">{a.source}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
