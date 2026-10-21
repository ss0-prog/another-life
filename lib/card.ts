"use client";

import type { LifeSummary } from "@/lib/sim/types";

const W = 1080;
const H = 1350;
let font = "serif";
const STATS: [keyof LifeSummary["stats"], string, string][] = [
  ["health", "健康", "#84d6b0"],
  ["money", "経済", "#f0c994"],
  ["bonds", "つながり", "#f0a8bd"],
  ["learn", "学び", "#9bbdf0"],
  ["joy", "幸福度", "#f7e08a"],
];

// 日本語は空白で区切れないので、1文字ずつ幅を測って折り返す。
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else line += ch;
  }
  if (line) lines.push(line);
  return lines;
}

function drawLife(ctx: CanvasRenderingContext2D, life: LifeSummary, heading: string, accent: string, x: number, y: number, w: number) {
  ctx.textAlign = "left";
  ctx.fillStyle = accent;
  ctx.font = `500 26px ${font}`;
  ctx.fillText(heading, x, y);

  ctx.fillStyle = "#eceef2";
  ctx.font = `600 84px ${font}`;
  ctx.fillText(String(life.deathAge), x, y + 100);
  ctx.font = `500 28px ${font}`;
  ctx.fillStyle = "#bcc1ca";
  ctx.fillText("歳で人生を終えた", x + ctx.measureText(String(life.deathAge)).width + 150, y + 100);

  let cy = y + 160;
  ctx.font = `500 28px ${font}`;
  ctx.fillStyle = "#eceef2";
  for (const l of [life.echo.status.occupation, life.echo.status.city, life.echo.status.living]) {
    for (const row of wrap(ctx, l, w)) {
      ctx.fillText(row, x, cy);
      cy += 42;
    }
  }

  cy += 14;
  STATS.forEach(([k, label, color], i) => {
    const sy = cy + i * 46;
    ctx.fillStyle = "#bcc1ca";
    ctx.font = `500 24px ${font}`;
    ctx.fillText(label, x, sy + 8);
    ctx.fillStyle = "#343a44";
    ctx.fillRect(x + 130, sy - 8, w - 130, 12);
    ctx.fillStyle = color;
    ctx.fillRect(x + 130, sy - 8, ((w - 130) * life.stats[k]) / 100, 12);
  });

  cy += STATS.length * 46 + 36;
  ctx.font = `500 24px ${font}`;
  const tl = life.echo.timeline.slice(0, 5);
  for (const item of tl) {
    ctx.fillStyle = accent;
    ctx.fillText(`${item.age}歳`, x, cy);
    ctx.fillStyle = "#eceef2";
    const rows = wrap(ctx, item.event, w - 90);
    rows.forEach((row, i) => ctx.fillText(row, x + 90, cy + i * 34));
    cy += Math.max(rows.length, 1) * 34 + 14;
  }
}

// 比較結果を1枚の画像(PNG)にする。
export async function renderCard(real: LifeSummary, alt: LifeSummary): Promise<Blob | null> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  font = getComputedStyle(document.body).fontFamily || "serif";

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0d16");
  bg.addColorStop(1, "#07080a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(236,238,242,${0.2 + ((i * 7) % 6) / 10})`;
    ctx.fillRect((i * 97) % W, (i * 53) % (H - 200), 1 + (i % 3), 1 + (i % 3));
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#eceef2";
  ctx.font = `600 56px ${font}`;
  ctx.fillText("別の宇宙のあなた", W / 2, 130);
  ctx.font = `500 26px ${font}`;
  ctx.fillStyle = "#bcc1ca";
  ctx.fillText("ふたつの人生", W / 2, 180);

  const colW = 440;
  drawLife(ctx, real, "現実のあなた", "#9bbdf0", 70, 270, colW);
  drawLife(ctx, alt, "分岐した、もうひとりのあなた", "#f0c994", 570, 270, colW);

  ctx.textAlign = "center";
  ctx.fillStyle = "#8b919c";
  ctx.font = `500 22px ${font}`;
  ctx.fillText("日本の統計的な傾向と設計上の仮定にもとづく想像の物語です", W / 2, H - 50);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
