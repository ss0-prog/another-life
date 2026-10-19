"use client";

import { useEffect } from "react";
import { resumeBgmOnFirstTouch, watchLightning, watchCrow, setBgmMood, toggleBgm, useBgmOn } from "@/lib/bgm";
import { usePhase } from "@/lib/timeStore";
import { useWeather } from "@/lib/weatherStore";

// 昼夜・空模様の変化を、BGMに伝える。ヘッダーに一つだけ置く。
export function BgmDriver() {
  const phase = usePhase();
  const weather = useWeather();
  useEffect(() => setBgmMood({ phase, weather }), [phase, weather]);
  useEffect(() => resumeBgmOnFirstTouch(), []);
  useEffect(() => watchLightning(), []);
  useEffect(() => watchCrow(), []);
  return null;
}

export function BgmToggle({ variant }: { variant: "nav" | "icon" | "drawer" }) {
  const on = useBgmOn();
  const label = on ? "BGMを止める" : "BGMを流す";
  const icon = (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
      {!on && <path d="M3 3l18 18" />}
    </svg>
  );
  if (variant === "icon")
    return (
      <button type="button" onClick={toggleBgm} aria-pressed={on} aria-label={label} className={`flex h-9 w-9 items-center justify-center border sm:h-10 sm:w-10 ${on ? "border-warm/60 text-warm" : "border-line text-haze"} hover:text-mist`}>
        {icon}
      </button>
    );
  return (
    <button type="button" onClick={toggleBgm} aria-pressed={on} title={label} className={`flex items-center gap-2 border ${variant === "drawer" ? "px-3 py-2" : "px-2.5 py-1 xl:px-3"} ${on ? "border-warm/60 text-warm" : "border-line text-haze"} hover:border-haze hover:text-mist`}>
      {icon}
      {variant === "drawer" ? (on ? "BGM をとめる" : "BGM を流す") : <span className="max-xl:sr-only">BGM</span>}
    </button>
  );
}
