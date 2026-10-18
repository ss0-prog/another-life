// 公開するサイトのURL。公開先が決まったら、環境変数 NEXT_PUBLIC_SITE_URL に入れる(末尾の / は不要)。
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const SITE_NAME = "別の宇宙のあなた";
