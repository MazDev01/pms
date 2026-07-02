// ── number / currency formatting helpers ──
export function fmtBaht(v: number): string {
  if (!isFinite(v) || v <= 0) return "฿0";
  if (v >= 1_000_000_000_000) return `฿${(v / 1_000_000_000_000).toFixed(1)}T`;
  if (v >= 1_000_000_000) return `฿${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `฿${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `฿${Math.round(v / 1_000)}K`;
  return `฿${v.toLocaleString()}`;
}

export function fmtM(v: number): string {
  return `฿${Math.round(v * 10) / 10}M`;
}

export function fmtFull(v: number): string {
  return `฿${v.toLocaleString()}`;
}
