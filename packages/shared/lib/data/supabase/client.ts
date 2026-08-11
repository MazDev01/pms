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
      // ── ที่เก็บใบผ่านเข้าระบบ: localStorage (ใช้ร่วมกันทุกแท็บ) ────────────────────
      //
      // เคยเป็น sessionStorage (แยกต่อแท็บ) เพื่อกันบั๊กบัญชีปนข้ามแท็บ:
      //   เปิดสาขา ก. ไว้ แล้วล็อกอินสาขา ข. ในแท็บใหม่ → แท็บของสาขา ก. รีเฟรชแล้ว
      //   เห็นข้อมูลของสาขา ข. แบบเงียบ ๆ ทั้งที่หัวจอยังเขียนชื่อสาขา ก.
      //
      // แต่มันแลกมาด้วยราคาที่ผู้ใช้จ่ายทุกวัน (ยืนยันด้วยเบราว์เซอร์จริง 11 ส.ค. 69):
      //   เปิดแท็บใหม่ = เด้งกลับหน้าเข้าสู่ระบบ ทั้งที่ยังไม่เคยกดออกจากระบบเลย
      //   ปิดเบราว์เซอร์แล้วเปิดใหม่ = ต้องล็อกอินใหม่ทุกครั้ง
      //   กดลิงก์ที่เปิดแท็บใหม่ = ต้องล็อกอินใหม่
      //
      // จึงกลับมาใช้ localStorage แล้วกันบั๊กเดิมที่ต้นเหตุจริงแทน — ดูตัวกันสลับบัญชี
      // ใน supabaseAuth.ts (sbOnChange): ถ้าบัญชีในเบราว์เซอร์เปลี่ยนคน แท็บที่ค้างอยู่
      // จะโหลดหน้าใหม่ทั้งหน้า ไม่ใช่เอาข้อมูลบัญชีใหม่มาปะทับหน้าจอของบัญชีเดิม
      // (แก้ที่ต้นเหตุ = ได้ทั้งความถูกต้องและความสะดวก ไม่ต้องเลือกอย่างใดอย่างหนึ่ง)
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return _client;
}

/** มีเซสชันเก็บอยู่ในแท็บนี้ไหม (ยังไม่ตรวจว่าหมดอายุ — แค่ "เคยล็อกอินและยังไม่ออก")
 *
 *  ใช้กันไม่ให้ยิงคำขอข้อมูลตอนที่ยังไม่ได้ล็อกอิน (7 ส.ค. 69)
 *  คำขอพวกนั้นถูกฐานข้อมูลปฏิเสธทุกครั้งอยู่แล้ว (401) จึงไม่มีประโยชน์ที่จะยิง
 *  มีแต่ทำให้หน้า login มีหน้าจอ error แดงเด้งคาไว้ · อ่านจาก localStorage โดยตรง
 *  (คีย์ของ supabase-js) เพราะต้องตอบได้ทันทีแบบไม่ต้องรอ — getSession() เป็น async
 */
export function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  // ⚠️ ต้องอ่านที่เดียวกับที่ createClient เก็บ (localStorage) — อ่านคนละที่แล้วจะตอบว่า
  //    "ยังไม่ได้ล็อกอิน" ทั้งที่ล็อกอินอยู่ ทุกคำขอข้อมูลจะถูกปฏิเสธก่อนออกจากเครื่องด้วยซ้ำ
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
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
