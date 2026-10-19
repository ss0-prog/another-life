"use client";

import { useSyncExternalStore } from "react";

// 昼・夕方・夜。ボタンで、昼 → 夕方 → 夜 → 昼 の順に切り替え、選んだ状態は、このブラウザに覚えておく。
// 切り替えるときは、いきなり変えず、夜→(朝焼け)→昼、昼→夕方→夜 と、ゆっくり移り変わる。夕方は、太陽も月も出ていない、夕焼けの空。
export type TimeOfDay = "night" | "day" | "evening";
export const TOD_LABEL: Record<TimeOfDay, string> = { day: "昼", evening: "夕", night: "夜" };
export const nextTod = (t: TimeOfDay): TimeOfDay => (t === "day" ? "evening" : t === "evening" ? "night" : "day");
export type Phase = "night" | "dawn" | "day" | "dusk";

const KEY = "betsu-uchu:time";
// 一つの段階にかける時間(ミリ秒)。空の色は、この時間をかけて、なめらかに変わる。
export const PHASE_MS = 5000;

let current: TimeOfDay = "night";
let phase: Phase = "night";
let loaded = false;
let timer: ReturnType<typeof setTimeout> | null = null;
// 切り替えの途中(空が移り変わっているあいだ)は、新しい切り替えを、受けつけない。
let locked = false;
// 昼夜のボタンが押されたあと(それまでは、はじめから、昼か夜の空を、そのまま出す)。
let skyAnimated = false;
let unlockTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const apply = () => {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.tod = current;
    document.documentElement.dataset.phase = phase;
    // 昼夜の切り替え中(空が、まだ、変わっている間)は、印をつける。この間は、文字の「自動コントラスト」を、止める。
    document.documentElement.toggleAttribute("data-tod-lock", locked);
  }
};
const emit = () => {
  apply();
  listeners.forEach((l) => l());
};

// ブラウザに覚えている状態を、一度だけ読み込む(切り替えのアニメーションはしない)。
export function loadTimeOfDay() {
  if (loaded) return;
  loaded = true;
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "day" || v === "night" || v === "evening") {
      current = v;
      phase = v === "evening" ? "dusk" : v;
      emit();
    }
    // 最初の表示だけは、色の変化をつけない(layout の最初のスクリプトが、つけた印を、はずす)。
    window.setTimeout(() => document.documentElement.classList.remove("no-anim"), 500);
  } catch {
    /* 保存できない環境では、夜のまま */
  }
}

export function setTimeOfDay(t: TimeOfDay) {
  if (locked) return;
  skyAnimated = true;
  if (t === current && (phase === t)) return;
  // 朝焼け(夕焼け)の5秒と、そのあとの、太陽や月が、位置につく5秒のあいだ、ロックする。
  locked = true;
  if (unlockTimer) clearTimeout(unlockTimer);
  unlockTimer = setTimeout(() => {
    locked = false;
    unlockTimer = null;
    emit();
  }, PHASE_MS * 2);
  current = t;
  try {
    window.localStorage.setItem(KEY, t);
  } catch {
    /* noop */
  }
  if (timer) clearTimeout(timer);
  if (t === "day") {
    // 夜 → 朝焼け → 昼
    phase = "dawn";
    emit();
    timer = setTimeout(() => {
      phase = "day";
      timer = null;
      emit();
    }, PHASE_MS);
  } else {
    // 夕方は、夕焼けの空のまま、とどまる。夜へは、そのまま、夜の空へ移る。
    phase = t === "evening" ? "dusk" : "night";
    timer = null;
    emit();
  }
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useTimeOfDay = (): TimeOfDay => useSyncExternalStore(subscribe, () => current, () => "night");
export const useSkyAnimated = (): boolean => useSyncExternalStore(subscribe, () => skyAnimated, () => false);
export const useTimeLocked = (): boolean => useSyncExternalStore(subscribe, () => locked, () => false);
export const usePhase = (): Phase => useSyncExternalStore(subscribe, () => phase, () => "night");
