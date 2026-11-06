"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
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

// App Check(Fraud Defense: 旧 reCAPTCHA Enterprise)のサイトキー。設定されているときだけ有効にする(サイトキーは公開前提の値)。
// 有効にすると、このサイトの画面から来た通信だけを Firestore が受け付けられる(ルールの強制は Firebase コンソールで行う)。
const appCheckSiteKey = process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY;

function app(): FirebaseApp {
  if (getApps().length) return getApp();
  const created = initializeApp(config);
  if (appCheckSiteKey && typeof window !== "undefined") {
    // 手元の開発(localhost)では、デバッグ用のトークンを使う。コンソールに出る値を Firebase に登録すると通る。
    if (location.hostname === "localhost") (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    initializeAppCheck(created, { provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
  }
  return created;
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
