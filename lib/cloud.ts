"use client";

import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Branch, CurrentSelf } from "@/lib/sim/types";
import type { SavedEcho } from "@/lib/types";

export type SavedProfile = { self: CurrentSelf; branch: Branch };

// users/{uid}/profile/main に、入力した情報(いまのあなたとターニングポイント)を記憶する。
export const profileStore = {
  async save(uid: string, profile: SavedProfile): Promise<boolean> {
    try {
      await setDoc(doc(getDb(), "users", uid, "profile", "main"), { ...profile, updatedAt: new Date().toISOString() });
      return true;
    } catch {
      return false;
    }
  },
  async load(uid: string): Promise<SavedProfile | null> {
    try {
      const snap = await getDoc(doc(getDb(), "users", uid, "profile", "main"));
      const d = snap.data();
      return d && d.self && d.branch ? { self: d.self, branch: d.branch } : null;
    } catch {
      return null;
    }
  },
};

// users/{uid}/echoes/{id} に保存する。メールアドレスなどの個人情報は保存しない。
export const cloudEchoStore = {
  async save(uid: string, echo: SavedEcho): Promise<boolean> {
    try {
      await setDoc(doc(getDb(), "users", uid, "echoes", echo.id), echo);
      return true;
    } catch (e) {
      console.error("echo save failed", e);
      return false;
    }
  },
  async list(uid: string): Promise<SavedEcho[]> {
    try {
      const q = query(collection(getDb(), "users", uid, "echoes"), orderBy("createdAt", "desc"), limit(50));
      return (await getDocs(q)).docs.map((d) => d.data() as SavedEcho);
    } catch {
      return [];
    }
  },
};
