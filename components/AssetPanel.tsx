"use client";

import { SINCE, assetAvailable, yearOf } from "@/lib/sim/era";
import { manParts, manText } from "@/lib/money";
import { useEffect, useMemo, useRef, useState } from "react";
import { chipClass } from "@/components/controls";
import type { Messages } from "@/lib/i18n";
import { jpData } from "@/lib/sim/data/jp";
import { canInterpret, describeText, holdingsValue, suggestTag } from "@/lib/sim/engine";
import { marketOf, monthIndex } from "@/lib/sim/market";
import type { LenderOffer } from "@/lib/sim/engine";
import { debtTotal } from "@/lib/sim/helpers";
import { savingsRate } from "@/lib/sim/economy";
import { incomeOf } from "@/lib/sim/salary";
import { householdTax, taxSnap } from "@/lib/sim/tax";
import { livingCosts } from "@/lib/sim/living";
import type { AssetId, GameState, LenderId, Tag } from "@/lib/sim/types";

type Props = {
  t: Messages["play"]["assets"];
  state: GameState;
  month: number;
  onTrade: (id: AssetId, yen: number) => boolean;
  onStartStocks: () => void;
  onSpend: (yen: number, text: string, tag: Tag | null) => "ok" | "short" | "fail";
  onKidNisa: (yen: number) => boolean;
  onPlan: (id: AssetId, yen: number) => boolean;
  onBorrow: (lender: LenderId, yen: number, text: string, tag: Tag | null) => boolean;
  offers: (yen: number) => LenderOffer[];
};

