"use client";

// ── ตัวเรียกงาน admin ที่ต้องทำ "ฝั่งเซิร์ฟเวอร์" (service_role) ────────────────────
// งานอย่างสร้างบัญชีเข้าระบบต้องใช้ service_role ซึ่งอยู่ในเบราว์เซอร์ไม่ได้
// จึงยิงไปที่ Route Handler ของแอป HQ (/api/admin/*) ที่ถือ service_role ฝั่งเซิร์ฟเวอร์แทน
// (โมดูลนี้อยู่ฝั่ง client — ส่งแค่ JWT ของผู้เรียกไปให้เซิร์ฟเวอร์ตรวจสิทธิ์เอง ไม่แตะ service_role)
import { getSupabase } from "./data/supabase/client";
import { DATA_SOURCE } from "./data/config";

export type CreateDealerInput = {
  code: string; name: string; province: string; region: string; revenueTarget: number;
};
export type CreateDealerResult =
  | { ok: true; email: string; password: string }
  | { ok: false; error: string };

/** สร้างตัวแทน "พร้อมบัญชีเข้าระบบจริง" ผ่าน Route Handler ฝั่งเซิร์ฟเวอร์ (H5) */
export async function createDealerAccount(input: CreateDealerInput): Promise<CreateDealerResult> {
  // โหมดเดโม (local) ไม่มีระบบยืนยันตัวตนจริงให้ผูก — บอกตามจริง ไม่แกล้งทำสำเร็จ
  if (DATA_SOURCE !== "supabase") {
    return { ok: false, error: "โหมดเดโม: สร้างบัญชีตัวแทนจริงไม่ได้ (ต้องมีระบบยืนยันตัวตน)" };
  }
  let token = "";
  try {
    const { data } = await getSupabase().auth.getSession();
    token = data.session?.access_token ?? "";
  } catch { /* ไม่มี session */ }
  if (!token) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };

  try {
    const res = await fetch("/api/admin/dealers", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; email?: string; password?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `เซิร์ฟเวอร์ตอบกลับ ${res.status}` };
    return { ok: true, email: json.email ?? "", password: json.password ?? "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
