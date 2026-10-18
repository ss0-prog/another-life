"use client";

import { useSyncExternalStore } from "react";
import type { Weather } from "@/lib/sim/weather";

// 背景(Ambient)と、再生画面(PlayScreen)で、いまの空模様を共有する。
let current: Weather = "clear";
const listeners = new Set<() => void>();

export const setWeather = (w: Weather) => {
  if (w === current) return;
  current = w;
  listeners.forEach((l) => l());
};

export const useWeather = (): Weather =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => "clear",
  );
