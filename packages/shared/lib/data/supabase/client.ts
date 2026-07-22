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
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return _client;
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
