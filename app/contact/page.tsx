"use client";

import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { primaryButtonClass } from "@/components/controls";
import { contactAvailable, contactFormUrl, sendContact } from "@/lib/contact";

type Status = "idle" | "sending" | "sent" | "mailto" | "failed";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [reply, setReply] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    const r = await sendContact({ name, reply, message });
    setStatus(r);
    if (r === "sent") {
      setName("");
      setReply("");
      setMessage("");
    }
  };

  const field = "mt-3 w-full border-b border-line bg-transparent py-2 text-base tracking-wider text-mist outline-none placeholder:text-dim focus:border-haze";
  const label = "text-xs tracking-[0.3em] text-haze";

  return (
    <PageShell title="お問い合わせ" lead="ご意見、ご感想、不具合のご報告など、お気軽にお寄せください。">
      {contactFormUrl ? (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
          <p className="w-full text-left text-base leading-9 tracking-wider text-haze">お問い合わせは、外部のフォームサービス(Tally)で受け付けています。下のボタンから、フォームが開きます。</p>
          <a href={contactFormUrl} target="_blank" rel="noopener noreferrer" className={primaryButtonClass}>
            <span className="absolute inset-0 border border-warm/60 bg-warm/5 transition-colors group-hover:border-warm group-hover:bg-warm/10" />
            お問い合わせフォームを開く
          </a>
          <p className="w-full text-left text-xs leading-6 tracking-wider text-dim">フォームに入力した内容は、Tally を通じて、運営者だけが受け取ります。お返事が必要なときは、フォームに、返信先のメールアドレスを書いてください。</p>
        </div>
      ) : !contactAvailable ? (
        <p className="mx-auto w-fit text-left text-base leading-9 tracking-wider text-haze">現在、お問い合わせの受け付けを準備しています。しばらくお待ちください。</p>
      ) : (
        <form onSubmit={submit} className="space-y-8">
          <label className="block">
            <span className={label}>お名前(任意)</span>
            <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className={label}>返信先のメールアドレス(お返事が必要なとき)</span>
            <input type="email" value={reply} maxLength={200} onChange={(e) => setReply(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className={label}>内容</span>
            <textarea value={message} rows={6} maxLength={2000} required onChange={(e) => setMessage(e.target.value)} className={`${field} resize-y leading-8`} />
          </label>
          <p className="text-xs leading-6 tracking-wider text-dim">入力した内容は、お返事のためにのみ使います。</p>
          <div className="flex flex-col items-center gap-4">
            <button type="submit" disabled={!message.trim() || status === "sending"} className={primaryButtonClass}>
              <span className="absolute inset-0 border border-warm/60 bg-warm/5 transition-colors group-hover:border-warm group-hover:bg-warm/10" />
              {status === "sending" ? "送信しています" : "送信する"}
            </button>
            {status === "sent" && <p role="status" className="text-sm tracking-wider text-haze">送信しました。ありがとうございます。</p>}
            {status === "mailto" && <p role="status" className="text-sm tracking-wider text-haze">メールソフトを開きました。そちらから送信してください。</p>}
            {status === "failed" && <p role="alert" className="text-sm tracking-wider text-haze">送信できませんでした。時間をおいて、もう一度お試しください。</p>}
          </div>
        </form>
      )}
    </PageShell>
  );
}
