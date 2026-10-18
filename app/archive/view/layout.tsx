import type { Metadata } from "next";

// 個別の人生は、検索結果には出さない(公開した本人の意図しない拡散を、避ける)。
export const metadata: Metadata = { title: "公開された人生", robots: { index: false, follow: true } };

export default function ArchiveViewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
