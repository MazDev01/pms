// ── พื้นฐานของทุกเส้นทาง /api/v1 ─────────────────────────────────────────────────
//
// ระยะ 1 ของแผนแยก backend — ย้าย "ท่อส่งข้อมูล" มาที่เซิร์ฟเวอร์ ยังไม่ย้าย "กฎธุรกิจ"
//
// ⚠️ หลักสำคัญของระยะนี้: พฤติกรรมต้องเหมือนเดิมเป๊ะ
//   backend ทำงาน "ในนามผู้ใช้ที่เรียกมา" โดยส่งใบผ่าน (JWT) ของเขาต่อให้ฐานข้อมูล
//   ไม่ได้ใช้ service_role — RLS ทั้ง 72 กฎจึงยังบังคับเหมือนเดิมทุกประการ
//   ผู้ใช้เห็นข้อมูลชุดเดิม สิทธิ์เท่าเดิม ต่างแค่คำขอเดินผ่านเซิร์ฟเวอร์ของเราอีกทอด
//
//   ทำแบบนี้เพราะถ้าเปลี่ยนทั้ง "ทางเดิน" และ "กฎ" พร้อมกัน เวลาพังจะแยกไม่ออกว่า
//   พังเพราะย้ายท่อ หรือพังเพราะกฎเปลี่ยน · การย้าย service_role + กฎ อยู่ที่ระยะ 2 และ 4
import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PageError } from "./_page";

export const runtime = "nodejs";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** ตอบกลับแบบมีเหตุผลติดไปด้วยเสมอ — หน้าเว็บเอาไปแสดงตรง ๆ ได้
 *  code = รหัสของ Postgres (เช่น 23503 ชน FK) — ฝั่งแอปแปลงเป็นข้อความที่คนอ่านรู้เรื่องต่อ
 *  ไม่ส่งไปด้วยจะเสียความสามารถนั้นทั้งระบบ (friendlyError อ่านจาก DbError.code) */
export function fail(status: number, error: string, code?: string) {
  return NextResponse.json(code ? { error, code } : { error }, { status });
}

export function ok<T>(data: T) {
  // ข้อมูลผู้ใช้ห้ามถูกแคชโดยตัวกลางใด ๆ (คนละสาขาเห็นคนละชุด)
  return NextResponse.json(data as object, { headers: { "Cache-Control": "no-store, private" } });
}

/** สร้าง client ที่ "เป็นตัวผู้ใช้คนที่เรียกมา" — RLS ทำงานเหมือนตอนเบราว์เซอร์ยิงเอง */
export function asCaller(req: NextRequest): SupabaseClient | null {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !URL_ || !ANON) return null;
  return createClient(URL_, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** ห่อ handler: จับ error ที่หลุดออกมา ไม่ให้ stack trace โผล่ถึงเบราว์เซอร์ แต่ต้องมี log ฝั่งเซิร์ฟเวอร์ */
export function handler(
  name: string,
  fn: (req: NextRequest, sb: SupabaseClient) => Promise<Response>,
) {
  return async (req: NextRequest): Promise<Response> => {
    const sb = asCaller(req);
    if (!sb) return fail(401, "ยังไม่ได้เข้าสู่ระบบ");
    try {
      return await fn(req, sb);
    } catch (e) {
      // error ของฐานข้อมูลที่หลุดออกมาระหว่างไล่หน้า — ต้องส่งข้อความจริงกลับไป ไม่ใช่กลืนเป็น "ขัดข้อง"
      if (e instanceof PageError) return dbFail(name, e);
      console.error(`[api/v1/${name}]`, e);
      return fail(503, "ระบบขัดข้องชั่วคราว — ลองใหม่อีกครั้ง");
    }
  };
}

/** แปลง error ของ supabase เป็นคำตอบ — ต้องไม่กลืนเงียบ (บทเรียนซ้ำ ๆ ของโปรเจกต์นี้) */
export function dbFail(name: string, error: { message: string; code?: string }) {
  console.error(`[api/v1/${name}] ฐานข้อมูลปฏิเสธ`, error);
  return fail(503, error.message || "อ่าน/เขียนฐานข้อมูลไม่สำเร็จ", error.code);
}
