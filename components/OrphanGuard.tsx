"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// 日本語の文で、最後の行に1〜2文字だけが残る(「た。」だけが改行される)のを防ぐ。
// ブラウザの text-wrap: pretty は日本語には効かないので、文字の位置を測って、
// 最後の行が短すぎる文だけ、右の余白を少しずつ広げて、前の行の文字を送りこむ。
// 画面の見た目(行の右はし)は、ほとんど変わらない。
const SEL = "p,li,h1,h2,h3,h4,button,label,a,span,div,dd,dt";
const CLOSERS = /[。、.!?!?」』)）〉》】]/;
const MIN_LAST = 3;
const MAX_STEPS = 5;

function lastLineCore(el: Element): number | null {
  const tn = el.lastChild;
  if (!tn || tn.nodeType !== 3) return null;
  const text = tn.textContent ?? "";
  if (text.length < 4) return null;
  const range = document.createRange();
  const topAt = (i: number) => {
    range.setStart(tn, i);
    range.setEnd(tn, i + 1);
    const r = range.getBoundingClientRect();
    return r.width ? r.top : null;
  };
  let i = text.length - 1;
  while (i >= 0 && !text[i].trim()) i--;
  if (i < 3) return null;
  const lastTop = topAt(i);
  if (lastTop === null) return null;
  let core = 0;
  for (let j = i; j >= 0; j--) {
    if (!text[j].trim()) continue;
    const t = topAt(j);
    if (t === null) continue;
    if (Math.abs(t - lastTop) > 3) return core; // 前の行に出た: ここまでが、最後の行
    if (!CLOSERS.test(text[j])) core++;
    if (core >= MIN_LAST) return core;
  }
  return null; // 先頭まで同じ行(折り返していない)
}

function reset() {
  document.querySelectorAll<HTMLElement>("[data-og]").forEach((el) => {
    el.style.paddingRight = el.dataset.ogR ?? "";
    el.style.paddingLeft = el.dataset.ogL ?? "";
    delete el.dataset.og;
    delete el.dataset.ogR;
    delete el.dataset.ogL;
  });
}

function fix() {
  reset();
  const els = document.querySelectorAll<HTMLElement>(`body :is(${SEL})`);
  for (const el of els) {
    if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") continue;
    const cs = getComputedStyle(el);
    if (cs.display === "inline" || cs.display === "contents") continue;
    if (cs.whiteSpace === "nowrap" || cs.textAlignLast === "justify") continue;
    const core = lastLineCore(el);
    if (core === null || core >= MIN_LAST) continue;
    const step = parseFloat(cs.fontSize) + (parseFloat(cs.letterSpacing) || 0);
    const center = cs.textAlign === "center";
    const origR = el.style.paddingRight;
    const origL = el.style.paddingLeft;
    const basePR = parseFloat(cs.paddingRight) || 0;
    const basePL = parseFloat(cs.paddingLeft) || 0;
    let ok = false;
    for (let k = 1; k <= MAX_STEPS; k++) {
      el.style.paddingRight = `${basePR + step * k * (center ? 0.5 : 1)}px`;
      if (center) el.style.paddingLeft = `${basePL + step * k * 0.5}px`;
      const c = lastLineCore(el);
      if (c === null || c >= MIN_LAST) {
        ok = true;
        break;
      }
    }
    if (ok) {
      el.dataset.og = "1";
      el.dataset.ogR = origR;
      el.dataset.ogL = origL;
    } else {
      el.style.paddingRight = origR;
      el.style.paddingLeft = origL;
    }
  }
}

export function OrphanGuard() {
  const path = usePathname();
  useEffect(() => {
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          fix();
        } catch {}
      });
    };
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(run, 160);
    };
    later();
    const mo = new MutationObserver(later);
    mo.observe(document.body, { childList: true, characterData: true, subtree: true });
    window.addEventListener("resize", later);
    document.fonts?.ready.then(later).catch(() => {});
    return () => {
      mo.disconnect();
      window.removeEventListener("resize", later);
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [path]);
  return null;
}
