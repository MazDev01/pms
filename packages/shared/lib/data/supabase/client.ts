"use client";

// Supabase client — จุดเชื่อมต่อ backend จริง (เฟส B)
// อ่านค่าจาก ENV · ถ้ายังไม่ตั้งค่า → ใช้ LocalAdapter (ดู config.ts / index.ts)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** ตั้งค่า Supabase ครบหรือยัง (มี URL + anon key) */
export function isSupabaseConfigured(): boolean {
  return Boolean(URL && ANON);
}

let _client: SupabaseClient | null = null;

/** client แบบ singleton — สร้างครั้งเดียว ใช้ซ้ำทั้งแอป */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase ยังไม่ตั้งค่า — กำหนด NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ใน .env.local",
    );
  }
  if (!_client) {
    _client = createClient(URL, ANON, {
      // ⚠️ storage: sessionStorage (ไม่ใช่ default localStorage) — กันบัญชีสลับข้ามแท็บ
      //   default ของ supabase-js ใช้ localStorage ซึ่งใช้ร่วมกันทุกแท็บของ origin เดียวกัน
      //   ล็อกอินบัญชีที่สองในแท็บใหม่จะเขียนทับ session เดิม ทำให้แท็บเก่าที่เปิดค้างไว้
      //   (บัญชีแรก) รีเฟรชแล้วกลายเป็นเห็นข้อมูลของบัญชีที่สองแทนแบบเงียบๆ — พบจริงจากทดสอบ QA
      //   (เคส 7: เปิด RYG ไว้ ล็อกอิน CNX ในแท็บใหม่ → แท็บ RYG เห็นข้อมูล CNX)
      //   sessionStorage แยกอิสระต่อแท็บ (ต่างจาก localStorage) จึงตัดปัญหานี้ทั้งหมด
      //   trade-off: ปิดเบราว์เซอร์ทั้งหมดแล้วเปิดใหม่ต้องล็อกอินใหม่ (ไม่ persist ข้ามการปิดเบราว์เซอร์
      //   เหมือน localStorage เดิม) — เช็กบ็อกซ์ "จดจำฉันไว้ในระบบ" ในฟอร์ม login ปัจจุบันก็ไม่ได้ผูกกับ
      //   พฤติกรรมนี้อยู่แล้ว (ไม่เคยถูกส่งเข้า signIn จริง) จึงไม่มีอะไรเสียเพิ่มจากจุดนั้น
      auth: { persistSession: true, autoRefreshToken: true, storage: typeof window !== "undefined" ? window.sessionStorage : undefined },
    });
  }
  return _client;
}

/** มีเซสชันเก็บอยู่ในแท็บนี้ไหม (ยังไม่ตรวจว่าหมดอายุ — แค่ "เคยล็อกอินและยังไม่ออก")
 *
 *  ใช้กันไม่ให้ยิงคำขอข้อมูลตอนที่ยังไม่ได้ล็อกอิน (7 ส.ค. 69)
 *  คำขอพวกนั้นถูกฐานข้อมูลปฏิเสธทุกครั้งอยู่แล้ว (401) จึงไม่มีประโยชน์ที่จะยิง
 *  มีแต่ทำให้หน้า login มีหน้าจอ error แดงเด้งคาไว้ · อ่านจาก sessionStorage โดยตรง
 *  (คีย์ของ supabase-js) เพราะต้องตอบได้ทันทีแบบไม่ต้องรอ — getSession() เป็น async
 */
export function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) return true;
    }
  } catch { /* เบราว์เซอร์ปิด storage — ถือว่าไม่มี */ }
  return false;
}

/** ตรวจว่าเชื่อมต่อ DB ได้จริงไหม (ping ตาราง dealers) — ใช้ตอน health-check */
export async function checkConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await getSupabase().from("dealers").select("code").limit(1);
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
