"use client";

import { useCallback, useEffect, useState } from "react";
import { countPresent } from "@/lib/presence";
import { useAuth } from "@/lib/useAuth";

const POLL_MS = 15_000;

// 管理者だけが見られる画面。見られるかどうかは、Firestore のルール(管理者のメールだけ読める)で決まる。
export default function AdminPage() {
  const { enabled, user, login, logout } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);
  const [at, setAt] = useState("");

  const load = useCallback(async () => {
    try {
      setCount(await countPresent());
      setDenied(false);
      setAt(new Date().toLocaleTimeString("ja-JP"));
    } catch {
      setDenied(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
    const t = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(t);
  }, [user, load]);

  return (
    <div className="mx-auto w-full max-w-xl px-6 pb-24 pt-16 text-center">
      <h1 className="text-xl tracking-[0.2em] text-mist">管理</h1>
      {!enabled ? (
        <p className="mt-8 text-sm text-haze">この環境では、使えません。</p>
      ) : !user ? (
        <div className="mt-8">
          <p className="text-sm tracking-wider text-haze">管理者としてログインしてください。</p>
          <button type="button" onClick={() => void login()} className="mt-6 border border-warm/60 bg-warm/5 px-6 py-3 text-sm tracking-[0.2em] text-mist hover:border-warm">
            ログイン
          </button>
        </div>
      ) : denied ? (
        <div className="mt-8">
          <p role="alert" className="text-sm tracking-wider text-haze">この画面は、管理者だけが見られます。</p>
          <button type="button" onClick={() => void logout()} className="mt-6 text-xs tracking-[0.3em] text-haze underline underline-offset-8 hover:text-mist">
            ログアウト
          </button>
        </div>
      ) : (
        <div className="mt-10">
          <p className="text-xs tracking-[0.3em] text-haze">いま見ている人</p>
          <p className="mt-4 text-6xl tabular-nums text-warm">{count ?? "…"}</p>
          <p className="mt-3 text-xs tracking-wider text-dim">人(直近2分半のうちに、反応があった数)・{at}に更新・{POLL_MS / 1000}秒ごとに自動で更新</p>
          <button type="button" onClick={() => void logout()} className="mt-10 text-xs tracking-[0.3em] text-haze underline underline-offset-8 hover:text-mist">
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}
