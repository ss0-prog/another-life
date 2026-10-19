import { soften } from "@/lib/jp";

// 出来事の文章から、「(…)」の補足を取り出して、本文の下に、色と大きさを変えて出す。
// 補足は、ふたつの種類に分ける: お金の増減(「-28万円」「借金+172万円」)と、ほかの説明(期間・費用・条件など)。
export function splitEvent(text: string): { main: string; notes: string[] } {
  const notes: string[] = [];
  let main = "";
  let depth = 0;
  let buf = "";
  for (const ch of text) {
    if (ch === "(" || ch === "(") {
      if (depth === 0) buf = "";
      else buf += ch;
      depth++;
    } else if ((ch === ")" || ch === ")") && depth > 0) {
      depth--;
      if (depth === 0) {
        if (buf.trim()) notes.push(buf.trim());
      } else buf += ch;
    } else if (depth > 0) buf += ch;
    else main += ch;
  }
  // 閉じていない「(」があれば、そのまま本文に戻す。
  if (depth > 0) main += `(${buf}`;
  return { main: main.replace(/\s+([。、])/g, "$1").trim(), notes };
}

const isMoney = (s: string) => /^[+\-−]?\s*[\d,]+(万)?円|借金[+\-]/.test(s);

type Props = { text: string; className?: string; noteClassName?: string; as?: "p" | "span" };
export function EventText({ text, className = "", noteClassName = "text-[11px] leading-5 sm:text-xs sm:leading-6", as = "p" }: Props) {
  const { main, notes } = splitEvent(text);
  const Tag = as;
  return (
    <>
      <Tag className={className}>{soften(main)}</Tag>
      {notes.length > 0 && (
        <span className="mt-0.5 block space-y-0.5">
          {notes.map((n, i) =>
            isMoney(n) ? (
              <span key={i} className={`block font-bold tabular-nums tracking-wider ${noteClassName}`} style={{ color: "var(--color-s-money)" }}>
                {n}
              </span>
            ) : (
              <span key={i} className={`block tracking-wider text-haze ${noteClassName}`}>
                {soften(n)}
              </span>
            ),
          )}
        </span>
      )}
    </>
  );
}
