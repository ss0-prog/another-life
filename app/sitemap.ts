import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

// 検索エンジンに伝える、公開ページの一覧。個別の人生(/archive/view)は、含めない。
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/concept", "/archive", "/collection", "/mbti", "/sources", "/privacy", "/contact"];
  const now = new Date();
  return pages.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency: p === "" ? "weekly" : "monthly", priority: p === "" ? 1 : 0.6 }));
}
