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

export function fmtFull(v: number | null | undefined): string {
  return `฿${(v ?? 0).toLocaleString()}`;
}

// เท่ากับ fmtFull แต่ปัดเศษก่อนแสดง (ค่าที่มีจุดทศนิยม เช่นผลรวมที่คำนวณจากหลายรายการ)
export function fmtFullRounded(v: number | null | undefined): string {
  return fmtFull(Math.round(v ?? 0));
}

// ย่อเฉพาะหลักล้านขึ้นไป (฿1.5M) ต่ำกว่านั้นแสดงเต็ม (฿480,000) — ต่างจาก fmtBaht ที่ย่อตั้งแต่หลักพัน
export function fmtBahtM(v: number | null | undefined): string {
  const n = v ?? 0;
  return n >= 1e6 ? `฿${(n / 1e6).toFixed(1)}M` : fmtFull(n);
}

// ── อัตราส่วนที่ "ยังตัดสินไม่ได้" ต้องขึ้น "—" ไม่ใช่ 0% ────────────────────────────
//
// บั๊กจริง (เอเจนต์สวมบทผู้บริหารเจอเอง 10 ส.ค. 69):
//   หน้าที่ยังไม่มีข้อมูลขึ้น "อัตราแปลงเป็นลูกค้า 0%" และ "อัตราปิดการขาย 0% · 0/0 ใบ"
//   ซึ่งสื่อว่า "มีโอกาสแล้วทำไม่ได้เลย" ทั้งที่ความจริงคือ "ยังไม่มีโอกาสให้วัด"
//   ผู้บริหารอ่านแล้วสรุปผิดว่าทีมทำงานล้มเหลว
//   ยิ่งสับสนเพราะบางหน้าทำถูกอยู่แล้ว (ขึ้น "—") = ตัวเลขเดียวกันแสดงคนละแบบในระบบเดียว
//
// กติกา: ตัวหารเป็น 0 = ยังตัดสินไม่ได้ → "—" เสมอ ทุกหน้า
export function pctOrNull(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}
/** ข้อความเปอร์เซ็นต์พร้อมหน่วย — ตัวหารเป็น 0 คืน "—" */
export function pctText(part: number, whole: number): string {
  const p = pctOrNull(part, whole);
  return p === null ? "—" : `${p}%`;
}
