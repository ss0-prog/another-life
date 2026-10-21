"use client";

import { FAR_ISLANDS, INSET, INSET_FAR, OKINAWA, VIEW, project, projectFar, projectSouth, resolvePlace } from "@/lib/geo/japan";
import { MAIN_SHAPES, NORTHERN_TERRITORIES, SOUTH_SHAPES } from "@/lib/geo/japanShapes";

type Home = { age: number; place: string };

type Stop = { age: number; place: string; short: string; xy: [number, number] | null };

const OKI_XY: [number, number] = projectSouth(OKINAWA);
// 海外で暮らした、の札: 地図の左上(日本海がある側)。
const OVERSEAS_BOX = { x: 8, y: 10, w: 136 };

// 海岸線の数字の並びを、SVGの線にする(最初に、一度だけ作る)
const toPath = (flat: number[], proj: (ll: [number, number]) => [number, number]) => {
  let d = "";
  for (let i = 0; i < flat.length; i += 2) {
    const [x, y] = proj([flat[i], flat[i + 1]]);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d}Z`;
};
const MAIN_D = MAIN_SHAPES.map((f) => toPath(f, project)).join("");
const SOUTH_D = SOUTH_SHAPES.map((f) => toPath(f, projectSouth)).join("");
const KURIL_D = NORTHERN_TERRITORIES.map((f) => toPath(f, project)).join("");

// 日本地図の上に、これまで暮らした場所を、引っ越しの順に、矢印でつなぐ。
// 海外へ出たときは、地図の外に、小さな札を出す。
export function JapanMap({ homes, city, age, abroad }: { homes: Home[]; city: string; age: number; abroad: boolean }) {
  // 暮らした場所の並び(いまの場所が、まだ書きとめられていなければ、足す)
  const raw: Home[] = homes.length ? [...homes] : [{ age, place: city }];
  if (raw[raw.length - 1].place !== city) raw.push({ age, place: city });
  const stops: Stop[] = [];
  for (const h of raw) {
    const r = resolvePlace(h.place);
    const last = stops[stops.length - 1];
    if (last && last.place === h.place) continue;
    stops.push({ age: h.age, place: h.place, short: r.short, xy: r.kind === "japan" ? (r.ll === OKINAWA ? OKI_XY : project(r.ll)) : null });
  }
  const moves = stops.length - 1;
  const path = (a: [number, number], b: [number, number]) => {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    // 少し、ふくらませる(重なった線を、見分けやすくする)
    return `M ${a[0]} ${a[1]} Q ${mx - dy * 0.12} ${my + dx * 0.12} ${b[0]} ${b[1]}`;
  };
  const overseas = stops.filter((s) => !s.xy);

  return (
    <div className="mt-8 rounded-sm border border-line bg-panel/70 p-4">
      <p className="font-gothic text-xs tracking-[0.3em] text-warm">これまで暮らした場所</p>
      <p className="font-gothic mt-1 text-[11px] leading-5 tracking-wider text-dim">{moves > 0 ? `${moves}回引っ越しました。矢印は移った順です。` : "まだ引っ越していません。"}</p>
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="mx-auto mt-3 w-full max-w-sm" role="img" aria-label="暮らした場所を結んだ日本地図">
        <defs>
          <marker id="jm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--color-warm)" />
          </marker>
        </defs>
        <path d={MAIN_D} fill="var(--color-line)" fillOpacity={0.4} stroke="var(--color-haze)" strokeOpacity={0.55} strokeWidth={0.6} strokeLinejoin="round" />
        {/* 北方領土(歯舞群島・色丹島・国後島・択捉島)。他の島と同じ、ふつうの線で描く */}
        <path d={KURIL_D} fill="var(--color-line)" fillOpacity={0.4} stroke="var(--color-haze)" strokeOpacity={0.55} strokeWidth={0.6} strokeLinejoin="round" />
        {/* 沖縄など(南西諸島) */}
        <rect x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} rx={3} fill="var(--color-void)" fillOpacity={0.35} stroke="var(--color-line)" strokeDasharray="3 3" />
        <path d={SOUTH_D} fill="var(--color-line)" fillOpacity={0.45} stroke="var(--color-haze)" strokeOpacity={0.55} strokeWidth={0.5} strokeLinejoin="round" />
        <text x={INSET.x + INSET.w - 4} y={INSET.y + 9} textAnchor="end" fontSize={7.5} fill="var(--color-dim)">沖縄・南西諸島</text>

        {/* 遠方の島(小笠原諸島・南鳥島・沖ノ鳥島)。位置だけを、印で示す */}
        <rect x={INSET_FAR.x} y={INSET_FAR.y} width={INSET_FAR.w} height={INSET_FAR.h} rx={3} fill="var(--color-void)" fillOpacity={0.35} stroke="var(--color-line)" strokeDasharray="3 3" />
        {FAR_ISLANDS.map((isl) => {
          const [fx, fy] = projectFar(isl.ll);
          return (
            <g key={isl.name}>
              <circle cx={fx} cy={fy} r={2} fill="var(--color-haze)" fillOpacity={0.8} />
              <text x={fx} y={fy - 5} textAnchor="middle" fontSize={6.5} fill="var(--color-dim)">{isl.name}</text>
            </g>
          );
        })}
        <text x={INSET_FAR.x + INSET_FAR.w - 4} y={INSET_FAR.y + INSET_FAR.h - 3} textAnchor="end" fontSize={5.5} fill="var(--color-dim)">遠方の島(位置の目安)</text>

        {/* 引っ越しの矢印 */}
        {stops.slice(1).map((s, i) => {
          const from = stops[i];
          if (!from.xy || !s.xy) return null;
          if (from.xy[0] === s.xy[0] && from.xy[1] === s.xy[1]) return null;
          return <path key={i} d={path(from.xy, s.xy)} fill="none" stroke="var(--color-warm)" strokeWidth={1.8} strokeLinecap="round" opacity={0.9} markerEnd="url(#jm-arrow)" />;
        })}
        {/* 海外へ(日本の地図の外に出る矢印) */}
        {stops.slice(1).map((s, i) => {
          const from = stops[i];
          if (s.xy || !from.xy) return null;
          return <path key={`o${i}`} d={`M ${from.xy[0]} ${from.xy[1]} Q ${(from.xy[0] + OVERSEAS_BOX.x + OVERSEAS_BOX.w) / 2} ${(from.xy[1] + OVERSEAS_BOX.y) / 2} ${OVERSEAS_BOX.x + OVERSEAS_BOX.w + 2} ${OVERSEAS_BOX.y + 22}`} fill="none" stroke="var(--color-warm)" strokeWidth={1.4} strokeDasharray="4 3" markerEnd="url(#jm-arrow)" opacity={0.8} />;
        })}

        {/* 場所の印と、年齢 */}
        {stops.map((s, i) => {
          if (!s.xy) return null;
          const [x, y] = s.xy;
          // すぐ近くに、ほかの印があるときは、文字を、下にずらす(重ならないように)
          const near = stops.slice(0, i).filter((o) => o.xy && Math.abs(o.xy[0] - x) < 22 && Math.abs(o.xy[1] - y) < 20).length;
          const dy = near * 22;
          const first = i === 0;
          const isNow = i === stops.length - 1 && !abroad;
          const right = x < VIEW.w * 0.62;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={isNow ? 5.5 : 4} fill={first ? "var(--color-cool)" : "var(--color-warm)"} stroke="var(--color-void)" strokeWidth={1.2} />
              <text x={x + (right ? 8 : -8)} y={y - 3 + dy} textAnchor={right ? "start" : "end"} fontSize={9.5} fill="var(--color-mist)" paintOrder="stroke" stroke="var(--color-void)" strokeWidth={2.4} strokeOpacity={0.7}>
                {s.short}
              </text>
              <text x={x + (right ? 8 : -8)} y={y + 8 + dy} textAnchor={right ? "start" : "end"} fontSize={8.5} fill="var(--color-haze)" paintOrder="stroke" stroke="var(--color-void)" strokeWidth={2.4} strokeOpacity={0.7}>
                {first ? `${s.age}歳〜` : `${s.age}歳`}
                {isNow ? "(いま)" : ""}
              </text>
            </g>
          );
        })}

        {/* 海外(日本海側の、海の上に置く。日本の地図と、重ならないように) */}
        {overseas.length > 0 && (
          <g>
            <rect x={OVERSEAS_BOX.x} y={OVERSEAS_BOX.y} width={OVERSEAS_BOX.w} height={20 + overseas.slice(-3).length * 13} rx={3} fill="var(--color-void)" fillOpacity={0.55} stroke="var(--color-warm)" strokeOpacity={0.7} />
            <text x={OVERSEAS_BOX.x + 8} y={OVERSEAS_BOX.y + 15} fontSize={9.5} fill="var(--color-warm)">海外で暮らした</text>
            {overseas.slice(-3).map((s, i) => (
              <text key={i} x={OVERSEAS_BOX.x + 8} y={OVERSEAS_BOX.y + 29 + i * 13} fontSize={9} fill="var(--color-mist)">
                {s.age}歳〜 {s.short}
              </text>
            ))}
          </g>
        )}
      </svg>
      <p className="font-gothic mt-2 text-center text-[10px] leading-4 tracking-wider text-dim">地図はおおまかな略図です。街の位置は目安です。</p>
    </div>
  );
}
