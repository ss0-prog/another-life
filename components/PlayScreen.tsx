"use client";

import { AchievementToaster } from "@/components/Achievements";
import { JapanMap } from "@/components/JapanMap";
import { DeltaItem } from "@/components/Delta";
import { LifeCharts } from "@/components/LifeCharts";
import { relationships, type Relation } from "@/lib/sim/relations";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { chipClass, primaryButtonClass } from "@/components/controls";
import type { Messages } from "@/lib/i18n";
import { jpData } from "@/lib/sim/data/jp";
import { AssetPanel } from "@/components/AssetPanel";
import { ActivityPanel } from "@/components/ActivityPanel";
import { answer, borrowAndSpend, contributeKidFund, canInterpret, describeText, envAt, freeAction, holdingsValue, lenderOffers, pending, shortfallFor, setName, runForOffice, setPlan, goMeet, shopBuy, shopSell, startLesson, startPartTime, startStocks, stopLesson, stopPartTime, suggestNames, suggestTag, tick, trade } from "@/lib/sim/engine";
import { compat, compatMark, IDEAL, idealChance, typeLabel } from "@/lib/sim/mbti";
import { debtTotal, kidCall, kidTitle, lifeLabel } from "@/lib/sim/helpers";
import { soften } from "@/lib/jp";
import { DevPanel } from "@/components/DevPanel";
import { DeathOverlay } from "@/components/DeathOverlay";
import { GhostPanel } from "@/components/GhostPanel";
import { weatherAt } from "@/lib/sim/weather";
import { setWeather } from "@/lib/weatherStore";
import { incomeOf, round10 } from "@/lib/sim/salary";
import type { AssetId, Choice, GameState, LenderId, SeriesPoint, Tag, TurningOption } from "@/lib/sim/types";

type Props = {
  t: Messages["play"];
  initial: GameState;
  birthYear: number;
  selfAge: number;
  ghost: SeriesPoint[];
  dev?: boolean;
  onFinish: (final: GameState) => void;
};

const EXTRA = [
  { key: "stress", label: "ストレス", color: "var(--color-down)", note: "高いと体と心をむしばむ。仕事・借金・育児・介護で上がる" },
  { key: "trust", label: "信用", color: "var(--color-cool)", note: "社会的な信用。安定した仕事や持ち家で上がり、破産で大きく下がる" },
  { key: "career", label: "実績", color: "var(--color-warm)", note: "仕事の積み重ね。昇進や頂点にのぼる運に効く" },
  { key: "charm", label: "魅力", color: "var(--color-s-bonds)", note: "人を引きつける力。恋愛や結婚のしやすさに効く" },
] as const;
const STAT_KEYS = ["health", "money", "bonds", "learn", "joy"] as const;
// 等倍で1年=12秒。100歳まで生きると、ちょうど20分かかる。
const BASE_MS = 12000;

