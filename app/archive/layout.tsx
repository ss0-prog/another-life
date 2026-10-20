import type { Metadata } from "next";

export const metadata: Metadata = { title: "誰かの人生", description: "ほかの人が公開した、二つの人生を読む。", alternates: { canonical: "/archive" } };

export default function ArchiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
