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
let reverbBus: ConvolverNode | null = null;
let mood: Mood = { phase: "night", weather: "clear" };
let on = false;
let chordIdx = 0;
let chordTimer: ReturnType<typeof setTimeout> | null = null;
let bellTimer: ReturnType<typeof setTimeout> | null = null;
let crowTimer: ReturnType<typeof setTimeout> | null = null;
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
  reverbBus = reverb;
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
  syncCrow();
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

// ---- カラス: 夕方の晴れた空のときだけ、遠くで、小さく鳴く ----
const crowOn = () => on && mood.phase === "dusk" && mood.weather === "clear";

// 「カァー」を一声。のこぎり波を、ざらつかせ(60Hzで震わせ)、声の帯域だけ通し、こもらせて、遠くに聞こえさせる。
function caw(delay: number, pan: number, f0: number) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const dur = 0.42;
  const am = ctx.createGain();
  am.gain.value = 0.75;
  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 62;
  lfoDepth.gain.value = 0.25;
  lfo.connect(lfoDepth).connect(am.gain);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1150;
  band.Q.value = 1.1;
  const far = ctx.createBiquadFilter();
  far.type = "lowpass";
  far.frequency.value = 2200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.03, t + 0.05);
  g.gain.setValueAtTime(0.03, t + dur - 0.15);
  g.gain.linearRampToValueAtTime(0, t + dur);
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  [1, 1.012].forEach((k) => {
    const o = ctx!.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f0 * 1.12 * k, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.82 * k, t + dur);
    o.connect(am);
    o.start(t);
    o.stop(t + dur + 0.05);
  });
  lfo.start(t);
  lfo.stop(t + dur + 0.05);
  am.connect(band).connect(far).connect(g).connect(p);
  p.connect(master);
  if (reverbBus) p.connect(reverbBus);
}

function playCrow() {
  crowTimer = null;
  if (!crowOn()) return;
  const n = 1 + Math.floor(Math.random() * 3);
  const f0 = 430 + Math.random() * 110;
  const pan = Math.random() * 1.2 - 0.6;
  for (let i = 0; i < n; i++) caw(i * (0.62 + Math.random() * 0.12), pan, f0 * (1 - i * 0.03));
  crowTimer = setTimeout(playCrow, (14 + Math.random() * 22) * 1000);
}

// 夕方の晴れの間だけ、カラスの鳴き声の予約を入れておく。
function syncCrow() {
  if (crowOn() && !crowTimer) crowTimer = setTimeout(playCrow, (4 + Math.random() * 6) * 1000);
  else if (!crowOn() && crowTimer) {
    clearTimeout(crowTimer);
    crowTimer = null;
  }
}

// ---- 効果音(木の枝の分岐): BGMがオンのときだけ鳴る ----
const SFX_SCALE = [60, 62, 64, 67, 69]; // Cメジャー・ペンタトニック

// やわらかい一音(ぽん)。
function tone(freq: number, delay: number, sec: number, vol: number) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
  o.connect(g);
  g.connect(master);
  if (reverbBus) g.connect(reverbBus);
  o.start(t);
  o.stop(t + sec + 0.05);
}
// 木が育つほど、音が少しずつ高くなる。
const stepNote = (i: number) => SFX_SCALE[i % SFX_SCALE.length] + 12 * Math.min(1, Math.floor(i / SFX_SCALE.length));

// 枝が伸びる: さーっと伸びる風のような音 → 葉が開く小さな音 → 先端の節が、ぽんと出る。
export function sfxGrow(index: number) {
  if (!ctx || !master || !noiseBuf || !on) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(250, t);
  bp.frequency.exponentialRampToValueAtTime(900, t + 1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.5);
  g.gain.linearRampToValueAtTime(0, t + 1.1);
  src.connect(bp).connect(g).connect(master);
  src.start(t, Math.random() * 3);
  src.stop(t + 1.2);
  const n = stepNote(index);
  tone(midi(n + 12), 0.7, 0.5, 0.02);
  tone(midi(n + 19), 0.82, 0.5, 0.016);
  tone(midi(n), 0.9, 2.2, 0.07);
}

// ひとつ前へ戻る: 小さく、下がる音。
export function sfxBack() {
  if (!ctx || !on) return;
  tone(midi(64), 0, 0.9, 0.05);
  tone(midi(60), 0.1, 1.2, 0.05);
}

// 枝がさかのぼる: 一本もどるたびに、短く、下がっていく音。
export function sfxRewind(remaining: number) {
  if (!ctx || !on) return;
  tone(midi(stepNote(remaining)), 0, 1.1, 0.045);
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
  syncCrow();
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
  syncCrow();
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
    if (crowTimer) clearTimeout(crowTimer);
    void ctx?.close();
    ctx = null;
  };
}
