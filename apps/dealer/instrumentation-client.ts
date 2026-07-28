// Sentry (ฝั่ง client) — เปิดอัตโนมัติเมื่อตั้ง NEXT_PUBLIC_SENTRY_DSN เท่านั้น
// ไม่ตั้ง DSN = ไม่โหลด Sentry เลย (dynamic import → tree-shaken ตอน build) · error ยังลง console ผ่าน captureError
// ต่อเข้ากับศูนย์รวม observability (setErrorSink) → repo เขียนล้มเหลว/realtime หลุด ไหลเข้า Sentry
import { setErrorSink } from "@pms/shared/lib/observability";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init({ dsn, tracesSampleRate: 0 });
      setErrorSink((err, ctx) => Sentry.captureException(err, { extra: { context: ctx } }));
    })
    .catch((e) => console.warn("[observability] เปิด Sentry ไม่สำเร็จ", e));
}
