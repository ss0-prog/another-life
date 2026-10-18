"use client";

import type { SavedEcho } from "@/lib/types";
import type { Branch, CurrentSelf } from "@/lib/sim/types";

const ECHOES_STORAGE = "betsu-uchu:echoes";

// LocalStorage はプライベートモードなどで例外を投げることがあるため、すべて握りつぶす。
function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export const echoStore = {
  list(): SavedEcho[] {
    const raw = safeGet(ECHOES_STORAGE);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },
  save(echo: SavedEcho): boolean {
    const others = echoStore.list().filter((e) => e.id !== echo.id);
    return safeSet(ECHOES_STORAGE, JSON.stringify([echo, ...others].slice(0, 50)));
  },
};

// 最後に入力した「いまのあなた」とターニングポイントを、このブラウザに覚えておく(ログインしなくても、次から入力を飛ばせる)。
const PROFILE_STORAGE = "betsu-uchu:profile";
export const profileLocal = {
  get(): { self: CurrentSelf; branch: Branch } | null {
    const raw = safeGet(PROFILE_STORAGE);
    if (!raw) return null;
    try {
      const o = JSON.parse(raw);
      return o && o.self && o.branch ? o : null;
    } catch {
      return null;
    }
  },
  set(profile: { self: CurrentSelf; branch: Branch }): boolean {
    return safeSet(PROFILE_STORAGE, JSON.stringify(profile));
  },
  clear() {
    try {
      window.localStorage.removeItem(PROFILE_STORAGE);
    } catch {
      /* noop */
    }
  },
};
