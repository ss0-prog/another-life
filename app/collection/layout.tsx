import type { Metadata } from "next";

export const metadata: Metadata = { title: "コレクション", description: "遊びの中で達成した実績を集めるコレクション。", alternates: { canonical: "/collection" } };

export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
