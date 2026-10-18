// これまでに解除した実績の記録(この端末のブラウザにだけ、保存する)。
const KEY = "betsu-uchu:achievements";

type Record_ = Record<string, string>;

function read(): Record_ {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Record_) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

// 解除した実績を記録して、「この端末で、はじめて解除した」ものの id を返す。
export function recordUnlocked(ids: string[]): string[] {
  const rec = read();
  const fresh: string[] = [];
  for (const id of ids) {
    if (!rec[id]) {
      rec[id] = new Date().toISOString();
      fresh.push(id);
    }
  }
  if (fresh.length) {
    try {
      localStorage.setItem(KEY, JSON.stringify(rec));
    } catch {}
  }
  return fresh;
}

export const unlockedCount = () => Object.keys(read()).length;
export const isUnlocked = (id: string) => Boolean(read()[id]);

// 解除した実績の、一覧(id → 最初に解除した日時)。
export const unlockedAll = (): Record<string, string> => read();
