// 「健康 +1」「資産 -3万円」のような、ひとつ分の増減。
// 名前は、能力値の色(右の能力値のバーと同じ色)。+ は緑、- は赤。
export function DeltaItem({ label, color, up, children }: { label: string; color: string; up: boolean; children: React.ReactNode }) {
  return (
    <span className="keep inline-flex items-baseline gap-1.5">
      <span style={{ color }}>{label}</span>
      <span style={{ color: up ? "var(--color-up)" : "var(--color-down)" }}>
        {up ? "+" : "-"}
        {children}
      </span>
    </span>
  );
}
