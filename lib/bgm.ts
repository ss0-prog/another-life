"use client";

import { useSyncExternalStore } from "react";
import type { Phase } from "@/lib/timeStore";
import type { Weather } from "@/lib/sim/weather";

// BGM: 音声ファイルは使わず、ブラウザの中で、ゆっくり重なる和音と、まばらなベルを作り続ける(Web Audio)。
// 夜は、短調のしずかな和音。昼は、ひらけた明るい和音。雨は雨音、雪は高く小さなベル、曇りは音をこもらせる。
const KEY = "betsu-uchu:bgm";
const MASTER = 0.3;
const CHORD_SEC = 16;

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const NIGHT_CHORDS = [
  [41, 48, 52, 57, 64], // Fmaj9
  [48, 55, 59, 62, 64], // Cmaj9
  [43, 50, 55, 59, 62], // G6/9
  [45, 52, 55, 59, 64], // Am9
];
const DAY_CHORDS = [
  [48, 55, 59, 62, 64], // Cmaj9
  [41, 48, 52, 57, 62], // Fmaj9
  [43, 50, 55, 59, 62], // G6/9
  [45, 52, 55, 59, 64], // Am9
];
const NIGHT_BELLS = [60, 62, 64, 67, 69]; // Cメジャー・ペンタトニック(Aマイナーと同じ音)
const DAY_BELLS = [60, 62, 64, 67, 69]; // Cメジャー・ペンタトニック

type Mood = { phase: Phase; weather: Weather };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let padBus: BiquadFilterNode | null = null;
let rainGain: GainNode | null = null;
let rainFilter: BiquadFilterNode | null = null;
let wet: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let mood: Mood = { phase: "night", weather: "clear" };
let on = false;
let chordIdx = 0;
let chordTimer: ReturnType<typeof setTimeout> | null = null;
let bellTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const isDay = () => mood.phase === "day";

// 部屋の響き(リバーブ): 減衰していくノイズから作る。
function makeImpulse(c: AudioContext, sec: number) {
  const len = Math.floor(c.sampleRate * sec);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}

// 雨音の元になる、さらさらしたノイズ(ホワイトノイズ)。
function makeRainNoise(c: AudioContext) {
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// 雷鳴の元になる、低くやわらかいノイズ(ブラウンノイズ)。
function makeNoise(c: AudioContext) {
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.04 * w) / 1.04;
    d[i] = last * 3.2;
  }
  return buf;
}

function build() {
  if (ctx) return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = makeImpulse(ctx, 5);
  wet = ctx.createGain();
  wet.gain.value = 0.55;
  reverb.connect(wet).connect(master);

  padBus = ctx.createBiquadFilter();
  padBus.type = "lowpass";
  padBus.frequency.value = 1400;
  padBus.connect(master);
  padBus.connect(reverb);

  noiseBuf = makeNoise(ctx);
  const noise = ctx.createBufferSource();
  noise.buffer = makeRainNoise(ctx);
  noise.loop = true;
  // 低い音を切り(ごうごうしない)、高い音も丸めて、さーっという雨音にする
  const rainLow = ctx.createBiquadFilter();
  rainLow.type = "highpass";
  rainLow.frequency.value = 600;
  rainFilter = ctx.createBiquadFilter();
  rainFilter.type = "lowpass";
  rainFilter.frequency.value = 3200;
  rainGain = ctx.createGain();
  rainGain.gain.value = 0;
  noise.connect(rainLow).connect(rainFilter).connect(rainGain).connect(master);
  noise.start();
}

// 気分(昼夜・空模様)にあわせて、音色をゆっくり変える。
function applyMood() {
  if (!ctx || !padBus || !rainGain || !rainFilter || !wet) return;
  const t = ctx.currentTime;
  const w = mood.weather;
  const cutoff = w === "cloudy" ? 900 : w === "rain" || w === "thunder" ? 1000 : w === "snow" ? 1700 : isDay() ? 1900 : 1400;
  padBus.frequency.setTargetAtTime(cutoff, t, 3);
  wet.gain.setTargetAtTime(w === "snow" ? 0.8 : 0.55, t, 3);
  rainGain.gain.setTargetAtTime(w === "rain" ? 0.016 : w === "thunder" ? 0.028 : 0, t, 4);
  rainFilter.frequency.setTargetAtTime(w === "thunder" ? 2600 : 3200, t, 4);
}

// 和音を一つ、長くのばす。
function playChord() {
  if (!ctx || !padBus || !on) return;
  const chords = isDay() ? DAY_CHORDS : NIGHT_CHORDS;
  const notes = chords[chordIdx % chords.length];
  chordIdx++;
  const t = ctx.currentTime;
  const len = CHORD_SEC + 4;
  notes.forEach((n, i) => {
    ([["sine", -5], ["triangle", 6]] as const).forEach(([type, detune]) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = type;
      o.frequency.value = midi(n);
      o.detune.value = detune;
      const peak = (type === "sine" ? 0.05 : 0.026) / (1 + i * 0.12);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 5);
      g.gain.setValueAtTime(peak, t + len - 6);
      g.gain.linearRampToValueAtTime(0, t + len);
      o.connect(g).connect(padBus!);
      o.start(t);
      o.stop(t + len + 0.1);
    });
  });
  chordTimer = setTimeout(playChord, CHORD_SEC * 1000);
}

