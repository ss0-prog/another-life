"use client";

import { useState } from "react";
import { chipClass } from "@/components/controls";
import type { Messages } from "@/lib/i18n";
import { jpData } from "@/lib/sim/data/jp";
import { lessonById } from "@/lib/sim/data/jp-lessons";
import { fitScore } from "@/lib/sim/mbti";
import { MAX_LESSONS } from "@/lib/sim/types";
import type { GameState } from "@/lib/sim/types";

type Props = {
  t: Messages["play"]["lessons"];
  state: GameState;
  onStart: (id: string) => boolean;
  onStop: (id: string) => void;
  mode?: "lesson" | "hobby";
  embedded?: boolean;
};

// 習い事。大人も子どもも、いつでも始めたり、やめたりできる。同時にできるのは5つまで。
export function LessonPanel({ t, state, onStart, onStop, mode = "lesson", embedded = false }: Props) {
  const isHobby = (id: string) => lessonById(id)?.group === "趣味";
  const inMode = (id: string) => (mode === "hobby") === isHobby(id);
  const [open, setOpen] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const p = state.person;
  const dead = state.deathAge !== null;
  const full = p.lessons.length >= MAX_LESSONS;
  const taken = new Set(p.lessons.map((l) => l.id));
  const kid = p.age < 18;

  // 年齢にあう習い事を、分野ごとに。
  const groups = [...new Set(jpData.lessons.filter((l) => inMode(l.id)).map((l) => l.group))].map((g) => ({
    group: g,
    items: jpData.lessons.filter((l) => l.group === g && (!l.needs || (p.mbti ? new RegExp(l.needs).test(p.mbti) : false)) && p.age >= l.minAge && (l.maxAge === undefined || p.age <= l.maxAge) && !taken.has(l.id)),
  }));

  // この性格に向いている活動(向き不向きの点数が高いもの)。
  const recommended = groups.flatMap((g) => g.items).filter((l) => fitScore(p.mbti, l.tags) >= 2 || (l.needs && p.mbti)).slice(0, 6);

  return (
    <div className="mt-4 rounded-sm border border-line bg-panel/60 px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-xs tracking-[0.3em] text-warm">
          {mode === "hobby" ? "趣味" : t.title} <span className="tabular-nums text-haze">{p.lessons.filter((l) => inMode(l.id)).length}つ</span>
          <span className="ml-2 tabular-nums text-dim">(習い事と趣味であわせて {p.lessons.length}/{MAX_LESSONS})</span>
        </p>
        {!dead && !embedded && (
          <button type="button" onClick={() => { setOpen((o) => !o); setMsg(null); }} className="text-xs tracking-[0.15em] text-haze underline-offset-4 hover:text-mist hover:underline">
            {open ? t.close : t.add}
          </button>
        )}
      </div>

      {p.lessons.filter((l) => inMode(l.id)).length === 0 ? (
        <p className="mt-2 text-sm leading-7 tracking-wider text-dim">{t.none}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {p.lessons.filter((l) => inMode(l.id)).map((l) => {
            const def = lessonById(l.id);
            if (!def) return null;
            return (
              <li key={l.id} className="flex items-baseline justify-between gap-2 text-sm leading-7 tracking-wider">
                <span className="text-mist">
                  {def.label}
                  <span className="ml-2 text-xs text-dim">
                    {p.age - l.since + 1}
                    {t.yearsIn}
                  </span>
                </span>
                {!dead && (
                  <button type="button" onClick={() => onStop(l.id)} className="shrink-0 text-xs tracking-wider text-dim hover:text-mist">
                    {t.stop}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {open && !dead && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="mb-2 text-[11px] leading-4 tracking-wider text-dim">習い事と趣味は合わせて5つまで。★は性格に向いている活動、△は苦手な活動です。</p>
          {full && <p className="mb-2 text-xs leading-6 tracking-wider" style={{ color: "var(--color-s-bonds)" }}>{t.full}</p>}
          {msg && <p className="mb-2 text-xs leading-6 tracking-wider text-dim">{msg}</p>}
          {p.mbti && recommended.length > 0 && (
            <div className="mb-3">
              <p className="text-xs tracking-[0.2em] text-warm">★ {p.mbti}タイプに向いている活動</p>
              <div className="mt-1 grid grid-cols-1 gap-1.5">
                {recommended.map((l) => (
                  <button key={l.id} type="button" disabled={full} title={l.note} onClick={() => setMsg(onStart(l.id) ? null : t.full)} className={`${chipClass(false)} flex w-full items-center justify-between gap-3 !border-warm/50 !px-3 !py-2 !text-left !text-xs leading-5 disabled:opacity-40`}>
                    <span className="block">★ {l.label}</span>
                    <span className="block shrink-0 text-dim">{kid ? "親が払う" : `${t.yearly}${l.costMan}${t.man}`}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!p.mbti && <p className="mb-2 text-[11px] leading-4 tracking-wider text-dim">MBTIを入力するとあなたの性格に向いている活動が出ます。</p>}
          <div className="max-h-60 space-y-3 overflow-y-auto pr-1">
            {groups.map(
              (g) =>
                g.items.length > 0 && (
                  <div key={g.group}>
                    <p className="text-xs tracking-[0.2em] text-haze">{g.group}</p>
                    <div className="mt-1 grid grid-cols-1 gap-1.5">
                      {g.items.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          disabled={full}
                          title={l.note}
                          onClick={() => setMsg(onStart(l.id) ? null : t.full)}
                          className={`${chipClass(false)} flex w-full items-center justify-between gap-3 !px-3 !py-2 !text-left !text-xs leading-5 disabled:opacity-40`}
                        >
                          <span className="block">{fitScore(p.mbti, l.tags) >= 2 ? "★ " : fitScore(p.mbti, l.tags) <= -1 ? "△ " : ""}{l.label}</span>
                          <span className="block shrink-0 text-dim">{kid ? "親が払う" : `${t.yearly}${l.costMan}${t.man}`}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ),
            )}
          </div>
          {kid && <p className="mt-2 text-xs leading-6 tracking-wider text-dim">{t.parentPays}</p>}
        </div>
      )}
    </div>
  );
}