const yenText = (n: number) => `=${(Number.isFinite(n) ? Math.round(n) : 0).toLocaleString("ja-JP")}円`;
const man = (yen: number) => (Number.isFinite(yen) ? Math.round(yen / 10000).toLocaleString("ja-JP") : "0");
const pct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`;

const SLOTS = 40;
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;

const PRESETS: { key: keyof Messages["play"]["assets"]["presets"]; tag: Tag; minYen: number }[] = [
  { key: "trip", tag: "rest", minYen: 1000 },
  { key: "learn", tag: "learn", minYen: 500 },
  { key: "family", tag: "bond", minYen: 500 },
  { key: "give", tag: "bond", minYen: 100 },
  { key: "self", tag: "rest", minYen: 500 },
  { key: "petDog", tag: "bond", minYen: 30000 },
  { key: "petCat", tag: "bond", minYen: 20000 },
  { key: "kidNisa", tag: "bond", minYen: 0 },
];

export function AssetPanel({ t, state, month, onTrade, onStartStocks, onPlan, onSpend, onKidNisa, onBorrow, offers }: Props) {
  const [loan, setLoan] = useState<{ yen: number; text: string; tag: Tag | null } | null>(null);
  const [menu, setMenu] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // スマホの上のバーの「資産の使い方」から、ひらく。
  useEffect(() => {
    const onOpen = () => {
      setMenu(true);
      setWriting(false);
      window.setTimeout(() => rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    };
    window.addEventListener("betsu-uchu:open-spend", onOpen);
    return () => window.removeEventListener("betsu-uchu:open-spend", onOpen);
  }, []);
  const [taxOpen, setTaxOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const costs = livingCosts(state.person, jpData);
  // 手取りは、左の「年収の目安」と同じ計算で、いまの状態から出す(年のはじめの値のままだと、年のなかで能力値が変わると、ずれる)。結婚していれば、配偶者のぶんをふくめた世帯の目安。
  const ownIncome = state.person.occ !== null ? Math.round(incomeOf(state.person, jpData, state.person.econ)) : 0;
  const tx = state.person.occ !== null ? taxSnap(householdTax(state.person, jpData, state.person.econ)) : null;
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [spendAmount, setSpendAmount] = useState("");
  const [tag, setTag] = useState<Tag | null>(null);
  const [tagTouched, setTagTouched] = useState(false);
  const [sel, setSel] = useState<AssetId>("index");
  const [amount, setAmount] = useState("");
  const [planAmount, setPlanAmount] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const market = useMemo(() => marketOf(state.seed, jpData), [state.seed]);
  const dead = state.deathAge !== null;
  // 18歳未満は、お小遣い(円)。株はできない。
  const minor = state.person.age < 18;
  const stocks = state.wallet.stocks && !minor;
  const invested = holdingsValue(state, month, jpData);

  // 資産(貯金+運用-借金)の増減を、-1000〜+1000の点数にして記録する。
  const net = state.wallet.cash + invested - debtTotal(state.wallet.debts);
  const [swings, setSwings] = useState<number[]>([]);
  const track = useRef<{ key: string; anchor: number } | null>(null);
  useEffect(() => {
    const key = `${state.seed}:${state.salt}`;
    if (!Number.isFinite(net)) return;
    if (!track.current || track.current.key !== key) {
      track.current = { key, anchor: net };
      setSwings([]);
      return;
    }
    const ref = minor ? Math.max(3000, Math.abs(track.current.anchor) * 0.5) : Math.max(1_000_000, Math.abs(track.current.anchor) * 0.3);
    const score = Math.max(-1000, Math.min(1000, Math.round(((net - track.current.anchor) / ref) * 1000)));
    if (Math.abs(score) < 10) return;
    track.current.anchor = net;
    setSwings((l) => [...l, score].slice(-SLOTS));
  }, [net, minor, state.seed, state.salt]);

  const now = monthIndex(state.person.age, month);
  const path = market[sel];
  const asset = jpData.assets.find((a) => a.id === sel)!;
  const price = path[now];
  const ago = (m: number) => (now - m >= 0 ? price / path[now - m] - 1 : null);
  const held = state.wallet.units[sel] * price;

  // 直近5年の値動きを折れ線にする。
  const from = Math.max(0, now - 60);
  const slice = path.slice(from, now + 1);
  const lo = Math.min(...slice);
  const hi = Math.max(...slice);
  const pts = slice.map((v, i) => `${(i / Math.max(1, slice.length - 1)) * 300},${58 - ((v - lo) / Math.max(1e-9, hi - lo)) * 52}`).join(" ");

  const yen = Math.round((Number(amount) || 0) * 10000);
  const act = (sign: 1 | -1) => {
    if (dead || yen <= 0) return;
    const ok = onTrade(sel, sign * yen);
    setMsg(ok ? null : sign > 0 ? t.noMoney : t.noHolding);
    if (ok) setAmount("");
  };

  const spendYen = Math.round((Number(spendAmount) || 0) * (minor ? 1 : 10000));
  // 子どもは借りられないので、お小遣いで払えない使い道は、出さない。
  const hasKid = !minor && state.person.kidList.some((k) => state.person.age - k.bornAge < 18);
  const visiblePresets = PRESETS.filter((pr) => (pr.key !== "kidNisa" || (hasKid && yearOf(state.person) >= SINCE.kidsNisa)) && ((pr.key !== "petDog" && pr.key !== "petCat") || state.person.pets.filter((x) => !x.died).length < 3) && (!minor || state.wallet.cash >= pr.minYen));
  const amountChips = (minor ? [500, 1000, 3000, 5000, 10000, 30000] : [5, 10, 30, 50, 100, 300]).filter((v) => !minor || v <= state.wallet.cash);
  const readable = canInterpret(text);
  const submitSpend = () => {
    if (!text.trim() || spendYen <= 0 || !(readable || tag)) return;
    if (text === t.presets.kidNisa) {
      if (spendYen > state.wallet.cash) return setMsg(t.noMoney);
      if (onKidNisa(spendYen)) {
        setText("");
        setSpendAmount("");
        setWriting(false);
        setMenu(false);
        setMsg(null);
      }
      return;
    }
    const useTag = readable ? null : tag;
    const r = onSpend(spendYen, text, useTag);
    if (r === "short") return setLoan({ yen: spendYen, text, tag: useTag });
    if (r === "fail") return setMsg(t.noMoney);
    setText("");
    setSpendAmount("");
    setTag(null);
    setTagTouched(false);
    setWriting(false);
    setMenu(false);
    setMsg(null);
  };

  const field = "border-b border-line bg-transparent py-1 text-mist outline-none placeholder:text-dim focus:border-haze";

  // 6歳になるまでは、自分のお金は持たない。
  if (state.person.age < 6)
    return (
      <div className="flex flex-col">
        <h3 className="text-sm tracking-[0.3em] text-warm">{t.allowance}</h3>
        <p className="mt-3 text-sm leading-7 tracking-wider text-haze">まだ、自分のお金は持っていません。お金のことは、家族が見てくれています。</p>
      </div>
    );

  return (
    <div ref={rootRef} className="flex scroll-mt-28 flex-col">
      <h3 className="text-sm tracking-[0.3em] text-warm max-lg:hidden">{minor ? t.allowance : t.title}</h3>
      <p className="mt-1 text-[11px] leading-4 tracking-wider text-dim max-lg:hidden">{minor ? "親からもらうお金。使い道は自分で決められます" : "貯金・運用資産・借金をまとめたお金の状況です。「合計」は借金を引いた実質の資産"}</p>

      <div className="mt-5 text-center max-lg:mt-0">
        <p className="tabular-nums text-mist text-3xl max-lg:hidden sm:text-4xl">
          {minor ? (Number.isFinite(state.wallet.cash) ? Math.round(state.wallet.cash) : 0).toLocaleString("ja-JP") : manParts(net / 10000).num}
          <span className="ml-1 text-xs text-haze">{minor ? t.unitYen : manParts(net / 10000).unit}</span>
        </p>
        {!minor && <p className="text-xs tabular-nums text-dim max-lg:hidden">{yenText(net)}</p>}
        {state.wallet.kidFund && state.wallet.kidFund.units > 0 && (
          <p className="mt-2 text-xs tracking-wider text-haze">
            こどもNISA(子どもの将来の積立) 約{man(state.wallet.kidFund.units * market.index[now])}万円
            <span className="block text-[11px] text-dim">積立 {man(state.wallet.kidFund.contributed)}万円。自分の資産には数えません。</span>
          </p>
        )}
        {!minor && tx && tx.gross > 0 && (
          <div className="mt-3 border border-line/70 text-left">
            <button type="button" onClick={() => setTaxOpen((o) => !o)} aria-expanded={taxOpen} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs tracking-wider text-haze hover:text-mist">
              <span>今年の手取り(世帯の目安)</span>
              <span className="flex items-center gap-2 tabular-nums text-mist">
                約{tx.net}万円
                <span aria-hidden className={`text-[9px] text-dim transition-transform ${taxOpen ? "rotate-180" : ""}`}>▼</span>
              </span>
            </button>
            {taxOpen && (
              <div className="border-t border-line/70 px-3 py-3 text-[11px] leading-5 tracking-wider text-dim">
                <dl className="space-y-1 tabular-nums">
                  <div className="flex justify-between gap-3 text-haze">
                    <dt>額面(税や保険料を引く前の収入)</dt>
                    <dd>{tx.gross}万円</dd>
                  </div>
                  {state.person.married && ownIncome > 0 && tx.gross > ownIncome + 1 && (
                    <div className="flex justify-between gap-3 pl-3 text-[10px]">
                      <dt>うち 自分 {ownIncome}万円 + 配偶者 {tx.gross - ownIncome}万円</dt>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt>− 所得税</dt>
                    <dd>{tx.incomeTax}万円</dd>
                  </div>
                  {tx.credit > 0 && (
                    <div className="flex justify-between gap-3 pl-3 text-[10px]">
                      <dt>うち 住宅ローン控除で減った分</dt>
                      <dd>−{tx.credit}万円</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt>− 住民税</dt>
                    <dd>{tx.resident}万円</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>− 社会保険料</dt>
                    <dd>{tx.social}万円</dd>
                  </div>
                  <div className="flex justify-between gap-3 pl-3 text-[10px]">
                    <dt>健康・介護保険</dt>
                    <dd>{tx.health}万円</dd>
                  </div>
                  <div className="flex justify-between gap-3 pl-3 text-[10px]">
                    <dt>年金</dt>
                    <dd>{tx.pension}万円</dd>
                  </div>
                  <div className="flex justify-between gap-3 pl-3 text-[10px]">
                    <dt>雇用保険</dt>
                    <dd>{tx.employment}万円</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-line/70 pt-1.5 text-xs font-bold text-mist">
                    <dt>= 手取り</dt>
                    <dd>
                      {tx.net}万円<span className="ml-1 text-[10px] font-normal text-haze">(額面の{Math.round((tx.net / tx.gross) * 100)}%)</span>
                    </dd>
                  </div>
                </dl>
                <p className="mt-2">税の計算は、実際の制度をもとにした簡略版です(出典は「データについて」)。</p>
              </div>
            )}
          </div>
        )}
        {!minor && state.person.occ !== null && costs.total > 0 && (
          <div className="mt-2 border border-line/70 text-left">
            <button type="button" onClick={() => setCostOpen((o) => !o)} aria-expanded={costOpen} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs tracking-wider text-haze hover:text-mist">
              <span>今年の生活費・固定費(世帯の目安)</span>
              <span className="flex items-center gap-2 tabular-nums text-mist">
                約{costs.total}万円(月{(costs.total / 12).toFixed(1)}万円)
                <span aria-hidden className={`text-[9px] text-dim transition-transform ${costOpen ? "rotate-180" : ""}`}>▼</span>
              </span>
            </button>
            {costOpen && (
              <div className="border-t border-line/70 px-3 py-3 text-[11px] leading-5 tracking-wider text-dim">
                <dl className="space-y-1.5 tabular-nums">
                  {costs.items.map((x) => (
                    <div key={x.id}>
                      <div className="flex justify-between gap-3 text-haze">
                        <dt>{x.label}</dt>
                        <dd>{x.man}万円(月{(x.man / 12).toFixed(1)}万円)</dd>
                      </div>
                      {x.note && <p className="pl-3 text-[10px]">{x.note}</p>}
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 border-t border-line/70 pt-1.5 text-xs font-bold text-mist">
                    <dt>= 合計</dt>
                    <dd>{costs.total}万円</dd>
                  </div>
                </dl>
                <p className="mt-2">手取りから、この生活費を引いた黒字の一部が、貯金に回ります。残りは、保険・年金・ローンの返済・投資などに使われる想定です。収入が低いと、暮らしを切りつめます。年に1度、まとめて反映されます。</p>
                <p className="mt-1">費目は、総務省の家計調査・全国家計構造調査(令和6年: 全国の消費支出は総世帯で月約25.1万円)と、文部科学省の学習費調査をもとにした目安です。</p>
              </div>
            )}
          </div>
        )}
        {!minor && <p className="mt-2 text-[11px] leading-4 tracking-wider text-dim max-lg:hidden">普通預金の金利: 年{(savingsRate(state.person.econ) * 100).toFixed(3)}%(景気で上下する架空の水準)</p>}
        {stocks && (
          <p className="mt-2 text-xs tracking-wider text-haze">
            うち {t.cash} {manText(state.wallet.cash / 10000)}・{t.invested} {manText(invested / 10000)}
            {state.wallet.debts.length > 0 ? `・${t.debt} -${manText(debtTotal(state.wallet.debts) / 10000)}` : ""}
          </p>
        )}
      </div>

      <div className="mt-5 max-lg:mt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs tracking-[0.2em] text-haze">{t.swing}</span>
          {swings.length > 0 && (
            <span className="text-xl tabular-nums sm:text-2xl" style={{ color: swings[swings.length - 1] >= 0 ? "var(--color-up)" : "var(--color-down)" }}>
              {signed(swings[swings.length - 1])}
            </span>
          )}
        </div>
        <svg viewBox="0 0 300 100" className="mt-1 h-24 w-full" preserveAspectRatio="none" role="img" aria-label={t.swing}>
          <line x1="0" x2="300" y1="50" y2="50" stroke="var(--color-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {swings.map((v, i) => {
            const h = (Math.abs(v) / 1000) * 48;
            const w = 300 / SLOTS;
            return <rect key={i} x={(SLOTS - swings.length + i) * w + 1} width={w - 2} y={v >= 0 ? 50 - h : 50} height={Math.max(1, h)} fill={v >= 0 ? "var(--color-up)" : "var(--color-down)"} />;
          })}
        </svg>
        <p className="text-xs leading-6 tracking-wider text-dim">{swings.length === 0 ? t.swingNone : t.swingNote}</p>
      </div>

      {state.wallet.debts.length > 0 && (
        <div className="mt-4 rounded-sm border px-4 py-3 text-center" style={{ borderColor: "var(--color-s-bonds)" }}>
          <p className="text-xs tracking-[0.2em]" style={{ color: "var(--color-s-bonds)" }}>{t.debt}</p>
          <p className="mt-1 text-xl tabular-nums sm:text-2xl" style={{ color: "var(--color-s-bonds)" }}>
            -{man(debtTotal(state.wallet.debts))}
            <span className="ml-1 text-xs">{t.unit}</span>
          </p>
          <p className="text-xs tabular-nums text-dim">{yenText(debtTotal(state.wallet.debts))}</p>
          <ul className="mt-2 space-y-0.5 text-xs leading-6 tracking-wider text-haze">
            {state.wallet.debts.map((d) => (
              <li key={d.lender}>
                {{ family: "家族", friend: "友人", bank: "銀行", card: "カードローン", shark: "闇金" }[d.lender]} {manText(d.amount / 10000)}
                {d.rate > 0 ? `(${t.interest} 年${Math.round(d.rate * 100)}%)` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!dead && (
        <button type="button" onClick={() => { setMenu((m) => !m); setWriting(false); }} className="mx-auto mt-6 border border-warm/60 bg-warm/5 px-6 py-2 text-sm tracking-[0.25em] text-mist hover:border-warm">
          {menu ? t.close : t.usage}
        </button>
      )}

      {loan && !dead && (
        <div className="mt-4 rounded-sm border px-4 py-4" style={{ borderColor: "var(--color-s-bonds)" }}>
          <p className="text-center text-base tracking-[0.15em]" style={{ color: "var(--color-s-bonds)" }}>
            ⚠ {t.shortTitle}
          </p>
          <p className="mt-2 text-center text-sm tabular-nums tracking-wider text-mist">
            {t.shortBy} {man(loan.yen - state.wallet.cash)}{t.unit}({yenText(loan.yen - state.wallet.cash)})
          </p>
          <p className="mt-2 text-xs leading-6 tracking-wider text-haze">{t.loanWarn}</p>
          <p className="mt-3 text-xs tracking-[0.2em] text-haze">{t.loanChoose}</p>
          <ul className="mt-2 space-y-2">
            {offers(loan.yen).map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={!o.ok}
                  onClick={() => {
                    if (onBorrow(o.id, loan.yen, loan.text, loan.tag)) {
                      setLoan(null);
                      setText("");
                      setSpendAmount("");
                      setTag(null);
                      setTagTouched(false);
                      setWriting(false);
                      setMenu(false);
                      setMsg(null);
                    }
                  }}
                  className={`${chipClass(false)} w-full text-left disabled:opacity-40`}
                >
                  {o.label}
                  <span className="ml-2 text-xs text-dim">{o.rateText}</span>
                  <span className="mt-1 block text-xs leading-6 text-dim">{o.ok ? o.note : `${t.cantBorrow}: ${o.why}`}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setLoan(null)} className="mt-3 block w-full text-center text-sm tracking-[0.2em] text-haze hover:text-mist">
            {t.loanCancel}
          </button>
        </div>
      )}

      {menu && !dead && !writing && (
        <ul className="mt-4 grid auto-rows-fr gap-3">
          {!stocks && !minor && (
            <li>
              <button type="button" onClick={() => { onStartStocks(); setMenu(false); }} className={`${chipClass(false)} flex h-full w-full flex-col justify-center text-left`}>
                {t.startStocks}
                <span className="mt-1 block text-xs leading-6 text-dim">{t.startStocksDesc}</span>
              </button>
            </li>
          )}
          <li>
            <button type="button" onClick={() => setMenu(false)} className={`${chipClass(false)} flex h-full w-full flex-col justify-center text-left`}>
              {t.keepCash}
              <span className="mt-1 block text-xs leading-6 text-dim">使わずに貯金のままにしておく。</span>
            </button>
          </li>
          <li>
            <button type="button" onClick={() => setWriting(true)} className={`${chipClass(false)} flex h-full w-full flex-col justify-center text-left`}>
              {t.writeOwn}
              <span className="mt-1 block text-xs leading-6 text-dim">旅・学び・家族などに使う。足りなければ借りて使うこともできる。</span>
            </button>
          </li>
        </ul>
      )}

      {menu && !dead && writing && (
        <div className="mt-4 space-y-4">
          <p className="text-xs leading-5 tracking-wider text-dim">{minor ? "お小遣いで払える使い道だけが出ています。" : "使い道を選んで金額を決めます。足りなければ借りて使うこともできます。"}</p>
          <div className="grid grid-cols-1 gap-1.5">
            {visiblePresets.map((pr) => (
              <button
                key={pr.key}
                type="button"
                onClick={() => {
                  setText(t.presets[pr.key]);
                  setTag(pr.tag);
                  setTagTouched(true);
                  setSpendAmount("");
                }}
                className={`${chipClass(text === t.presets[pr.key])} flex w-full items-center !px-3 !py-2 text-left !text-xs`}
              >
                {t.presets[pr.key]}
              </button>
            ))}
            {visiblePresets.length === 0 && <p className="text-xs leading-6 tracking-wider text-dim">いまのお小遣いでは使える使い道がありません。</p>}
          </div>
          {text && (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                {amountChips.map((v) => (
                  <button key={v} type="button" onClick={() => setSpendAmount(String(v))} className={`${chipClass(Number(spendAmount) === v)} !px-2 !py-1.5 text-center !text-xs`}>
                    {minor ? `${v.toLocaleString("ja-JP")}円` : `${v.toLocaleString("ja-JP")}万円`}
                  </button>
                ))}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-xs tracking-[0.2em] text-haze">{t.ownAmount}</span>
                <input type="number" min={0} max={minor ? Math.floor(state.wallet.cash) : undefined} inputMode="numeric" value={spendAmount} onChange={(e) => { setSpendAmount(e.target.value); setMsg(null); }} className={`${field} w-28 text-center text-lg tabular-nums`} />
                <span className="text-xs text-haze">{minor ? t.unitYen : t.unit}</span>
                <span className="text-xs tabular-nums tracking-wider text-warm">{spendYen > 0 && !minor ? yenText(spendYen) : ""}</span>
                <button type="button" onClick={() => setSpendAmount(String(minor ? Math.floor(state.wallet.cash) : Math.floor(state.wallet.cash / 10000)))} className="text-xs tracking-wider text-haze underline-offset-4 hover:text-mist hover:underline">
                  {t.all}
                </button>
              </div>
              {minor && spendYen > state.wallet.cash && <p className="text-xs tracking-wider" style={{ color: "var(--color-s-bonds)" }}>お小遣いが足りません(子どもは借りることができません)。</p>}
            </>
          )}
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setWriting(false)} className="text-sm tracking-[0.2em] text-haze hover:text-mist">
              {t.ownBack}
            </button>
            <button type="button" disabled={!text.trim() || spendYen <= 0 || !(readable || tag) || (minor && spendYen > state.wallet.cash)} onClick={submitSpend} className="border border-warm/60 px-5 py-1 text-sm tracking-[0.2em] text-mist hover:border-warm disabled:opacity-30">
              {t.ownSubmit}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p className="mt-3 text-center text-xs tracking-wider" style={{ color: "var(--color-s-bonds)" }}>
          {msg}
        </p>
      )}

      {stocks && (
        <>
          <div className="mt-8 grid auto-rows-fr grid-cols-2 gap-2">
            {jpData.assets.filter((a) => assetAvailable(a.id, yearOf(state.person))).map((a) => (
              <button key={a.id} type="button" onClick={() => setSel(a.id)} className={`${chipClass(a.id === sel)} flex h-full items-center justify-center !px-2 !py-2 text-center !text-xs leading-5`}>
                {a.label}
              </button>
            ))}
          </div>
          <p className="mx-auto mt-3 w-fit text-left text-xs leading-6 tracking-wider text-dim">{asset.desc}</p>

          <svg viewBox="0 0 300 64" className="mt-4 h-40 w-full xl:h-52" preserveAspectRatio="none" role="img" aria-label={asset.label}>
            <polyline points={pts} fill="none" stroke="var(--color-warm)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="mt-2 flex justify-center gap-6 text-xs tracking-wider text-haze">
            {([[t.change1y, 12], [t.change5y, 60]] as const).map(([label, m]) => {
              const c = ago(m);
              return (
                <span key={label}>
                  {label}{" "}
                  <span style={{ color: c === null ? undefined : c >= 0 ? "var(--color-s-health)" : "var(--color-s-bonds)" }}>{c === null ? "—" : pct(c)}</span>
                </span>
              );
            })}
            <span>
              {t.held} {man(held)}
              {t.unit}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <input type="number" min={0} inputMode="numeric" value={amount} disabled={dead} placeholder={t.amount} onChange={(e) => { setAmount(e.target.value); setMsg(null); }} className={`${field} w-28 text-center text-lg tabular-nums`} />
            <span className="text-xs text-haze">{t.unit}</span>
            <span className="text-xs tabular-nums tracking-wider text-warm">{yen > 0 ? yenText(yen) : ""}</span>
            <button type="button" disabled={dead} onClick={() => setAmount(String(Math.floor(state.wallet.cash / 10000)))} className="text-xs tracking-wider text-haze underline-offset-4 hover:text-mist hover:underline">
              {t.all}
            </button>
            <button type="button" disabled={dead || yen <= 0} onClick={() => act(1)} className="border border-warm/60 px-4 py-1 text-sm tracking-widest text-mist hover:border-warm disabled:opacity-30">
              {t.buy}
            </button>
            <button type="button" disabled={dead || yen <= 0} onClick={() => act(-1)} className="border border-line px-4 py-1 text-sm tracking-widest text-haze hover:border-haze disabled:opacity-30">
              {t.sell}
            </button>
            <button
              type="button"
              disabled={dead || held < 1}
              onClick={() => {
                const ok = onTrade(sel, -held);
                setMsg(ok ? null : t.noHolding);
                if (ok) setAmount("");
              }}
              className="border border-line px-4 py-1 text-sm tracking-widest text-haze hover:border-haze disabled:opacity-30"
            >
              すべて売る{held >= 1 ? `(約${man(held)}${t.unit})` : ""}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs tracking-wider text-haze">
            <span>積み立て(毎月ずつ・年の額)</span>
            <input type="number" min={0} inputMode="numeric" value={planAmount} disabled={dead} placeholder={String(Math.round((state.wallet.plans?.[sel] ?? 0) / 10000))} onChange={(e) => setPlanAmount(e.target.value)} className={`${field} w-20 text-center tabular-nums`} />
            <span>万円</span>
            <button type="button" disabled={dead || planAmount === ""} onClick={() => { if (onPlan(sel, Math.round(Number(planAmount) * 10000))) setPlanAmount(""); }} className="border border-warm/60 px-3 py-1 text-mist hover:border-warm disabled:opacity-30">設定</button>
            <span className="text-dim">{(state.wallet.plans?.[sel] ?? 0) > 0 ? `いま: 年${man(state.wallet.plans![sel]!)}万円を積み立て中(0でやめる)` : "いま: 積み立てなし"}</span>
          </div>
          <p className="mx-auto mt-5 w-fit text-left text-xs leading-6 tracking-wider text-dim">{t.disclaimer}</p>
        </>
      )}
    </div>
  );
}
