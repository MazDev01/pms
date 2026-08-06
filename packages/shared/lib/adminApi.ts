"use client";

// ── ตัวเรียกงาน admin ที่ต้องทำ "ฝั่งเซิร์ฟเวอร์" (service_role) ────────────────────
// งานอย่างสร้างบัญชีเข้าระบบต้องใช้ service_role ซึ่งอยู่ในเบราว์เซอร์ไม่ได้
// จึงยิงไปที่ Route Handler ของแอป HQ (/api/admin/*) ที่ถือ service_role ฝั่งเซิร์ฟเวอร์แทน
// (โมดูลนี้อยู่ฝั่ง client — ส่งแค่ JWT ของผู้เรียกไปให้เซิร์ฟเวอร์ตรวจสิทธิ์เอง ไม่แตะ service_role)
import { getSupabase } from "./data/supabase/client";
import { DATA_SOURCE } from "./data/config";
import { friendlyError } from "./friendlyError";

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
    return { ok: false, error: friendlyError(e, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้") };
  }
}

// อ่าน access_token ของผู้เรียกจาก session ปัจจุบัน — ส่งไปให้เซิร์ฟเวอร์ตรวจสิทธิ์เอง
async function callerToken(): Promise<string> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? "";
  } catch { return ""; }
}

// ── ผู้ใช้สำนักงานใหญ่ (HQ) — สร้าง/ลบ ผ่าน Route Handler ฝั่งเซิร์ฟเวอร์ ──
export type CreateHQUserInput = {
  name: string; email: string; phone: string; role: string; department: string;
  status: "active" | "inactive"; avatar?: string;
};
export type CreateHQUserResult =
  | { ok: true; id: string; email: string; password: string }
  | { ok: false; error: string };

