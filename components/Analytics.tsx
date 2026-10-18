// アクセス解析(Cloudflare Web Analytics)。Cookieを使わず、個人を特定せず、ページの閲覧数などを集計するだけのもの。
// 環境変数 NEXT_PUBLIC_CF_BEACON_TOKEN が設定されているときだけ読み込む。
export function Analytics() {
  const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
  if (!token) return null;
  return <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token })} />;
}
