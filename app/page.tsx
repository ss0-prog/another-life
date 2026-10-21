"use client";

import { IfMark } from "@/components/IfMark";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CompareResult } from "@/components/CompareResult";
import { PlayScreen } from "@/components/PlayScreen";
import { TreeWizard } from "@/components/TreeWizard";
import { primaryButtonClass } from "@/components/controls";
import { branchLabelOf, entryFrom, publishEntry } from "@/lib/archive";
import { cloudEchoStore, profileStore, type SavedProfile } from "@/lib/cloud";
import { getMessages } from "@/lib/i18n";
import { autoRun, startAlt, startReal, summarize } from "@/lib/sim/engine";
import type { Branch, CurrentSelf, GameState, LifeSummary, Setup } from "@/lib/sim/types";
import { echoStore, profileLocal } from "@/lib/storage";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";

const t = getMessages();

type Phase =
  | { name: "home" }
  | { name: "wizard" }
  | { name: "play"; initial: GameState }
  | { name: "result"; real: LifeSummary; alt: LifeSummary; altLabel: string };

export default function Home() {
  const { user, enabled, login } = useAuth();
  const [saved, setSaved] = useState<SavedProfile | null>(null);
  const [prefill, setPrefill] = useState<CurrentSelf | null>(null);
  // ログインしていなくても、最後に入力した条件を、このブラウザから読み込む。ログイン中は、アカウントに記憶した条件を優先する。
  useEffect(() => {
    setSaved(profileLocal.get());
  }, []);
  useEffect(() => {
    if (!user) return;
    profileStore.load(user.uid).then((p) => p && setSaved(p));
  }, [user]);
  const [phase, setPhase] = useState<Phase>({ name: "home" });
  const [setup, setSetup] = useState<Setup | null>(null);
  // 分かれなかった「現実のあなた」の人生。はじめに一度だけ最後まで進めておき、プレイ中の見比べと、結果に使う。
  const [realRun, setRealRun] = useState<GameState | null>(null);

  // マルチバース: 同じ運命(同じ種)のまま、別の道を歩んだ、ほかの宇宙。最大3つまで。
  const [multi, setMulti] = useState(false);
  // 遊ぶ画面を、はじめから作りなおすための番号(やり直すたびに増やす。同じ画面のまま、前の人生が残らないように)。
  const [runId, setRunId] = useState(0);
  // 画面の中の確認(はい・いいえ)。
  const [ask, setAsk] = useState<{ message: string; yes: string; run: () => void } | null>(null);
  // 左上のタイトルが押されたら、トップ画面にもどる(遊んでいる途中なら、確かめてから)。
  useEffect(() => {
    const goHome = () => {
      setMulti(false);
      setPrefill(null);
      setPhase({ name: "home" });
      window.scrollTo({ top: 0 });
    };
    const onHome = () => {
      // 遊んでいる途中は、画面の中の確認(ブラウザの確認ダイアログは、使えない環境があるため)を出す。
      if (phase.name === "play") setAsk({ message: "遊んでいる途中です。トップにもどりますか?(この人生は、保存されません)", yes: "トップにもどる", run: goHome });
      else goHome();
    };
    window.addEventListener("betsu-uchu:home", onHome);
    return () => window.removeEventListener("betsu-uchu:home", onHome);
  }, [phase.name]);
  // いまの画面(トップ・入力・遊ぶ・結果)を、ヘッダーに伝える。遊ぶ・結果の画面では、ヘッダーの「はじめる」が、「同じ条件で人生をやり直す」に変わる。
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("betsu-uchu:phase", { detail: phase.name }));
    return () => {
      window.dispatchEvent(new CustomEvent("betsu-uchu:phase", { detail: "other" }));
    };
  }, [phase.name]);
  // 開発中だけ: /?dev=1 で、遊ぶ画面に、開発者の道具箱が出る(本番では出ない)。
  const [dev, setDev] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") setDev(new URLSearchParams(window.location.search).get("dev") === "1");
  }, []);

  // 入力画面に入ったときは、画面の一番上から始める。
  useEffect(() => {
    if (phase.name === "wizard") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase.name]);

  const startPlay = (self: CurrentSelf, branch: Branch, fresh = false, keepFate = false) => {
    // 巻き戻しのときは、同じ種(景気・空模様・めぐり合わせ)のまま、選ぶ道だけを変える。
    const keep = setup && (keepFate || (!fresh && multi));
    const next: Setup = { self: keep ? setup.self : self, branch, seed: keep ? setup.seed : Math.floor(Math.random() * 2 ** 31) };
    // 入力した条件は、このブラウザに覚えておく(次から、入力を飛ばして始められる)。
    profileLocal.set({ self: next.self, branch: next.branch });
    setSaved({ self: next.self, branch: next.branch });
    setSetup(next);
    if (!keep) {
      setRealRun(autoRun(startReal(next)));
    }
    setMulti(false);
    setRunId((n) => n + 1);
    setPhase({ name: "play", initial: startAlt(next) });
    window.scrollTo({ top: 0 });
  };

  // 同じ条件(いまのあなた・ターニングポイント)で、人生をはじめからやり直す。運命(景気・空模様・めぐり合わせ)は、新しくなる。
  useEffect(() => {
    const onRestart = () => {
      if (!setup) return;
      const run = () => startPlay(setup.self, setup.branch, true);
      if (phase.name === "play") setAsk({ message: "遊んでいる途中です。同じ条件ではじめからやり直しますか?(この人生は、保存されません)", yes: "やり直す", run });
      else run();
    };
    window.addEventListener("betsu-uchu:restart", onRestart);
    return () => window.removeEventListener("betsu-uchu:restart", onRestart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, phase.name]);

  // もうひとりの人生が終わったら、分岐しなかった今のままの自分を最後まで進めて見比べる。
  const finish = (final: GameState) => {
    if (!setup) return;
    setPhase({ name: "result", alt: summarize(final), altLabel: branchLabelOf(setup), real: summarize(realRun ?? autoRun(startReal(setup))) });
    window.scrollTo({ top: 0 });
  };

  // ログイン中はアカウント(Firestore)、未ログインならこのブラウザに保存する。
  const save = async (publish: boolean, comment: string): Promise<"cloud" | "local" | "failed" | "publishFailed"> => {
    if (phase.name !== "result" || !setup) return "failed";
    const item = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), setup, alt: phase.alt, real: phase.real };
    if (user) {
      const saved = await cloudEchoStore.save(user.uid, item);
      if (!saved) return "failed";
      if (publish && !(await publishEntry(entryFrom(item.id, setup, phase.alt, phase.real, user.uid, comment)))) return "publishFailed";
      return "cloud";
    }
    return echoStore.save(item) ? "local" : "failed";
  };

  return (
    <div className="relative flex flex-1 flex-col">
      {ask && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-[2.5vw] backdrop-blur-sm">
          <div className="w-full max-w-md rounded-sm border border-warm/60 bg-panel px-6 py-6 text-center shadow-xl">
            <p className="text-base leading-8 tracking-wider text-mist">{ask.message}</p>
            <div className="mt-6 flex items-center justify-center gap-4">
              <button type="button" onClick={() => setAsk(null)} className="border border-line px-5 py-2 text-sm tracking-[0.2em] text-haze hover:border-haze hover:text-mist">
                つづける
              </button>
              <button
                type="button"
                onClick={() => {
                  const run = ask.run;
                  setAsk(null);
                  run();
                }}
                className="keep border border-warm/70 bg-warm/10 px-5 py-2 text-sm font-bold tracking-[0.2em] text-mist hover:border-warm"
              >
                {ask.yes}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        <AnimatePresence mode="wait">
          {phase.name === "home" && (
            <motion.div
              key="home"
              className="mx-auto flex w-full max-w-4xl flex-col items-center px-[2.5vw] pb-24 pt-12 sm:px-6 sm:pt-[4.5rem]"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 1 }}
            >
              {/* タイトルまわりの3行は、いちばん幅の広い行にそろえて、左右の頭をそろえる */}
              <div className="flex w-fit max-w-full flex-col items-stretch">
              <motion.p className="flex items-center justify-between gap-2 whitespace-nowrap text-[13px] font-bold tracking-[0.12em] text-warm min-[400px]:gap-3 min-[400px]:text-lg min-[400px]:tracking-[0.3em] sm:gap-5 sm:text-2xl sm:tracking-[0.4em]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 1.6 }}>
                <span aria-hidden className="h-px w-3 shrink-0 bg-warm min-[400px]:w-5 sm:w-9" />
                <span className="-mr-[0.12em] min-[400px]:-mr-[0.3em] sm:-mr-[0.4em]">{t.home.eyebrow}</span>
                <span aria-hidden className="h-px w-3 shrink-0 bg-warm min-[400px]:w-5 sm:w-9" />
              </motion.p>
              {/* タイトルの行: ロゴ「if」を、タイトルの左に、同じ高さで置く。上の「もうひとつの人生を見届ける」と、左右の頭と尻をそろえる */}
              <motion.div
                className="mt-8 flex items-center justify-between gap-3 text-2xl sm:gap-5 sm:text-4xl"
                initial={{ opacity: 0, filter: "blur(8px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                transition={{ delay: 0.8, duration: 2.4, ease: "easeOut" }}
              >
                <IfMark className="h-[1.15em] w-auto shrink-0 text-mist" />
                {/* コロン: ロゴとタイトルの、ちょうど真ん中に置く(左右の間隔が、同じになるように) */}
                <svg aria-hidden viewBox="0 2 7 62" className="h-[1.15em] w-auto shrink-0 text-mist" fill="currentColor">
                  <circle cx="3.5" cy="31" r="3.4" />
                  <circle cx="3.5" cy="53" r="3.4" />
                </svg>
                <h1 className="-mr-[0.2em] min-w-0 flex-1 whitespace-nowrap text-center tracking-[0.2em] text-mist [text-align-last:justify] sm:-mr-[0.35em] sm:tracking-[0.35em]">{t.home.title}</h1>
              </motion.div>
              <motion.p className="mt-4 whitespace-nowrap text-center text-sm tracking-[0.5em] text-haze sm:text-base" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 1.8 }}>
                {t.home.subtitle}
              </motion.p>
              </div>
              <motion.div className="mt-12 w-full space-y-6 text-center text-sm leading-8 tracking-[0.15em] text-haze" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 2 }}>
                {/* 一行目の途中の改行は、スマホ(幅640px未満)だけ。PCでは、つづけて一行に出す。三行目(最後)の前は、いつも改行する */}
                <p>
                  {(() => {
                    const [a, b, c] = t.home.lead.split("\n");
                    return (
                      <>
                        {a}
                        <br className="sm:hidden" />
                        {b}
                        <br />
                        {c}
                      </>
                    );
                  })()}
                </p>
              </motion.div>
              {saved && (
                <div className="mt-12 w-full max-w-2xl rounded-sm border border-warm/50 bg-panel/80 px-6 py-6 text-center backdrop-blur-sm">
                  <p className="text-xs tracking-[0.4em] text-warm">前回の入力</p>
                  <p className="mt-3 text-base leading-8 tracking-wider text-mist">
                    {saved.self.age}歳・{saved.self.prefecture}
                    <span className="block text-sm text-haze">ターニングポイント: {branchLabelOf({ self: saved.self, branch: saved.branch, seed: 0 } as Setup)}({saved.branch.age}歳)</span>
                  </p>
                  <p className="mt-1 text-[11px] leading-5 tracking-wider text-dim">{t.home.useSavedNote}</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => startPlay(saved.self, saved.branch)} className="border border-warm/70 bg-warm/10 px-4 py-3 text-sm font-bold tracking-[0.2em] text-mist transition-colors hover:border-warm hover:bg-warm/20">
                      {t.home.useSaved}
                      <span className="mt-1 block text-[11px] font-normal tracking-wider text-haze">同じターニングポイントですぐに始める</span>
                    </button>
                    <button type="button" onClick={() => { setPrefill(saved.self); setPhase({ name: "wizard" }); }} className="border border-warm/70 px-4 py-3 text-sm font-bold tracking-[0.2em] text-mist transition-colors hover:border-warm hover:bg-warm/10">
                      {t.home.changeBranch}
                      <span className="mt-1 block text-[11px] font-normal tracking-wider text-haze">いまのあなたはそのまま別の道を選ぶ</span>
                    </button>
                  </div>
                  <button type="button" onClick={() => { profileLocal.clear(); setSaved(null); }} className="mt-4 text-xs tracking-wider text-dim underline-offset-4 hover:text-mist hover:underline">
                    この端末の記憶を消す
                  </button>
                </div>
              )}
              {/* 「別の人生をシミュレートする」は、アニメーションで出さず、はじめから、表示しておく */}
              <div className="mt-12">
                <button type="button" onClick={() => { setPrefill(null); setPhase({ name: "wizard" }); }} className={primaryButtonClass}>
                  <span className="absolute inset-0 border border-warm/60 bg-warm/5 transition-colors group-hover:border-warm group-hover:bg-warm/10" />
                  {t.home.start}
                </button>
              </div>
              <motion.p className="mt-20 text-xs tracking-[0.5em] text-haze" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4, duration: 1.4 }}>
                {t.home.howTo}
              </motion.p>
              <motion.ol className="mt-4 grid w-full gap-4 lg:grid-cols-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.6, duration: 1.6 }}>
                {t.home.steps.map((step, i) => (
                  <li key={step} className="flex flex-col items-center rounded-sm border border-line bg-panel/70 px-5 py-6 text-center backdrop-blur-sm">
                    <span className="text-2xl text-warm">{i + 1}</span>
                    <p className="mt-2 whitespace-pre-line text-sm font-bold leading-7 tracking-wider text-mist">{step}</p>
                    <span aria-hidden className="mt-3 h-px w-8 bg-line" />
                    {t.home.stepsDetail?.[i] && <p className="mt-3 w-full text-left text-xs leading-6 tracking-[0.06em] text-haze">{t.home.stepsDetail[i]}</p>}
                  </li>
                ))}
              </motion.ol>
              {/* 「無数のifの先へ」の上にも、「別の人生をシミュレートする」を置く */}
              <div className="mt-14">
                <button type="button" onClick={() => { setPrefill(null); setPhase({ name: "wizard" }); }} className={primaryButtonClass}>
                  <span className="absolute inset-0 border border-warm/60 bg-warm/5 transition-colors group-hover:border-warm group-hover:bg-warm/10" />
                  {t.home.start}
                </button>
              </div>
              {/* 無数の「if」の先へ(多元宇宙の考え方に触れる) */}
              <motion.div className="mt-14 w-full max-w-2xl text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.8, duration: 1.6 }}>
                <p className="text-xs tracking-[0.5em] text-haze">{t.home.ifTitle}</p>
                <div className="mt-5 space-y-5 text-sm leading-8 tracking-[0.08em] text-haze">
                  {t.home.ifBody.map((line, i) => (
                    <p key={i} className={`whitespace-pre-line ${i === 0 ? "cq [--fit:39.5]" : ""} ${i === 0 || i === t.home.ifBody.length - 1 ? "text-mist" : ""}`}>{i === 0 ? <span className="fancy-underline fit-line">{line}</span> : line}</p>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}

          {phase.name === "wizard" && (
            <motion.div key="wizard" className="flex w-full flex-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
              <TreeWizard
                t={t.wizard}
                onSubmit={startPlay}
                prefill={prefill}
                auth={{
                  enabled,
                  loggedIn: !!user,
                  login: async () => {
                    await login();
                    return !!getFirebaseAuth().currentUser;
                  },
                  remember: async (self, branch) => {
                    const uid = getFirebaseAuth().currentUser?.uid;
                    return uid ? profileStore.save(uid, { self, branch }) : false;
                  },
                }}
              />
            </motion.div>
          )}

          {phase.name === "play" && (
            <motion.div key={`play-${runId}`} className="flex w-full flex-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
              <PlayScreen t={t.play} initial={phase.initial} birthYear={new Date().getFullYear() - (setup?.self.age ?? 0)} selfAge={setup?.self.age ?? 0} ghost={realRun?.series ?? []} dev={dev} onFinish={finish} />
            </motion.div>
          )}

          {phase.name === "result" && (
            <motion.div key="result" className="w-full px-[2.5vw] pb-24 pt-10 sm:px-10" exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
              <CompareResult
                t={t.result}
                real={phase.real}
                alt={phase.alt}
                altLabel={phase.altLabel}
                onSave={save}
                canPublish={Boolean(user)}
                publishEnabled={enabled}
                onLogin={() => void login()}
                onMulti={() => {
                  // 同じ条件(いまのあなた・ターニングポイント・運命)のまま、すぐに、遊ぶ画面へ。何度でも、やり直せる。
                  if (!setup) return;
                  startPlay(setup.self, setup.branch, false, true);
                }}
                onAgain={() => {
                  setMulti(false);
                  setPrefill(null);
                  setPhase({ name: "wizard" });
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="w-full px-[2.5vw] pb-24 pt-10 sm:px-12 lg:px-20"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      {children}
    </motion.div>
  );
}
