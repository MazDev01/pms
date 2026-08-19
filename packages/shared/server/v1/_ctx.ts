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
import { BadInput } from "./_valid";
import { callerToken } from "./_cookie";

export const runtime = "nodejs";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
// ── จำกัดจำนวนคำขอต่อคนต่อนาที (ผลตรวจระบบ 19 ส.ค. 69) ──────────────────────────
//
// เดิมด่านนี้มีเฉพาะ /api/admin/* (7 เส้นทาง) ส่วนงานขายทั้งหมดยิงได้ไม่จำกัด
// บัญชีตัวแทนที่ถูกขโมยจึงดูดข้อมูลทั้งสาขาออกไปได้เร็วมาก โดยไม่มีอะไรหน่วง
//
// โควตาตั้งจากการใช้งานจริง: เปิดหน้าหนึ่งยิงราว 10-15 คำขอ (โหลด 5 ตาราง + สรุป + ตั้งค่า)
//   เซลส์ที่ทำงานหนักเปิดหลายหน้าต่อนาทีก็ยังอยู่ใต้ 600 สบาย ๆ — ด่านนี้จึงไม่รบกวนคนทำงานจริง
//   แต่หยุดสคริปต์ที่ไล่ดูดข้อมูลรัว ๆ ได้ทันที
// การเขียนตั้งต่ำกว่ามาก — คนทำงานปกติกดบันทึกหลักสิบครั้ง/นาทีก็มากแล้ว
const LIMIT_READ  = { max: 600, windowSec: 60 };
const LIMIT_WRITE = { max: 120, windowSec: 60 };

/** ตรวจโควตาของผู้เรียกเอง — นับด้วย client ของผู้ใช้คนนั้น ไม่ต้องใช้กุญแจระดับระบบ
 *
 *  ⚠️ แอปตัวแทนไม่มี (และไม่ควรมี) กุญแจระดับระบบ ถ้าผูกด่านนี้ไว้กับกุญแจนั้น
 *     ฝั่งตัวแทนจะข้ามด่านทั้งหมดแบบเงียบ ๆ — ซึ่งเป็นฝั่งที่ต้องกันมากที่สุด
 *  คีย์ประกอบจาก auth.uid() ที่ฝั่งฐานข้อมูล (0146) ผู้เรียกเลือกไม่ได้ว่าจะนับให้ใคร
 *  fail-open: ตัวนับมีปัญหา = ปล่อยผ่าน ดีกว่าปิดบริการเพราะตัวนับพัง */
async function withinQuota(sb: SupabaseClient, scope: "read" | "write", max: number, windowSec: number): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("check_own_rate_limit", {
      p_scope: scope, p_max: max, p_window_seconds: windowSec,
    });
    if (error) { console.warn("[rateLimit] RPC ขัดข้อง — ปล่อยผ่าน", error.message); return true; }
    return data !== false;
  } catch (e) {
    console.warn("[rateLimit] ปล่อยผ่าน", e);
    return true;
  }
}

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

/** สร้าง client ที่ "เป็นตัวผู้ใช้คนที่เรียกมา" — RLS ทำงานเหมือนตอนเบราว์เซอร์ยิงเอง
 *  ใบผ่านมาจาก cookie (ระยะ 4) หรือ header (สคริปต์ดูแลระบบ/ชุดทดสอบ) — ดู _cookie.ts */
export function asCaller(req: NextRequest): SupabaseClient | null {
  const token = callerToken(req);
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
    // ด่านจำกัดจำนวนคำขอ — อ่านกับเขียนแยกถังกัน (โหลดหน้าจอไม่ควรกินโควตาของการบันทึก)
    const เขียน = req.method !== "GET" && req.method !== "HEAD";
    const { max, windowSec } = เขียน ? LIMIT_WRITE : LIMIT_READ;
    if (!(await withinQuota(sb, เขียน ? "write" : "read", max, windowSec))) {
      console.warn(`[api/v1/${name}] เกินโควตา (${เขียน ? "write" : "read"})`);
      return fail(429, "คำขอถี่เกินไป — รอสักครู่แล้วลองใหม่อีกครั้ง");
    }
    try {
      return await fn(req, sb);
    } catch (e) {
      // ข้อมูลขาเข้าผิดรูป — ผู้เรียกแก้เองได้ ต้องบอกให้ชัดว่าช่องไหนผิด ไม่ใช่ 503 "ระบบขัดข้อง"
      if (e instanceof BadInput) return fail(400, e.message);
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