/** สร้างผู้ใช้ HQ "พร้อมบัญชีเข้าระบบจริง" — รหัสผ่านสุ่มที่เซิร์ฟเวอร์ คืนมาโชว์ครั้งเดียว */
export async function createHQUser(input: CreateHQUserInput): Promise<CreateHQUserResult> {
  if (DATA_SOURCE !== "supabase") {
    return { ok: false, error: "โหมดเดโม: สร้างบัญชีผู้ใช้จริงไม่ได้ (ต้องมีระบบยืนยันตัวตน)" };
  }
  const token = await callerToken();
  if (!token) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };
  try {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; id?: string; email?: string; password?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `เซิร์ฟเวอร์ตอบกลับ ${res.status}` };
    return { ok: true, id: json.id ?? "", email: json.email ?? "", password: json.password ?? "" };
  } catch (e) {
    return { ok: false, error: friendlyError(e, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้") };
  }
}

/** ลบผู้ใช้ HQ จริง (auth + profile) ผ่าน Route Handler ฝั่งเซิร์ฟเวอร์ */
export async function deleteHQUser(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (DATA_SOURCE !== "supabase") {
    return { ok: false, error: "โหมดเดโม: ลบบัญชีจริงไม่ได้ (ต้องมีระบบยืนยันตัวตน)" };
  }
  const token = await callerToken();
  if (!token) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };
  try {
    const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `เซิร์ฟเวอร์ตอบกลับ ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้") };
  }
}

/** ออกรหัสผ่านใหม่ให้ตัวแทน (HQ คุมรหัสผ่านของตัวแทนเท่านั้น — ตัวแทนไม่มีสิทธิ์ตั้ง/ขอรีเซ็ตเอง)
 *  รหัสใหม่สุ่มที่เซิร์ฟเวอร์เสมอ คืนมาโชว์ครั้งเดียวเหมือนตอนสร้างบัญชี */
export async function resetDealerPassword(code: string): Promise<CreateDealerResult> {
  if (DATA_SOURCE !== "supabase") {
    return { ok: false, error: "โหมดเดโม: รีเซ็ตรหัสผ่านจริงไม่ได้ (ต้องมีระบบยืนยันตัวตน)" };
  }
  const token = await callerToken();
  if (!token) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };
  try {
    const res = await fetch(`/api/admin/dealers?code=${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; email?: string; password?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `เซิร์ฟเวอร์ตอบกลับ ${res.status}` };
    return { ok: true, email: json.email ?? "", password: json.password ?? "" };
  } catch (e) {
    return { ok: false, error: friendlyError(e, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้") };
  }
}

/** อีเมลเข้าระบบจริงของแต่ละสาขา (รหัสสาขา → อีเมล) — สาขาที่ไม่มีบัญชีจะไม่มีคีย์
 *  ต้องถามเซิร์ฟเวอร์ ห้ามคำนวณเอาเองจากรหัสสาขา (อีเมลจริงของแต่ละสาขาไม่ได้เป็นสูตรเดียวกัน) */
export async function listDealerLoginEmails(): Promise<Record<string, string>> {
  if (DATA_SOURCE !== "supabase") return {};
  const token = await callerToken();
  if (!token) return {};
  try {
    const res = await fetch("/api/admin/dealers/logins", { headers: { authorization: `Bearer ${token}` } });
    const json = (await res.json().catch(() => ({}))) as { logins?: Record<string, string> };
    return res.ok ? (json.logins ?? {}) : {};
  } catch { return {}; }
}

/** เปิดดูรหัสผ่านของตัวแทน (HQ ที่มีสิทธิ์ dealers:manage เท่านั้น)
 *  ดึงตอนกดดูเท่านั้น — ห้ามโหลดล่วงหน้ามาไว้ในหน้า เพราะเคยมีรหัสหลุดไปกับ bundle มาแล้ว
 *  ฝั่งเซิร์ฟเวอร์บันทึก audit ทุกครั้งที่เรียก (ดู /api/admin/dealers/secret) */
export async function viewDealerPassword(code: string): Promise<
  { ok: true; password: string; updatedAt: string; updatedBy: string } | { ok: false; error: string }
> {
  if (DATA_SOURCE !== "supabase") {
    return { ok: false, error: "โหมดเดโม: รหัสผ่านแสดงอยู่ในหน้าอยู่แล้ว" };
  }
  const token = await callerToken();
  if (!token) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };
  try {
    const res = await fetch(`/api/admin/dealers/secret?code=${encodeURIComponent(code)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => ({}))) as
      { error?: string; password?: string; updatedAt?: string; updatedBy?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `เซิร์ฟเวอร์ตอบกลับ ${res.status}` };
    return { ok: true, password: json.password ?? "", updatedAt: json.updatedAt ?? "", updatedBy: json.updatedBy ?? "" };
  } catch (e) {
    return { ok: false, error: friendlyError(e, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้") };
  }
}

/** ขอลิงก์ "เข้าระบบแทนตัวแทน" — ไม่ต้องรู้/รีเซ็ตรหัสผ่านตัวแทนเลย (ใช้ Supabase magic-link)
 *  ลิงก์ใช้ได้ครั้งเดียวแล้วหมดอายุ — เปิดในแท็บใหม่ไปยังแอปตัวแทนเสมอ (คนละ origin กับ HQ) */
export async function impersonateDealer(code: string): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  if (DATA_SOURCE !== "supabase") {
    return { ok: false, error: "โหมดเดโม: ไม่ต้องขอลิงก์ — ใช้ปุ่มเข้าระบบแทนแบบเดโมได้เลย" };
  }
  const token = await callerToken();
  if (!token) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };
  try {
    const res = await fetch(`/api/admin/dealers/impersonate?code=${encodeURIComponent(code)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; link?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `เซิร์ฟเวอร์ตอบกลับ ${res.status}` };
    return { ok: true, link: json.link ?? "" };
  } catch (e) {
    return { ok: false, error: friendlyError(e, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้") };
  }
}

/** ลบตัวแทนจริง (auth ของผู้ใช้สังกัดสาขา + แถว dealers) ผ่าน Route Handler ฝั่งเซิร์ฟเวอร์
 *  เดิมลบผ่าน repo ตรง ๆ ได้แค่แถว dealers → บัญชี auth ของสาขายังค้างเป็นบัญชีกำพร้า */
export async function deleteDealerAccount(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (DATA_SOURCE !== "supabase") {
    return { ok: false, error: "โหมดเดโม: ลบบัญชีจริงไม่ได้ (ต้องมีระบบยืนยันตัวตน)" };
  }
  const token = await callerToken();
  if (!token) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };
  try {
    const res = await fetch(`/api/admin/dealers?code=${encodeURIComponent(code)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `เซิร์ฟเวอร์ตอบกลับ ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้") };
  }
}
