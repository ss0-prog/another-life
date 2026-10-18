"use client";

import { useEffect, useState } from "react";

// SNSで、この人生(またはサイト)を、共有するボタン。投稿の文章を、あらかじめ入れる。
export function ShareButtons({ text, path, label = "この人生を共有する" }: { text: string; path?: string; label?: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setUrl(path ? `${window.location.origin}${path}` : window.location.href);
    setCanShare(typeof navigator.share === "function");
  }, [path]);
  if (!url) return null;
  const body = `${text} #別の宇宙のあなた`;
  const links = [
    { label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(body)}&url=${encodeURIComponent(url)}` },
    { label: "LINE", href: `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  ];
  const cls = "keep border border-line bg-panel/60 px-4 py-1.5 text-xs tracking-[0.2em] text-haze transition-colors hover:border-haze hover:text-mist";
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs tracking-[0.3em] text-dim">{label}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {links.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={cls}>
            {l.label}
          </a>
        ))}
        {canShare && (
          <button type="button" onClick={() => navigator.share({ title: "別の宇宙のあなた", text, url }).catch(() => {})} className={cls}>
            ほかのアプリ
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {}
          }}
          className={cls}
        >
          {copied ? "コピーしました" : "リンクをコピー"}
        </button>
      </div>
    </div>
  );
}
