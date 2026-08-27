// ── ไล่ดึงทีละหน้า ฝั่งเซิร์ฟเวอร์ ───────────────────────────────────────────────
//
// ยกกติกามาจาก SupabaseAdapter ตรง ๆ (pageAll / rangedFetch) เพราะข้อจำกัดเป็นของ PostgREST
// ไม่ใช่ของเบราว์เซอร์ — ย้ายมาอยู่เซิร์ฟเวอร์แล้วก็ยังโดนเหมือนเดิมทุกประการ
//
// ⚠️ กับดักที่ต้องกันต่อ (บทเรียนเดิมของโปรเจกต์):
//   1. คืนสูงสุด 1,000 แถว/คำขอ — ขอ 5,000 ก็ได้ 1,000 โดยไม่มี error ให้รู้
//   2. ต้องมี ORDER ที่ "ไม่มีทางเสมอกัน" เสมอ ไม่งั้นแบ่งหน้าแล้วแถวซ้ำ/หาย
//      เลขงานขายเดินแยกรายสาขา → ต้องพ่วง dealer_code เป็นตัวตัดสินท้ายสุด
//   3. เกินเพดานแล้วต้อง "บอก" ไม่ใช่ตัดเงียบ — ที่นี่คืนธง partial กลับไปให้ฝั่งแอปเตือนผู้ใช้
export const PAGE_ROWS = 1000;
export const PAGE_HARD_CAP = 50000;
export const TIEBREAK_COL = "dealer_code";

type Row = Record<string, unknown>;
type RowsResult = { data: unknown[] | null; error: { message: string; code?: string } | null };

/** ผลของการไล่ดึงทั้งตาราง — partial = ชนเพดาน ข้อมูลไม่ครบ (ฝั่งแอปต้องเตือนผู้ใช้) */
export type PagedRows = { rows: Row[]; partial: boolean };

export async function pageAll(
  run: (from: number, to: number) => PromiseLike<RowsResult>,
  /** เพดานเฉพาะครั้งนี้ (เช่น scope ทั้งเครือ) — ไม่ส่งมา = ใช้เพดานสูงสุดของระบบ */
  cap = PAGE_HARD_CAP,
): Promise<PagedRows> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await run(from, from + PAGE_ROWS - 1);
    if (error) throw new PageError(error.message, error.code);
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < PAGE_ROWS) break;
    if (out.length >= cap) return { rows: out.slice(0, cap), partial: true };
  }
  return { rows: out, partial: out.length > cap };
}

/** ผู้เรียกขอก้อนใหญ่ (limit > 1,000) — ต้องไล่ทีละหน้าเหมือนกัน ไม่งั้นได้แค่ 1,000 แถวแรกเงียบ ๆ */
export async function rangedFetch<T extends Row>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null; count?: number | null }>,
  limit: number, offset: number,
): Promise<{ rows: T[]; total: number }> {
  const out: T[] = [];
  let total = 0;
  for (let from = offset; out.length < limit; from += PAGE_ROWS) {
    const to = Math.min(from + PAGE_ROWS, offset + limit) - 1;
    const { data, error, count } = await buildQuery(from, to);
    if (error) throw new PageError(error.message, error.code);
    if (count != null) total = count;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < to - from + 1) break;
  }
  return { rows: out, total };
}

/** error จากฐานข้อมูลที่หลุดออกมาระหว่างไล่หน้า — handler จับแล้วแปลงเป็นคำตอบพร้อมรหัส */
export class PageError extends Error {
  code?: string;
  constructor(message: string, code?: string) { super(message); this.name = "PageError"; this.code = code; }
}
