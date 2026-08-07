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

// ── CSP แบบ "รหัสยืนยันต่อคำขอ" (nonce) — ของจริงที่กัน XSS ได้ ──────────────────────
//
// ต่างจาก CSP ข้างบนตรงไหน: ข้างบนต้องเปิด 'unsafe-inline' ทิ้งไว้ให้ Next.js hydrate
//   ซึ่งเท่ากับ "อนุญาตสคริปต์ที่ฝังในหน้าทุกตัว" — สคริปต์แปลกปลอมที่แทรกเข้ามาก็รันได้เหมือนกัน
//   แบบ nonce ออกรหัสสุ่มใหม่ทุกคำขอ แล้วอนุญาตเฉพาะสคริปต์ที่ถือรหัสนั้น
//   สคริปต์ที่ถูกแทรกเข้ามาภายหลังไม่มีทางรู้รหัส จึงถูกบล็อกจริง
//   'strict-dynamic' = สคริปต์ที่ผ่านแล้วโหลดสคริปต์อื่นต่อได้ (Next.js ต้องใช้)
//
// ⚠️ ใช้เฉพาะตอนรันจริง (production) เท่านั้น — ตอนพัฒนา React Refresh ต้องใช้ eval
//    และ Next.js ฝังสคริปต์ที่ไม่มี nonce หลายจุด ถ้าบังคับตอน dev หน้าจะพังทั้งระบบ
//    ระดับความปลอดภัยตอนพัฒนาจึงเท่าเดิม (ซึ่งไม่ใช่ปัญหา เพราะไม่มีผู้ใช้จริงเข้าถึง)
export function cspWithNonce(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",       // ปิด <object>/<embed> — ช่องรันโค้ดเก่าที่ไม่มีใครใช้แล้ว
  ].join("; ");
}

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

/** ใส่หัวข้อความปลอดภัยให้ทุกหน้า — เรียกจาก next.config.ts ของแต่ละแอป
 *
 *  ⚠️ ตอนรันจริง (production) จะ "ไม่ใส่ CSP จากที่นี่" เพราะ middleware เป็นคนใส่แบบ nonce แทน
 *     ถ้าใส่ทั้งสองที่ เบราว์เซอร์จะบังคับ "ทั้งสองอัน" พร้อมกัน (ตัดกันเป็นเซตร่วม)
 *     ผลคือ nonce ใช้ไม่ได้จริงเพราะโดนอีกอันที่ไม่มี nonce บล็อกซ้ำ — หน้าจะพังแบบหาสาเหตุยาก
 *     หัวข้ออีก 4 อันไม่เกี่ยวกับ CSP จึงยังใส่จากที่นี่เหมือนเดิมทั้งสองโหมด
 */
export function securityHeaderRules() {
  const isProd = process.env.NODE_ENV === "production";
  const headers = isProd ? SECURITY_HEADERS.filter(h => h.key !== "Content-Security-Policy") : SECURITY_HEADERS;
  return [{ source: "/:path*", headers }];
}
