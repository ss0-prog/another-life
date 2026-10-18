"use client";

import { useState } from "react";
import { jpData } from "@/lib/sim/data/jp";
import { devAdvance, devEvent, devQueue, devSet, devSetAge } from "@/lib/sim/engine";
import type { GameState } from "@/lib/sim/types";

type Props = {
  state: GameState;
  act: (updater: (s: GameState) => GameState) => void;
  setSpeed: (n: number) => void;
};

const STATS = ["health", "money", "bonds", "learn", "joy"] as const;

// 開発者用の道具箱(/dev からのプレイでだけ出る)。条件を、いちいち手でたどらずに、すぐ確かめられる。
export function DevPanel({ state, act, setSpeed }: Props) {
  const [open, setOpen] = useState(true);
  const [age, setAge] = useState("");
  const [cash, setCash] = useState("");
  const [qid, setQid] = useState(jpData.eventQuestions[0]?.id ?? "");
  const [eid, setEid] = useState(jpData.lifeEvents[0]?.id ?? "");
  const p = state.person;
  const btn = "border border-line px-2 py-1 text-xs text-haze hover:border-haze hover:text-mist";
  const field = "w-20 border-b border-line bg-transparent text-center text-sm text-mist outline-none";

  return (
    <div className="fixed bottom-3 left-3 z-[70] max-h-[85dvh] w-72 overflow-y-auto rounded-sm border border-warm/60 bg-void/95 p-3 text-xs text-haze shadow-xl">
      <div className="flex items-center justify-between">
        <span className="font-bold tracking-widest text-warm">開発者の道具</span>
        <button type="button" onClick={() => setOpen((o) => !o)} className={btn}>{open ? "たたむ" : "ひらく"}</button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1 text-dim">年を進める(標準の道・おまかせ)</p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 3, 5, 10, 30].map((n) => (
                <button key={n} type="button" className={btn} onClick={() => act((s) => devAdvance(s, n))}>+{n}年</button>
              ))}
              <button type="button" className={btn} onClick={() => act((s) => devAdvance(s, 200))}>最後まで</button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-dim">年齢を指定してその年の出来事を出す(いま {p.age}歳)</p>
            <div className="flex items-center gap-2">
              <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="例: 30" className={field} inputMode="numeric" />
              <button type="button" className={btn} onClick={() => Number(age) > 0 && act((s) => devSetAge(s, Number(age)))}>この年の前へ</button>
            </div>
            <p className="mt-1 text-[11px] text-dim">そのあと「+1年」でその年齢の出来事・節目が出ます。</p>
          </div>
          <div>
            <p className="mb-1 text-dim">選択の場面をすぐ出す</p>
            <select value={qid} onChange={(e) => setQid(e.target.value)} className="w-full border border-line bg-void p-1 text-mist">
              {jpData.eventQuestions.map((q) => (
                <option key={q.id} value={q.id}>{q.id}</option>
              ))}
            </select>
            <button type="button" className={`${btn} mt-1`} onClick={() => act((s) => devQueue(s, qid))}>出す</button>
          </div>
          <div>
            <p className="mb-1 text-dim">選択のない出来事をいま起こす</p>
            <select value={eid} onChange={(e) => setEid(e.target.value)} className="w-full border border-line bg-void p-1 text-mist">
              {jpData.lifeEvents.map((q) => (
                <option key={q.id} value={q.id}>{q.id}</option>
              ))}
            </select>
            <button type="button" className={`${btn} mt-1`} onClick={() => act((s) => devEvent(s, eid))}>起こす</button>
          </div>
          <div>
            <p className="mb-1 text-dim">資産(万円)を書きかえる(いま {Math.round(state.wallet.cash / 10000)})</p>
            <div className="flex items-center gap-2">
              <input value={cash} onChange={(e) => setCash(e.target.value)} placeholder="例: 500" className={field} inputMode="numeric" />
              <button type="button" className={btn} onClick={() => cash !== "" && act((s) => devSet(s, { cashYen: Number(cash) * 10000 }))}>設定</button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-dim">能力値(0〜100)</p>
            <div className="grid grid-cols-5 gap-1">
              {STATS.map((k) => (
                <div key={k} className="text-center">
                  <p className="text-[10px]">{({ health: "健康", money: "経済", bonds: "絆", learn: "学び", joy: "幸福" } as const)[k]}</p>
                  <input
                    defaultValue={Math.round(p.stats[k])}
                    key={`${k}-${Math.round(p.stats[k])}`}
                    onBlur={(e) => e.target.value !== "" && act((s) => devSet(s, { stats: { [k]: Number(e.target.value) } }))}
                    className="w-full border-b border-line bg-transparent text-center text-mist outline-none"
                    inputMode="numeric"
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-dim">時間の速さ</p>
            <div className="flex gap-1.5">
              {[1, 8, 32, 128].map((n) => (
                <button key={n} type="button" className={btn} onClick={() => setSpeed(n)}>×{n}</button>
              ))}
            </div>
          </div>
          <p className="text-[11px] leading-4 text-dim">
            seed {state.seed} ・ 職 {p.job ?? p.occ ?? "なし"} ・ MBTI {p.mbti ?? "なし"} ・ 結婚 {p.married ? "済" : "未"} ・ 子ども {p.kids}人
          </p>
        </div>
      )}
    </div>
  );
}
