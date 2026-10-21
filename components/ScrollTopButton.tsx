"use client";

import { useEffect, useState } from "react";

// スマホ: 下へスクロールしたら、右下に、「一番上へもどる」ボタンを出す。
export function ScrollTopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <button
      type="button"
      aria-label="一番上へもどる"
      title="一番上へもどる"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-warm/60 bg-panel/90 text-warm shadow-[0_6px_24px_rgba(0,0,0,0.45)] transition-opacity duration-300 hover:border-warm lg:hidden ${show ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 14l6-6 6 6" />
        <path d="M6 19h12" />
      </svg>
    </button>
  );
}
