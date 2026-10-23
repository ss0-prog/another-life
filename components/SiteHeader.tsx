"use client";

import { IfMark } from "@/components/IfMark";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { TOD_LABEL, loadTimeOfDay, nextTod, setTimeOfDay, useTimeLocked, useTimeOfDay } from "@/lib/timeStore";
import { useAuth } from "@/lib/useAuth";
import { BgmDriver, BgmToggle } from "@/components/BgmToggle";
import { TodIcon } from "@/components/TodIcon";

const t = getMessages();

const NAV = [
  { href: "/", label: t.nav.home },
  { href: "/concept", label: t.nav.concept },
  { href: "/archive", label: t.nav.archive },
  { href: "/collection", label: "コレクション" },
  { href: "/contact", label: t.nav.contact },
] as const;

// スマホのメニューに出す、ページへのリンク(ひとこと説明つき)。
const DRAWER_LINKS = [
  { href: "/", label: "人生をはじめる", desc: "ターニングポイントから人生をやり直す" },
  { href: "/concept", label: t.nav.concept, desc: "このサイトでできること・遊び方" },
  { href: "/archive", label: t.nav.archive, desc: "ほかの人の一生を見る・探す" },
  { href: "/collection", label: "コレクション", desc: "達成した実績を集めてならべる" },
  { href: "/mbti", label: "MBTIについて", desc: "16タイプの説明とゲームでの使われ方" },
  { href: "/sources", label: t.nav.sources, desc: "もとにした統計の出典" },
  { href: "/privacy", label: t.nav.privacy, desc: "入力した情報の扱い" },
  { href: "/contact", label: t.nav.contact, desc: "ご意見・ご質問" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const { enabled, user, login, logout } = useAuth();
  const tod = useTimeOfDay();
  const todLocked = useTimeLocked();
  useEffect(() => loadTimeOfDay(), []);
  // ヘッダーは、画面の上に、ついてくる。高さを、CSS変数(--header-h)に入れて、ほかの「上にはりつく部品」が、ずらせるようにする。
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty("--header-h", `${el.getBoundingClientRect().height}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // トップページが、いまどの画面か(遊んでいる間・結果を見ている間は、「はじめる」を、やり直しのボタンに入れかえる)。
  const [appPhase, setAppPhase] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setAppPhase(String((e as CustomEvent).detail));
    window.addEventListener("betsu-uchu:phase", on);
    return () => window.removeEventListener("betsu-uchu:phase", on);
  }, []);
  useEffect(() => setMenuOpen(false), [pathname]);
  const inGame = pathname === "/" && (appPhase === "play" || appPhase === "result");
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // メニューの中身(PC は横ならび、スマホは、左から出てくるパネルに縦ならび)。
  const renderItems = (drawer: boolean) => (
    <>
          {NAV.map((n) =>
            n.href === "/" && inGame ? (
              <span key="restart" className={`flex gap-3 ${drawer ? "flex-col items-stretch" : "items-center"}`}>
              <button type="button" onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event("betsu-uchu:home")); }} aria-label="ホーム(トップ画面にもどる)" title="ホーム(トップ画面にもどる)" className="flex h-9 w-9 items-center justify-center text-mist hover:text-warm">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 11.5 12 4l9 7.5" />
                  <path d="M5.5 10v9.5h13V10" />
                  <path d="M10 19.5v-5h4v5" />
                </svg>
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event("betsu-uchu:restart")); }} className={`border border-warm/60 bg-warm/10 px-3 py-1 font-bold text-mist hover:border-warm ${drawer ? "text-center text-sm leading-7" : "keep"}`}>
                <span className="xl:hidden max-lg:hidden">やり直す</span>
                <span className="hidden xl:inline max-lg:inline">同じ条件で人生をやり直す</span>
              </button>
              </span>
            ) : (
            <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} aria-current={active(n.href) ? "page" : undefined} className={active(n.href) ? "text-warm" : "text-haze hover:text-mist"}>
              {n.label}
            </Link>
            ),
          )}
          <button type="button" onClick={() => setTimeOfDay(nextTod(tod))} disabled={todLocked} aria-pressed={tod !== "night"} className="flex items-center gap-2 border border-line px-3 py-1 text-haze hover:border-haze hover:text-mist disabled:opacity-50">
            <TodIcon tod={tod} className="h-4 w-4 translate-y-[1.5px]" />
            {TOD_LABEL[tod]}
          </button>
          <BgmToggle variant="nav" />
          <button
            type="button"
            disabled={!enabled}
            title={enabled ? "ログインすると入力した情報や結果を記憶できます(任意)" : "ログイン機能はまだ設定されていません"}
            onClick={user ? logout : login}
            className="flex items-center gap-2 whitespace-nowrap border border-warm/50 px-2.5 py-1 text-mist hover:border-warm disabled:opacity-50 xl:px-3"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${user ? "bg-s-health" : "bg-dim"}`} />
            {user ? t.settings.logout : "ログイン"}
          </button>
    </>
  );

  return (
    <>
    <BgmDriver />
    <header ref={headerRef} className="sticky top-0 z-[60] border-b border-line/70 bg-void/50 backdrop-blur-[2px]">
      <div className="flex flex-nowrap items-center justify-between gap-x-3 sm:gap-x-8 gap-y-2 px-[2.5vw] py-2.5 sm:px-8 lg:h-14 lg:py-0">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 hover:text-warm sm:gap-3 lg:shrink-0"
          onClick={(e) => {
            // トップページにいる(遊んでいる途中も含む)ときは、ページの切り替えではなく、トップ画面にもどす。
            if (pathname === "/") {
              e.preventDefault();
              window.dispatchEvent(new Event("betsu-uchu:home"));
            }
          }}
        >
          <IfMark className="h-7 w-auto shrink-0 text-mist sm:h-8" />
          <span className="min-w-0">
            <span className="block truncate text-[15px] leading-5 tracking-[0.06em] text-mist sm:text-base sm:tracking-[0.25em] lg:overflow-visible lg:whitespace-nowrap">{t.meta.title}</span>
            <span className="block whitespace-nowrap text-[9px] leading-4 tracking-[0.02em] text-dim min-[400px]:text-[10px] min-[400px]:tracking-[0.06em] sm:text-[11px] sm:tracking-[0.12em] lg:max-xl:hidden">あなたのもうひとつの人生</span>
          </span>
        </Link>
        {/* スマホ: メニューボタン(ひらくと、リンクが縦にならぶ) */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setTimeOfDay(nextTod(tod))}
            disabled={todLocked}
            aria-pressed={tod !== "night"}
            aria-label={`${TOD_LABEL[tod]}の空(${TOD_LABEL[nextTod(tod)]}にする)`}
            className="flex h-9 w-9 items-center justify-center border border-line text-lg text-haze hover:text-mist disabled:opacity-50 sm:h-10 sm:w-10"
          >
            <TodIcon tod={tod} className="h-5 w-5" />
          </button>
          <BgmToggle variant="icon" />
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label="メニュー"
            className="flex h-9 w-9 items-center justify-center border border-line text-haze hover:text-mist sm:h-10 sm:w-10"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
        <nav aria-label="メイン" className="hidden shrink-0 items-center gap-x-4 whitespace-nowrap text-[13px] tracking-[0.1em] lg:flex lg:max-xl:gap-x-2.5 xl:gap-x-4 xl:text-sm xl:tracking-[0.12em] 2xl:gap-x-6 2xl:tracking-[0.15em]">
          {renderItems(false)}
        </nav>
      </div>
    </header>

    {/* スマホ: 左から、カーテンのように、出てくるメニュー */}
    <div className={`fixed inset-0 z-[70] lg:hidden ${menuOpen ? "" : "pointer-events-none"}`} aria-hidden={!menuOpen}>
      <button type="button" aria-label="メニューを閉じる" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)} className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${menuOpen ? "opacity-100" : "opacity-0"}`} />
      <nav aria-label="メイン(スマホ)" className={`absolute inset-y-0 left-0 flex w-[78vw] max-w-xs flex-col gap-4 overflow-y-auto border-r border-line bg-panel px-6 pb-8 pt-5 text-base tracking-[0.15em] shadow-2xl transition-transform duration-300 ease-out ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm tracking-[0.25em] text-warm">メニュー</span>
          <button type="button" aria-label="メニューを閉じる" onClick={() => setMenuOpen(false)} className="flex h-10 w-10 items-center justify-center border border-line text-haze hover:text-mist">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-6 border-t border-line/60 pt-5">
          {/* ページ */}
          <div>
            <p className="text-xs tracking-[0.3em] text-warm">ページ</p>
            <ul className="mt-2 divide-y divide-line/50">
              {DRAWER_LINKS.filter((l) => !(inGame && l.href === "/")).map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setMenuOpen(false)} aria-current={active(l.href) ? "page" : undefined} className={`block py-3 ${active(l.href) ? "text-warm" : "text-mist hover:text-warm"}`}>
                    <span className="block text-base tracking-[0.15em]">{l.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-5 tracking-wider text-dim">{l.desc}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 表示とログイン */}
          <div>
            <p className="text-xs tracking-[0.3em] text-warm">表示とログイン</p>
            <div className="mt-3 flex flex-col gap-3 text-sm tracking-[0.15em]">
              <button type="button" onClick={() => setTimeOfDay(nextTod(tod))} disabled={todLocked} aria-pressed={tod !== "night"} className="flex items-center gap-2 border border-line px-3 py-2 text-haze hover:border-haze hover:text-mist disabled:opacity-50">
                <TodIcon tod={tod} className="h-4 w-4 translate-y-[1.5px]" />
                {`${TOD_LABEL[tod]}の空(${TOD_LABEL[nextTod(tod)]}にする)`}
              </button>
              <BgmToggle variant="drawer" />
              <button
                type="button"
                disabled={!enabled}
                onClick={user ? logout : login}
                className="flex items-center gap-2 border border-warm/50 px-3 py-2 text-mist hover:border-warm disabled:opacity-50"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${user ? "bg-s-health" : "bg-dim"}`} />
                {user ? t.settings.logout : t.settings.login}
              </button>
              <p className="text-[11px] leading-5 tracking-wider text-dim">{enabled ? "ログインは任意です。ログインすると保存した結果をどの端末からでも見られます。" : "ログイン機能はまだ設定されていません。ログインしなくてもすべて遊べます。"}</p>
            </div>
          </div>

          {/* 遊び方 */}
          <div>
            <p className="text-xs tracking-[0.3em] text-warm">遊び方</p>
            <ol className="mt-2 space-y-1.5 text-xs leading-6 tracking-wider text-haze">
              {t.home.steps.map((st, k) => (
                <li key={st} className="flex gap-2">
                  <span className="text-warm">{k + 1}</span>
                  {st.replace("\n", "")}
                </li>
              ))}
            </ol>
          </div>

          {/* このサイトの約束 */}
          <div>
            <p className="text-xs tracking-[0.3em] text-warm">このサイトの約束</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-6 tracking-wider text-haze">
              <li>・ログインなしで遊べます</li>
              <li>・株価は完全な架空です。景気は、過去は実際の統計、未来はランダムです</li>
              <li>・占いや予言ではありません</li>
              <li>・入力した内容はこの端末の中だけで使います</li>
            </ul>
          </div>

          {/* 注意事項 */}
          <div className="rounded-sm border border-warm/40 bg-warm/5 px-4 py-3">
            <p className="text-xs tracking-[0.3em] text-warm">ご注意</p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-5 tracking-wider text-haze">
              <li>・ここに出てくる数字はあくまで統計上の数字と、設計上の仮定にもとづくものです。あなたやほかの誰かの実際の人生を、予測するものではありません。</li>
              <li>・寿命・病気・収入・結婚などは統計的な傾向から、確率で決まります。同じ条件でも結果は人生ごとに変わります。</li>
              <li>・株価は乱数でつくった完全な架空のものです。景気・物価・失業率は、実際の統計がある過去の年はその数字を使い、それ以外の年(未来)は毎回ランダムです。投資の助言ではありません。</li>
              <li>・占いや人生診断ではありません。</li>
            </ul>
            <Link href="/sources" onClick={() => setMenuOpen(false)} className="mt-2 inline-block text-[11px] tracking-wider text-warm underline underline-offset-4">どの数字が統計でどれが仮定か →</Link>
          </div>

          <p className="border-t border-line/60 pt-4 text-[11px] tracking-[0.2em] text-dim">© {t.footer.copy}</p>
        </div>
      </nav>
    </div>
    </>
  );
}
