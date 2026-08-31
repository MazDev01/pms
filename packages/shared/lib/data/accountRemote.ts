// ── บัญชีเข้าระบบของตัวแทน — โหมดจริง (คุยกับ API ของสำนักงานใหญ่) ──────────────
//
// ทำไมต้องผ่านแอปสำนักงานใหญ่ (บอสตัดสิน 28 ส.ค. 69):
//   คีย์ผู้ดูแลระบบ (service role) กับกุญแจถอดรหัสสำเนารหัสผ่าน (DEALER_SECRET_KEY)
//   อยู่ที่แอปสำนักงานใหญ่ที่เดียวโดยตั้งใจ — แอปตัวแทนไม่มี และไม่ควรมี
//   ถ้าให้แอปตัวแทนเปลี่ยนบัญชีเองตรง ๆ สำนักงานใหญ่จะเปิดดูรหัสที่ตัวแทนตั้งไม่ได้เลย
//
// การยืนยันตัวตน: ส่งใบผ่านของ "ตัวแทนคนที่กำลังใช้งาน" ไปกับคำขอ (Bearer)
//   ฝั่งเซิร์ฟเวอร์ตรวจว่าใบผ่านนี้เป็นของสาขานั้นจริงก่อนทำอะไร — ไม่เชื่อรหัสสาขาที่ส่งมา

import type { AccountChangeResult, AccountRepo, AccountRequest, AccountState } from "./ports";
import { getAccessToken } from "./supabase/client";

/** ที่อยู่แอปสำนักงานใหญ่ — ตั้งใน .env (NEXT_PUBLIC_HQ_ORIGIN) · แอป HQ เองเรียกที่ตัวเอง */
function hqOrigin(): string {
  const ตั้งไว้ = process.env.NEXT_PUBLIC_HQ_ORIGIN;
  if (ตั้งไว้) return ตั้งไว้.replace(/\/$/, "");
  // แอป HQ เรียกเส้นทางของตัวเอง (same-origin) — แอปตัวแทนที่ยังไม่ตั้งค่าจะได้ error ที่อ่านออก
  if (typeof window !== "undefined" && process.env.PMS_APP === "hq") return window.location.origin;
  return "";
}

async function ยิง<T>(path: string, init?: RequestInit): Promise<T> {
  const origin = hqOrigin();
  if (!origin && process.env.PMS_APP !== "hq") {
    throw new Error("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_HQ_ORIGIN — เปลี่ยนบัญชีเข้าระบบจากหน้านี้ยังไม่ได้");
  }
  const token = await getAccessToken();
  const res = await fetch(`${origin}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(body?.error || `คำขอไม่สำเร็จ (${res.status})`);
  return body as T;
}

export const accountRemote: AccountRepo = {
  state: (dealerCode) =>
    ยิง<AccountState>(`/api/account?code=${encodeURIComponent(dealerCode)}`),

  change: (input) =>
    ยิง<AccountChangeResult>("/api/account", { method: "POST", body: JSON.stringify(input) }),

  listRequests: () =>
    ยิง<{ requests: AccountRequest[] }>("/api/admin/dealers/account-requests").then(r => r.requests),

  decide: (id, action, reason) =>
    ยิง<{ ok: true }>("/api/admin/dealers/account-requests", {
      method: "PATCH",
      body: JSON.stringify({ id, action, reason }),
    }).then(() => undefined),
};
