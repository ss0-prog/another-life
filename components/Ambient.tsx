"use client";

import { renderToStaticMarkup } from "react-dom/server.browser";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Phase, loadTimeOfDay, usePhase, useSkyAnimated, useTimeOfDay } from "@/lib/timeStore";
import { HORIZON_GLOW, skyPalette } from "@/components/skyPalette";
import { CROW_EVENT } from "@/lib/bgm";
import { createRng } from "@/lib/sim/rng";
import { setWeather, useWeather } from "@/lib/weatherStore";
import type { Weather } from "@/lib/sim/weather";

// 星・雨粒・雪などの位置は、レンダーごとに変わらないよう、決まった式から作る。
const spread = (count: number, seedMul: number) =>
  Array.from({ length: count }, (_, i) => ({
    left: (i * seedMul + (i % 7) * 3.1) % 100,
    top: (i * 31.3 + (i % 7) * 9) % 100,
    size: 1 + (i % 3) * 0.6,
    delay: (i % 9) * 0.37,
    duration: 0.7 + (i % 5) * 0.18,
    sway: 10 + (i % 4) * 8,
  }));

function Clouds({ dark, day }: { dark: boolean; day: boolean }) {
  const clouds = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ top: 4 + i * 11, w: 38 + (i % 3) * 14, dur: 70 + i * 17, delay: -i * 19 })), []);
  return (
    <>
      {clouds.map((c, i) => (
        <span
          key={i}
          className="cloud absolute rounded-full"
          style={{ top: `${c.top}%`, width: `${c.w}vw`, height: "18vh", animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s`, background: day ? (dark ? "radial-gradient(ellipse, rgba(70,78,92,0.7), rgba(70,78,92,0) 70%)" : "radial-gradient(ellipse, rgba(255,255,255,0.65), rgba(255,255,255,0) 70%)") : dark ? "radial-gradient(ellipse, rgba(60,66,80,0.55), rgba(60,66,80,0) 70%)" : "radial-gradient(ellipse, rgba(120,128,146,0.4), rgba(120,128,146,0) 70%)", filter: "blur(18px)" }}
        />
      ))}
    </>
  );
}

// 飛行機: たまに、空を横切る。昼は、飛行機雲だけ。夜は、本当に小さな光が、点滅しながら、ゆっくり移動する。
function Plane({ phase, weather }: { phase: Phase; weather: Weather }) {
  const visibleSky = weather === "clear" || weather === "cloudy";
  return (
    <>
      <div className="absolute inset-x-0 top-[28%] h-0" style={{ opacity: phase === "day" && visibleSky ? 1 : 0, transition: "opacity 4.5s ease" }}>
        <span className="contrail absolute left-0 top-0 block h-[2px] rounded-full" />
      </div>
      <div className="absolute inset-x-0 top-[34%] h-0" style={{ opacity: phase === "night" && visibleSky ? 1 : 0, transition: "opacity 4.5s ease" }}>
        <span className="plane-light absolute left-0 top-0 block h-0 w-0">
          <span className="plane-blink absolute block h-[2px] w-[2px] rounded-full bg-white" style={{ boxShadow: "0 0 3px 1px rgba(255,255,255,0.7)" }} />
          <span className="plane-blink-b absolute left-[7px] top-[1px] block h-[1.5px] w-[1.5px] rounded-full" style={{ background: "#ff5a5a" }} />
        </span>
      </div>
    </>
  );
}

// 雨: 一つぶずつ動かすと、たくさんの層ができて、昼夜の切り替えがカクつく。筋を描いた小さな絵(タイル)を、数まいだけ重ね、まいごとに、まっすぐ流す。
function rainTile(size: number, count: number, seed: number, alpha: number) {
  let t = seed;
  const rnd = () => {
    t = (t * 16807) % 2147483647;
    return t / 2147483647;
  };
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = 14 + rnd() * (size - 28);
    const y = rnd() * (size - 36);
    const len = 12 + rnd() * 18;
    lines.push(`<line x1='${x.toFixed(1)}' y1='${y.toFixed(1)}' x2='${x.toFixed(1)}' y2='${(y + len).toFixed(1)}'/>`);
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><g stroke='rgba(155,189,240,${alpha})' stroke-width='1' stroke-linecap='round'>${lines.join("")}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function Rain({ heavy }: { heavy: boolean }) {
  const layers = useMemo(
    () => [
      { size: 240, dur: 0.5, img: rainTile(240, heavy ? 9 : 6, 7, 0.55) },
      { size: 320, dur: 0.65, img: rainTile(320, heavy ? 11 : 7, 19, 0.45) },
      { size: 420, dur: 0.85, img: rainTile(420, heavy ? 13 : 8, 31, 0.35) },
    ],
    [heavy],
  );
  // 雨の筋は、タイルの中では、まっすぐ(縦)に描いて、そのまま、まっすぐ(縦)に流す。
  // 全体を、少し傾けて(約10度)見せるので、筋の向きと、落ちていく向きが、いつも、そろう。
  return (
    <span className="absolute left-[-25%] top-[-25%] h-[150%] w-[150%] overflow-hidden" style={{ transform: "rotate(10deg)" }}>
      {layers.map((l, i) => (
        <span key={i} className="rain-layer absolute left-0 w-full" style={{ top: -l.size, height: `calc(100% + ${l.size}px)`, backgroundImage: l.img, backgroundSize: `${l.size}px ${l.size}px`, ["--t" as string]: `${l.size}px`, animationDuration: `${l.dur}s` }} />
      ))}
    </span>
  );
}

function Snow() {
  const flakes = useMemo(() => spread(80, 29.3), []);
  return (
    <>
      {flakes.map((d, i) => (
        <span key={i} className="snow-flake absolute rounded-full bg-mist" style={{ left: `${d.left}%`, top: 0, width: d.size + 1, height: d.size + 1, animationDuration: `${6 + (i % 6) * 1.8}s`, animationDelay: `${-d.delay * 9}s`, ["--sway" as string]: `${d.sway}px` }} />
      ))}
    </>
  );
}

function Stars({ dim }: { dim: boolean }) {
  const stars = useMemo(() => spread(70, 53.7).map((s) => ({ ...s, top: s.top * 0.78 })), []);
  return (
    <>
      {stars.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-mist"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
          animate={{ opacity: dim ? [0.05, 0.25, 0.05] : [0.15, 0.85, 0.15] }}
          transition={{ duration: 4 + (i % 5) * 1.6, delay: (i % 9) * 0.9, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </>
  );
}

// ---- 街のシルエット: 高さの違うビルが二重に並び、夜は窓に灯りがともり、高いビルの屋上には赤いランプがまたたく ----
type Building = { x: number; w: number; h: number; antenna: number; windows: { x: number; y: number; lit: boolean; warm: boolean; flicker: boolean; delay: number }[]; beacon: boolean; delay: number; roof: 0 | 1 | 2 | 3; setback: boolean; sign: string | null; signY: number };

function makeCity(seed: number, minH: number, maxH: number, windowRate: number): Building[] {
  const rng = createRng(seed);
  const out: Building[] = [];
  let x = -20;
  while (x < 1640) {
    const w = 38 + rng() * 78;
    const h = minH + rng() * (maxH - minH);
    const tall = h > maxH * 0.78;
    const cols = Math.max(2, Math.floor((w - 10) / 12));
    const rows = Math.max(2, Math.floor((h - 16) / 17));
    const windows: Building["windows"] = [];
    // 灯りは、規則正しい格子にならないよう、1つずつ、ランダムに散らす(ついた窓は、位置も、少しずらす)。
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        const lit = rng() < 0.32;
        const jx = (rng() - 0.5) * 5;
        const jy = (rng() - 0.5) * 7;
        windows.push({ x: 7 + c * 12 + (lit ? jx : 0), y: 12 + r * 17 + (lit ? jy : 0), lit, warm: rng() < 0.72, flicker: rng() < 0.1, delay: rng() * 8 });
      }
    const roofPick = rng();
    const signColors = ["#ff6fa5", "#6fe3ff", "#ffd35a", "#9bff9b"];
    out.push({
      x, w, h,
      antenna: tall && rng() < 0.7 ? 18 + rng() * 34 : 0,
      windows,
      beacon: tall,
      delay: rng() * 3,
      // 屋上の設備(給水タンク・室外機・階段室)と、上の階が少しひっこんだ形、ネオンの看板
      roof: roofPick < 0.18 ? 1 : roofPick < 0.4 ? 2 : roofPick < 0.55 ? 3 : 0,
      setback: h > minH + (maxH - minH) * 0.55 && rng() < 0.55,
      sign: h > minH + (maxH - minH) * 0.25 && rng() < 0.16 ? signColors[Math.floor(rng() * signColors.length)] : null,
      signY: 20 + rng() * (h * 0.5),
    });
    x += w + (rng() < 0.25 ? 6 + rng() * 14 : 1 + rng() * 5);
  }
  return out;
}

function CityLayer({ buildings, color, base, night, near }: { buildings: Building[]; color: string; base: number; night: boolean; near?: boolean }) {
  const fillStyle = { fill: color, transition: "fill 5s ease" } as const;
  return (
    <g>
      {buildings.map((b, i) => {
        const top = base - b.h;
        return (
          <g key={i} transform={`translate(${b.x} ${top})`}>
            <rect width={b.w} height={b.h + 40} style={fillStyle} />
            {/* 上の階が、少しひっこんだ形 */}
            {b.setback && <rect x={b.w * 0.18} y={-b.h * 0.14} width={b.w * 0.64} height={b.h * 0.14 + 1} style={fillStyle} />}
            {/* 屋上の設備 */}
            {b.roof === 1 && (
              <g style={fillStyle}>
                <rect x={b.w * 0.3} y={-9} width={b.w * 0.26} height={9} />
                <rect x={b.w * 0.3 + 2} y={-12} width={b.w * 0.26 - 4} height={3} />
              </g>
            )}
            {b.roof === 2 && (
              <g style={fillStyle}>
                {[0.14, 0.4, 0.66].map((f) => (
                  <rect key={f} x={b.w * f} y={-5} width={b.w * 0.16} height={5} />
                ))}
              </g>
            )}
            {b.roof === 3 && <rect x={b.w * 0.55} y={-11} width={b.w * 0.22} height={11} style={fillStyle} />}
            {/* 光と影: 上は、ほんのり明るく、下に向かって、しずむ。左のふちに光、右のふちに影 */}
            <rect width={b.w} height={b.h + 40} fill="url(#bShade)" style={{ opacity: night ? 0.3 : 1, transition: "opacity 4.5s ease" }} />
            <rect width={1.4} height={b.h + 40} fill="#ffffff" opacity={night ? 0.06 : 0.16} />
            <rect x={b.w - 2} width={2} height={b.h + 40} fill="#000000" opacity={0.18} />
            {/* 階ごとの、うすい線 */}
            {near && (
              <g stroke="#000" strokeWidth={0.5} opacity={0.12}>
                {Array.from({ length: Math.floor(b.h / 17) }, (_, k) => (
                  <line key={k} x1={0} x2={b.w} y1={12 + k * 17 + 12} y2={12 + k * 17 + 12} />
                ))}
              </g>
            )}
            {/* 昼は、窓ガラスが、空と太陽を、うっすら映す */}
            <g style={{ opacity: night ? 0 : 1, transition: "opacity 4.5s ease" }}>
              {b.windows.filter((w, k) => k % 3 === 0 && !w.lit).map((w, k) => (
                <rect key={k} x={w.x} y={w.y} width={5} height={8} rx={0.6} fill="#ffffff" opacity={0.16} />
              ))}
            </g>
            {/* 夜の窓の灯り(光が、にじむ) */}
            <g style={{ opacity: night ? 1 : 0, transition: "opacity 4.5s ease" }} filter={near ? undefined : undefined}>
              {b.windows.map((w, k) =>
                w.lit ? (
                  <g key={k}>
                    <rect x={w.x - 1.5} y={w.y - 1.5} width={8} height={11} rx={2} fill={w.warm ? "#f6cf8c" : "#cfe0ff"} opacity={0.09} />
                    <rect x={w.x} y={w.y} width={5} height={8} rx={0.6} fill={w.warm ? "#f6cf8c" : "#cfe0ff"} opacity={0.55} className={w.flicker ? "win-flicker" : undefined} style={w.flicker ? { animationDelay: `${w.delay}s` } : undefined} />
                  </g>
                ) : null,
              )}
            </g>
            {/* ネオンの看板 */}
            {b.sign && (
              <g style={{ opacity: night ? 1 : 0, transition: "opacity 4.5s ease" }}>
                <rect x={b.w - 7} y={b.signY - 3} width={9} height={20} rx={3} fill={b.sign} opacity={0.18} />
                <rect x={b.w - 4} y={b.signY} width={3} height={14} rx={1} fill={b.sign} opacity={0.9} className="win-flicker" style={{ animationDelay: `${b.delay}s` }} />
              </g>
            )}
            {/* 高い建物の、屋上の四角の頂点(左上・右上)に、小さな赤いランプを、ゆっくり点滅させる */}
            {b.beacon && (
              <g style={{ opacity: night ? 1 : 0, transition: "opacity 4.5s ease" }}>
                {[2.5, b.w - 2.5].map((cx, k) => (
                  <g key={k}>
                    <circle cx={cx} cy={0.5} r={3} fill="#ff2d2d" opacity={0.22} className="beacon-slow" style={{ animationDelay: `${b.delay * 1.7 + k * 1.3}s` }} />
                    <circle cx={cx} cy={0.5} r={1.3} fill="#ff4545" className="beacon-slow" style={{ animationDelay: `${b.delay * 1.7 + k * 1.3}s` }} />
                  </g>
                ))}
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

// 東京タワー。昼は、赤と白に塗り分けた鉄骨が、うっすら見える。夜は、鉄骨のふちと、ふたつの展望台が、あたたかい白いあかりに照らされ、てっぺんの赤いランプが、ゆっくりまたたく。
function TokyoTower({ cx, base, color, night }: { cx: number; base: number; color: string; night: boolean }) {
  // 高さごとの、タワーの片側の幅(下が広く、上が細い)。
  const hw = (y: number) => (y > 190 ? 15 + ((y - 190) / (base - 190)) * 21 : y > 114 ? 6 + ((y - 114) / 76) * 9 : 1.2 + ((y - 56) / 58) * 4.8);
  const rungs = [base - 6, 262, 238, 214, 196, 170, 150, 132, 116, 96, 76];
  const edgeL = [[-36, base], [-15, 190], [-9, 150], [-6, 114], [-1.4, 62]];
  const edgeR = edgeL.map(([x, y]) => [-x, y]);
  const pts = (e: number[][]) => e.map(([x, y]) => `${x},${y}`).join(" ");
  const lightOn = { opacity: night ? 1 : 0, transition: "opacity 4.5s ease" } as const;
  return (
    <g transform={`translate(${cx} 0)`}>
      {/* 夜のあかりの、ぼんやりしたひろがり */}
      <ellipse cx={0} cy={165} rx={62} ry={132} fill="url(#towerHalo)" style={lightOn} />
      {/* シルエット */}
      <g style={{ fill: color, transition: "fill 5s ease" }}>
        <polygon points={`-36,${base} ${pts(edgeL.slice(1))} 0,54 ${pts(edgeR.slice(1).reverse())} 36,${base}`} />
        <rect x={-21} y={183} width={42} height={9} />
        <rect x={-11} y={107} width={22} height={7} />
        <rect x={-0.9} y={44} width={1.8} height={14} />
      </g>
      {/* 鉄骨の、はしご状の組みもの */}
      <g strokeWidth={0.7} style={{ stroke: night ? "#8a7a62" : "#f1ece4", opacity: night ? 0.55 : 0.45, transition: "stroke 4.5s ease, opacity 4.5s ease" }}>
        {rungs.slice(0, -1).map((y, i) => {
          const y2 = rungs[i + 1];
          return (
            <g key={y}>
              <line x1={-hw(y)} y1={y} x2={hw(y)} y2={y} />
              <line x1={-hw(y)} y1={y} x2={hw(y2)} y2={y2} />
              <line x1={hw(y)} y1={y} x2={-hw(y2)} y2={y2} />
            </g>
          );
        })}
      </g>
      {/* 夜のあかり: ふちを、あたたかい白で、にじませて光らせる */}
      <g style={lightOn}>
        <g filter="url(#towerBlur)" fill="none" stroke="#e8b878" strokeWidth={1.6} strokeLinecap="round" opacity={0.3}>
          <polyline points={pts(edgeL)} />
          <polyline points={pts(edgeR)} />
          <line x1={-22} y1={187} x2={22} y2={187} strokeWidth={2.6} stroke="#f0c690" />
          <line x1={-12} y1={110} x2={12} y2={110} strokeWidth={2.2} stroke="#f0c690" />
        </g>
        <g fill="none" stroke="#e9c48f" strokeWidth={0.6} strokeLinecap="round" opacity={0.6}>
          <polyline points={pts(edgeL)} />
          <polyline points={pts(edgeR)} />
          {rungs.slice(0, -1).map((y) => (
            <line key={y} x1={-hw(y)} y1={y} x2={hw(y)} y2={y} strokeWidth={0.45} opacity={0.6} />
          ))}
          <line x1={-20} y1={187} x2={20} y2={187} strokeWidth={1.1} stroke="#f2d3a6" />
          <line x1={-10} y1={110} x2={10} y2={110} strokeWidth={1} stroke="#f2d3a6" />
        </g>
        <circle cx={0} cy={44} r={6} fill="#ff2d2d" opacity={0.16} className="beacon" />
        <circle cx={0} cy={44} r={2.1} fill="#ff5a4d" className="beacon" />
      </g>
    </g>
  );
}

// 街のシルエットの色と、窓の灯り。朝焼け・夕焼けの空では、少し紫がかった色になる。
const CITY_COLORS: Record<Phase, { far: string; near: string; lit: boolean }> = {
  night: { far: "#080b11", near: "#040609", lit: true },
  dusk: { far: "#2a2540", near: "#1c1a30", lit: true },
  dawn: { far: "#2d2a46", near: "#1f1d34", lit: true },
  day: { far: "#8aa0b8", near: "#667d97", lit: false },
};

// タワーの足もとに、ぽつんと建つ、小さな建物(窓の灯りは、決まった並び)。
// 観覧車の手前に建つ、一つの建物(観覧車のうしろ側を、少しだけ隠す)。
const wheelFront: Building[] = (() => {
  const w = 54;
  const h = 112;
  const windows: Building["windows"] = [];
  for (let c = 0; c < 4; c++) for (let r = 0; r < 6; r++) windows.push({ x: 7 + c * 12, y: 12 + r * 17, lit: (c * 3 + r) % 4 !== 0, warm: (c + r) % 3 !== 0, flicker: c === 2 && r === 3, delay: 0.9 });
  return [{ x: 566, w, h, antenna: 0, windows, beacon: false, delay: 0, roof: 2, setback: false, sign: null, signY: 0 }];
})();

const frontBuilding: Building[] = (() => {
  const make = (x: number, w: number, h: number, cols: number, rows: number, roof: 0 | 1 | 2 | 3, sign: string | null, shift: number): Building => {
    const windows: Building["windows"] = [];
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) windows.push({ x: 8 + c * 12, y: 8 + r * 17, lit: (c + r + shift) % 3 !== 1, warm: (c + shift) % 4 !== 3, flicker: c === 1 && r === 0, delay: 1.3 + shift * 0.4 });
    return { x, w, h, antenna: 0, windows, beacon: false, delay: 0, roof, setback: false, sign, signY: 14 };
  };
  // タワーの足もとの、低い建物(3つ)
  return [make(897, 46, 44, 3, 2, 2, "#ffd35a", 0), make(858, 60, 104, 4, 4, 3, null, 1), make(922, 62, 92, 4, 3, 1, "#ff9fb6", 2)];
})();

// 観覧車: ゆっくり回る。ゴンドラは、いつも下を向く。夜は、縁のランプが、色を変えながら、きらめく。
function FerrisWheel({ cx, base, night }: { cx: number; base: number; night: boolean }) {
  const R = 64;
  const cy = base - 86;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const gondolas = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);
  const lampColors = ["#ff7ab0", "#7ad7ff", "#ffd36a", "#a6ff9e", "#c59bff"];
  const frame = night ? "#4a5070" : "#546b86";
  return (
    <g transform={`translate(${cx} ${cy})`} aria-hidden>
      {/* 支柱(A字) */}
      <g stroke={frame} strokeWidth={2.4} strokeLinecap="round" style={{ transition: "stroke 4.5s ease" }}>
        <line x1={0} y1={0} x2={-30} y2={base - cy} />
        <line x1={0} y1={0} x2={30} y2={base - cy} />
        <line x1={-20} y1={(base - cy) * 0.66} x2={20} y2={(base - cy) * 0.66} strokeWidth={1.2} />
      </g>
      {/* 回る輪 */}
      <g className="ferris">
        <g stroke={frame} fill="none" style={{ transition: "stroke 4.5s ease" }}>
          <circle r={R} strokeWidth={2.2} />
          <circle r={R * 0.62} strokeWidth={1.1} />
          {gondolas.map((a, i) => (
            <line key={i} x1={0} y1={0} x2={r2(Math.cos(a) * R)} y2={r2(Math.sin(a) * R)} strokeWidth={1.1} />
          ))}
        </g>
        {/* 縁のランプ(夜) */}
        <g style={{ opacity: night ? 1 : 0, transition: "opacity 4.5s ease" }}>
          {Array.from({ length: 36 }, (_, i) => {
            const a = (i / 36) * Math.PI * 2;
            return <circle key={i} cx={r2(Math.cos(a) * R)} cy={r2(Math.sin(a) * R)} r={1.2} fill={lampColors[i % lampColors.length]} className="win-flicker" style={{ animationDelay: `${(i % 7) * 0.7}s` }} />;
          })}
        </g>
        {/* ゴンドラ(回っても、下を向く) */}
        {gondolas.map((a, i) => (
          <g key={i} transform={`translate(${r2(Math.cos(a) * R)} ${r2(Math.sin(a) * R)})`}>
            <g className="ferris-gondola">
              <rect x={-3.4} y={0.6} width={6.8} height={6.2} rx={1.2} fill={night ? "#ffd9a0" : ["#ff9fb6", "#9fd4ff", "#ffe08a", "#b7f0b0"][i % 4]} opacity={night ? 0.9 : 0.95} style={{ transition: "fill 4.5s ease" }} />
            </g>
          </g>
        ))}
        <circle r={3.2} fill={frame} style={{ transition: "fill 4.5s ease" }} />
      </g>
    </g>
  );
}

function SkylineSvg({ phase, mode = "all" }: { phase: Phase; mode?: "all" | "city" | "glow" }) {
  const far = useMemo(() => makeCity(11, 50, 130, 0.22), []);
  const near = useMemo(() => makeCity(23, 70, 200, 0.3), []);
  const c = CITY_COLORS[phase];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="270" viewBox="0 0 1600 270" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <radialGradient id="towerHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd9a0" stopOpacity="0.14" />
          <stop offset="60%" stopColor="#ffb870" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#ffb870" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>
        <radialGradient id="cityGlow" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#ffb86b" stopOpacity="0.38" />
          <stop offset="55%" stopColor="#ff8f5a" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ff8f5a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="groundHaze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fb2d8" stopOpacity="0" />
          <stop offset="100%" stopColor="#8fb2d8" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="nightHaze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a4a7a" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffb070" stopOpacity="0.1" />
        </linearGradient>
        <filter id="towerBlur" x="-50%" y="-10%" width="200%" height="120%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      {/* 街あかりが、空を、ほんのり染める */}
      {mode !== "city" && <ellipse cx={800} cy={285} rx={980} ry={150} fill="url(#cityGlow)" style={{ opacity: c.lit ? 1 : 0 }} />}
      {mode === "glow" ? (
        <rect x={0} y={150} width={1600} height={130} fill="url(#nightHaze)" />
      ) : (
      <>
      <CityLayer buildings={far} color={c.far} base={270} night={c.lit} />
      {/* 高架を走る電車 */}
      <g aria-hidden>
        <rect x={0} y={236} width={1600} height={2.4} style={{ fill: c.far, transition: "fill 5s ease" }} />
        <g className="train" style={{ opacity: 0.95 }}>
          {Array.from({ length: 5 }, (_, k) => (
            <g key={k} transform={`translate(${k * 31} 0)`}>
              <rect x={0} y={226} width={29} height={10} rx={2.2} fill={c.lit ? "#3a3f52" : "#e8edf3"} />
              <rect x={0} y={232} width={29} height={1.6} fill={c.lit ? "#f6cf8c" : "#4a86c8"} opacity={c.lit ? 0.35 : 0.9} />
              {[3, 10, 17, 24].map((wx) => (
                <rect key={wx} x={wx} y={228} width={3.6} height={3.4} rx={0.6} fill={c.lit ? "#ffe9b0" : "#8fb4d8"} opacity={c.lit ? 0.95 : 0.8} />
              ))}
            </g>
          ))}
        </g>
      </g>
      <CityLayer buildings={near} color={c.near} base={290} night={c.lit} near />
      <FerrisWheel cx={560} base={290} night={c.lit} />
      {/* 観覧車の右下を、少しだけ隠す建物 */}
      <CityLayer buildings={wheelFront} color={c.near} base={290} night={c.lit} near />
      <TokyoTower cx={920} base={290} color={c.near} night={c.lit} />
      {/* タワーの前に、ひとつ、小さな建物 */}
      <CityLayer buildings={frontBuilding} color={c.near} base={290} night={c.lit} near />
      {/* 地平線の、かすみ(昼は青白く、夜は、街あかりで、ほんのりオレンジ) */}
      {mode !== "city" && <rect x={0} y={150} width={1600} height={130} fill="url(#groundHaze)" style={{ opacity: c.lit ? 0 : 1 }} />}
      {mode !== "city" && <rect x={0} y={150} width={1600} height={130} fill="url(#nightHaze)" style={{ opacity: c.lit ? 1 : 0 }} />}
      </>
      )}
    </svg>
  );
}

// 街の絵は、ふつうの画像(img)として表示する。ページの色の変数が、昼夜の切り替えで、毎フレーム変わっても、画像の中の何千もの要素は、スタイルの再計算を受けない。
const SVG_CSS = `@keyframes beacon{0%,100%{opacity:1}50%{opacity:.12}}.beacon{animation:beacon 2.4s ease-in-out infinite}@keyframes win-flicker{0%,100%{opacity:.55}45%{opacity:.2}60%{opacity:.6}}.win-flicker{animation:win-flicker 7s ease-in-out infinite}@keyframes train-run{from{transform:translateX(-200px)}to{transform:translateX(1700px)}}.train{animation:train-run 46s linear infinite}@keyframes beacon-slow{0%,100%{opacity:1}50%{opacity:.1}}.beacon-slow{animation:beacon-slow 5.5s ease-in-out infinite}@keyframes ferris-turn{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes ferris-counter{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}.ferris{transform-box:view-box;transform-origin:0 0;animation:ferris-turn 140s linear infinite}.ferris-gondola{transform-box:view-box;transform-origin:0 0;animation:ferris-counter 140s linear infinite}@media (prefers-reduced-motion:reduce){.beacon,.win-flicker,.train,.beacon-slow,.ferris,.ferris-gondola{animation:none}}`;
function skylineUri(phase: Phase, mode: "all" | "city" | "glow") {
  const svg = renderToStaticMarkup(<SkylineSvg phase={phase} mode={mode} />).replace(/^(<svg[^>]*>)/, `$1<style>${SVG_CSS}</style>`);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
function SkylineImg({ phase, mode }: { phase: Phase; mode: "all" | "city" | "glow" }) {
  const uri = useMemo(() => skylineUri(phase, mode), [phase, mode]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={uri} alt="" className="absolute inset-0 h-full w-full" draggable={false} />;
}

// 街: 夜・夕方(朝)・昼の3まいを重ね、まいごとの透明度だけを、ゆっくり入れ替える。
// (SVGの中の色や透明度を、一つずつ動かすと、毎フレーム、街ぜんたいを描きなおすことになり、画面がちらつく。まいごと入れ替えるなら、描きなおしは、いらない)
// 画面の左はしに立つ、大きなビル。画面の幅が変わっても、いつも、左はしに、そのまま、置く。
// (街の絵は、画面が細いと、左右が切れるので、別にして、描く。)
const EDGE_WINDOWS = (() => {
  const rng = createRng(4242);
  const out: { x: number; y: number; lit: boolean; warm: boolean }[] = [];
  for (let c = 0; c < 5; c++)
    for (let r = 0; r < 17; r++) {
      const lit = rng() < 0.34;
      const jx = (rng() - 0.5) * 4;
      const jy = (rng() - 0.5) * 5;
      out.push({ x: 12 + c * 15 + (lit ? jx : 0), y: 56 + r * 14 + (lit ? jy : 0), lit, warm: rng() < 0.72 });
    }
  return out;
})();

function EdgeBuilding({ phase }: { phase: Phase }) {
  const c = CITY_COLORS[phase];
  return (
    <svg viewBox="0 -14 100 314" preserveAspectRatio="xMinYMax meet" className="absolute bottom-0 left-0 h-[84%] w-auto max-sm:-translate-x-[38%]" aria-hidden>
      <defs>
        <linearGradient id={`edgeShade-${phase}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      {/* 本体と、上の階が、ひっこんだ部分 */}
      <rect x={0} y={44} width={92} height={260} fill={c.near} />
      <rect x={10} y={22} width={64} height={26} fill={c.near} />
      <rect x={26} y={8} width={30} height={16} fill={c.near} />
      {/* アンテナと、赤いランプ */}
      <rect x={40} y={-6} width={2} height={16} fill={c.near} />
      <g style={{ opacity: c.lit ? 1 : 0 }}>
        <circle cx={41} cy={-8} r={3.4} fill="#ff4545" className="beacon-slow" />
      </g>
      {/* 光と影 */}
      <rect x={0} y={44} width={92} height={260} fill={`url(#edgeShade-${phase})`} opacity={c.lit ? 0.3 : 1} />
      <rect x={0} y={44} width={1.6} height={260} fill="#ffffff" opacity={c.lit ? 0.06 : 0.16} />
      <rect x={88} y={44} width={4} height={260} fill="#000000" opacity={0.18} />
      {/* 窓: 夜は、灯りが、ランダムに散らばる。昼は、ガラスが、空を、うっすら映す */}
      {EDGE_WINDOWS.map((w, i) =>
        c.lit ? (
          w.lit && (
            <g key={i}>
              <rect x={w.x - 1.4} y={w.y - 1.4} width={8.8} height={11.8} rx={2} fill={w.warm ? "#f6cf8c" : "#cfe0ff"} opacity={0.09} />
              <rect x={w.x} y={w.y} width={6} height={9} rx={0.8} fill={w.warm ? "#f6cf8c" : "#cfe0ff"} opacity={0.55} />
            </g>
          )
        ) : (
          i % 3 === 0 && <rect key={i} x={w.x} y={w.y} width={6} height={9} rx={0.8} fill="#ffffff" opacity={0.18} />
        ),
      )}
    </svg>
  );
}

function Skyline({ phase }: { phase: Phase }) {
  const layer = (p: Phase, on: boolean) => ({ opacity: on ? 1 : 0, transition: "opacity 5s ease-in-out", willChange: "opacity" as const, ...(p ? {} : {}) });
  return (
    <div className="absolute inset-x-0 bottom-0 h-[30vh] min-h-44 w-full">
      <div className="absolute inset-0" style={layer("night", phase !== "day")}><SkylineImg phase="night" mode="glow" /></div>
      {/* 夜の街は、昼のあいだは、見えなくする(昼の街の屋上から、夜の赤いランプが、はみ出して、見えてしまうため)。ほかの層と同じ時間で、ゆっくり入れ替える(灯りが、急に消えたり、点いたりしないように) */}
      <div className="absolute inset-0" style={{ opacity: phase === "night" || phase === "dawn" ? 1 : 0, transition: "opacity 5s ease-in-out" }}><SkylineImg phase="night" mode="city" /><EdgeBuilding phase="night" /></div>
      <div className="absolute inset-0" style={layer("dusk", phase === "dusk" || phase === "dawn")}><SkylineImg phase="dusk" mode="all" /><EdgeBuilding phase="dusk" /></div>
      <div className="absolute inset-0" style={layer("day", phase === "day")}><SkylineImg phase="day" mode="all" /><EdgeBuilding phase="day" /></div>
    </div>
  );
}

// 月: 晴れた夜は、くっきりと。曇りの夜は、雲のむこうに、ぼんやりと。
// 太陽と月の動き(実際の天体の動きに近いもの)。
// 一日(時刻)を連続して進め、太陽は、6時に左(東)の地平線から昇り、12時に最も高くなり、18時に右(西)の地平線へ沈む。
// 月は、満月として、太陽と、ちょうど反対に動く(18時に昇り、0時に最も高くなり、6時に沈む)。
// 昼の定位置は10時ごろ、夜の定位置は午前2時ごろ。ボタンで切り替えると、時刻が、実際に進んで、日の入り(日の出)を通る。
const Y_EDGE = 66; // 画面のはし(出入りするところ)の高さ(%)
const ZENITH = 8; // いちばん高いときの高さ(%)
const A_IN = 0.07; // 画面の左はしに来るときの、弧の進み具合
const A_OUT = 0.93; // 画面の右はしを出るときの、弧の進み具合
const REST_T = { day: 10, evening: 18, night: 26 }; // 26 = 翌日の午前2時

// 時刻(0〜24+)から、天体の位置(%)・見えるか・高さ(0〜1)を求める。
// 画面の左はしから出て、弧を描いて、右はしへ出ていく。画面の外では、見えない。
function bodyAt(hour: number): { x: number; y: number; o: number; e: number } {
  const a = ((((hour - 6) % 24) + 24) % 24) / 12;
  // 見えないあいだに、反対側へ回りこませておく(アニメーションの途中で、画面を横切って見えてしまわないように)
  if (a > 1) return { x: a < 1.5 ? 108 : -8, y: Y_EDGE, o: 0, e: 0 };
  const e = Math.sin(Math.PI * a);
  return { x: ((a - A_IN) / (A_OUT - A_IN)) * 100, y: Y_EDGE - (Y_EDGE - ZENITH) * e, o: 1, e };
}

// 最後の0.6秒で、ゆっくり減速して、止まる(10秒のうち、最後の6%)。
const P0 = 0.94;
const slowEnd = (p: number) => (p < P0 ? p : P0 + (p - P0) - ((p - P0) * (p - P0)) / (2 * (1 - P0))) / (P0 + (1 - P0) / 2);

function Celestial({ phase, tod, animate, dimMoon }: { phase: Phase; tod: "day" | "evening" | "night"; animate: boolean; dimMoon: boolean }) {
  const sunRef = useRef<HTMLDivElement>(null);
  const moonRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef(REST_T[tod] % 24); // いまの時刻
  const dimRef = useRef(dimMoon);
  dimRef.current = dimMoon;
  const lastOp = useRef([1, 0, 0]);
  const warmRef = useRef<SVGCircleElement>(null);
  const sunL = useRef<HTMLSpanElement[]>([]); // 太陽の3つの色の層: 昼(白に近い)・夕(黄〜だいだい)・沈みかけ(赤みのだいだい)
  const place = (hour: number) => {
    const sun = bodyAt(hour);
    const moon = bodyAt(hour + 12);
    const sEl = sunRef.current;
    const mEl = moonRef.current;
    if (sEl) {
      // 高さ(0=地平線、1=いちばん高い)で、色の層を、なめらかに入れかえる。オレンジになるのは、沈みかけてから。
      const e = sun.e;
      const pale = Math.min(1, Math.max(0, (e - 0.25) / 0.3));
      const red = Math.min(1, Math.max(0, (0.25 - e) / 0.25));
      const amber = Math.max(0, 1 - pale - red);
      const [lp, la, lr] = sunL.current;
      // 色の層は、描きなおしが重い。見た目に、ほとんど差が出ない、わずかな変化では、書きかえない
      const last = lastOp.current;
      const upd = (el: HTMLSpanElement | undefined, v: number, k: number) => {
        if (!el) return;
        if (Math.abs(v - last[k]) >= 0.05 || ((v === 0 || v === 1) && v !== last[k])) {
          last[k] = v;
          el.style.opacity = String(v);
        }
      };
      upd(lp, pale, 0);
      upd(la, amber, 1);
      upd(lr, red, 2);
      sEl.style.transform = `translate3d(${sun.x}vw, ${sun.y}vh, 0)`;
      sEl.style.opacity = String(sun.o);
    }
    if (mEl) {
      const e = moon.e;
      const warm = Math.min(1, Math.max(0, (0.3 - e) / 0.3)); // 低いときだけ、月も、ほんのり、あたたかい色
      if (warmRef.current) warmRef.current.style.opacity = String(Math.round(warm * 20) / 20);
      mEl.style.transform = `translate3d(${moon.x}vw, ${moon.y}vh, 0)`;
      mEl.style.opacity = String(moon.o * (dimRef.current ? 0.35 : 1));
    }
  };
  useEffect(() => {
    const target = REST_T[tod];
    // 切り替えは、いつも、時刻を前へ進める(昼→夜は、日没を通り、夜→昼は、日の出を通る)。
    const from = hourRef.current % 24;
    let to = target;
    while (to <= from) to += 24;
    if (!animate || Math.abs(from - (target % 24)) < 0.01) {
      hourRef.current = target % 24;
      place(target);
      return;
    }
    const D = 10000;
    const t0 = performance.now();
    const hourAt = (p: number) => from + (to - from) * slowEnd(Math.min(1, Math.max(0, p)));
    // 太陽と月の動きは、毎フレーム書きかえずに、あらかじめ、細かく計算して、ブラウザのアニメーションにまかせる(画面がカクつかない)
    const N = 120;
    const sunKF: Keyframe[] = [];
    const layerKF: Keyframe[][] = [[], [], []];
    const moonKF: Keyframe[] = [];
    const warmKF: Keyframe[] = [];
    for (let i = 0; i <= N; i++) {
      const offset = i / N;
      const h = hourAt(offset);
      const sun = bodyAt(h);
      const moon = bodyAt(h + 12);
      sunKF.push({ offset, transform: `translate3d(${sun.x}vw, ${sun.y}vh, 0)`, opacity: sun.o });
      const e = sun.e;
      const pale = Math.min(1, Math.max(0, (e - 0.25) / 0.3));
      const red = Math.min(1, Math.max(0, (0.25 - e) / 0.25));
      [pale, Math.max(0, 1 - pale - red), red].forEach((v, k) => layerKF[k].push({ offset, opacity: v }));
      warmKF.push({ offset, opacity: Math.min(1, Math.max(0, (0.3 - moon.e) / 0.3)) });
      moonKF.push({ offset, transform: `translate3d(${moon.x}vw, ${moon.y}vh, 0)`, opacity: moon.o * (dimRef.current ? 0.35 : 1) });
    }
    const opts: KeyframeAnimationOptions = { duration: D, easing: "linear", fill: "forwards" };
    const sEl = sunRef.current;
    const mEl = moonRef.current;
    const anims: Animation[] = [];
    if (sEl) anims.push(sEl.animate(sunKF, opts));
    sunL.current.forEach((el, k) => el && anims.push(el.animate(layerKF[k], opts)));
    if (mEl) anims.push(mEl.animate(moonKF, opts));
    if (warmRef.current) anims.push(warmRef.current.animate(warmKF, opts));
    const settle = (h: number) => {
      anims.forEach((an) => an.cancel());
      lastOp.current = [-1, -1, -1];
      hourRef.current = h % 24;
      place(h);
    };
    const main = anims[0];
    if (main) main.onfinish = () => settle(to);
    return () => {
      if (!main || main.playState === "finished") return;
      settle(hourAt((performance.now() - t0) / D));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tod, animate]);
  useEffect(() => place(hourRef.current), [dimMoon]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div ref={sunRef} className="absolute left-0 top-0 will-change-transform" style={{ opacity: 0 }}>
        <div className="relative -translate-x-1/2 -translate-y-1/2">
          {[
            ["rgba(255,252,236,1)", "rgba(255,246,214,0.9)"],
            ["rgba(255,240,190,0.95)", "rgba(255,214,140,0.62)"],
            ["rgba(255,214,160,0.9)", "rgba(255,150,90,0.42)"],
          ].map(([core, glow], k) => (
            <span
              key={k}
              ref={(el) => {
                if (el) sunL.current[k] = el;
              }}
              className={`block h-[34vmin] w-[34vmin] rounded-full ${k === 0 ? "" : "absolute inset-0"}`}
              style={{ background: k === 0 ? `radial-gradient(circle, ${core} 0%, ${core} 16%, ${glow} 22%, rgba(255,226,150,0.35) 40%, rgba(255,226,150,0) 70%)` : `radial-gradient(circle, ${core} 0%, ${core} 10%, ${glow} 20%, rgba(255,200,140,0.22) 38%, rgba(255,190,130,0.08) 56%, rgba(255,190,130,0) 74%)`, opacity: k === 0 ? 1 : 0 }}
            />
          ))}
        </div>
      </div>
      <div ref={moonRef} className="absolute left-0 top-0 will-change-transform" style={{ opacity: 0 }}>
        <div className="relative -translate-x-1/2 -translate-y-1/2">
        <div className="absolute -inset-[7vmin] rounded-full" style={{ background: "radial-gradient(circle, rgba(220,230,255,0.28) 0%, rgba(220,230,255,0.08) 45%, rgba(220,230,255,0) 70%)" }} />
        <svg viewBox="0 0 100 100" className="relative h-[9vmin] w-[9vmin] min-h-14 min-w-14">
          <circle cx="50" cy="50" r="46" fill="#f3eedd" />
          <circle ref={warmRef} cx="50" cy="50" r="46" fill="rgb(255,200,131)" style={{ opacity: 0 }} />
        </svg>
        </div>
      </div>
    </>
  );
}

// 背景: 空模様(晴れ・曇り・雨・雪・雷)に応じて、夜空が移り変わる。足もとには、細かく描いた街。
const FADE = { transition: "opacity 4.8s ease-in-out" } as const;

// 太陽: 朝焼けでは地平線から昇り、昼は空高く、夕焼けでは地平線へ沈んでいく。
const SUN_CORE: Record<Phase, string> = {
  night: "rgba(255,240,200,0)",
  dawn: "rgba(255,226,170,1)",
  day: "rgba(255,252,232,1)",
  dusk: "rgba(255,196,130,1)",
};
const SUN_COLOR: Record<Phase, string> = {
  night: "rgba(255,200,140,0)",
  dawn: "rgba(255,190,120,0.95)",
  day: "rgba(255,240,170,1)",
  dusk: "rgba(255,150,90,0.95)",
};

// 流れ星: 晴れた夜に、ごくたまに(ゲームの時間で、5〜8年に一度ほど。等倍で、1分〜1分半に一度)、ひとつか、ふたつ流れる。
function ShootingStars({ active }: { active: boolean }) {
  const [shots, setShots] = useState<{ id: number; left: number; top: number; delay: number; len: number }[]>([]);
  const shownFirst = useRef(false);
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    let n = 0;
    // サイトに入って、夜の空が見えたら、まず、ひとつ、流れ星を流す。
    let first: ReturnType<typeof setTimeout> | undefined;
    if (!shownFirst.current) {
      first = setTimeout(() => {
        shownFirst.current = true;
        setShots([{ id: ++n + 1000, left: 25 + Math.random() * 35, top: 8 + Math.random() * 18, delay: 0, len: 130 }]);
        setTimeout(() => setShots([]), 3500);
      }, 1200);
    }
    const schedule = () => {
      const wait = (5 + Math.random() * 3) * 12000;
      timer = setTimeout(() => {
        const count = Math.random() < 0.35 ? 2 : 1;
        const batch = Array.from({ length: count }, (_, i) => ({ id: ++n, left: 15 + Math.random() * 60, top: 4 + Math.random() * 28, delay: i * 0.7, len: 90 + Math.random() * 70 }));
        setShots(batch);
        setTimeout(() => setShots([]), 3500);
        schedule();
      }, wait);
    };
    schedule();
    return () => {
      clearTimeout(timer);
      if (first) clearTimeout(first);
    };
  }, [active]);
  return (
    <>
      {shots.map((s) => (
        <span key={s.id} className="meteor absolute" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.len, animationDelay: `${s.delay}s` }} />
      ))}
    </>
  );
}

// カラス: 夕方の晴れた空に、ときどき、三羽が連れだって、画面のはしから、羽ばたきながら、建物の頂上より少し下を、水平に飛んでいく。
// 飛びはじめたことを、BGM(lib/bgm.ts)に知らせると、数秒あとに、鳴き声が聞こえる(広い画面では二回)。
const WIDE = 1024; // この幅以上は、PC(飛ぶのに時間がかかるので、ゆっくり飛ばす)
const FLOCK = [
  { dx: 0, dy: 0, delay: 0, bob: 0 },
  { dx: -24, dy: 7, delay: -0.13, bob: -0.5 },
  { dx: -13, dy: -8, delay: -0.27, bob: -1.1 },
];
function Crow({ active }: { active: boolean }) {
  const [flight, setFlight] = useState<{ id: number; dir: 1 | -1; top: number; sec: number } | null>(null);
  useEffect(() => {
    if (!active) {
      setFlight(null);
      return;
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let n = 0;
    let next: ReturnType<typeof setTimeout>;
    let hide: ReturnType<typeof setTimeout>;
    const fly = () => {
      const sec = window.innerWidth >= WIDE ? 22 : 16;
      if (!still) {
        setFlight({ id: ++n, dir: Math.random() < 0.5 ? 1 : -1, top: 81 + Math.random() * 5, sec });
        hide = setTimeout(() => setFlight(null), (sec + 0.5) * 1000);
      }
      window.dispatchEvent(new Event(CROW_EVENT));
      next = setTimeout(fly, (sec + 10 + Math.random() * 25) * 1000); // 前の飛行が終わってから、10〜35秒あく
    };
    next = setTimeout(fly, 5000);
    return () => {
      clearTimeout(next);
      clearTimeout(hide);
      setFlight(null);
    };
  }, [active]);
  if (!flight) return null;
  return (
    <div key={flight.id} className={flight.dir === 1 ? "crow-pass-r" : "crow-pass-l"} style={{ top: `${flight.top}vh`, animationDuration: `${flight.sec}s` }}>
      {FLOCK.map((c, i) => (
        <div key={i} className="crow-bob absolute" style={{ left: c.dx * flight.dir, top: c.dy, animationDelay: `${c.bob}s` }}>
          {/* ごく簡単な形: 小さな胴体と、羽ばたく二枚の羽 */}
          <svg viewBox="0 0 20 12" width={14} height={8.4} style={{ transform: flight.dir === 1 ? undefined : "scaleX(-1)", display: "block" }} aria-hidden>
            <g fill="#0b0910" opacity={0.9}>
              <ellipse cx={10} cy={7} rx={5} ry={2} />
              <circle cx={15.2} cy={6.3} r={1.5} />
              <path className="crow-wing" style={{ animationDelay: `${c.delay}s` }} d="M10 6.5 C9 2, 6 0.5, 3 1 C5.5 3, 7.5 5, 10 7.5 Z" />
            </g>
          </svg>
        </div>
      ))}
    </div>
  );
}

// 背景: 空模様(晴れ・曇り・雨・雪・雷)に応じて、空が移り変わる。足もとには、細かく描いた街。
export function Ambient() {
  // 前回の昼・夜を読みこむまで、空は、出さない(最初から、暗い夜空が見えてしまわないように)。
  const [ready, setReady] = useState(false);
  // 空の色の移り変わりは、最初の表示が落ち着いてから、はじめる(読みこみ直後に、夜から昼へ、勝手に動いて見えないように)。
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    loadTimeOfDay();
    setReady(true);
    const t = window.setTimeout(() => setArmed(true), 900);
    return () => window.clearTimeout(t);
  }, []);
  const weather = useWeather();
  const phase = usePhase();
  const animateSky = useSkyAnimated();
  const target = useTimeOfDay();
  const day = phase === "day";
  const sky = skyPalette(weather, phase);
  const nightish = phase === "night" || phase === "dusk";
  const clearish = weather === "clear" || weather === "cloudy";
  // 見た目の確認用: ?weather=rain のように、空模様を指定できる(clear / cloudy / rain / snow / thunder)。
  useEffect(() => {
    const w = new URLSearchParams(window.location.search).get("weather");
    if (w === "clear" || w === "cloudy" || w === "rain" || w === "snow" || w === "thunder") setWeather(w);
  }, []);
  // 空模様を、html に伝える(雨・雪・雷のときは、月が見えないので、文字の自動コントラストを止める。動く雨のうしろで、文字の色が、毎フレーム変わって、ちらつくため)。
  useEffect(() => {
    document.documentElement.dataset.weather = weather;
  }, [weather]);
  return (
    <div aria-hidden className="ambient-root pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ opacity: ready ? 1 : 0 }}>
      {/* 空の色: 4つの色(上から下へ)を、色の変数として、ゆっくり動かし、色そのものを、移り変わらせる(夜 → 朝焼け → 昼、昼 → 夕焼け、夕焼け → 夜) */}
      <div
        className="absolute inset-0"
        style={
          {
            "--sk0": sky[0],
            "--sk1": sky[1],
            "--sk2": sky[2],
            "--sk3": sky[3],
            background: "linear-gradient(180deg, var(--sk0) 0%, var(--sk1) 34%, var(--sk2) 68%, var(--sk3) 100%)",
            transition: armed ? "--sk0 5s ease-in-out, --sk1 5s ease-in-out, --sk2 5s ease-in-out, --sk3 5s ease-in-out" : "none",
          } as React.CSSProperties
        }
      />
      {/* 地平線の、あたたかい光: 朝焼けと夕焼けのときだけ、うかび、昼や夜では、ゆっくり消える */}
      <div
        className="absolute inset-x-0 bottom-0 h-[70%]"
        style={{
          background: "radial-gradient(ellipse 85% 75% at 50% 100%, rgba(255,176,105,0.9) 0%, rgba(255,150,100,0.35) 38%, rgba(255,150,100,0) 72%)",
          opacity: phase === "dawn" || phase === "dusk" ? HORIZON_GLOW[weather] : 0,
          transition: armed ? "opacity 5s ease-in-out" : "none",
        }}
      />

      <AnimatePresence>
        <motion.div key={weather} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 3 }}>
          {clearish && (
            <div className="absolute inset-0" style={{ opacity: nightish ? (phase === "dusk" ? 0.3 : 1) : 0, transition: `opacity 4s ease-in-out ${nightish ? "0s" : "1s"}` }}>
              <Stars dim={weather === "cloudy"} />
            </div>
          )}
          {clearish && <Celestial phase={phase} tod={target} animate={animateSky} dimMoon={weather === "cloudy"} />}
          <ShootingStars active={phase === "night" && weather === "clear"} />
          {(weather === "cloudy" || weather === "rain" || weather === "thunder" || weather === "clear") && (
            // 晴れの昼に、雲が、うっすらと、時間をかけて、あらわれる(夜は、見えない)
            <div className="absolute inset-0" style={{ opacity: weather === "clear" ? (day ? 1 : 0) : 1, transition: `opacity ${weather === "clear" && !day ? "9s" : "7s"} ease-in-out ${weather === "clear" && day ? "2s" : "0s"}` }}>
              <Clouds dark={weather !== "cloudy" && weather !== "clear"} day={weather === "clear" ? true : day} />
            </div>
          )}
          <Plane phase={phase} weather={weather} />
          {weather === "rain" && <Rain heavy={false} />}
          {weather === "thunder" && (
            <>
              <Rain heavy />
              <span className="lightning absolute inset-0" />
            </>
          )}
          {weather === "snow" && <Snow />}
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0" style={{ background: weather === "clear" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.22)", opacity: day ? 1 : 0, transition: "opacity 4.8s ease-in-out" }} />

      <Skyline phase={phase} />
      <Crow active={phase === "dusk" && weather === "clear"} />
    </div>
  );
}
