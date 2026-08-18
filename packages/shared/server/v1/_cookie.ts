// ── ใบผ่านที่เก็บใน cookie ที่ JavaScript อ่านไม่ได้ (ระยะ 4) ──────────────────────
//
// เป้าหมายของระยะ 4: "ปิดประตูฐานข้อมูล" — ไม่ให้หน้าเว็บต่อฐานข้อมูลตรงได้อีก
//
// ⚠️ สิ่งที่แผนเดิมเขียนไว้ว่า "ถอนสิทธิ์ anon" ทำแล้วไม่ได้ผลอย่างที่ชื่อบอก:
//    กุญแจสาธารณะอ่าน/เขียนอะไรไม่ได้อยู่แล้วทุกตาราง (ยืนยันด้วย anon-exposure.spec.ts)
//    ประตูที่ยังเปิดจริงคือ "ใบผ่านของคนที่ล็อกอินแล้ว" ซึ่งวางอยู่ในเบราว์เซอร์ให้ JavaScript หยิบไปใช้ได้
//
// วิธีปิดที่เลือก: ย้ายใบผ่านไปไว้ใน cookie แบบ httpOnly
//   • JavaScript ในหน้าเว็บอ่านไม่ได้ → หยิบไปยิงเข้าฐานข้อมูลเองไม่ได้
//   • เบราว์เซอร์แนบ cookie ไปกับคำขอที่ยิงมาที่ backend ของเราให้เอง
//   • backend ยังทำงาน "ในนามผู้ใช้" เหมือนเดิม → **สิทธิ์ที่ฐานข้อมูล (RLS 72 กฎ) ยังเป็นตัวกันหลัก**
//     (ต่างจากทางเลือกที่ให้ backend ถือกุญแจแม่หลัก ซึ่งจะทำให้ RLS เลิกคุ้มครองการใช้งานปกติ
//      แล้วต้องเขียนการกันข้ามสาขาเองทั้ง 19 เส้นทาง — พลาดจุดเดียวข้อมูลสาขาอื่นรั่ว)
//
// ⚠️ ใช้ได้เฉพาะโหมด api — โหมด supabase หน้าเว็บต้องถือใบผ่านเองเพื่อคุยกับฐานข้อมูลตรง
import type { NextRequest } from "next/server";

/** ชื่อ cookie — ขึ้นต้น __Host- ไม่ได้เพราะตอนพัฒนาใช้ http (ข้อกำหนดของเบราว์เซอร์บังคับ https) */
export const ACCESS_COOKIE = "pms_at";
export const REFRESH_COOKIE = "pms_rt";

const isHttps = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https")
  || process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

/** ค่ามาตรฐานของ cookie ใบผ่าน — ต้องเหมือนกันทุกที่ ไม่งั้นลบไม่ออก/ทับไม่ได้ */
function base(maxAgeSec: number) {
  return {
    httpOnly: true,            // ⚠️ หัวใจของระยะนี้ — JavaScript อ่านไม่ได้
    sameSite: "lax" as const,  // กันถูกเว็บอื่นยิงแทนผู้ใช้ (CSRF) ในกรณีทั่วไป
    secure: isHttps(),         // ตอนพัฒนาเป็น http ถ้าบังคับ secure เบราว์เซอร์จะทิ้ง cookie ทิ้งเงียบ ๆ
    path: "/",
    maxAge: maxAgeSec,
  };
}

export const accessCookie  = (v: string, maxAgeSec: number) => ({ name: ACCESS_COOKIE,  value: v, ...base(maxAgeSec) });
export const refreshCookie = (v: string) => ({ name: REFRESH_COOKIE, value: v, ...base(60 * 60 * 24 * 30) });
/** ลบ cookie = ตั้งค่าว่างและหมดอายุทันที (ต้องส่งค่าตั้งอื่นให้ตรงกับตอนตั้ง ไม่งั้นเบราว์เซอร์ไม่ลบให้) */
export const clearCookie = (name: string) => ({ name, value: "", ...base(0) });

/** ใบผ่านของผู้เรียก — อ่านจาก cookie ก่อน แล้วค่อยถอยไปดู header
 *
 *  ⚠️ ยังรับ header อยู่โดยตั้งใจ: สคริปต์ดูแลระบบและชุดทดสอบยิงด้วย Bearer
 *     และช่วงเปลี่ยนผ่านหน้าเว็บบางส่วนยังส่ง header อยู่ — ตัดทิ้งทันทีจะพังเป็นแถบ
 *     ตัดออกได้เมื่อย้ายครบทุกจุดแล้ว (ดู docs/BACKEND-MIGRATION.md ระยะ 4) */
export function callerToken(req: NextRequest): string {
  const fromCookie = req.cookies.get(ACCESS_COOKIE)?.value?.trim();
  if (fromCookie) return fromCookie;
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}