// ベルを一つ、ぽつんと鳴らす。間隔は、ばらばら。
function playBell() {
  if (!ctx || !padBus || !on) return;
  const snow = mood.weather === "snow";
  const scale = isDay() ? DAY_BELLS : NIGHT_BELLS;
  const note = scale[Math.floor(Math.random() * scale.length)] + (snow ? 12 : Math.random() < 0.15 ? 12 : 0);
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o2.type = "sine";
  o.frequency.value = midi(note);
  o2.frequency.value = midi(note) * 2.01;
  const vol = snow ? 0.02 : 0.03;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 6);
  const g2 = ctx.createGain();
  g2.gain.value = 0.18;
  o.connect(g);
  o2.connect(g2).connect(g);
  g.connect(padBus);
  o.start(t);
  o2.start(t);
  o.stop(t + 6.2);
  o2.stop(t + 6.2);
  bellTimer = setTimeout(playBell, (12 + Math.random() * 14) * 1000);
}

// 雷鳴: 低いノイズが、どんと鳴って、うねりながら遠ざかる。
function playThunder() {
  if (!ctx || !master || !noiseBuf || !on || mood.weather !== "thunder") return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(450, t);
  lp.frequency.exponentialRampToValueAtTime(70, t + 6);
  const g = ctx.createGain();
  const peak = 0.45 + Math.random() * 0.25;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.1);
  // ごろごろと、うねりながら、小さくなる
  [[0.9, 0.6], [1.9, 0.75], [3.1, 0.4]].forEach(([dt, k]) => g.gain.linearRampToValueAtTime(peak * k * (0.8 + Math.random() * 0.4), t + dt));
  g.gain.exponentialRampToValueAtTime(0.0001, t + 6.5);
  src.connect(lp).connect(g).connect(master);
  src.start(t, Math.random() * 3);
  src.stop(t + 6.6);
}

// 稲妻(背景の「flash」アニメーション)は、9秒ごとに、周期の約87%で光る。光のすこしあとに、雷鳴を鳴らす。
export function watchLightning() {
  const on_ = (e: Event) => {
    if ((e as AnimationEvent).animationName !== "flash") return;
    if (Math.random() < 0.75) setTimeout(playThunder, 7830 + 800 + Math.random() * 1700);
  };
  window.addEventListener("animationstart", on_);
  window.addEventListener("animationiteration", on_);
  return () => {
    window.removeEventListener("animationstart", on_);
    window.removeEventListener("animationiteration", on_);
  };
}

export function startBgm() {
  if (on) return;
  build();
  if (!ctx || !master) return;
  on = true;
  void ctx.resume();
  applyMood();
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(MASTER, ctx.currentTime, 1.5);
  playChord();
  bellTimer = setTimeout(playBell, 9000);
  try {
    window.localStorage.setItem(KEY, "on");
  } catch {}
  emit();
}

export function stopBgm() {
  if (!on || !ctx || !master) return;
  on = false;
  if (chordTimer) clearTimeout(chordTimer);
  if (bellTimer) clearTimeout(bellTimer);
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
  // 余韻が消えてから、音を止める(鳴らし直すと、また最初の和音から)。
  const c = ctx;
  setTimeout(() => {
    if (!on && c.state === "running") void c.suspend();
  }, 4000);
  try {
    window.localStorage.setItem(KEY, "off");
  } catch {}
  emit();
}

export function toggleBgm() {
  if (on) stopBgm();
  else startBgm();
}

export function setBgmMood(m: Mood) {
  const dayChanged = isDay() !== (m.phase === "day");
  mood = m;
  if (dayChanged) chordIdx = 0;
  applyMood();
}

// 前回「オン」にしていたら、最初に画面をさわったときから鳴らす(ブラウザは、さわる前の自動再生を許さない)。
export function resumeBgmOnFirstTouch() {
  let pref = false;
  try {
    pref = window.localStorage.getItem(KEY) === "on";
  } catch {}
  if (!pref) return () => {};
  const go = () => {
    startBgm();
    cleanup();
  };
  const cleanup = () => {
    window.removeEventListener("pointerdown", go);
    window.removeEventListener("keydown", go);
  };
  window.addEventListener("pointerdown", go, { once: true });
  window.addEventListener("keydown", go, { once: true });
  return cleanup;
}

export const useBgmOn = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => on,
    () => false,
  );

// 開発中にこのファイルが読み直されても、古い音が、止められないまま残らないようにする。
if (typeof window !== "undefined") {
  const g = globalThis as { __bgmDispose?: () => void };
  g.__bgmDispose?.();
  g.__bgmDispose = () => {
    on = false;
    if (chordTimer) clearTimeout(chordTimer);
    if (bellTimer) clearTimeout(bellTimer);
    void ctx?.close();
    ctx = null;
  };
}
