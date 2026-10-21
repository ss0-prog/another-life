"use client";

import { useEffect, useState } from "react";
import { branchLabelOf } from "@/lib/archive";
import { FAVORITE_MAX, HISTORY_MAX, randomLives, type RandomLife } from "@/lib/storage";
import type { Setup } from "@/lib/sim/types";

const labelOf = (x: RandomLife) => `${x.self.age}歳・${x.self.prefecture}生まれ`;
const branchOf = (x: RandomLife) => branchLabelOf({ self: x.self, branch: x.branch, seed: x.seed } as Setup);

// トップページの一番下: ランダムで始めた人生の、履歴(最新5件)とお気に入り(5件まで)。お気に入りに入れられるのは、ログインした人だけ。
export function RandomHistory({ loggedIn, onPlay }: { loggedIn: boolean; onPlay: (x: RandomLife) => void }) {
  const [list, setList] = useState<RandomLife[]>([]);
  const [msg, setMsg] = useState("");
  useEffect(() => setList(randomLives.list()), []);
  if (list.length === 0) return null;

  const favorites = list.filter((x) => x.favorite);
  const history = list.filter((x) => !x.favorite);

  const row = (x: RandomLife) => (
    <li key={x.id} className="flex items-center gap-3 border border-line bg-panel/70 px-4 py-3 text-left">
      <div className="min-w-0 flex-1">
        <p className="text-sm tracking-wider text-mist">{labelOf(x)}</p>
        <p className="text-xs leading-6 tracking-wider text-haze">ターニングポイント: {branchOf(x)}({x.branch.age}歳)</p>
      </div>
      <button type="button" onClick={() => onPlay(x)} className="shrink-0 border border-warm/60 bg-warm/5 px-3 py-1.5 text-xs tracking-[0.15em] text-mist hover:border-warm">
        もう一度
      </button>
      <button
        type="button"
        disabled={!loggedIn}
        title={loggedIn ? (x.favorite ? "お気に入りから外す" : "お気に入りに入れる") : "お気に入りは、ログインすると使えます"}
        aria-label={x.favorite ? "お気に入りから外す" : "お気に入りに入れる"}
        onClick={() => {
          const r = randomLives.toggleFavorite(x.id);
          setList(r.list);
          setMsg(r.full ? `お気に入りは${FAVORITE_MAX}件までです。` : "");
        }}
        className="shrink-0 text-lg leading-none text-warm disabled:opacity-40"
      >
        {x.favorite ? "★" : "☆"}
      </button>
      <button type="button" aria-label="履歴から消す" title="消す" onClick={() => setList(randomLives.remove(x.id))} className="shrink-0 text-sm text-dim hover:text-mist">
        ×
      </button>
    </li>
  );

  return (
    <section className="mx-auto mt-24 w-full max-w-2xl text-left">
      <h2 className="text-center text-xs tracking-[0.4em] text-haze">ランダムで始めた人生</h2>
      {!loggedIn && <p className="mt-2 text-center text-[11px] leading-5 tracking-wider text-dim">お気に入りは、ログインすると使えます。</p>}
      {favorites.length > 0 && (
        <>
          <p className="mt-6 text-xs tracking-[0.3em] text-warm">お気に入り({favorites.length}/{FAVORITE_MAX})</p>
          <ul className="mt-2 space-y-2">{favorites.map(row)}</ul>
        </>
      )}
      {history.length > 0 && (
        <>
          <p className="mt-6 text-xs tracking-[0.3em] text-warm">履歴(最新{HISTORY_MAX}件まで)</p>
          <ul className="mt-2 space-y-2">{history.map(row)}</ul>
        </>
      )}
      {msg && <p role="alert" className="mt-3 text-center text-xs text-haze">{msg}</p>}
    </section>
  );
}
