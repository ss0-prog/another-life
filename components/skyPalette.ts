import type { Phase } from "@/lib/timeStore";
import type { Weather } from "@/lib/sim/weather";

// 空の色。夜・朝焼け・昼・夕焼けの、4つの色合いを、空模様(晴れ・曇り・雨・雪・雷)ごとに持つ。
// 空は、4つの色(上から下へ)を、色の変数として、ゆっくり動かして、段階ごとに、色そのものを移り変わらせる
// (2まいの絵を重ねて透明度を入れ替えるのではないので、途中で、色がにごったり、明るさが沈んだりしない)。

type Stop = [number, string]; // [位置(0〜100), 色]
const SKY_POS = [0, 34, 68, 100] as const;

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: [number, number, number]) => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;

// 好きな位置の色を、並んだ色から、求める。
const at = (stops: Stop[], pos: number): [number, number, number] => {
  if (pos <= stops[0][0]) return rgb(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (pos <= stops[i][0]) {
      const t = (pos - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return mix(rgb(stops[i - 1][1]), rgb(stops[i][1]), t);
    }
  }
  return rgb(stops[stops.length - 1][1]);
};
const four = (stops: Stop[]) => SKY_POS.map((p) => at(stops, p));

const NIGHT: Record<Weather, Stop[]> = {
  clear: [[0, "#0a0d16"], [55, "#090a10"], [100, "#07080a"]],
  cloudy: [[0, "#14171e"], [55, "#0e1015"], [100, "#08090c"]],
  rain: [[0, "#0b1220"], [55, "#0a0e17"], [100, "#06080b"]],
  snow: [[0, "#1a202b"], [55, "#12161e"], [100, "#0a0c10"]],
  thunder: [[0, "#0c0b1a"], [55, "#09090f"], [100, "#050508"]],
};
const DAY: Record<Weather, Stop[]> = {
  clear: [[0, "#1478e6"], [38, "#3d9bf2"], [72, "#86cdff"], [100, "#d4efff"]],
  cloudy: [[0, "#4a5666"], [50, "#7b8795"], [100, "#aab4be"]],
  rain: [[0, "#2c3a4d"], [55, "#4a596b"], [100, "#6d7c8c"]],
  snow: [[0, "#6c7a8c"], [55, "#a4b0bd"], [100, "#d3dbe3"]],
  thunder: [[0, "#262a3a"], [55, "#3e4458"], [100, "#5c6377"]],
};
// 朝焼けと夕焼け(晴れの日の色)。曇りや雨の日は、その空模様の色に、うすく、焼けの色が、さす。
const DAWN: Stop[] = [[0, "#2a2d5c"], [28, "#7b5a92"], [62, "#e58f70"], [100, "#ffd29a"]];
const DUSK: Stop[] = [[0, "#121734"], [32, "#3a2548"], [68, "#8a3d35"], [100, "#c97a45"]];
const GLOW: Record<Weather, number> = { clear: 1, cloudy: 0.62, snow: 0.5, rain: 0.36, thunder: 0.26 };

export function skyPalette(weather: Weather, phase: Phase): string[] {
  if (phase === "night") return four(NIGHT[weather]).map(css);
  if (phase === "day") return four(DAY[weather]).map(css);
  // 朝焼け・夕焼け: 空模様の昼と夜の、まん中の色に、焼けの色を、空模様ごとの強さで、かさねる。
  const base = four(NIGHT[weather]).map((n, i) => mix(n, four(DAY[weather])[i], 0.5));
  const sun = four(phase === "dawn" ? DAWN : DUSK);
  return base.map((b, i) => css(mix(b, sun[i], GLOW[weather])));
}

// 地平線のあたりの、あたたかい光。朝焼けと夕焼けのときだけ、うかぶ(空模様が晴れに近いほど、はっきり)。
export const HORIZON_GLOW: Record<Weather, number> = { clear: 0.55, cloudy: 0.3, snow: 0.22, rain: 0.12, thunder: 0.08 };
