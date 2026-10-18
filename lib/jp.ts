// 日本語の読点(、)を、自然な数にそろえる。
// データの文には、ひと息ごとに「、」が入っているものが多いので、短いまとまりのあいだの「、」は取って、
// ある程度の長さ(min 文字)が続いたところだけに、「、」を残す。接続の言葉の前の「、」は、残す。
export function soften(text: string, min = 14): string {
  return breakParens(commaSoften(text, min));
}

// かっこ書きの説明が続くときは、読みやすいよう、かっこの前で改行する(画面では、改行をそのまま表示する)。
// 短いかっこ(「(男子)」「(+3万円)」など)は、そのまま。説明のかっこ(6文字以上)だけを、改行する。
// (行の右はしまで文字をつめて折り返す方針にしたので、いまは、改行を入れない。)
export function breakParens(text: string): string {
  return text;
}

function commaSoften(text: string, min: number): string {
  if (!text || !text.includes("、")) return text;
  const parts = text.split("、");
  let out = parts[0];
  let chunk = parts[0].length;
  for (let i = 1; i < parts.length; i++) {
    const next = parts[i];
    const keep = chunk >= min || /^(しかし|ただし|でも|そのため|それでも|ところが|なお|また|そして)/.test(next);
    if (keep) {
      out += `、${next}`;
      chunk = next.length;
    } else {
      out += next;
      chunk += next.length;
    }
  }
  return out;
}
