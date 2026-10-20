"use client";

import { useCallback, useEffect, useState } from "react";
import { addComment, COMMENT_MAX, deleteComment, listComments, type Comment } from "@/lib/archive";
import { useAuth } from "@/lib/useAuth";

// 名前や写真は出さない。書いた人の ID から、決まった短い印だけをつくる。
const tagOf = (uid: string) => {
  let h = 0;
  for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36).slice(0, 4).toUpperCase();
};

const dateOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

export function Comments({ entryId, ownerId }: { entryId: string; ownerId?: string }) {
  const { enabled, user, login } = useAuth();
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => listComments(entryId).then(setList), [entryId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!enabled) return null;

  const submit = async () => {
    if (!user || !text.trim()) return;
    setBusy(true);
    setError("");
    if (await addComment(entryId, user.uid, text)) {
      setText("");
      await load();
    } else setError("送れませんでした。時間をおいて、もう一度お試しください。");
    setBusy(false);
  };

  return (
    <section className="mx-auto mt-16 w-full max-w-2xl text-left">
      <h2 className="text-sm tracking-[0.3em] text-haze">コメント</h2>

      {list === null ? (
        <p className="mt-4 text-sm text-dim">読み込んでいます</p>
      ) : list.length === 0 ? (
        <p className="mt-4 text-sm leading-7 tracking-wider text-dim">まだコメントはありません。</p>
      ) : (
        <ul className="mt-4 divide-y divide-line/60">
          {list.map((c) => (
            <li key={c.id} className="py-4">
              <p className="flex flex-wrap items-center gap-x-3 text-xs tracking-wider text-dim">
                <span>旅人 {tagOf(c.author)}</span>
                {ownerId && c.author === ownerId && <span className="text-warm">この人生の持ち主</span>}
                <span>{dateOf(c.createdAt)}</span>
                {user && (user.uid === c.author || user.uid === ownerId) && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (await deleteComment(entryId, c.id)) await load();
                      else setError("削除できませんでした。");
                    }}
                    className="ml-auto underline underline-offset-4 hover:text-mist"
                  >
                    削除
                  </button>
                )}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 tracking-wider text-mist">{c.text}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX))}
          disabled={!user || busy}
          rows={3}
          placeholder={user ? "この人生に、ひとこと" : "ログインすると、コメントできます。"}
          className="w-full resize-y border border-line bg-transparent p-3 text-sm leading-7 tracking-wider text-mist placeholder:text-dim disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="mt-2 flex items-center gap-4 text-xs tracking-wider text-dim">
          {user ? (
            <>
              <span>
                {text.length}/{COMMENT_MAX}
              </span>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !text.trim()}
                className="ml-auto border border-warm/60 bg-warm/5 px-5 py-2 text-sm tracking-[0.2em] text-mist transition-colors hover:border-warm disabled:opacity-50"
              >
                コメントする
              </button>
            </>
          ) : (
            <button type="button" onClick={() => void login()} className="underline underline-offset-4 hover:text-mist">
              ログインする
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-haze">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
