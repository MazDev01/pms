// ── ศูนย์รวมการรายงาน error (observability) ────────────────────────────────────
// จุดเดียวที่ทุก error สำคัญไหลผ่าน (repo เขียนล้มเหลว · realtime หลุด · ฯลฯ)
// เดิม error กระจายเป็น console.error/warn รายจุด → production พังตรงไหนไม่รู้ตัว
//
// provider-agnostic: shared ไม่ผูกกับ Sentry/เจ้าไหน — แค่ console เสมอ + ส่งต่อ "sink" ที่แอปลงทะเบียน
//   ต่อ provider ทีหลังได้โดยไม่ต้องแก้ที่เรียกใช้ (captureError อยู่แล้วทุกจุดสำคัญ)
//
// เปิด Sentry จริง = ตั้ง NEXT_PUBLIC_SENTRY_DSN ในแต่ละแอปพอ — ต่อสายไว้แล้วที่
//   apps/{hq,dealer}/instrumentation-client.ts (dynamic import · เปิดเมื่อมี DSN เท่านั้น)
//   @sentry/nextjs ติดตั้งแล้ว · ไม่มี DSN = Sentry ไม่ถูกโหลด (tree-shaken) error ยังลง console

export type ErrorContext = string;
type ErrorSink = (error: unknown, context?: ErrorContext) => void;

let sink: ErrorSink | null = null;

/** ลงทะเบียนปลายทางรายงาน error (เช่น Sentry) — เรียกครั้งเดียวตอนแอปเริ่ม · null = ปิด */
export function setErrorSink(fn: ErrorSink | null): void {
  sink = fn;
}

/** รายงาน error สำคัญ — console เสมอ + ส่งต่อ sink ถ้าลงทะเบียนไว้ (sink พังต้องไม่ล้มระบบ) */
export function captureError(error: unknown, context?: ErrorContext): void {
  console.error(context ? `[${context}]` : "[error]", error);
  try { sink?.(error, context); } catch { /* observability ต้องไม่ทำให้งานหลักพัง */ }
}

/** ตรวจว่าที่อยู่ปลายทางแจ้งเตือน (Sentry DSN) เขียนถูกรูปแบบไหม
 *
 *  ทำไมต้องมี: ถ้า DSN เพี้ยนแม้ตัวเดียว Sentry จะ "ปิดตัวเองเงียบ ๆ" ไม่มี error ไม่มี log
 *  = ระบบพังจริงแล้วไม่มีใครได้รับแจ้ง ซึ่งแย่กว่าไม่ได้ตั้งไว้เลย เพราะทุกคนคิดว่ามีคนเฝ้าอยู่
 *  (เจอตอนซ้อมแจ้งเตือน 3 ก.ย. 69 — ใส่ DSN ผิดรูปแบบแล้วไม่มีอะไรเกิดขึ้นเลยสักอย่าง)
 *
 *  รูปแบบที่ถูก: https://<กุญแจ>@<โฮสต์>/<หมายเลขโครงการ>
 */
export function dsnใช้ได้(dsn: string | undefined): boolean {
  if (!dsn) return false;
  try {
    const u = new URL(dsn);
    return /^https?:$/.test(u.protocol) && /^[A-Za-z0-9]+$/.test(u.username)
      && !!u.hostname && /^\/\d+$/.test(u.pathname);
  } catch { return false; }
}

/** เตือนดัง ๆ เมื่อ "ตั้ง DSN ไว้แต่เขียนผิด" — เงียบไว้เมื่อไม่ได้ตั้ง (ตั้งใจไม่เปิด) */
export function เตือนถ้าDsnเพี้ยน(dsn: string | undefined, ที่: string): boolean {
  if (!dsn) return false;
  if (dsnใช้ได้(dsn)) return true;
  console.error(`[observability] ที่อยู่แจ้งเตือน (SENTRY DSN) ของ ${ที่} เขียนผิดรูปแบบ — ระบบจะไม่ส่งแจ้งเตือนเลย ตรวจค่า NEXT_PUBLIC_SENTRY_DSN`);
  return false;
}
