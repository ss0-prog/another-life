import Link from "next/link";
import { getMessages } from "@/lib/i18n";

const t = getMessages();

const PLAY = [
  { href: "/", label: "別の人生をはじめる" },
  { href: "/archive", label: t.nav.archive },
  { href: "/collection", label: "コレクション" },
  { href: "/concept", label: t.nav.concept },
] as const;

const ABOUT = [
  { href: "/mbti", label: "MBTIについて" },
  { href: "/sources", label: t.nav.sources },
  { href: "/privacy", label: t.nav.privacy },
  { href: "/contact", label: t.nav.contact },
] as const;

const PROMISES = [
  { mark: "無", text: "ログインなしで遊べます" },
  { mark: "虚", text: "株価は完全な架空です。景気は、過去は実際の統計、未来はランダムです" },
  { mark: "占", text: "占いや予言ではありません" },
] as const;

const DATA_POLICY = [
  "入力した内容はあなたの端末の中でシミュレーションに使うだけです。ログインしないかぎりサーバーには送りません。",
  "前回の入力はこの端末のブラウザにだけ覚えています。いつでもトップ画面から消せます。",
  "ログインは任意です。ログインしたときだけ保存した結果がクラウドに保存されます。",
  "結果を公開するかどうかはあなたが選びます。公開するときも持病・MBTI・性自認・惹かれる相手・自由記述・細かい地名は取り除きます。",
  "外部のサービスには入力を渡しません。ただし職業を「声で探す」を使ったときだけ、ブラウザの音声認識サービスに声が送られます。",
  "閲覧数などをCookieなしで集計しています。個人は特定せず広告のための追跡もしていません。",
] as const;

const SOURCES = ["厚生労働省 簡易生命表", "人口動態統計", "賃金構造基本統計調査", "国税庁 民間給与実態統計", "家計調査", "出生動向基本調査"] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line/70 bg-void/70 backdrop-blur-md">
      {/* PC のシミュレーション画面だけ、1行に縮めたフッター(画面の高さに、おさめるため) */}
      <div className="footer-compact hidden h-10 shrink-0 items-center gap-5 px-8 text-[11px] tracking-wider text-dim">
        <nav aria-label="フッター(簡易)" className="flex shrink-0 items-center gap-x-5 whitespace-nowrap">
          {ABOUT.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-mist">
              {l.label}
            </Link>
          ))}
        </nav>
        {/* リンクと、注意書きの境目 */}
        <span aria-hidden className="h-4 w-px shrink-0 bg-line" />
        <p className="min-w-0 flex-1 text-left leading-4">※ 入力した情報は、このサービス以外には絶対に使いません。数字は統計と設計上の仮定にもとづき、占い・予言ではなく、株価は架空です。</p>
        <p className="hidden shrink-0 whitespace-nowrap tracking-[0.2em] xl:block">© {t.footer.copy}</p>
      </div>
      <div className="footer-full mx-auto max-w-6xl px-[2.5vw] pb-6 pt-12 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.6fr]">
          {/* ブランド */}
          <div>
            <p className="text-lg tracking-[0.3em] text-mist">{t.footer.copy}</p>
            <p className="mt-3 text-xs leading-6 tracking-wider text-haze">選ばなかった道の先でもうひとりのあなたが生きている。<br />一年ずつ見届ける人生シミュレーション。</p>
            <div className="mt-4 flex items-center gap-2 text-warm" aria-hidden>
              <span className="h-px w-8 bg-warm/60" />
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
              </svg>
              <span className="h-px w-8 bg-warm/60" />
            </div>
          </div>

          {/* 遊ぶ・サイトについて: スマホでは、横ならび */}
          <div className="grid grid-cols-2 gap-6 md:contents">
          <nav aria-label="遊ぶ">
            <p className="text-xs tracking-[0.35em] text-warm">遊ぶ</p>
            <ul className="mt-3 space-y-2 text-sm tracking-[0.12em] text-haze">
              {PLAY.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-mist">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* このサイトについて */}
          <nav aria-label="このサイトについて">
            <p className="text-xs tracking-[0.35em] text-warm">サイトについて</p>
            <ul className="mt-3 space-y-2 text-sm tracking-[0.12em] text-haze">
              {ABOUT.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-mist">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          </div>

          {/* 約束 */}
          <div>
            <p className="text-xs tracking-[0.35em] text-warm">このサイトの約束</p>
            <ul className="mt-3 space-y-2">
              {PROMISES.map((x) => (
                <li key={x.mark} className="flex items-start gap-3 text-xs leading-6 tracking-wider text-haze">
                  <span className="mt-[0.2rem] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-warm/60 text-[10px] text-warm">{x.mark}</span>
                  {x.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 重要: 入力した情報は、このサービス以外には、絶対に使わない */}
        <div className="font-gothic mt-10 rounded-sm border border-warm/50 bg-warm/5 px-4 py-4 text-left">
          <p className="text-xs tracking-[0.35em] text-warm">重要なお知らせ</p>
          <p className="mt-2 text-sm leading-7 tracking-wider text-mist">入力していただいた情報は、このサービスの中だけで使います。ほかのサービスや、ほかの目的には、絶対に使いません。</p>
        </div>

        {/* データの扱い */}
        <div className="font-gothic mt-10 border-t border-line/60 pt-6">
          <p className="text-xs tracking-[0.35em] text-warm">データの扱い</p>
          <ul className="mt-3 grid gap-x-8 gap-y-2 text-xs leading-6 tracking-wider text-haze md:grid-cols-2">
            {DATA_POLICY.map((x) => (
              <li key={x} className="flex gap-2">
                <span className="mt-[0.65rem] h-1 w-1 shrink-0 rounded-full bg-warm" aria-hidden />
                {x}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-5 tracking-wider text-dim">くわしくは「プライバシーポリシー」のページに書いています。</p>
        </div>

        {/* データの出典 */}
        <div className="mt-10 border-t border-line/60 pt-6">
          <p className="text-xs tracking-[0.35em] text-warm">もとにした統計</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <li key={s}>
                <Link href="/sources" className="inline-block rounded-full border border-line px-3 py-1 text-[11px] tracking-wider text-haze transition-colors hover:border-warm hover:text-mist">
                  {s}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-5 tracking-wider text-dim">実在の統計をもとに確率を設計しています。もとにした統計の出典は「データについて」に書いています。</p>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-line/60 pt-5 text-[11px] tracking-wider text-dim sm:flex-row">
          <p>{t.footer.note}</p>
          <p className="tracking-[0.2em]">© {t.footer.copy}</p>
        </div>
      </div>
    </footer>
  );
}