export function PlayScreen({ t, initial, birthYear, selfAge, ghost, dev = false, onFinish }: Props) {
  const [state, setState] = useState(initial);
  // 1年のあいだに起きる出来事は、一個ずつ順番に見せる。自分で操作した結果は、すぐに見せる。
  const [seen, setSeen] = useState(initial.events.length);
  const skipReveal = useRef(false);
  const act: typeof setState = (u) => {
    skipReveal.current = true;
    setState(u);
  };
  const [month, setMonth] = useState(0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  // 枝分かれした選択の、ここまで選んだ道。
  const [trail, setTrail] = useState<TurningOption[]>([]);
  const [nameText, setNameText] = useState("");
  const [nameSuggest, setNameSuggest] = useState<string[]>([]);

  // 再生中は、ページ全体を1画面(100vh)に収める。フッターは隠す。
  useEffect(() => {
    document.body.dataset.play = "1";
    return () => {
      delete document.body.dataset.play;
    };
  }, []);

  // いまの年齢の空模様を、背景に伝える。再生画面を離れたら、晴れに戻す。
  useEffect(() => {
    setWeather(weatherAt(state.seed, state.person.age));
  }, [state.seed, state.person.age]);
  useEffect(() => () => setWeather("clear"), []);

  const totalEvents = state.events.length;
  useEffect(() => {
    if (skipReveal.current) {
      skipReveal.current = false;
      setSeen(totalEvents);
    }
  }, [totalEvents]);
  useEffect(() => {
    if (seen >= totalEvents || !running) return;
    const id = setTimeout(() => setSeen((n) => n + 1), 1500 / speed);
    return () => clearTimeout(id);
  }, [seen, totalEvents, speed, running]);
  const revealed = seen >= totalEvents;

  // 選択の場面は、年のはじめにまとめて出さず、その年の決まった月に来たときに出す。
  const tp = useMemo(() => pending(state, jpData, month), [state, month]);

  // 1年の進みを、なめらかに動かす(毎フレーム、いまの月のなかの経過時間から幅を決める)。止まっているあいだは、その位置で止まる。
  const yearBar = useRef<HTMLDivElement>(null);
  const yearBarM = useRef<HTMLDivElement>(null);
  const barKey = useRef("");
  const ticking = !tp && state.deathAge === null && running && !state.naming[0];
  useEffect(() => {
    const el = yearBar.current;
    const elM = yearBarM.current;
    if (!el) return;
    const setW = (w: string) => {
      el.style.width = w;
      if (elM) elM.style.width = w;
    };
    // 月が進んだときだけ、基準の位置に合わせる(一時停止では、止まった位置のまま)。
    const key = `${state.person.age}:${month}`;
    if (barKey.current !== key) {
      barKey.current = key;
      setW(`${(month / 12) * 100}%`);
    }
    if (!ticking) return;
    const monthMs = BASE_MS / 12 / speed;
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const frac = Math.min(1, (now - t0) / monthMs);
      setW(`${((month + frac) / 12) * 100}%`);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [month, state.person.age, speed, ticking]);
  const dead = state.deathAge !== null;
  const p = state.person;

  // 選択を求められていない間だけ、1か月ずつ時間を進める(12か月で1歳)。株価はこの月ごとに動く。
  const naming = state.naming[0];
  useEffect(() => {
    if (tp || dead || !running || naming) return;
    const id = setTimeout(() => {
      if (month < 11) setMonth(month + 1);
      else {
        setState((s) => tick(s));
        setMonth(0);
      }
    }, BASE_MS / 12 / speed);
    return () => clearTimeout(id);
  }, [state, month, tp, dead, running, speed, naming]);

  // 名づけの候補を、新しい名づけが始まるたびに出し直す。
  useEffect(() => {
    setNameText("");
    setNameSuggest(naming ? suggestNames(state) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naming?.kind, naming?.index, state.naming.length]);

  const onTrade = (id: AssetId, yen: number) => {
    const next = trade(state, id, yen, month);
    if (!next) return false;
    act(next);
    return true;
  };

  const onStartStocks = () => act((s) => startStocks(s));
  const onPlan = (id: AssetId, yen: number) => {
    const next = setPlan(state, id, yen);
    if (!next) return false;
    act(next);
    return true;
  };
  // 使い道にお金を使う。貯金が足りなければ "short"(借りて使うか、あとで選ぶ)。
  const onSpend = (yen: number, text: string, tag: Tag | null): "ok" | "short" | "fail" => {
    if (shortfallFor(state, yen) > 0) return state.person.age < 18 ? "fail" : "short";
    const next = freeAction(state, { text, tag, yen, month }, jpData);
    if (!next) return "fail";
    act(next);
    return "ok";
  };
  const onKidNisa = (yen: number) => {
    const next = contributeKidFund(state, yen);
    if (!next) return false;
    act(next);
    return true;
  };
  const onBorrow = (lender: LenderId, yen: number, text: string, tag: Tag | null) => {
    const next = borrowAndSpend(state, lender, { text, tag, yen, month }, jpData);
    if (!next) return false;
    act(next);
    return true;
  };
  const offers = (yen: number) => lenderOffers(state, shortfallFor(state, yen), jpData);

  const choose = (choice: Choice) => {
    if (!tp) return;
    act((s) => answer(s, tp, choice));
    setTrail([]);
  };

  const env = envAt(state);
  const last = trail[trail.length - 1];
  // ポップアップは、閉じて、画面を見ながら考えられる(閉じているあいだも、選ぶまで、時間は止まったまま)。
  const [closedKey, setClosedKey] = useState<string | null>(null);
  const popupKey = tp ? `${tp.id}-${p.age}` : "";
  const popupWanted = Boolean(tp) && !dead && !naming && revealed;
  const showPopup = popupWanted && closedKey !== popupKey;
  const question = tp ? (last?.children ? last.children(p) : { title: tp.title, prompt: tp.prompt, options: tp.options }) : null;
  // 選択の場面(出来事の質問をのぞく)では、選べない道を、うすく表示して、理由を赤字で出す。
  const lockable = Boolean(tp) && !tp!.id.startsWith("ev:");
  const affordable = (o: TurningOption) => o.auto || !o.cost || p.age < 18 || o.cost(p) * 10000 <= state.wallet.cash;
  const isOpen = (o: TurningOption, depth = 0): boolean => (!o.show || o.show(p)) && affordable(o) && (!o.children || depth > 3 || o.children(p).options.some((c) => isOpen(c, depth + 1)));
  const lockReason = (o: TurningOption): string | null => {
    if (!lockable) return null;
    if (!affordable(o)) return `貯金が足りません(約${o.cost!(p)}万円が必要)`;
    if (o.children && !isOpen(o)) return "選べる行き先がありません(費用が足りないなど)";
    return null;
  };
  const options = question?.options.filter((o) => (!o.show || o.show(p)) && (lockable || affordable(o))) ?? [];
  const income = p.occ === null ? null : round10(incomeOf(p, jpData, env.econ));
  const econColor = env.econ > 0.6 ? "var(--color-s-health)" : env.econ < -0.4 ? "var(--color-s-bonds)" : "var(--color-haze)";

  // 枝分かれの途中なら深く進み、行き止まりなら選択を確定する。
  const pick = (o: TurningOption) => {
    if (o.children) setTrail([...trail, o]);
    else choose({ kind: "option", path: [...trail.map((x) => x.id), o.id] });
  };

  // スマホは、overflow-x-clip(スクロール領域を作らない)にする。hiddenだと、この列が、スクロール領域になって、上にはりつく部品(sticky)が、ページのスクロールに、ついてこない。
  const col = "min-h-0 min-w-0 overflow-x-clip lg:overflow-x-hidden bg-void/35 px-[2.5vw] py-2 sm:px-8 sm:py-6 lg:overflow-y-auto lg:py-8";

  return (
    <div className="grid w-full flex-1 divide-line lg:h-[calc(100dvh-3.5rem-2.5rem)] lg:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.7fr)_minmax(17rem,0.9fr)] lg:divide-x">
      {/* 左: 年の移り変わり */}
      <section className={`${col} order-2 lg:order-1`}>
        <p className="text-sm tracking-[0.4em] text-warm">{t.branchBadge}</p>
        <p className="mt-1 text-xs leading-5 tracking-wider text-dim">{t.notes.branch}</p>
        <div className="mt-5">
          <div className="text-5xl font-bold tabular-nums tracking-widest text-mist drop-shadow-[0_0_24px_rgba(240,201,148,0.35)]">{p.age}<span className="ml-2 text-xl font-medium text-haze">歳</span></div>
          <p className="mt-1 text-lg tabular-nums tracking-[0.2em] text-warm">{birthYear + p.age}年</p>
          <p className="mt-3 text-base tracking-[0.15em] text-haze">
            {lifeLabel(p, jpData)} / {p.city}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
          <NoteBlock label={t.econ} note={t.notes.econ}>
            <p className="mt-1 text-lg" style={{ color: econColor }}>{env.econLabel}</p>
          </NoteBlock>
          <NoteBlock right label={t.income} note={t.notes.income}>
            <p className="mt-1 text-lg tabular-nums text-mist">{income === null ? "—" : `${income.toLocaleString("ja-JP")}${t.unitMan}`}</p>
          </NoteBlock>
        </div>

        <div className="mt-6 grid grid-cols-2 items-start gap-x-6 gap-y-5">
          {STAT_KEYS.map((k, i) => (
            <StatBar right={i % 2 === 1} key={k} label={t.stats[k]} value={p.stats[k]} color={`var(--color-s-${k})`} note={t.statNotes[k]} />
          ))}
        </div>

        <div className="mt-6 border-t border-line/60 pt-4">
          <p className="text-xs tracking-[0.3em] text-warm">暮らしの数値</p>
          <div className="mt-3 grid grid-cols-2 items-start gap-x-6 gap-y-5">
            {EXTRA.map((x, i) => (
              <StatBar right={i % 2 === 1} key={x.key} label={x.label} value={p.extra[x.key]} color={x.color} note={x.note} />
            ))}
          </div>
        </div>

        <GhostPanel age={p.age} selfAge={selfAge} ghost={ghost} netMan={Math.round((state.wallet.cash + holdingsValue(state, month) - debtTotal(state.wallet.debts)) / 10000)} joy={p.stats.joy} />

        <LifeCharts series={state.series ?? []} />

        <FamilyStatus t={t.family} p={p} />

        <RelationPanel p={p} />




      </section>

      {/* 中央: 年ごとのイベント(選択と、起きたこと) */}
      <section className={`${col} order-1 max-lg:!pt-0 lg:order-2 lg:flex lg:flex-col`}>
        <div className="sticky top-[var(--header-h,0px)] z-30 -mx-[2.5vw] mb-4 border-b border-line/70 bg-panel/95 px-[2.5vw] py-2 lg:hidden">
          <div className="mb-2 flex items-stretch gap-2">
          <button type="button" onClick={() => window.dispatchEvent(new Event("betsu-uchu:home"))} aria-label="トップ画面にもどる" title="トップ画面にもどる" className="flex w-10 shrink-0 items-center justify-center border border-line text-haze hover:border-haze hover:text-mist">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 11.5 12 4l9 7.5" />
              <path d="M5.5 10v9.5h13V10" />
              <path d="M10 19.5v-5h4v5" />
            </svg>
          </button>
          <button type="button" onClick={() => window.dispatchEvent(new Event("betsu-uchu:restart"))} className="block flex-1 border border-warm/60 bg-warm/10 px-3 py-1.5 text-center text-xs font-bold tracking-[0.15em] text-mist hover:border-warm">
            同じ条件で人生をやり直す
          </button>
        </div>
        <p className="flex items-baseline justify-between text-xs tracking-[0.2em] text-haze"><span>次の誕生日まで</span><span className="tabular-nums text-mist">{p.age}歳</span></p>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
            <div ref={yearBarM} className="h-2 rounded-full bg-warm" style={{ width: `${(month / 12) * 100}%` }} />
          </div>
        {!dead && (
          <div className="mt-2 flex max-w-full flex-nowrap items-center gap-1 whitespace-nowrap text-xs font-bold tracking-[0.02em]">
            <button type="button" onClick={() => setRunning((r) => !r)} disabled={popupWanted || Boolean(naming && revealed)} aria-label={running ? t.pause : t.resume} title={running ? t.pause : t.resume} className="keep shrink-0 border border-warm/60 bg-warm/5 px-2 py-1.5 text-mist hover:border-warm disabled:opacity-40">
              {running ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <rect x="6" y="5" width="4.2" height="14" rx="1" />
                  <rect x="13.8" y="5" width="4.2" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M7 4.8v14.4a.8.8 0 0 0 1.2.7l11.2-7.2a.8.8 0 0 0 0-1.4L8.2 4.1a.8.8 0 0 0-1.2.7Z" />
                </svg>
              )}
            </button>
            {[1, 2, 4, 8].map((sp) => (
              <button key={sp} type="button" onClick={() => setSpeed(sp)} aria-pressed={speed === sp} aria-label={`${t.speed} ×${sp}`} className={`keep shrink-0 border px-1.5 py-1.5 ${speed === sp ? "border-warm bg-warm/15 text-mist" : "border-line text-haze hover:border-haze hover:text-mist"}`}>
                ×{sp}
              </button>
            ))}
          </div>
        )}
        </div>
        <LifeRibbon age={state.deathAge ?? p.age} dead={dead} startAge={state.events[0]?.age ?? p.age} events={state.events.slice(0, seen)} />

        {naming && !dead && revealed ? (
          <motion.div key={`name-${naming.kind}-${naming.index}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="rounded-sm border border-warm/50 bg-panel px-6 py-7 shadow-[0_0_50px_rgba(240,201,148,0.12)]">
            <h3 className="text-center text-xl tracking-[0.2em] text-warm">{t.naming.title}</h3>
            <p className="mx-auto mt-3 w-fit text-left text-base leading-8 tracking-wider text-mist">
              {naming.label}
              {naming.kind === "child" ? t.naming.child : t.naming.pet}
            </p>
            <input
              autoFocus
              value={nameText}
              maxLength={12}
              placeholder={t.naming.placeholder}
              onChange={(e) => setNameText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && act((s) => setName(s, nameText))}
              className="mt-6 w-full border-b border-line bg-transparent py-2 text-center text-2xl tracking-[0.2em] text-mist outline-none placeholder:text-dim focus:border-haze"
            />
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <span className="w-full text-center text-xs tracking-[0.2em] text-dim">{t.naming.candidates}</span>
              {nameSuggest.map((n) => (
                <button key={n} type="button" onClick={() => setNameText(n)} className={chipClass(nameText === n)}>
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-7 flex items-center justify-center gap-6">
              <button type="button" onClick={() => act((s) => setName(s, null))} className="text-sm tracking-[0.2em] text-haze underline-offset-8 hover:text-mist hover:underline">
                {t.naming.auto}
              </button>
              <button type="button" disabled={!nameText.trim()} onClick={() => act((s) => setName(s, nameText))} className="border border-warm/60 px-6 py-2 text-sm tracking-[0.2em] text-mist hover:border-warm disabled:opacity-30">
                {t.naming.decide}
              </button>
            </div>
          </motion.div>
        ) : null}

        <ol className="mt-4 max-h-[40dvh] space-y-3 overflow-y-auto pr-1 sm:mt-6 sm:space-y-4 lg:max-h-none lg:overflow-visible lg:pr-0">
          <AnimatePresence initial={false}>
            {state.events.slice(0, seen).reverse().map((e, i) => (
              <motion.li key={`${e.age}-${soften(e.event)}-${seen - i}`} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="border-l-2 border-warm/50 pl-5">
                <span className="keep text-xs tracking-[0.15em] text-warm sm:text-base sm:tracking-[0.2em]">{e.age}歳<span className="ml-2 text-[10px] text-dim sm:text-xs">{birthYear + e.age}年</span></span>
                <p className={`text-xs leading-6 tracking-wide text-mist sm:text-base sm:leading-8 ${i === 0 ? "font-bold" : ""}`}>{soften(e.event)}</p>
                {e.fx && (
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] font-bold tabular-nums tracking-wider sm:text-xs">
                    {e.fx.money !== undefined && (
                      <DeltaItem label="資産" color="var(--color-s-money)" up={e.fx.money >= 0}>
                        {Math.abs(e.fx.money) >= 10000 ? `${Math.round(Math.abs(e.fx.money) / 10000).toLocaleString("ja-JP")}万円` : `${Math.round(Math.abs(e.fx.money)).toLocaleString("ja-JP")}円`}
                      </DeltaItem>
                    )}
                    {STAT_KEYS.filter((k) => e.fx?.stats?.[k]).map((k) => {
                      const d = e.fx!.stats![k]!;
                      return (
                        <DeltaItem key={k} label={t.stats[k]} color={`var(--color-s-${k})`} up={d > 0}>
                          {Math.abs(d)}
                        </DeltaItem>
                      );
                    })}
                  </p>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
        {/* 画面の下に、ずっと表示する(スマホなど、ページ全体をスワイプする画面でも、消えない) */}
        <p className="fixed inset-x-0 bottom-0 z-30 border-t border-line/60 bg-void/85 px-4 py-1.5 text-left text-[10px] leading-4 lg:py-2 lg:text-[11px] lg:leading-5 tracking-wider text-dim lg:sticky lg:-bottom-8 lg:inset-x-auto lg:z-auto lg:-mb-8 lg:mt-auto lg:border-0 lg:bg-void/60 lg:px-2">
          <span className="lg:hidden">※ シミュレーションです。占い・予言ではありません。株価・景気は架空です。</span>
          <span className="hidden lg:inline">※ これはシミュレーションです。占いや予言ではなく実際の人生や将来を当てるものでは、決してありません。株価・景気の動きも乱数でつくった完全な架空のもので、実際の相場や景気とは関係がありません。</span>
        </p>
      </section>

      {/* 右: 株(資産) */}
      <section className={`${col} order-3`}>
        <div className="mb-6 hidden rounded-sm border border-line bg-panel/60 px-4 py-3 lg:block">
          <p className="text-xs tracking-[0.2em] text-haze">次の誕生日まで</p>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
            <div ref={yearBar} className="h-2 rounded-full bg-warm" style={{ width: `${(month / 12) * 100}%` }} />
          </div>
        {!dead && (
          <div className="mt-3 flex max-w-full flex-nowrap items-center gap-1 whitespace-nowrap text-xs font-bold tracking-[0.02em]">
            <button type="button" onClick={() => setRunning((r) => !r)} disabled={popupWanted || Boolean(naming && revealed)} aria-label={running ? t.pause : t.resume} title={running ? t.pause : t.resume} className="keep shrink-0 border border-warm/60 bg-warm/5 px-2 py-1.5 text-mist hover:border-warm disabled:opacity-40">
              {running ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <rect x="6" y="5" width="4.2" height="14" rx="1" />
                  <rect x="13.8" y="5" width="4.2" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M7 4.8v14.4a.8.8 0 0 0 1.2.7l11.2-7.2a.8.8 0 0 0 0-1.4L8.2 4.1a.8.8 0 0 0-1.2.7Z" />
                </svg>
              )}
            </button>
            {[1, 2, 4, 8].map((sp) => (
              <button key={sp} type="button" onClick={() => setSpeed(sp)} aria-pressed={speed === sp} aria-label={`${t.speed} ×${sp}`} className={`keep shrink-0 border px-1.5 py-1.5 ${speed === sp ? "border-warm bg-warm/15 text-mist" : "border-line text-haze hover:border-haze hover:text-mist"}`}>
                ×{sp}
              </button>
            ))}
          </div>
        )}
        </div>
        <ActivityPanel
          t={t.lessons}
          state={state}
          onStartLesson={(id) => {
            const next = startLesson(state, id);
            if (!next) return false;
            act(next);
            return true;
          }}
          onStopLesson={(id) => act((s) => stopLesson(s, id))}
          onStartPart={(id) => {
            const next = startPartTime(state, id);
            if (!next) return false;
            act(next);
            return true;
          }}
          onStopPart={() => act((s) => stopPartTime(s))}
          onMeet={(id) => {
            const next = goMeet(state, id);
            if (!next) return false;
            act(next);
            return true;
          }}
          onBuy={(id) => {
            const next = shopBuy(state, id);
            if (!next) return false;
            act(next);
            return true;
          }}
          onSell={(id) => {
            const next = shopSell(state, id);
            if (!next) return false;
            act(next);
            return true;
          }}
          onRun={(id) => {
            const next = runForOffice(state, id);
            if (!next) return false;
            act(next);
            return true;
          }}
        />
        <AssetPanel t={t.assets} state={state} month={month} onTrade={onTrade} onStartStocks={onStartStocks} onPlan={onPlan} onSpend={onSpend} onKidNisa={onKidNisa} onBorrow={onBorrow} offers={offers} />
        <JapanMap homes={p.homes ?? []} city={p.city} age={p.age} abroad={!!p.abroad} />
      </section>
      <AchievementToaster state={state} />
      {dev && <DevPanel state={state} act={act} setSpeed={setSpeed} />}
      {dead && revealed && <DeathOverlay age={state.deathAge ?? p.age} cause={state.deathCause ?? ""} why={state.deathNote?.reasons.join("。")} label={t.compare} line={t.dead} onCompare={() => onFinish(state)} />}
      {popupWanted && !showPopup && tp && (
        <div className="fixed inset-x-[2.5vw] bottom-4 z-50 flex items-center justify-between gap-3 rounded-sm border border-warm/70 bg-panel px-4 py-3 shadow-xl lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 lg:gap-4 lg:px-5">
          <p className="min-w-0 text-xs leading-5 tracking-wider text-mist sm:text-sm">選択の場面で時間を止めています。<span className="block font-bold text-warm sm:ml-2 sm:inline">{soften(question?.title ?? "")}</span></p>
          <button type="button" onClick={() => setClosedKey(null)} className="keep shrink-0 border border-warm/70 bg-warm/10 px-4 py-1.5 text-sm font-bold text-mist hover:border-warm">
            選択をひらく
          </button>
        </div>
      )}
      {showPopup && tp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-[2.5vw] py-6 backdrop-blur-sm">
          <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto">
          <motion.div key={`${tp.id}-${p.age}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }} className="relative rounded-sm border border-warm/50 bg-panel px-6 py-7 shadow-[0_0_50px_rgba(240,201,148,0.12)]">
            {trail.length > 0 && (
              <button type="button" onClick={() => setTrail(trail.slice(0, -1))} aria-label="ひとつ前の質問にもどる" title="ひとつ前の質問にもどる" className="absolute left-3 top-3 border border-line px-3 py-1 text-sm font-bold tracking-wider text-haze hover:border-haze hover:text-mist">
                &lt;&lt; 戻る
              </button>
            )}
            <button type="button" onClick={() => setClosedKey(popupKey)} className="absolute right-3 top-3 border border-line px-3 py-1 text-xs tracking-wider text-haze hover:border-haze hover:text-mist" aria-label="画面を閉じて考える(時間は止まったまま)">
              閉じて、考える ✕
            </button>
            <h3 className="text-center text-2xl font-bold tracking-[0.2em] text-warm">{soften(question?.title ?? "")}</h3>
            {trail.length > 0 && (
              <p className="mx-auto mt-2 w-fit text-left text-xs leading-6 tracking-wider text-dim">
                {t.picked}: {trail.map((x) => x.label).join(" › ")}
              </p>
            )}
            <p className="mx-auto mt-3 w-fit text-left text-lg font-bold leading-8 tracking-wider text-mist">{soften(question?.prompt ?? "")}</p>
            {env.econ !== 0 && (env.econ < -0.6 || env.econ > 0.6) && (
              <p className="mt-2 text-center text-xs tracking-wider" style={{ color: econColor }}>
                {t.econ}: {env.econLabel}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3">
              {options.map((o) => (
                <button key={o.id} type="button" disabled={Boolean(lockReason(o))} onClick={() => pick(o)} className={`${chipClass(false)} text-left ${lockReason(o) ? "!cursor-not-allowed opacity-45" : ""}`}>
                  <span className="font-bold">{soften(o.label)}</span>
                  {lockReason(o) && <span className="mt-1 block text-xs font-bold leading-6 tracking-wider" style={{ color: "var(--color-down)" }}>{lockReason(o)}</span>}
                  {o.detail && <span className="mt-1 block text-xs leading-6 tracking-wider text-dim">{soften(o.detail(p, env, jpData))}</span>}
                </button>
              ))}
            </div>
            {trail.length > 0 && (
              <button type="button" onClick={() => setTrail(trail.slice(0, -1))} className="mt-5 block w-full text-center text-sm tracking-[0.3em] text-haze underline-offset-8 hover:text-mist hover:underline">
                {t.back}
              </button>
            )}
          </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}

// 人生の道のり: 0〜100歳のものさしの上に、いまの年齢と、ターニングポイントと、これまでの大きな節目を、並べる(PC の、出来事の欄の上)。
function LifeRibbon({ age, dead, startAge, events }: { age: number; dead: boolean; startAge: number; events: GameState["events"] }) {
  const [open, setOpen] = useState(false); // スマホでは、閉じておき、タップで、ひらく(PC では、いつも表示)
  // 横軸は、100歳で終わらせず、その先も、うすく続けておく(どこが上限かは、示さない)。目盛りの数字は、100までしか書かない。
  // 100歳をこえて、右はしに近づいたら、軸を、のばす。
  const MAX = Math.max(116, age + 8);
  const pos = (a: number) => `${Math.min(100, Math.max(0, (a / MAX) * 100))}%`;
  const marks = events.filter((e) => e.weight >= 66 && e.age > startAge).slice(0, 40);
  const seenAge = new Set<number>();
  const dots = marks.filter((e) => (seenAge.has(e.age) ? false : (seenAge.add(e.age), true)));
  return (
    <div className="mb-3 rounded-sm border border-line bg-panel/60 px-4 py-2.5">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-baseline justify-between gap-3 text-left text-xs tracking-[0.2em] text-haze lg:cursor-default">
        <span className="flex items-center gap-1.5 text-warm">
          人生の道のり
          <span aria-hidden className={`text-[9px] text-dim transition-transform lg:hidden ${open ? "rotate-180" : ""}`}>▼</span>
        </span>
        <span className="tabular-nums">
          {dead ? `${age}歳で最期` : `いま ${age}歳`}・節目 {dots.length}つ
        </span>
      </button>
      <div className={`${open ? "block" : "hidden"} lg:block`}>
      <div className="relative mt-2 h-6">
        <div className="absolute left-0 top-[0.65rem] h-1.5 rounded-l-full bg-line" style={{ width: pos(100) }} />
        {/* 100歳より先は、数字を書かず、うすく消えていく(上限は、示さない) */}
        <div className="absolute right-0 top-[0.65rem] h-1.5 bg-gradient-to-r from-line to-transparent" style={{ left: pos(100) }} />
        <div className="absolute left-0 top-[0.65rem] h-1.5 rounded-full bg-warm/70" style={{ width: pos(age) }} />
        {/* ターニングポイント */}
        <div className="absolute top-0 -translate-x-1/2" style={{ left: pos(startAge) }} title={`${startAge}歳: ターニングポイント`}>
          <div className="mx-auto h-3 w-px bg-cool" />
          <div className="-mt-0.5 h-2.5 w-2.5 rotate-45 border border-cool bg-panel" />
        </div>
        {/* 節目 */}
        {dots.map((e, i) => (
          <span key={i} className="absolute top-[0.55rem] h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-warm bg-panel" style={{ left: pos(e.age) }} title={`${e.age}歳: ${soften(e.event)}`} />
        ))}
        {/* いま(最期を迎えたあとは、その年齢で止まり、×の印になる) */}
        {dead ? (
          <span className="absolute top-[0.35rem] -translate-x-1/2 text-base leading-none text-dim" style={{ left: pos(age) }} aria-label="最期">
            ×
          </span>
        ) : (
          <span className="absolute top-[0.45rem] h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-warm shadow-[0_0_10px_rgba(240,201,148,0.7)]" style={{ left: pos(age) }} />
        )}
      </div>
      <div className="relative h-3.5 text-[10px] leading-none tabular-nums tracking-wider text-dim">
        {[0, 20, 40, 60, 80, 100].map((a) => (
          <span key={a} className={`absolute whitespace-nowrap ${a === 0 ? "" : "-translate-x-1/2"}`} style={{ left: pos(a) }}>
            {a}
          </span>
        ))}
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 text-[10px] tracking-wider text-dim">
        <span><span className="text-cool">◇</span> ターニングポイント({startAge}歳)</span>
        <span><span className="text-warm">○</span> 人生の節目</span>
        <span><span className="text-warm">●</span> いま　<span>×</span> 最期</span>
      </p>
      </div>
    </div>
  );
}

// 能力値などの、バー。名前の横の「▼」を押すと、説明がひらく。
function StatBar({ label, value, color, note, right = false }: { label: string; value: number; color: string; note: string; right?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-baseline justify-between gap-2 text-left lg:cursor-help">
        <span className="flex items-center gap-1 text-xs tracking-[0.15em] text-haze">
          {label}
          <span aria-hidden className={`text-[9px] text-dim transition-transform lg:hidden ${open ? "rotate-180" : ""}`}>▼</span>
        </span>
        <span className="text-lg tabular-nums" style={{ color }}>
          {Math.round(value)}
        </span>
      </button>
      <div className="mt-1 h-1.5 w-full rounded-full bg-line">
        <motion.div className="h-1.5 rounded-full" style={{ background: color }} animate={{ width: `${value}%` }} transition={{ duration: 0.6 }} />
      </div>
      {/* スマホ: タップでひらく */}
      {open && <p className="mt-1.5 text-[11px] leading-4 tracking-wider text-dim lg:hidden">{note}</p>}
      {/* PC: カーソルを合わせると、説明が出る */}
      <p role="tooltip" className={`pointer-events-none absolute top-full z-40 mt-1 hidden w-[13.5rem] rounded-sm border border-line bg-panel px-3 py-2 text-[11px] leading-5 tracking-wider text-haze shadow-xl lg:group-hover:block ${right ? "right-0" : "left-0"}`}>
        {note}
      </p>
    </div>
  );
}

// 景気・年収のような、値のかたまり。名前の横の「▼」を押すと、説明がひらく。
function NoteBlock({ label, note, children, right = false }: { label: string; note: string; children: React.ReactNode; right?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1 text-xs tracking-[0.15em] text-haze lg:cursor-help">
        {label}
        <span aria-hidden className={`text-[9px] text-dim transition-transform lg:hidden ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {children}
      {open && <p className="mt-1 text-[11px] leading-4 tracking-wider text-dim lg:hidden">{note}</p>}
      <p role="tooltip" className={`pointer-events-none absolute top-full z-40 mt-1 hidden w-[13.5rem] rounded-sm border border-line bg-panel px-3 py-2 text-[11px] leading-5 tracking-wider text-haze shadow-xl lg:group-hover:block ${right ? "right-0" : "left-0"}`}>
        {note}
      </p>
    </div>
  );
}

// 家族(配偶者・子ども・親)とペットの、いまの状態。
// いま関係のある人との関係値(親密か、疎遠か)。
function RelationPanel({ p }: { p: GameState["person"] }) {
  const rels = relationships(p);
  if (rels.length === 0) return null;
  const color = (r: Relation) => (r.tone === "gone" ? "var(--color-dim)" : r.tone === "good" ? "var(--color-up)" : r.tone === "mid" ? "var(--color-warm)" : "var(--color-down)");
  return (
    <div className="mt-6 rounded-sm border border-line bg-panel/60 px-4 py-3">
      <p className="text-xs tracking-[0.3em] text-warm">人との関係</p>
      <p className="mt-1 text-[11px] leading-4 tracking-wider text-dim">いま関係のある人との距離。つながり・相性・同居・最近の出来事で、変わります。</p>
      <ul className="mt-3 space-y-3">
        {rels.map((r) => (
          <li key={r.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm tracking-wider">
              <span className="text-mist">
                <span className="text-haze">{r.role}</span>{r.name !== r.role ? ` ${r.name}` : ""}
              </span>
              <span className="keep shrink-0 text-xs font-bold" style={{ color: color(r) }}>
                {r.label}
                {r.tone !== "gone" && <span className="ml-1 tabular-nums">{r.score}</span>}
              </span>
            </div>
            {r.tone !== "gone" && (
              <div className="mt-1 h-1 w-full rounded-full bg-line">
                <div className="h-1 rounded-full" style={{ width: `${r.score}%`, background: color(r) }} />
              </div>
            )}
            {r.facts.length > 0 && <p className="mt-1 text-[11px] leading-4 tracking-wider text-dim">{r.facts.join("・")}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FamilyStatus({ t, p }: { t: Messages["play"]["family"]; p: GameState["person"] }) {
  const mother = p.age >= p.parentDeath.mother ? t.gone : p.age >= p.parentDeath.mother - 2 ? t.ill : `${t.alive}(${p.age + p.parentOffset.mother}歳)`;
  const father = p.age >= p.parentDeath.father ? t.gone : p.age >= p.parentDeath.father - 2 ? t.ill : `${t.alive}(${p.age + p.parentOffset.father}歳)`;
  const row = "flex items-baseline justify-between gap-3 text-sm leading-7 tracking-wider";
  return (
    <div className="mt-6 rounded-sm border border-line bg-panel/60 px-4 py-3">
      <p className="text-xs tracking-[0.3em] text-warm">{t.title}</p>
      <dl className="mt-2">
        <div className={row}>
          <dt className="text-haze">{t.spouse}</dt>
          <dd className="text-right text-mist">
            {p.married ? (p.partner ? `${p.partner.family}${p.partner.given}` : t.has) : p.partner && (p.partner.status === "dating" || p.partner.status === "crush") ? `${p.partner.given}さん(${p.partner.status === "dating" ? "交際中" : "気になる人"})` : t.none}
            {p.partner && p.partner.status !== "ex" && p.partner.mbti && (
              <span className="block text-xs text-dim">
                {typeLabel(p.partner.mbti)}
                {p.mbti ? ` ・相性 ${compatMark(compat(p.mbti, p.partner.mbti))} ${compat(p.mbti, p.partner.mbti)}%` : ""}
              </span>
            )}
          </dd>
        </div>
        <div className={row}>
          <dt className="shrink-0 text-haze">{t.kids}</dt>
          <dd className="text-right text-mist">{p.kidList.length ? p.kidList.map((k, i) => `${k.anon ? kidTitle(p, i) : k.name ? kidCall(p, i) : `${kidTitle(p, i)}(名前はこれから)`}(${k.sex === "unknown" ? "名前・性別は未設定・" : ""}${p.age - k.bornAge}${t.born})`).join("・") : t.none}</dd>
        </div>
        <div className={row}>
          <dt className="text-haze">{t.mother}</dt>
          <dd className={p.age >= p.parentDeath.mother ? "text-dim" : "text-mist"}>{mother}</dd>
        </div>
        <div className={row}>
          <dt className="text-haze">{t.father}</dt>
          <dd className={p.age >= p.parentDeath.father ? "text-dim" : "text-mist"}>{father}</dd>
        </div>
        {p.pets.length > 0 && (
          <div className={row}>
            <dt className="shrink-0 text-haze">{t.pets}</dt>
            <dd className="text-right text-mist">
              {p.pets.map((x) => (x.died ? `${x.name}(${t.petGone})` : `${x.name || x.kind}(${x.kind}・${p.age - x.adoptedAge}${t.born})`)).join("・")}
            </dd>
          </div>
        )}
      </dl>
      {p.mbti ? (
        <p className="mt-3 border-t border-line pt-2 text-[11px] leading-5 tracking-wider text-dim">
          あなたは {typeLabel(p.mbti)}。相性がよいとされるのは {IDEAL[p.mbti].map(typeLabel).join("・")}。恋人として出会う確率はこのタイプの人が約{Math.round(idealChance(p.mbti) * 100)}%
          <span className="block">(出会いやすさの目安。MBTIの相性は俗説で実際の恋愛を保証するものではありません)</span>
        </p>
      ) : (
        <p className="mt-3 border-t border-line pt-2 text-[11px] leading-5 tracking-wider text-dim">MBTIを入力すると相性のよいタイプと出会う確率が出ます。</p>
      )}
      {(p.mood === "depressed" || p.sick) && (
        <p className="mt-2 text-xs leading-6 tracking-wider" style={{ color: "var(--color-s-bonds)" }}>
          {p.mood === "depressed" ? "心が深く沈んでいる。" : ""}
          {p.sick ? "深刻な病気を抱えている。" : ""}
        </p>
      )}
    </div>
  );
}
