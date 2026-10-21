"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { primaryButtonClass } from "@/components/controls";
import { contactAvailable, sendContact } from "@/lib/contact";

type Status = "idle" | "sending" | "sent" | "mailto" | "failed" | "wait";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [reply, setReply] = useState("");
  const [message, setMessage] = useState("");
  const [botcheck, setBotcheck] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [popup, setPopup] = useState<Status | null>(null);

  // 結果は、ポップアップで大きく見せる。Esc で閉じられる。
  useEffect(() => {
    if (!popup) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPopup(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popup]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    const r = await sendContact({ name, reply, message, botcheck });
    setStatus(r);
    setPopup(r);
    if (r === "sent") {
      setName("");
      setReply("");
      setMessage("");
    }
  };

  const field = "mt-3 w-full rounded-sm border border-line bg-void/30 px-3 py-2 text-base tracking-wider text-mist outline-none placeholder:text-dim focus:border-haze sm:mt-0 sm:flex-1";
  const label = "text-xs leading-6 tracking-[0.2em] text-haze sm:w-52 sm:shrink-0 sm:pt-2";
  const row = "block sm:flex sm:items-start sm:gap-6";

  return (
    <PageShell title="お問い合わせ" lead="ご意見、ご感想、不具合のご報告など、お気軽にお寄せください。">
      {!contactAvailable ? (
        <p className="rounded-sm border border-warm/50 bg-panel/70 px-5 py-8 text-left text-base leading-9 tracking-wider text-haze sm:px-10 sm:py-12">現在、お問い合わせの受け付けを準備しています。しばらくお待ちください。</p>
      ) : (
        <form onSubmit={submit} className="space-y-8 rounded-sm border border-warm/50 bg-panel/70 px-5 py-8 sm:px-10 sm:py-12">
          <label className={row}>
            <span className={label}>お名前(任意)</span>
            <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <label className={row}>
            <span className={label}>返信先のメールアドレス(お返事が必要なとき)</span>
            <input type="email" value={reply} maxLength={200} onChange={(e) => setReply(e.target.value)} className={field} />
          </label>
          {/* ボット対策の欄(人には見えない。何かが入っていたら、送らない) */}
          <label aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden" tabIndex={-1}>
            <span>この欄は、空のままにしてください</span>
            <input type="checkbox" name="botcheck" tabIndex={-1} autoComplete="off" checked={botcheck} onChange={(e) => setBotcheck(e.target.checked)} />
          </label>
          <label className={row}>
            <span className={label}>お問い合わせ内容</span>
            <textarea value={message} rows={6} maxLength={2000} required onChange={(e) => setMessage(e.target.value)} className={`${field} resize-y leading-8`} />
          </label>
          <p className="text-xs leading-6 tracking-wider text-dim sm:pl-[calc(13rem+1.5rem)]">入力した内容は、お返事のためにのみ使用します。<br />くわしくは<Link href="/privacy" className="whitespace-nowrap underline underline-offset-4 hover:text-warm">プライバシーポリシー</Link>をご覧ください。</p>
          <div className="flex flex-col items-center gap-4">
            <button type="submit" disabled={!message.trim() || status === "sending"} className={primaryButtonClass}>
              <span className="absolute inset-0 border border-warm/60 bg-warm/5 transition-colors group-hover:border-warm group-hover:bg-warm/10" />
              {status === "sending" ? "送信しています" : "送信する"}
            </button>
          </div>
        </form>
      )}
      {popup && popup !== "idle" && popup !== "sending" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/75 px-6 backdrop-blur-sm" onClick={() => setPopup(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="contact-popup-title" className="w-full max-w-md border border-line bg-panel px-7 py-9 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="contact-popup-title" className={`text-2xl font-bold tracking-[0.15em] ${popup === "failed" ? "text-down" : "text-warm"}`}>
              {popup === "sent" ? "送信しました" : popup === "mailto" ? "メールソフトを開きました" : popup === "wait" ? "少し、お待ちください" : "送信できませんでした"}
            </h2>
            <p className="mt-5 text-left text-base leading-8 tracking-wider text-mist">
              {popup === "sent"
                ? "ありがとうございます。お問い合わせは、運営者に届きました。お返事が必要なときは、入力いただいた返信先に、ご連絡します。"
                : popup === "mailto"
                  ? "メールソフトの画面から、内容を確認して、送信してください。"
                  : popup === "wait"
                    ? "続けて送るときは、1分ほど、時間をあけてください。"
                    : "通信がうまくいかなかったようです。時間をおいて、もう一度お試しください。"}
            </p>
            <button type="button" autoFocus onClick={() => setPopup(null)} className={`${primaryButtonClass} mt-8`}>
              <span className="absolute inset-0 border border-warm/60 bg-warm/5 transition-colors group-hover:border-warm group-hover:bg-warm/10" />
              閉じる
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
