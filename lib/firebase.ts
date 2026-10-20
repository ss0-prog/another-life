"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";

// Firebase の Web 設定は公開前提の値(秘密情報ではない)。アクセス制御は Firestore ルールで行う。
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 未設定の場合はログイン機能を無効にし、ゲスト(ブラウザ保存)のみで動かす。
export const firebaseEnabled = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

export const getFirebaseAuth = (): Auth => getAuth(app());
// 値が undefined の項目があっても、保存に失敗しないようにする(その項目は、書き込まない)。
let db: Firestore | null = null;
export const getDb = (): Firestore => {
  if (db) return db;
  try {
    db = initializeFirestore(app(), { ignoreUndefinedProperties: true });
  } catch {
    db = getFirestore(app());
  }
  return db;
};
