import { NextResponse, type NextRequest } from "next/server";
import { cspWithNonce } from "@pms/shared/lib/securityHeaders.mjs";

// ── ออก "รหัสยืนยันสคริปต์" (nonce) ใหม่ทุกคำขอ — ของจริงที่กัน XSS ได้ ───────────────
//
// ที่มา (ผลตรวจสอบระบบ 7 ส.ค. 69 · L-2): CSP เดิมเปิดบังคับใช้แล้วก็จริง แต่ยังต้องอนุญาต
//   'unsafe-inline' ให้ Next.js hydrate = อนุญาตสคริปต์ที่ฝังในหน้าทุกตัว รวมถึงตัวที่ถูกแทรกเข้ามา
//   จึงกัน XSS ไม่ได้จริง (บันทึกไว้ตอนนั้นว่าต้องรื้อมาใช้ nonce ซึ่งคือใบนี้)
//
// วิธีทำงาน: สุ่มรหัสใหม่ทุกคำขอ → ใส่ไว้ในหัวข้อคำขอให้ Next.js อ่านไปแปะกับสคริปต์ของตัวเอง
//   → ใส่ในหัวข้อคำตอบเพื่อบอกเบราว์เซอร์ว่า "อนุญาตเฉพาะสคริปต์ที่ถือรหัสนี้"
//   สคริปต์แปลกปลอมที่แทรกเข้ามาทีหลังไม่มีทางรู้รหัส (สุ่มใหม่ทุกครั้ง) จึงถูกบล็อกจริง
//
// ⚠️ เฉพาะตอนรันจริงเท่านั้น — ตอนพัฒนา React Refresh ต้องใช้ eval และ Next ฝังสคริปต์
//    ที่ไม่มี nonce หลายจุด ถ้าบังคับตอน dev หน้าจะพังทั้งระบบและไล่หาสาเหตุยากมาก
//    ตอน dev จึงปล่อยให้ next.config เป็นคนใส่ CSP แบบเดิมไปตามเดิม
export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  // ⚠️ ห้ามใช้ Buffer ตรงนี้ — middleware ของ Next รันบน Edge runtime เสมอ ซึ่งไม่มี Buffer
  //    บนเครื่องเราใช้ next start (Node) จึงผ่าน แต่บน Vercel จะพังทันทีทุกคำขอ
  //    = ระบบล่มทั้งเว็บ และเป็นแบบที่ทดสอบบนเครื่องไม่มีวันเจอ · ใช้ btoa ซึ่งเป็นของมาตรฐานเว็บแทน
  const nonce = btoa(crypto.randomUUID());
  const csp = cspWithNonce(nonce);

  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  // ⚠️ บรรทัดนี้คือหัวใจ — Next.js อ่าน nonce จาก "หัวข้อ CSP ของคำขอ" เท่านั้น
  //    ไม่ได้อ่านจาก x-nonce (ตัวนั้นมีไว้ให้โค้ดเราเรียกใช้เองถ้าต้องแปะสคริปต์เพิ่ม)
  //    ตอนแรกตั้งแค่ x-nonce แล้วพบว่าสคริปต์ 29 ตัวในหน้าไม่มี nonce เลยสักตัว
  //    เบราว์เซอร์จึงบล็อกทั้งหมด → หน้าขึ้นแต่กดอะไรไม่ได้ (ยิงพิสูจน์แล้ว 7 ส.ค. 69)
  headers.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  // ข้ามไฟล์นิ่ง/รูป — ไม่ใช่หน้าเว็บ ไม่ต้องมี CSP และการวิ่งผ่าน middleware ทุกไฟล์ทำให้ช้าเปล่า ๆ
  matcher: [
    { source: "/((?!_next/static|_next/image|favicon.ico).*)", missing: [{ type: "header", key: "next-router-prefetch" }] },
  ],
};
