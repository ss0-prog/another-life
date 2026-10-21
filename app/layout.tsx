import type { Metadata, Viewport } from "next";
import { Shippori_Mincho } from "next/font/google";
import { Ambient } from "@/components/Ambient";
import { Analytics } from "@/components/Analytics";
import { OrphanGuard } from "@/components/OrphanGuard";
import { PresenceBeacon } from "@/components/PresenceBeacon";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getMessages } from "@/lib/i18n";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const mincho = Shippori_Mincho({
  weight: ["500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-shippori",
  preload: false,
});

const t = getMessages();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: t.meta.titleFull, template: `%s | ${SITE_NAME}` },
  applicationName: SITE_NAME,
  keywords: ["人生シミュレーション", "もしもの人生", "別の人生", "人生ゲーム", "if", "シミュレーション", "ターニングポイント"],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  category: "game",
  description: t.meta.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: SITE_NAME,
    url: "/",
    title: t.meta.titleFull,
    description: t.meta.description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: { card: "summary_large_image", title: t.meta.titleFull, description: t.meta.description, images: ["/og.png"] },
  // 検索に載せたくない間(身内確認など)は、環境変数 NEXT_PUBLIC_NOINDEX=1 で、検索への登録をことわる
  robots: process.env.NEXT_PUBLIC_NOINDEX === "1" ? { index: false, follow: false } : undefined,
  // Google Search Console の所有確認(環境変数が設定されているときだけ出す)
  verification: process.env.NEXT_PUBLIC_GSC_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION } : undefined,
};

// 検索結果に出る、サービス名(WebSite)と、サービスの種類(WebApplication)。
const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: ["ifverse", "別の宇宙のあなた 人生シミュレーション"],
    url: SITE_URL,
    inLanguage: "ja",
    description: t.meta.description,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    inLanguage: "ja",
    description: t.meta.description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
  },
];

export const viewport: Viewport = {
  themeColor: "#07080a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={mincho.variable} suppressHydrationWarning>
      <head>
        {/* 前回えらんだ昼・夜を、最初の表示の前に反映する(暗い画面から、はじまらないように)。最初だけ、色の変化はつけない */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var v=localStorage.getItem("betsu-uchu:time");if(v==="day"||v==="night"||v==="evening"){var d=document.documentElement;d.dataset.tod=v;d.dataset.phase=v==="evening"?"dusk":v;if(v==="day")d.classList.add("no-anim")}}catch(e){}`,
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <Ambient />
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
        <Analytics />
        <OrphanGuard />
        <PresenceBeacon />
      </body>
    </html>
  );
}
