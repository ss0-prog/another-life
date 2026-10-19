// ロゴ「if」: iの点は、重なる二つの宇宙(あなたと、もうひとりのあなた)。fの右の先端二つ(上のはらい・横線)は、分かれ目を表す、二つの矢印になる。
export function IfMark({ className }: { className?: string }) {
  return (
    <svg viewBox="22 2 64 62" className={className} role="img" aria-label="if" fill="none" stroke="currentColor" strokeWidth={5.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M33 28 V60" />
      <circle cx="29.5" cy="11" r="5.6" fill="var(--color-warm)" stroke="none" />
      <circle cx="37.5" cy="11" r="5.6" fill="var(--color-cool)" stroke="none" opacity="0.9" />
      <path d="M56 60 V26 C56 14 63 9 75 10 H79" />
      <path d="M45 30 H79" />
      <path d="M75.7 5.1 L82 10 L75.7 14.9" stroke="var(--color-warm)" strokeWidth={3.6} />
      <path d="M75.7 25.1 L82 30 L75.7 34.9" stroke="var(--color-cool)" strokeWidth={3.6} />
    </svg>
  );
}
