// ── number / currency helpers ──
// แปลงสตริงมูลค่า ("฿1.2M" / "฿480K" / "1,200,000" / "2.8B") → ตัวเลขบาท (รองรับหน่วย B/M/K)
export function parseBaht(v: string | number): number {
  if (typeof v === "number") return v;
  const s = (v ?? "").toString().replace(/[฿,\s]/g, "");
  const n = parseFloat(s) || 0;
  if (/B/i.test(s)) return n * 1e9;
  if (/M/i.test(s)) return n * 1e6;
  if (/K/i.test(s)) return n * 1e3;
  return n;
}

export function fmtBaht(v: number): string {
  if (!isFinite(v) || v <= 0) return "฿0";
  if (v >= 1_000_000_000_000) return `฿${(v / 1_000_000_000_000).toFixed(1)}T`;
  if (v >= 1_000_000_000) return `฿${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `฿${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `฿${Math.round(v / 1_000)}K`;
  return `฿${v.toLocaleString()}`;
}

export function fmtFull(v: number): string {
  return `฿${v.toLocaleString()}`;
}
