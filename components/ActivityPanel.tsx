"use client";

import { partTimeAvailable, yearOf } from "@/lib/sim/era";
import { useState } from "react";
import { chipClass } from "@/components/controls";
import { LessonPanel } from "@/components/LessonPanel";
import type { Messages } from "@/lib/i18n";
import { jpData } from "@/lib/sim/data/jp";
import { officeChance } from "@/lib/sim/engine";
import { fitScore } from "@/lib/sim/mbti";
import { shopBuyable, shopSellable } from "@/lib/sim/shop";
import { MEETINGS, MEET_LIMIT } from "@/lib/sim/data/jp-meet";
import type { GameState } from "@/lib/sim/types";

type Props = {
  t: Messages["play"]["lessons"];
  state: GameState;
  onStartLesson: (id: string) => boolean;
  onStopLesson: (id: string) => void;
  onStartPart: (id: string) => boolean;
  onStopPart: () => void;
  onRun: (id: string) => boolean;
  onBuy: (id: string) => boolean;
  onSell: (id: string) => boolean;
  onMeet: (id: string) => boolean;
};

type View = "lesson" | "hobby" | "part" | "meet" | "office" | "shop";

// 右の列の上にある「活動する」。習い事・趣味・アルバイト・出馬(25歳〜)を、いつでも始められる。
export function ActivityPanel({ t, state, onStartLesson, onStopLesson, onStartPart, onStopPart, onRun, onBuy, onSell, onMeet }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const p = state.person;
  const dead = state.deathAge !== null;
  if (dead) return null;

  const working = p.occ !== null && p.occ !== "retired";
  // 仕事に就いている間は、アルバイトの画面を開いたままにしない。
  const viewNow = view === "part" && working ? null : view;

  const tabs: { id: View; label: string; show: boolean }[] = [
    { id: "lesson", label: "習い事", show: true },
    { id: "hobby", label: "趣味", show: p.age >= 6 },
    { id: "part", label: "アルバイト", show: p.age >= 16 && !working },
    { id: "meet", label: "出会い", show: p.age >= 15 },
    { id: "office", label: "出馬", show: p.age >= 25 },
    { id: "shop", label: "売買", show: p.age >= 8 },
  ];

  const parts = jpData.partTimes.filter((x) => p.age >= x.minAge && partTimeAvailable(x.id, yearOf(p)));
  const offices = jpData.offices.filter((x) => p.age >= x.minAge);
  const affordable = offices.filter((o) => state.wallet.cash >= o.costMan * 10000);

  return (
    <div className="mb-6">
      <button type="button" onClick={() => { setOpen((o) => !o); if (open) setView(null); }} className="w-full border border-warm/60 bg-warm/10 px-4 py-2.5 text-base font-bold tracking-[0.3em] text-mist hover:border-warm">
        {open ? "活動をとじる" : "活動する"}
      </button>
      {!open && <p className="mx-auto mt-1 w-fit text-left text-[11px] leading-4 tracking-wider text-dim">習い事・趣味(あわせて5つまで)・アルバイトなどを始められます</p>}

      {open && (
        <div className="mt-3">
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
            {tabs.filter((x) => x.show).map((x) => (
              <button key={x.id} type="button" onClick={() => setView(viewNow === x.id ? null : x.id)} className={`${chipClass(viewNow === x.id)} !px-0.5 !py-1.5 text-center !text-[11px]`}>
                {x.label}
              </button>
            ))}
          </div>

          {viewNow === "lesson" && <LessonPanel t={t} state={state} onStart={onStartLesson} onStop={onStopLesson} mode="lesson" embedded />}
          {viewNow === "hobby" && <LessonPanel t={t} state={state} onStart={onStartLesson} onStop={onStopLesson} mode="hobby" embedded />}

          {viewNow === "part" && (
            <div className="mt-4 rounded-sm border border-line bg-panel/60 px-4 py-3">
              <p className="text-xs tracking-[0.3em] text-warm">アルバイト</p>
              <p className="mt-1 text-[11px] leading-4 tracking-wider text-dim">★はあなたの性格に向いている仕事、△は苦手な仕事です。同時にひとつ。収入が増える一方勉強や体力に影響します。仕事に就くとアルバイトはやめることになります。</p>
              {p.parttime ? (
                <div className="mt-3 flex items-baseline justify-between gap-2 text-sm tracking-wider">
                  <span className="text-mist">{jpData.partTimes.find((x) => x.id === p.parttime!.id)?.label}<span className="ml-2 text-xs text-dim">{p.age - p.parttime.since + 1}年目</span></span>
                  <button type="button" onClick={onStopPart} className="shrink-0 border border-line px-2.5 py-0.5 text-xs tracking-wider text-haze hover:border-haze hover:text-mist">やめる</button>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-1.5">
                  {parts.map((x) => (
                    <button key={x.id} type="button" title={x.note} onClick={() => onStartPart(x.id)} className={`${chipClass(false)} flex w-full items-center justify-between gap-3 !px-3 !py-2 !text-left !text-xs leading-5`}>
                      <span className="block">{fitScore(p.mbti, x.tags) >= 2 ? "★ " : fitScore(p.mbti, x.tags) <= -1 ? "△ " : ""}{x.label}</span>
                      <span className="block shrink-0 text-dim">年に約{Math.round(x.yearlyMan * (working ? 0.6 : p.age < 18 ? 0.5 : 1))}万円</span>
                    </button>
                  ))}
                  {parts.length === 0 && <p className="text-xs text-dim">この年齢で始められるアルバイトはありません。</p>}
                </div>
              )}
            </div>
          )}

          {viewNow === "meet" && (
            <div className="mt-4 rounded-sm border border-line bg-panel/60 px-4 py-3">
              <p className="text-xs tracking-[0.3em] text-warm">出会いを探す</p>
              <p className="mt-1 text-[11px] leading-4 tracking-wider text-dim">自分から出かけて友人・恋人・ペット・仕事のチャンスと出会います。出かけるとその場での選択が出ます。1年に{MEET_LIMIT}回まで(今年は{p.history.meetYear === p.age ? p.history.meetCount ?? 0 : 0}回)。</p>
              <ul className="mt-3 space-y-2">
                {MEETINGS.filter((m) => m.show(p)).map((m) => {
                  const used = p.history.meetYear === p.age ? p.history.meetCount ?? 0 : 0;
                  const lackCash = p.age >= 18 && state.wallet.cash < m.costMan * 10000;
                  const reason = used >= MEET_LIMIT ? `今年はもう${MEET_LIMIT}回出かけました` : lackCash ? "貯金が足りません" : state.queue.length > 0 ? "いまの選択を先にすませてください" : null;
                  return (
                    <li key={m.id}>
                      <button type="button" disabled={Boolean(reason)} onClick={() => onMeet(m.id)} className={`${chipClass(false)} w-full !px-3 !py-2 !text-left !text-xs leading-5 ${reason ? "!cursor-not-allowed opacity-45" : ""}`}>
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="block font-bold">{m.label}</span>
                          <span className="block shrink-0 text-dim">{m.costMan > 0 ? `${m.costMan}万円` : "無料"}</span>
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-4 text-dim">{m.note}</span>
                        {reason && <span className="mt-0.5 block text-[11px] font-bold leading-4" style={{ color: "var(--color-down)" }}>{reason}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {viewNow === "shop" && (
            <div className="mt-4 rounded-sm border border-line bg-panel/60 px-4 py-3">
              <p className="text-xs tracking-[0.3em] text-warm">売買(買う・売る)</p>
              <p className="mt-1 text-[11px] leading-4 tracking-wider text-dim">家や車、趣味の道具、保険など。値段は設計上の仮定(だいたいの目安)です。お金が足りないものは表示していません。</p>
              {shopSellable(p).length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] tracking-[0.2em] text-haze">持っているもの・売る</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {shopSellable(p).map((x) => (
                      <li key={x.id}>
                        <button type="button" title={x.note} onClick={() => onSell(x.id)} className={`${chipClass(false)} flex w-full items-center justify-between gap-3 !px-3 !py-2 !text-left !text-xs leading-5`}>
                          <span className="block">{x.id === "home_sell" ? x.label : `${x.label.replace(/を買う$/, "")}を手放す`}</span>
                          <span className="block shrink-0 text-dim">{Math.round(x.sellMan!(p))}万円{x.yearlyMan && p.owns[x.id] !== undefined ? `・維持費 年${x.yearlyMan(p)}万円` : ""}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {[...new Set(shopBuyable(p).filter((x) => state.wallet.cash >= x.costMan(p) * 10000).map((x) => x.group))].map((g) => (
                <div key={g} className="mt-3">
                  <p className="text-[11px] tracking-[0.2em] text-haze">{g}</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {shopBuyable(p).filter((x) => x.group === g && state.wallet.cash >= x.costMan(p) * 10000).map((x) => (
                      <li key={x.id}>
                        <button type="button" title={x.note} onClick={() => onBuy(x.id)} className={`${chipClass(false)} w-full !px-3 !py-2 !text-left !text-xs leading-5`}>
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="block">{x.label}</span>
                            <span className="block shrink-0 text-dim">{x.costMan(p) >= 1 ? `${x.costMan(p).toLocaleString("ja-JP")}万円` : x.costMan(p) > 0 ? `${Math.round(x.costMan(p) * 10000).toLocaleString("ja-JP")}円` : "無料"}{x.yearlyMan ? `・年${x.yearlyMan(p)}万円` : ""}</span>
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-dim">{x.note}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {viewNow === "office" && (
            <div className="mt-4 rounded-sm border border-line bg-panel/60 px-4 py-3">
              <p className="text-xs tracking-[0.3em] text-warm">出馬(選挙に立候補する)</p>
              <p className="mt-1 whitespace-pre-line text-[11px] leading-4 tracking-wider text-dim">{"費用は、供託金と、選挙運動の費用の合計です。供託金は、当選するか、一定の得票があれば戻ります(得票が基準に届かないと没収)。選挙運動の費用は、戻りません。\n当選すれば、議員などの仕事に就きます。供託金は法律の定め、運動費は収支報告の平均を目安にしています(市区町村・知事は仮定)。当選の確率は、設計上の目安です。"}</p>
              {p.office ? (
                <p className="mt-3 text-sm tracking-wider text-mist">いま、{jpData.offices.find((x) => x.id === p.office!.id)?.label}として活動中です。</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {affordable.map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => onRun(o.id)} className={`${chipClass(false)} w-full text-left`}>
                        {o.label}
                        <span className="ml-2 text-xs text-dim">費用 約{o.costMan}万円(供託金{o.depositMan}万円+運動費約{o.campaignMan}万円)・当選の目安 約{Math.round(officeChance(p, o) * 100)}%</span>
                        <span className="mt-1 block text-xs leading-5 text-dim">{o.note}</span>
                      </button>
                    </li>
                  ))}
                  {affordable.length < offices.length && <p className="text-[11px] leading-4 tracking-wider text-dim">資産が足りない出馬先は表示していません。</p>}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
