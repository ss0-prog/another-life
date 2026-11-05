"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

// 初めて来た人へのポップアップ。親の位置(relative)を基準に出すだけで、画面を暗くしたり、位置を追いかけたりしない。
// place="below": 親(ボタン)の下に、矢印つきのふきだしを出す。place="top-right": 画面の右上に出す。
// 画面(トップ・入力・遊ぶ)ごとに、一度だけ出す。OKを押すか、一度表示すると、この端末に覚えておく。
const KEY = "betsu-uchu:guide-note";

// 開発中の確認用: true の間は、「見た」の記録を無視して、毎回出す。
// 公開の前に、必ず false にもどす(本来は、初めての人に一度だけ出す)。
const ALWAYS_SHOW = false;

const NOTES = {
  home: { title: "はじめる", body: "上のボタンをタップ" },
  wizard: { title: "進め方", body: "あなたの情報を選択してください。完全ランダムでも遊べます。\n(ここで選択した情報はこのシミュレートの用途以外には絶対に使用しません。情報はブラウザが記録し、クラウドには送信されません)" },
  play: { title: "見届ける", body: "一年ずつ進むシミュレートでは、いくつもの節目が訪れます。選択して、自分が思うがままに生きてみましょう。" },
} as const;

export type GuideSection = keyof typeof NOTES;

const read = (): Partial<Record<GuideSection, boolean>> => {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
};

export function GuideNote({ section, place }: { section: GuideSection; place: "below" | "top-right" }) {
  const [show, setShow] = useState(false);
  const shown = useRef(false);
  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ ...read(), [section]: true }));
    } catch {
      /* 保存できない環境では、毎回出るだけ */
    }
  }, [section]);
  useEffect(() => {
    if (!ALWAYS_SHOW && read()[section]) return;
    const timer = window.setTimeout(() => {
      shown.current = true;
      setShow(true);
    }, 500);
    // 「見た」ことにするのは、閉じたときと、次の画面へ進んだとき。見ないまま閉じたり、読み込みなおしたりしたときは、また出す。
    return () => {
      window.clearTimeout(timer);
      if (shown.current) markSeen();
    };
  }, [section, markSeen]);
  // 入力・遊ぶ画面では、OKを押すまでは、ポップアップの外を押しても、何も起きないようにする(画面を暗くしたり、覆ったりはしない)。
  const [nudge, setNudge] = useState(0);
  useEffect(() => {
    // トップでは、止めない(「はじめる」ボタンを、そのまま押せる)。
    if (!show || section === "home") return;
    const block = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return;
      e.preventDefault();
      e.stopPropagation();
      setNudge((k) => k + 1);
    };
    document.addEventListener("click", block, true);
    return () => document.removeEventListener("click", block, true);
  }, [show, section]);
  const n = NOTES[section];
  const below = place === "below";
  return (
    <AnimatePresence>
      {show && (
        <>
          {/* 入力・遊ぶ画面では、ポップアップ以外を暗くする(トップでは暗くしない)。押す操作は止めない(止めるのは、上の処理) */}
          {section !== "home" && <motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="pointer-events-none fixed inset-0 z-[85] bg-black/60" />}
          <motion.div
            role="dialog"
            aria-label={n.title}
            initial={{ opacity: 0, scale: 0.94, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: nudge === 0 ? 0 : nudge % 2 ? [0, -5, 5, -3, 0] : [0, 5, -5, 3, 0] }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className={`absolute z-[95] w-[min(16rem,92vw)] rounded-sm border bg-panel px-3 py-2 text-left text-xs leading-5 tracking-wide text-mist ${below ? "left-1/2 top-full mt-4 -translate-x-1/2 border-warm/60" : "right-[2.5vw] top-2 border-warm/60"}`}
          >
            {below && <span aria-hidden className="absolute -top-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-l border-t border-warm/60 bg-panel" />}
            <p className="font-bold text-warm">{n.title}</p>
            {/* トップでは、OKを本文の横に置く。ほかの画面では、本文の下の右に置く */}
            <div className={section === "home" ? "mt-1 flex items-center justify-between gap-3" : "mt-1"}>
              <p className="whitespace-pre-line text-haze">{n.body}</p>
              <div className={section === "home" ? "shrink-0" : "mt-1.5 flex justify-end"}>
                <button type="button" onClick={() => { setShow(false); markSeen(); }} className="border border-warm/60 px-3 py-px text-[11px] text-mist hover:border-warm hover:bg-warm/10">
                  OK
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
