"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { firebaseEnabled, getDb } from "@/lib/firebase";

export const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";
// 外部のフォームサービス(Tally など)のURL。設定されていれば、お問い合わせは、そこで受け付ける。
export const contactFormUrl = process.env.NEXT_PUBLIC_CONTACT_FORM_URL ?? "";
export const contactAvailable = contactFormUrl !== "" || firebaseEnabled || contactEmail !== "";

export type ContactInput = { name: string; reply: string; message: string };

// Firebase が使えるときは、受け付け用のコレクションに保存する(読めるのは運営だけ)。
// 使えず、メールアドレスが設定されているときは、メールソフトを開く。
export async function sendContact(input: ContactInput): Promise<"sent" | "mailto" | "failed"> {
  if (firebaseEnabled) {
    try {
      await addDoc(collection(getDb(), "contacts"), {
        name: input.name.slice(0, 80),
        reply: input.reply.slice(0, 200),
        message: input.message.slice(0, 2000),
        createdAt: serverTimestamp(),
      });
      return "sent";
    } catch {
      return "failed";
    }
  }
  if (contactEmail) {
    const body = encodeURIComponent(`${input.message}\n\n---\nお名前: ${input.name}\n返信先: ${input.reply}`);
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent("お問い合わせ")}&body=${body}`;
    return "mailto";
  }
  return "failed";
}
