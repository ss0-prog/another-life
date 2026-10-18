"use client";

import { useEffect, useState } from "react";
import { CompareResult } from "@/components/CompareResult";
import { PlayScreen } from "@/components/PlayScreen";
import { branchLabelOf } from "@/lib/archive";
import { getMessages } from "@/lib/i18n";
import { autoRun, startAlt, startReal, summarize } from "@/lib/sim/engine";
import type { Branch, CurrentSelf, GameState, LifeSummary, Setup } from "@/lib/sim/types";

const t = getMessages();

// 開発者用の入口。いまのあなたの条件とターニングポイントを、入力画面を通さずに指定して、すぐ遊ぶ・すぐ結果を見る。
// 本番のビルドでは、表示されない。
const BASE: CurrentSelf = {
  age: 30, prefecture: "東京都", sex: "female", condition: "none", ailment: "none", mbti: "INFP", edu: "univ", occ: "office", job: null, workStyle: "private",
  region: "tokyo", housing: "rent", married: false, kids: 0, savings: 300, school: "none",
};

const PRESETS: { name: string; self: Partial<CurrentSelf>; branch: Branch }[] = [
  { name: "10歳の小学生", self: { age: 10, occ: "none", edu: "univ", housing: "parents", savings: null }, branch: { kind: "childhood", option: "study", age: 6 } },
  { name: "16歳の高校生", self: { age: 16, occ: "none", edu: "univ", housing: "parents", savings: null }, branch: { kind: "education", option: "vocational", age: 15 } },
  { name: "20歳の大学生", self: { age: 20, school: "univ", yearsLeft: 2, occ: "none", housing: "parents", savings: 30 }, branch: { kind: "education", option: "vocational", age: 18 } },
  { name: "28歳の会社員(未婚)", self: { age: 28 }, branch: { kind: "job", option: "model", age: 22 } },
  { name: "36歳の既婚・子ども2人", self: { age: 36, married: true, kids: 2, kidBirthAges: [30, 33], kidSexes: ["girl", "boy"], partnerName: "ユウキ", mbti: "ENFJ" }, branch: { kind: "family", option: "single", age: 28 } },
  { name: "55歳の会社員", self: { age: 55, married: true, kids: 1, kidBirthAges: [28], kidSexes: ["boy"], savings: 1500 }, branch: { kind: "place", option: "abroad", age: 30 } },
  { name: "68歳・退職後", self: { age: 68, occ: "none", married: true, savings: 2500 }, branch: { kind: "job", option: "police", age: 24 } },
];

type Mode = { name: "form" } | { name: "play"; initial: GameState; setup: Setup; real: GameState } | { name: "result"; real: LifeSummary; alt: LifeSummary; label: string };

export default function DevPage() {
  const [json, setJson] = useState(() => JSON.stringify({ self: BASE, branch: PRESETS[3].branch }, null, 2));
  const [seed, setSeed] = useState("77");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<Mode>({ name: "form" });

  const build = (src = json): Setup | null => {
    try {
      const o = JSON.parse(src) as { self: CurrentSelf; branch: Branch };
      setErr("");
      return { self: { ...BASE, ...o.self }, branch: o.branch, seed: Number(seed) || 1 };
    } catch (e) {
      setErr(`JSONが読み取れません: ${(e as Error).message}`);
      return null;
    }
  };
  const play = (src?: string) => {
    const setup = build(src);
    if (!setup) return;
    setMode({ name: "play", initial: startAlt(setup), setup, real: autoRun(startReal(setup)) });
  };
  const result = (src?: string) => {
    const setup = build(src);
    if (!setup) return;
    setMode({ name: "result", alt: summarize(autoRun(startAlt(setup))), real: summarize(autoRun(startReal(setup))), label: branchLabelOf(setup) });
  };
  const preset = (i: number) => {
    const next = JSON.stringify({ self: { ...BASE, ...PRESETS[i].self }, branch: PRESETS[i].branch }, null, 2);
    setJson(next);
    return next;
  };

  // 例: /dev?preset=3&go=play  /dev?preset=4&go=result&seed=12
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const i = q.get("preset");
    if (q.get("seed")) setSeed(q.get("seed")!);
    if (i !== null && PRESETS[Number(i)]) {
      const src = preset(Number(i));
      const go = q.get("go");
      if (go === "play") setTimeout(() => play(src), 0);
      if (go === "result") setTimeout(() => result(src), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (process.env.NODE_ENV === "production") return <p className="p-10 text-haze">このページは開発用です。</p>;

  if (mode.name === "play")
    return (
      <div className="flex w-full flex-1">
        <PlayScreen
          t={t.play}
          initial={mode.initial}
          birthYear={new Date().getFullYear() - mode.setup.self.age}
          selfAge={mode.setup.self.age}
          ghost={mode.real.series ?? []}
          dev
          onFinish={(final) => setMode({ name: "result", alt: summarize(final), real: summarize(mode.real), label: branchLabelOf(mode.setup) })}
        />
      </div>
    );
  if (mode.name === "result")
    return (
      <div className="w-full px-6 pb-24 pt-10 sm:px-10">
        <button type="button" onClick={() => setMode({ name: "form" })} className="mb-6 border border-line px-3 py-1 text-xs text-haze hover:text-mist">← 条件にもどる</button>
        <CompareResult t={t.result} real={mode.real} alt={mode.alt} altLabel={mode.label} onSave={async () => "local"} canPublish={false} onAgain={() => setMode({ name: "form" })} />
      </div>
    );

  const btn = "border border-line px-3 py-1.5 text-sm text-haze hover:border-haze hover:text-mist";
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-xl tracking-[0.2em] text-warm">開発者の入口</h1>
      <p className="mt-2 text-sm leading-7 text-haze">入力画面を通さずに条件をまとめて指定して、すぐ遊ぶ・すぐ結果を見られます。遊ぶ画面では左下に道具箱(年を進める・出来事を起こす・資産や能力値を書きかえる・時間を速める)が出ます。</p>

      <p className="mt-6 text-xs tracking-[0.2em] text-dim">すぐ使える条件</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button key={p.name} type="button" className={btn} onClick={() => preset(i)}>{p.name}</button>
        ))}
      </div>

      <p className="mt-6 text-xs tracking-[0.2em] text-dim">条件(JSON)。self = いまのあなた、branch = ターニングポイント(kind / option / age)</p>
      <textarea value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} rows={24} className="mt-2 w-full border border-line bg-void/60 p-3 font-mono text-xs leading-5 text-mist outline-none focus:border-haze" />
      {err && <p className="mt-2 text-sm" style={{ color: "var(--color-down)" }}>{err}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-haze">
          seed(同じ数なら、同じ運命)
          <input value={seed} onChange={(e) => setSeed(e.target.value)} className="ml-2 w-24 border-b border-line bg-transparent text-center text-mist outline-none" inputMode="numeric" />
        </label>
        <button type="button" onClick={() => play()} className="border border-warm/70 bg-warm/10 px-5 py-2 text-sm font-bold text-mist hover:border-warm">この条件で遊ぶ</button>
        <button type="button" onClick={() => result()} className={btn}>最後まで自動で進めて結果を見る</button>
      </div>

      <p className="mt-8 text-xs leading-6 text-dim">
        直接リンク: <code>/dev?preset=3&amp;go=play</code>(番号は上の条件の順。0〜{PRESETS.length - 1})、<code>/dev?preset=4&amp;go=result&amp;seed=12</code>
      </p>
    </div>
  );
}
