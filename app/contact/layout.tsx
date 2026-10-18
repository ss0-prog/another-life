import type { Metadata } from "next";

export const metadata: Metadata = { title: "お問い合わせ", description: "ご意見・ご感想・不具合のご連絡はこちらから。", alternates: { canonical: "/contact" } };

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
