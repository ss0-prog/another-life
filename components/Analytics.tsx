import Script from "next/script";

// アクセス解析。ページの閲覧数や、どこから来たかなどを集計するだけで、個人を特定する情報は送らない。
// Cloudflare Web Analytics(Cookieなし)は NEXT_PUBLIC_CF_BEACON_TOKEN、Google アナリティクス(GA4)は NEXT_PUBLIC_GA_ID が設定されているときだけ読み込む。
export function Analytics() {
  const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  return (
    <>
      {token && <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token })} />}
      {gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config",${JSON.stringify(gaId)},{anonymize_ip:true});`}
          </Script>
        </>
      )}
    </>
  );
}
