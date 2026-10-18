"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dropdown, type DropdownItem } from "@/components/Dropdown";
import { GYO, READING, gyoOf, searchJobs } from "@/lib/sim/data/jp-jobsearch";

type Props = {
  items: DropdownItem[];
  value: string;
  onChange: (value: string) => void;
  kw?: Record<string, RegExp | undefined>;
  ariaLabel: string;
};

// 音声入力(ブラウザの音声認識)。使えないブラウザでは、ボタンを出さない。
type Rec = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const speechCtor = (): (new () => Rec) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

// 職種の選び方: ① 書いて探す(好きなこと・やりたいことでもよい)、② 声で探す、③ 五十音の頭文字から探す、④ 分類から選ぶ。
export function JobPicker({ items, value, onChange, kw, ariaLabel }: Props) {
  const [query, setQuery] = useState("");
  const [gyo, setGyo] = useState<string | null>(null);
  const [kanaOpen, setKanaOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voice, setVoice] = useState(false);
  const rec = useRef<Rec | null>(null);

  useEffect(() => {
    setVoice(!!speechCtor());
    return () => rec.current?.stop();
  }, []);

  const hits = useMemo(() => searchJobs(query, items, kw, 8), [query, items, kw]);
  const byGyo = useMemo(() => (gyo ? items.filter((i) => gyoOf(READING[i.value] ?? "") === gyo) : []), [gyo, items]);
  const labelOf = (v: string) => items.find((i) => i.value === v)?.label ?? v;
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of items) {
      const g = gyoOf(READING[i.value] ?? "");
      if (g) m[g] = (m[g] ?? 0) + 1;
    }
    return m;
  }, [items]);

  const listen = () => {
    const C = speechCtor();
    if (!C) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new C();
    r.lang = "ja-JP";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setQuery(t);
      setGyo(null);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  const row = (v: string, why?: string) => (
    <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v} className={`flex w-full items-center justify-between gap-3 border px-4 py-2.5 text-left text-base leading-7 tracking-wider transition-colors ${value === v ? "border-warm bg-warm/15 text-mist" : "border-line bg-panel/70 text-haze hover:border-haze hover:text-mist"}`}>
      <span>{labelOf(v)}</span>
      {why && <span className="font-gothic shrink-0 text-[11px] tracking-wider text-dim">{why}</span>}
    </button>
  );

  return (
    <div className="w-full max-w-xl text-left">
      {/* ① 書いて探す・② 声で探す */}
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setGyo(null);
          }}
          placeholder="書いて探す(例: 動物が好き / 絵を描く / エンジニア)"
          aria-label={`${ariaLabel}を書いて探す`}
          className="font-gothic min-w-0 flex-1 border border-line bg-panel/80 px-4 py-3 text-sm tracking-wider text-mist outline-none placeholder:text-dim focus:border-warm"
        />
        {voice && (
          <button type="button" onClick={listen} aria-pressed={listening} aria-label={listening ? "音声入力をとめる" : "声で探す"} title="声で探す" className={`flex w-12 shrink-0 items-center justify-center border transition-colors ${listening ? "border-warm bg-warm/20 text-warm" : "border-line bg-panel/80 text-haze hover:border-haze hover:text-mist"}`}>
            <svg viewBox="0 0 24 24" className={`h-5 w-5 ${listening ? "animate-pulse" : ""}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
        )}
      </div>
      {voice && <p className="font-gothic mt-1 text-[11px] leading-5 tracking-wider text-dim">{listening ? "聞いています。話してください。" : "声で探すときはブラウザの音声認識サービスに、声が送られます。"}</p>}

      {/* 検索の結果 */}
      {query.trim() !== "" && (
        <div className="mt-3 space-y-2" aria-live="polite">
          {hits.length > 0 ? (
            <>
              <p className="font-gothic text-xs tracking-wider text-haze">「{query.trim()}」に近い職業</p>
              {hits.map((h) => row(h.value, h.why))}
            </>
          ) : (
            <p className="font-gothic text-xs leading-6 tracking-wider text-dim">見つかりませんでした。ことばを変えるか下の「五十音」や「分類」から探してください。</p>
          )}
        </div>
      )}

      {/* ③ 五十音の頭文字から探す(開いたり閉じたりできる) */}
      <div className="mt-5 border border-line bg-panel/50">
        <button type="button" onClick={() => setKanaOpen((o) => !o)} aria-expanded={kanaOpen} aria-controls="kana-panel" className="font-gothic flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm tracking-wider text-haze transition-colors hover:text-mist">
          <span>五十音から探す</span>
          <svg viewBox="0 0 12 8" className={`h-2 w-3 shrink-0 transition-transform ${kanaOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M1 1.5 6 6.5l5-5" />
          </svg>
        </button>
        {kanaOpen && (
          <div id="kana-panel" className="border-t border-line px-4 pb-4 pt-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="五十音の頭文字">
              {GYO.map((g) => (
                <button key={g.key} type="button" disabled={!counts[g.key]} onClick={() => { setGyo(gyo === g.key ? null : g.key); setQuery(""); }} aria-pressed={gyo === g.key} className={`h-10 w-10 border text-base transition-colors disabled:opacity-30 ${gyo === g.key ? "border-warm bg-warm/15 text-mist" : "border-line bg-panel/70 text-haze hover:border-haze hover:text-mist"}`}>
                  {g.label}
                </button>
              ))}
            </div>
            {gyo && (
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {byGyo.length ? byGyo.map((i) => row(i.value)) : <p className="font-gothic text-xs text-dim">この行の職業はありません。</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ④ 分類から選ぶ */}
      <div className="mt-5">
        <p className="font-gothic text-xs tracking-wider text-haze">分類から選ぶ</p>
        <div className="mt-2">
          <Dropdown ariaLabel={ariaLabel} value={value} onChange={onChange} searchable placeholder="分類から選ぶ・絞り込む" items={items} />
        </div>
      </div>

      {value && (
        <p className="font-gothic mt-4 text-center text-sm tracking-wider text-warm">
          選んだ職業: <span className="font-bold">{labelOf(value)}</span>
        </p>
      )}
    </div>
  );
}
