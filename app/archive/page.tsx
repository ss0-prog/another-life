"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { archiveEnabled, listShared, sampleList, type ArchiveEntry } from "@/lib/archive";

const STAT_LABEL = { health: "健康", money: "経済", bonds: "つながり", learn: "学び", joy: "幸福度" } as const;
const STAT_KEYS = ["health", "money", "bonds", "learn", "joy"] as const;
const PAGE_SIZE = 9;

const signed = (n: number, unit: string) => `${n > 0 ? "+" : n < 0 ? "-" : "±"}${Math.abs(n).toLocaleString("ja-JP")}${unit}`;
const diffColor = (n: number) => (n > 0 ? "var(--color-up)" : n < 0 ? "var(--color-down)" : "var(--color-haze)");

// 「進路: 医学部…」のような表記を、「種類」と「選んだ道」に分ける。
const splitLabel = (label: string) => {
  const k = label.indexOf(": ");
  return k < 0 ? { kind: "", option: label } : { kind: label.slice(0, k), option: label.slice(k + 2) };
};

function EntryCard({ e }: { e: ArchiveEntry }) {
  const [open, setOpen] = useState(false);
  const ageDiff = e.alt.deathAge - e.real.deathAge;
  const assetDiff = e.alt.assets.total - e.real.assets.total;
  const date = e.createdAt ? new Date(e.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }) : null;
  const tp = splitLabel(e.branchLabel);
  const lives = [
    { label: "いまのまま", life: e.real, color: "var(--color-cool)" },
    { label: "分岐した", life: e.alt, color: "var(--color-warm)" },
  ];
  // 年表から、ターニングポイントのあとの出来事を、ひとつ紹介する(人生の中ほどのもの)。
  const tl = e.alt.echo.timeline;
  const highlight = tl.length > 1 ? tl[Math.floor(tl.length / 2)] : tl[0];
  return (
    <div className="flex flex-col rounded-sm border border-line bg-panel/80 backdrop-blur-sm transition-colors hover:border-warm/60">
      {/* 見出し(スマホでは、タップで、詳しい内容が下にひらく) */}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="block w-full px-5 py-5 text-left sm:cursor-default sm:px-6 sm:py-6">
        <span className="flex items-center justify-between gap-3 text-xs tracking-[0.2em] text-haze">
          <span className="keep">{e.sample ? "サンプル" : "公開された人生"}</span>
          <span className="keep">{e.branchAge}歳のとき</span>
        </span>
        <span className="mt-3 block text-[11px] tracking-[0.2em] text-warm">あなたの人生のターニングポイント{tp.kind ? `(${tp.kind})` : ""}</span>
        <span className="mt-1 block text-sm leading-7 tracking-wider text-mist">{tp.option}</span>
        <span className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 text-xs tracking-wider">
          <span className="flex flex-wrap gap-x-5 gap-y-1">
            <span className="keep" style={{ color: diffColor(ageDiff) }}>寿命 {signed(ageDiff, "歳")}</span>
            <span className="keep" style={{ color: diffColor(assetDiff) }}>資産 {signed(assetDiff, "万円")}</span>
          </span>
          <span className="keep text-haze sm:hidden">{open ? "閉じる ▲" : "ひらく ▼"}</span>
        </span>
      </button>

      {/* 詳しい内容(スマホでは、ひらいたときだけ。PC では、いつも表示) */}
      <div className={`${open ? "flex" : "hidden"} flex-1 flex-col border-t border-line/70 px-5 pb-5 pt-4 sm:flex sm:px-6 sm:pb-6`}>
        <div className="grid grid-cols-2 gap-4">
          {lives.map(({ label, life: l, color }) => (
            <div key={label} className="min-w-0">
              <p className="text-xs tracking-[0.2em]" style={{ color }}>
                {label}
              </p>
              <p className="mt-1 text-2xl tabular-nums text-mist">
                {l.deathAge}
                <span className="text-xs text-haze">歳</span>
              </p>
              {l.deathCause && <p className="text-xs tracking-wider text-haze">{l.deathCause}</p>}
              <p className="mt-2 text-xs leading-6 tracking-wider text-mist">{l.echo.status.occupation}</p>
              <p className="text-xs leading-6 tracking-wider text-dim">{l.echo.status.city}</p>
              <p className="mt-1 text-sm tabular-nums text-mist">
                {l.assets.total.toLocaleString("ja-JP")}
                <span className="text-xs text-haze">万円</span>
              </p>
              {l.assets.pnl !== 0 && <p className="text-[11px] tabular-nums tracking-wider" style={{ color: diffColor(l.assets.pnl) }}>運用 {signed(l.assets.pnl, "万円")}</p>}
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1.5">
          {STAT_KEYS.map((k) => (
            <div key={k} className="grid grid-cols-[4.2rem_1fr] items-center gap-2 text-[11px] tracking-wider text-haze">
              <span className="keep">{STAT_LABEL[k]}</span>
              <span className="block space-y-0.5">
                {lives.map(({ label, life, color }) => (
                  <span key={label} className="block h-1 w-full rounded-full bg-line">
                    <span className="block h-1 rounded-full" style={{ width: `${Math.max(2, Math.min(100, life.stats[k]))}%`, background: color }} />
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>

        {highlight && (
          <p className="mt-4 border-l-2 border-warm/60 pl-3 text-xs leading-6 tracking-wider text-haze">
            <span className="text-warm">{highlight.age}歳</span>　{highlight.event}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="text-[11px] tracking-wider text-dim">{date ?? ""}</span>
          <Link href={`/archive/view?id=${e.id}`} className="keep border border-warm/60 bg-warm/10 px-4 py-1.5 text-xs tracking-[0.2em] text-mist transition-colors hover:border-warm hover:bg-warm/20">
            詳しく見る →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ページ送り付きの一覧。
function PagedGrid({ entries }: { entries: ArchiveEntry[] }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  useEffect(() => setPage(1), [entries]);
  const cur = Math.min(page, pages);
  const shown = entries.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  return (
    <>
      <div className="mt-6 grid items-start gap-5 sm:grid-cols-2 sm:items-stretch lg:grid-cols-3">
        {shown.map((e) => (
          <EntryCard key={e.id} e={e} />
        ))}
      </div>
      {pages > 1 && (
        <nav aria-label="ページ" className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm tracking-wider">
          <button type="button" disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="border border-line px-3 py-1.5 text-haze hover:border-haze hover:text-mist disabled:cursor-not-allowed disabled:opacity-35">
            前へ
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" onClick={() => setPage(n)} aria-current={n === cur ? "page" : undefined} className={`h-9 w-9 border tabular-nums ${n === cur ? "border-warm bg-warm/15 text-mist" : "border-line text-haze hover:border-haze hover:text-mist"}`}>
              {n}
            </button>
          ))}
          <button type="button" disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="border border-line px-3 py-1.5 text-haze hover:border-haze hover:text-mist disabled:cursor-not-allowed disabled:opacity-35">
            次へ
          </button>
        </nav>
      )}
    </>
  );
}

type Filters = { q: string; kind: string; age: string; life: string; asset: string; cause: string };
const NO_FILTER: Filters = { q: "", kind: "", age: "", life: "", asset: "", cause: "" };
const AGE_BANDS: [string, string, (a: number) => boolean][] = [
  ["teen", "〜19歳", (a) => a < 20],
  ["20s", "20代", (a) => a >= 20 && a < 30],
  ["30s", "30代", (a) => a >= 30 && a < 40],
  ["40s", "40歳〜", (a) => a >= 40],
];

const haystack = (e: ArchiveEntry) =>
  [e.branchLabel, e.alt.deathCause, e.real.deathCause, e.alt.echo.status.occupation, e.real.echo.status.occupation, e.alt.echo.status.city, e.real.echo.status.city, e.alt.echo.status.living, ...e.alt.echo.timeline.map((t) => t.event)]
    .filter(Boolean)
    .join(" ");

function matches(e: ArchiveEntry, f: Filters, hay: string): boolean {
  if (f.q.trim() && !f.q.trim().split(/\s+/).every((w) => hay.includes(w))) return false;
  if (f.kind && splitLabel(e.branchLabel).kind !== f.kind) return false;
  if (f.age) {
    const band = AGE_BANDS.find((b) => b[0] === f.age);
    if (band && !band[2](e.branchAge)) return false;
  }
  const ageDiff = e.alt.deathAge - e.real.deathAge;
  if (f.life === "longer" && ageDiff <= 0) return false;
  if (f.life === "shorter" && ageDiff >= 0) return false;
  const assetDiff = e.alt.assets.total - e.real.assets.total;
  if (f.asset === "richer" && assetDiff <= 0) return false;
  if (f.asset === "poorer" && assetDiff >= 0) return false;
  if (f.cause && e.alt.deathCause !== f.cause) return false;
  return true;
}

const chip = (on: boolean) => `border px-3 py-1 text-xs tracking-wider transition-colors ${on ? "border-warm bg-warm/15 text-mist" : "border-line text-haze hover:border-haze hover:text-mist"}`;

export default function ArchivePage() {
  const samples = useMemo(() => sampleList(), []);
  const [shared, setShared] = useState<ArchiveEntry[] | null>(archiveEnabled ? null : []);
  const [f, setF] = useState<Filters>(NO_FILTER);

  useEffect(() => {
    if (archiveEnabled) listShared().then(setShared);
  }, []);

  const all = useMemo(() => [...(shared ?? []), ...samples], [shared, samples]);
  const kinds = useMemo(() => [...new Set(all.map((e) => splitLabel(e.branchLabel).kind).filter(Boolean))], [all]);
  const causes = useMemo(() => [...new Set(all.map((e) => e.alt.deathCause).filter((c): c is string => Boolean(c)))], [all]);
  const hays = useMemo(() => new Map(all.map((e) => [e.id, haystack(e)])), [all]);
  const filter = (list: ArchiveEntry[]) => list.filter((e) => matches(e, f, hays.get(e.id) ?? ""));
  const sharedF = useMemo(() => filter(shared ?? []), [shared, f, hays]); // eslint-disable-line react-hooks/exhaustive-deps
  const samplesF = useMemo(() => filter(samples), [samples, f, hays]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = JSON.stringify(f) !== JSON.stringify(NO_FILTER);
  const set = (patch: Partial<Filters>) => setF((cur) => ({ ...cur, ...patch }));

  return (
    <div className="mx-auto w-full max-w-[120rem] px-[2.5vw] pb-24 pt-12 sm:px-12">
      <h1 className="text-center text-2xl tracking-[0.3em] text-mist">誰かの人生</h1>
      <p className="mx-auto mt-6 max-w-xl w-fit text-left text-base leading-9 tracking-wider text-haze lg:max-w-none lg:whitespace-nowrap">
        ターニングポイントのもう一方を歩いた人たちの、一生です。<span className="inline-block">名前も連絡先もなく人生だけが残ります。</span>
      </p>

      {/* 検索: 人生の特徴(ターニングポイント・職業・地域・最期の原因・出来事)で探す */}
      <section className="mt-10 rounded-sm border border-line bg-panel/80 px-5 py-5 backdrop-blur-sm">
        <p className="text-xs tracking-[0.3em] text-warm">人生の特徴で探す</p>
        <input
          type="search"
          value={f.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="例: 留学 / 医師 / 東京 / がん / 起業(空白でくぎって、複数のことばも使えます)"
          className="mt-3 w-full border-b border-line bg-transparent py-2 text-base tracking-wider text-mist outline-none placeholder:text-dim focus:border-haze"
        />
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="keep w-28 shrink-0 text-xs tracking-wider text-haze">ターニングポイント</span>
            <button type="button" onClick={() => set({ kind: "" })} className={chip(f.kind === "")}>すべて</button>
            {kinds.map((k) => (
              <button key={k} type="button" onClick={() => set({ kind: f.kind === k ? "" : k })} className={chip(f.kind === k)}>
                {k}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="keep w-28 shrink-0 text-xs tracking-wider text-haze">そのときの年齢</span>
            <button type="button" onClick={() => set({ age: "" })} className={chip(f.age === "")}>すべて</button>
            {AGE_BANDS.map(([id, label]) => (
              <button key={id} type="button" onClick={() => set({ age: f.age === id ? "" : id })} className={chip(f.age === id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="keep w-28 shrink-0 text-xs tracking-wider text-haze">寿命</span>
            <button type="button" onClick={() => set({ life: "" })} className={chip(f.life === "")}>すべて</button>
            <button type="button" onClick={() => set({ life: f.life === "longer" ? "" : "longer" })} className={chip(f.life === "longer")}>長くなった</button>
            <button type="button" onClick={() => set({ life: f.life === "shorter" ? "" : "shorter" })} className={chip(f.life === "shorter")}>短くなった</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="keep w-28 shrink-0 text-xs tracking-wider text-haze">資産</span>
            <button type="button" onClick={() => set({ asset: "" })} className={chip(f.asset === "")}>すべて</button>
            <button type="button" onClick={() => set({ asset: f.asset === "richer" ? "" : "richer" })} className={chip(f.asset === "richer")}>増えた</button>
            <button type="button" onClick={() => set({ asset: f.asset === "poorer" ? "" : "poorer" })} className={chip(f.asset === "poorer")}>減った</button>
          </div>
          {causes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="keep w-28 shrink-0 text-xs tracking-wider text-haze">最期の原因</span>
              <button type="button" onClick={() => set({ cause: "" })} className={chip(f.cause === "")}>すべて</button>
              {causes.map((c) => (
                <button key={c} type="button" onClick={() => set({ cause: f.cause === c ? "" : c })} className={chip(f.cause === c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs tracking-wider text-dim">
          <span>
            {sharedF.length + samplesF.length}件が見つかりました(全{all.length}件)
          </span>
          {active && (
            <button type="button" onClick={() => setF(NO_FILTER)} className="text-haze underline underline-offset-4 hover:text-mist">
              条件をすべてクリア
            </button>
          )}
        </div>
      </section>

      {archiveEnabled && (
        <section className="mt-14">
          <h2 className="border-l-2 border-warm pl-4 text-lg tracking-[0.2em] text-warm">公開された人生</h2>
          {shared === null ? (
            <p className="mt-6 text-sm tracking-wider text-haze">読み込んでいます</p>
          ) : shared.length === 0 ? (
            <p className="mt-6 text-sm leading-8 tracking-wider text-haze">まだ公開された人生はありません。あなたの結果を保存するときに公開することもできます。</p>
          ) : sharedF.length === 0 ? (
            <p className="mt-6 text-sm leading-8 tracking-wider text-haze">条件に合う公開された人生は見つかりませんでした。</p>
          ) : (
            <PagedGrid entries={sharedF} />
          )}
        </section>
      )}

      <section className="mt-14">
        <h2 className="border-l-2 border-warm pl-4 text-lg tracking-[0.2em] text-warm">サンプルの人生</h2>
        <p className="mt-4 text-sm leading-8 tracking-wider text-haze">統計シミュレーションだけでつくった、架空の人生です。</p>
        {samplesF.length === 0 ? <p className="mt-6 text-sm leading-8 tracking-wider text-haze">条件に合うサンプルは見つかりませんでした。</p> : <PagedGrid entries={samplesF} />}
      </section>
    </div>
  );
}
