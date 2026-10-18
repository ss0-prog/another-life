"use client";

import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { firebaseEnabled, getFirebaseAuth } from "@/lib/firebase";

// ログインは任意。パスワードは扱わず、Google のポップアップ認証だけを使う。
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!firebaseEnabled) return;
    return onAuthStateChanged(getFirebaseAuth(), setUser);
  }, []);

  const login = useCallback(async () => {
    try {
      await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
    } catch {
      /* ポップアップを閉じた場合など。何もしない */
    }
  }, []);

  const logout = useCallback(() => signOut(getFirebaseAuth()), []);

  return { enabled: firebaseEnabled, user, login, logout };
}
