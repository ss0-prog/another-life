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

// ランダムで始めた人生の、履歴とお気に入り。このブラウザに、あわせて10件まで(履歴は最新5件・お気に入りは5件まで)。
const RANDOM_STORAGE = "betsu-uchu:random-lives";
export const HISTORY_MAX = 5;
export const FAVORITE_MAX = 5;
export type RandomLife = { id: string; createdAt: string; self: CurrentSelf; branch: Branch; seed: number; favorite: boolean };

const readRandom = (): RandomLife[] => {
  const raw = safeGet(RANDOM_STORAGE);
  if (!raw) return [];
  try {
    const o = JSON.parse(raw);
    return Array.isArray(o) ? o.filter((x) => x && x.self && x.branch && typeof x.seed === "number") : [];
  } catch {
    return [];
  }
};
// 履歴(お気に入りでないもの)は新しい順に5件、お気に入りは5件まで。
const trimRandom = (list: RandomLife[]): RandomLife[] => [...list.filter((x) => !x.favorite).slice(0, HISTORY_MAX), ...list.filter((x) => x.favorite).slice(0, FAVORITE_MAX)].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

export const randomLives = {
  list: readRandom,
  add(item: Omit<RandomLife, "id" | "createdAt" | "favorite">): RandomLife[] {
    const next = trimRandom([{ ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString(), favorite: false }, ...readRandom()]);
    safeSet(RANDOM_STORAGE, JSON.stringify(next));
    return next;
  },
  // お気に入りの入れかえ。5件をこえるときは、入れられない。
  toggleFavorite(id: string): { list: RandomLife[]; full: boolean } {
    const list = readRandom();
    const target = list.find((x) => x.id === id);
    if (!target) return { list, full: false };
    if (!target.favorite && list.filter((x) => x.favorite).length >= FAVORITE_MAX) return { list, full: true };
    target.favorite = !target.favorite;
    const next = trimRandom(list);
    safeSet(RANDOM_STORAGE, JSON.stringify(next));
    return { list: next, full: false };
  },
  remove(id: string): RandomLife[] {
    const next = readRandom().filter((x) => x.id !== id);
    safeSet(RANDOM_STORAGE, JSON.stringify(next));
    return next;
  },
};
