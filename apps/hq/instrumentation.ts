// Sentry (ฝั่งเซิร์ฟเวอร์) — เปิดอัตโนมัติเมื่อตั้ง NEXT_PUBLIC_SENTRY_DSN เท่านั้น
//
// ⚠️ ทำไมต้องมีไฟล์นี้ ทั้งที่มี instrumentation-client.ts อยู่แล้ว (เพิ่ม 7 ส.ค. 69 · Part 2):
//   ตัวฝั่ง client ดักได้เฉพาะข้อผิดพลาดที่เกิดในเบราว์เซอร์ของผู้ใช้
//   แต่งานที่ "พังแล้วเจ็บที่สุด" ของแอปนี้อยู่ฝั่งเซิร์ฟเวอร์ทั้งนั้น —
//   สร้างตัวแทน · สร้างบัญชีผู้ใช้ · เข้าระบบแทนตัวแทน (app/api/admin/**)
//   ถ้าพังจะได้แค่ข้อความ error กว้าง ๆ บนหน้าจอ ส่วนสาเหตุจริงอยู่ใน log ของเซิร์ฟเวอร์
//   ซึ่งไม่มีใครเปิดดู → รู้ตัวก็ต่อเมื่อผู้ใช้โทรมาบอกว่า "กดแล้วไม่ขึ้น"
//
// onRequestError = จุดที่ Next.js ส่งข้อผิดพลาดฝั่งเซิร์ฟเวอร์ทุกตัวมาให้ (หน้าเว็บ + API)
import { captureError } from "@pms/shared/lib/observability";

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({ dsn, tracesSampleRate: 0 });
}

export async function onRequestError(err: unknown, request: { path?: string }) {
  // ลง console เสมอ — ต่อให้ไม่ได้เปิด Sentry ก็ยังต้องมีร่องรอยไว้ตามหาสาเหตุ
  captureError(err, `server:${request?.path ?? "unknown"}`);
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(err);
  } catch { /* ระบบแจ้งเตือนพังต้องไม่ทำให้คำขอของผู้ใช้พังตาม */ }
}
