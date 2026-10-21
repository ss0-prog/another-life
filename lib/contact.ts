"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { firebaseEnabled, getDb } from "@/lib/firebase";

export const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";
// 回答をメールで受け取る、外部のフォーム送信サービス(Web3Forms)のアクセスキー。設定されていれば、サイトの入力欄から、そこへ送る。
// アクセスキーは、公開されても、送信先のメールアドレスは見えない(Web3Forms の仕組み)。
export const web3formsKey = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? "";
export const contactAvailable = web3formsKey !== "" || firebaseEnabled || contactEmail !== "";

export type ContactInput = { name: string; message: string; botcheck?: boolean };

// Firebase が使えるときは、受け付け用のコレクションに保存する(読めるのは運営だけ)。
// 使えず、メールアドレスが設定されているときは、メールソフトを開く。
export async function sendContact(input: ContactInput): Promise<"sent" | "mailto" | "failed" | "wait"> {
  // 続けて何度も送れないように、60秒は、あけてもらう。
  try {
    const last = Number(window.localStorage.getItem("betsu-uchu:contact-at") ?? 0);
    if (Date.now() - last < 60_000) return "wait";
  } catch {}
  if (web3formsKey) {
    // 人には見えない欄(botcheck)に、何かが入っていたら、ボットとみなして、送らない(送ったように見せる)。
    if (input.botcheck) return "sent";
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: web3formsKey,
          subject: "お問い合わせ(別の宇宙のあなた)",
          from_name: "別の宇宙のあなた お問い合わせ",
          name: input.name.slice(0, 80) || "(お名前なし)",
          message: input.message.slice(0, 2000),
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean } | null;
      if (!res.ok || !json?.success) return "failed";
      try {
        window.localStorage.setItem("betsu-uchu:contact-at", String(Date.now()));
      } catch {}
      return "sent";
    } catch {
      return "failed";
    }
  }
  if (firebaseEnabled) {
    try {
      await addDoc(collection(getDb(), "contacts"), {
        name: input.name.slice(0, 80),
        message: input.message.slice(0, 2000),
        createdAt: serverTimestamp(),
      });
      return "sent";
    } catch {
      return "failed";
    }
  }
  if (contactEmail) {
    const body = encodeURIComponent(`${input.message}\n\n---\nお名前: ${input.name}`);
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent("お問い合わせ")}&body=${body}`;
    return "mailto";
  }
  return "failed";
}
