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
