"use client";

import { collection, deleteDoc, doc, getCountFromServer, getDocs, query, setDoc, where } from "firebase/firestore";
import { firebaseEnabled, getDb } from "@/lib/firebase";

// いま見ている人の数(管理者用)。訪問者は、ランダムなIDで、60秒ごとに「いるよ」と書くだけ。個人を特定する情報は、送らない。
export const PRESENCE_BEAT_MS = 60_000;
// この時間いじょう「いるよ」がない人は、いないものとして数える。
export const PRESENCE_ALIVE_MS = 150_000;
// 管理者が画面を開いたとき、これより古い記録は、消す。
const PRESENCE_STALE_MS = 10 * 60_000;

const sessionId = () => {
  try {
    let id = sessionStorage.getItem("presence-id");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("presence-id", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
};

// 訪問者の画面から呼ぶ。止めたいときは、戻り値の関数を呼ぶ。
export function startPresence(): () => void {
  if (!firebaseEnabled) return () => {};
  const ref = () => doc(getDb(), "presence", sessionId());
  const beat = () => {
    if (document.visibilityState === "hidden") return;
    setDoc(ref(), { t: Date.now() }).catch(() => {});
  };
  beat();
  const timer = window.setInterval(beat, PRESENCE_BEAT_MS);
  document.addEventListener("visibilitychange", beat);
  const bye = () => void deleteDoc(ref()).catch(() => {});
  window.addEventListener("pagehide", bye);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", beat);
    window.removeEventListener("pagehide", bye);
  };
}

// 管理者用: いま見ている人の数を返す。古い記録は、ついでに消す。
export async function countPresent(): Promise<number> {
  const col = collection(getDb(), "presence");
  const now = Date.now();
  const snap = await getCountFromServer(query(col, where("t", ">", now - PRESENCE_ALIVE_MS)));
  getDocs(query(col, where("t", "<", now - PRESENCE_STALE_MS)))
    .then((s) => Promise.all(s.docs.map((d) => deleteDoc(d.ref))))
    .catch(() => {});
  return snap.data().count;
}
