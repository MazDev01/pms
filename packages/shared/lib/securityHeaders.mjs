// ── หัวข้อความปลอดภัยของหน้าเว็บ (ใช้ร่วมกันทั้งแอป HQ และแอปตัวแทน) ─────────────
//
// เดิมทั้งสองแอปไม่ได้ตั้งอะไรเลย เบราว์เซอร์จึงยอมทำสิ่งที่ไม่ควรทำได้หลายอย่าง
// (ผลตรวจสอบระบบรอบ 2 · ความปลอดภัย):
//   • หน้าเว็บถูกฝังใน iframe ของเว็บอื่นได้ → หลอกให้ผู้ใช้กดปุ่มโดยไม่รู้ตัว (clickjacking)
//   • เบราว์เซอร์เดาชนิดไฟล์เอง → ไฟล์แนบที่ผู้ใช้อัปโหลดอาจถูกรันเป็นหน้าเว็บ
//   • ที่อยู่หน้าจอ (ซึ่งมีรหัสสาขา/เลขที่เอกสาร) ถูกส่งต่อไปเว็บภายนอกผ่าน referrer
//
// CSP ตั้งแบบ "รายงานอย่างเดียว" ก่อน (Report-Only) โดยตั้งใจ:
//   Next.js ใช้สคริปต์แบบ inline ในการ hydrate หน้า ถ้าบังคับ CSP เต็มรูปแบบทันทีหน้าจะพังทั้งระบบ
//   ขั้นนี้จึงเก็บข้อมูลก่อนว่ามีอะไรถูกบล็อกบ้าง แล้วค่อยเปลี่ยนเป็นบังคับจริงเมื่อรายการนิ่งแล้ว
//   (บังคับทันทีโดยไม่ดูข้อมูลก่อน = เสี่ยงระบบล่มมากกว่าประโยชน์ที่ได้)
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // Next.js hydrate ด้วย inline script
  "style-src 'self' 'unsafe-inline'",                   // สไตล์เขียนติดกับอิลิเมนต์ทั้งระบบ
  "img-src 'self' data: blob: https:",                  // โลโก้/รูปโปรไฟล์เก็บเป็น data URL
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const SECURITY_HEADERS = [
  // ห้ามเว็บอื่นเอาหน้าเราไปฝังใน iframe
  { key: "X-Frame-Options", value: "DENY" },
  // ห้ามเบราว์เซอร์เดาชนิดไฟล์เอง
  { key: "X-Content-Type-Options", value: "nosniff" },
  // ส่ง referrer ข้ามเว็บให้น้อยที่สุด (ที่อยู่หน้าจอมีรหัสสาขา/เลขที่เอกสารอยู่)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // ระบบนี้ไม่ใช้กล้อง/ไมค์/ตำแหน่ง — ปิดไว้ทั้งหมด
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

/** ใส่หัวข้อความปลอดภัยให้ทุกหน้า — เรียกจาก next.config.ts ของแต่ละแอป */
export function securityHeaderRules() {
  return [{ source: "/:path*", headers: SECURITY_HEADERS }];
}
