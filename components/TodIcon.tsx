import type { TimeOfDay } from "@/lib/timeStore";

// 昼(太陽)・夕方(地平線に沈む太陽)・夜(月)の印。文字(☀ ☾)は、端末によって、表示できず「？」になることがあるので、絵(SVG)で描く。
export function TodIcon({ tod, className = "h-4 w-4" }: { tod: TimeOfDay; className?: string }) {
  if (tod === "day")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
        <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7" />
      </svg>
    );
  if (tod === "evening")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
        <path d="M6.8 16a5.2 5.2 0 0 1 10.4 0Z" fill="currentColor" stroke="none" />
        <path d="M2.5 19.5h19M12 6v2.2M4.6 9.8l1.7 1.5M19.4 9.8l-1.7 1.5" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M20.2 14.6A8.3 8.3 0 0 1 9.4 3.8a8.3 8.3 0 1 0 10.8 10.8Z" />
    </svg>
  );
}
