"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type DropdownItem = { value: string; label: string; group?: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  items: DropdownItem[];
  placeholder: string;
  searchPlaceholder?: string;
  // 項目が多いときに、絞り込みの入力欄を出す。
  searchable?: boolean;
  ariaLabel: string;
};

// 自作のドロップダウン(開閉する選択欄)。グループ分け、絞り込み、キーボード操作に対応する。
export function Dropdown({ value, onChange, items, placeholder, searchPlaceholder = "絞り込む", searchable = false, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const current = items.find((i) => i.value === value);
  const filtered = useMemo(() => items.filter((i) => !query || i.label.includes(query)), [items, query]);

  // 外をクリックしたら閉じる。
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // 開いたら、選択中の項目が見える位置にする。
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(Math.max(0, items.findIndex((i) => i.value === value)));
  }, [open, items, value]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return setOpen(true);
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && open && filtered[active]) {
      e.preventDefault();
      choose(filtered[active].value);
    }
  };

  let lastGroup: string | undefined;

  return (
    <div ref={root} className="relative w-full max-w-sm text-left" onKeyDown={onKey}>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-3 border px-4 py-3 text-base tracking-wider transition-colors ${open ? "border-warm bg-warm/10 text-mist" : "border-line bg-panel/80 text-mist hover:border-haze"}`}
      >
        <span className={current ? "" : "text-dim"}>{current?.label ?? placeholder}</span>
        <svg viewBox="0 0 12 8" className={`h-2 w-3 shrink-0 text-haze transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M1 1.5 6 6.5l5-5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 border border-warm/50 bg-panel shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
          {searchable && (
            <div className="border-b border-line px-3 py-2">
              <input
                autoFocus
                value={query}
                placeholder={searchPlaceholder}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                className="w-full bg-transparent text-sm tracking-wider text-mist outline-none placeholder:text-dim"
              />
            </div>
          )}
          <div ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && <p className="px-4 py-3 text-sm text-dim">見つかりません</p>}
            {filtered.map((it, i) => {
              const header = it.group && it.group !== lastGroup ? it.group : null;
              lastGroup = it.group;
              return (
                <div key={it.value + i}>
                  {header && <p className="px-4 pb-1 pt-3 text-xs tracking-[0.25em] text-warm">{header}</p>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={it.value === value}
                    data-index={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(it.value)}
                    className={`block w-full px-4 py-2 text-left text-base leading-7 tracking-wider ${i === active ? "bg-warm/15 text-mist" : "text-haze"} ${it.value === value ? "text-warm" : ""}`}
                  >
                    {it.label}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
