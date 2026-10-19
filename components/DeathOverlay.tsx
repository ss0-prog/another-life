"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { primaryButtonClass } from "@/components/controls";

type Props = { age: number; cause: string; why?: string; quote?: string; label: string; line: string; onCompare: () => void };

// 人生が終わったとき: 画面がゆっくり暗くなり、光の粒が、空へのぼっていく。
export function DeathOverlay({ age, cause, why, quote, label, line, onCompare }: Props) {
  // 光の粒は、少しだけ。ゆっくり、静かにのぼる。
  const motes = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        left: 12 + ((i * 41) % 76),
        size: 3 + (i % 3) * 1.5,
        delay: 0.5 + (i % 5) * 0.9,
        dur: 7 + (i % 4),
        drift: ((i % 5) - 2) * 10,
      })),
    [],
  );
  return (
    <motion.div className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden px-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }} style={{ background: "rgba(4,5,9,0.9)" }}>
      {motes.map((m, i) => (
        <motion.span
          key={i}
          className="absolute bottom-[-3vh] rounded-full"
          style={{ left: `${m.left}%`, width: m.size, height: m.size, background: "rgba(255,244,214,0.9)", boxShadow: "0 0 8px 2px rgba(255,236,170,0.35)" }}
          initial={{ y: 0, x: 0, opacity: 0 }}
          animate={{ y: "-105vh", x: m.drift, opacity: [0, 0.7, 0.6, 0] }}
          transition={{ delay: m.delay, duration: m.dur, repeat: Infinity, repeatDelay: 2, ease: "easeOut" }}
        />
      ))}
      <motion.p className="relative text-5xl font-bold tabular-nums tracking-widest text-[#f4efe2]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 1 }}>
        {age}
        <span className="ml-2 text-xl font-medium text-[#cfc8b6]">歳</span>
      </motion.p>
      <motion.p className="relative mt-4 text-base tracking-[0.25em] text-[#e6dfcc]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 1 }}>
        {cause}
      </motion.p>
      {why && (
        <motion.p className="relative mt-2 max-w-sm text-center text-xs leading-6 tracking-wider text-[#a9a391]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 1 }}>
          {why}
        </motion.p>
      )}
      <motion.p className="relative mt-2 text-sm tracking-[0.2em] text-[#a9a391]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 1 }}>
        {line}
      </motion.p>
      {quote && (
        <motion.p className="relative mx-auto mt-8 max-w-md text-center text-sm leading-8 tracking-[0.12em] text-[#d9d2bf]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9, duration: 1.6 }}>
          {quote}
        </motion.p>
      )}
      <motion.div className="relative mt-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: quote ? 3.2 : 1.9, duration: 0.8 }}>
        <button type="button" onClick={onCompare} className={`${primaryButtonClass} !text-[#f4efe2]`}>
          <span className="absolute inset-0 border border-[#f0c994]/70 bg-[#f0c994]/10 transition-colors group-hover:border-[#f0c994] group-hover:bg-[#f0c994]/20" />
          {label}
        </button>
      </motion.div>
    </motion.div>
  );
}
