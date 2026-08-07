// ── หัวข้อความปลอดภัยของหน้าเว็บ (ใช้ร่วมกันทั้งแอป HQ และแอปตัวแทน) ─────────────
//
// เดิมทั้งสองแอปไม่ได้ตั้งอะไรเลย เบราว์เซอร์จึงยอมทำสิ่งที่ไม่ควรทำได้หลายอย่าง
// (ผลตรวจสอบระบบรอบ 2 · ความปลอดภัย):
//   • หน้าเว็บถูกฝังใน iframe ของเว็บอื่นได้ → หลอกให้ผู้ใช้กดปุ่มโดยไม่รู้ตัว (clickjacking)
//   • เบราว์เซอร์เดาชนิดไฟล์เอง → ไฟล์แนบที่ผู้ใช้อัปโหลดอาจถูกรันเป็นหน้าเว็บ
//   • ที่อยู่หน้าจอ (ซึ่งมีรหัสสาขา/เลขที่เอกสาร) ถูกส่งต่อไปเว็บภายนอกผ่าน referrer
//
// ── CSP: เปลี่ยนจาก "รายงานอย่างเดียว" เป็น "บังคับใช้จริง" แล้ว (7 ส.ค. 69 · L-2) ──────
//
// ⚠️ ต้องเข้าใจให้ตรงกันว่าได้อะไรและไม่ได้อะไร:
//   ไม่ได้ — การกัน XSS แบบเต็มรูปแบบ · เพราะ script-src ยังต้องเปิด 'unsafe-inline'/'unsafe-eval'
//            ให้ Next.js hydrate หน้าได้ · ถ้าจะกันจริงต้องเปลี่ยนไปใช้ nonce ต่อคำขอ (งานใหญ่ แยกทำ)
//   ได้จริง — ห้ามส่งข้อมูลออกไปเซิร์ฟเวอร์ภายนอกที่ไม่ได้อนุญาต (connect-src) ← มีค่าที่สุดในชุดนี้
//            เพราะต่อให้มีสคริปต์แปลกปลอมหลุดเข้ามา ก็ส่งข้อมูลลูกค้าออกไปไม่ได้
//            + ห้ามเว็บอื่นฝังหน้าเราใน iframe + ห้ามเปลี่ยนปลายทางของฟอร์ม + ห้ามเปลี่ยน base URL
//
// ก่อนเปิดบังคับใช้ ไล่ตรวจแล้วว่ามีอะไรจะโดนบล็อกบ้าง:
//   • ฟอนต์ของหน้าเว็บ — ไม่กระทบ ถูกฝังมากับตัวแอปตอน build แล้ว (next/font/google)
//   • ฟอนต์ของ "ใบเสนอราคาที่พิมพ์ออกมา" — กระทบ! quotationPrint.ts ดึง Sarabun จากภายนอกตอนใช้งานจริง
//     หน้าต่างพิมพ์สืบทอด CSP มาจากหน้าที่เปิดมัน → ถ้าไม่เปิดทางไว้ เอกสารจะตกไปใช้ฟอนต์สำรอง
//     หน้าตาเพี้ยนจากที่ออกแบบ (จึงเปิดทางให้ fonts.googleapis.com / fonts.gstatic.com โดยเฉพาะ)
//   • ระบบแจ้งเตือนข้อผิดพลาด (Sentry) — ยังไม่ได้เปิดใช้ (ไม่ได้ตั้ง DSN) จึงไม่ต้องเปิดทาง
//     ⚠️ ถ้าวันหลังเปิดใช้ ต้องกลับมาเติมปลายทางของ Sentry ที่ connect-src ด้วย ไม่งั้นรายงานส่งไม่ออก
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // Next.js hydrate ด้วย inline script
  // fonts.googleapis.com = สไตล์ชีตของฟอนต์ในเอกสารที่พิมพ์ (ดูเหตุผลด้านบน)
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",                  // โลโก้/รูปโปรไฟล์เก็บเป็น data URL
  "font-src 'self' data: https://fonts.gstatic.com",    // ไฟล์ฟอนต์จริงของเอกสารที่พิมพ์
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
  { key: "Content-Security-Policy", value: CSP },
];

/** ใส่หัวข้อความปลอดภัยให้ทุกหน้า — เรียกจาก next.config.ts ของแต่ละแอป */
export function securityHeaderRules() {
  return [{ source: "/:path*", headers: SECURITY_HEADERS }];
}
