import ja from "@/locales/ja.json";

// 将来の多言語化に備え、ロケールごとの辞書をここで束ねる。
export type Messages = typeof ja;
export type Locale = "ja";

const dictionaries: Record<Locale, Messages> = { ja };

export const defaultLocale: Locale = "ja";

export function getMessages(locale: Locale = defaultLocale): Messages {
  return dictionaries[locale];
}
